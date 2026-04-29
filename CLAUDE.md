# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
# Install dependencies
uv sync

# Start backend (hot-reload)
uv run python -m uvicorn main:app --reload
# Runs at http://127.0.0.1:8000

# CLI: ingest a file or directory
uv run python src/scripts/ingest.py --input ./data/uploads/note.md
uv run python src/scripts/ingest.py --input ./data

# CLI: query (ad-hoc)
uv run python src/scripts/query.py

# CLI: reset all databases
uv run python src/scripts/reset.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
npm run build  # outputs to frontend/dist (served by FastAPI in production)
```

### Required external services (must be running before backend starts)
- **Neo4j** — local instance at `neo4j://127.0.0.1:7687` (Neo4j Desktop or Docker)
- **Ollama** — local embedding server at `http://localhost:11434`, with `nomic-embed-text` pulled; LLM calls go to a remote Ollama endpoint configured via env vars

## Environment variables

Copy `.env.example` to `.env` and fill in:

| Variable | Purpose |
|---|---|
| `OLLAMA_API_KEY` | Auth token for remote Ollama endpoint |
| `OLLAMA_BASE_URL` | Remote Ollama base URL |
| `LLM_MODEL` | Model name (default: `gemma4:31b-cloud`) |
| `NEO4J_URI` | Neo4j bolt URI (default: `neo4j://127.0.0.1:7687`) |
| `NEO4J_USERNAME` / `NEO4J_PASSWORD` | Neo4j credentials |
| `CHROMA_PERSIST_DIR` | ChromaDB storage path (default: `./chroma_db`) |
| `EMBEDDING_MODEL` | Ollama embedding model (default: `nomic-embed-text`) |
| `EMBEDDING_BASE_URL` | Local Ollama URL for embeddings (default: `http://localhost:11434`) |

## Architecture

### Overview
GraphRAG system with a React frontend, FastAPI backend, LangGraph agents, Neo4j knowledge graph, and ChromaDB vector store.

```
User → React (Vite) → FastAPI → LangGraph Supervisor
                                    ├── retrieve_node → ChromaDB (semantic) + Neo4j (graph)
                                    └── generate_node → Ollama LLM
```

### Backend (`src/`)

**`main.py`** — FastAPI entry point. Mounts all routers; CORS allows only `localhost:5173` / `127.0.0.1:5173`. In production, serves `frontend/dist` as an SPA via `StaticFiles` when that directory exists. `lifespan` closes the Neo4j driver on shutdown.

**`src/api/deps.py`** — single source of truth for all singletons. `Neo4jClient`, `ChromaClient`, and the LLM are each created once via `@lru_cache`. `get_compiled_graph()` composes them into a compiled LangGraph. FastAPI routers receive these via `Depends(...)`. Every singleton function **must** keep `@lru_cache()` — removing it causes the object to be rebuilt on every request.

**`src/agents/supervisor.py`** — LangGraph `StateGraph` with a linear flow: `retrieve → generate`. `AgentState` carries `question`, `context`, `answer`, and `debug`.

**`src/agents/retriever.py`** — dual-engine retrieval: (1) vector search via ChromaDB, (2) LLM extracts entities from the question, (3) Neo4j graph traversal per entity, (4) merged context string returned. ChromaDB failures are caught and skipped so graph-only context still flows through.

**`src/scripts/ingest.py`** — file ingestion pipeline for `.md`, `.txt`, `.pdf`, `.docx` (defined in `SUPPORTED_EXTENSIONS`). `.md` files use `MarkdownHeaderTextSplitter` then `RecursiveCharacterTextSplitter` (500 chars, 50 overlap); other formats use LangChain community loaders then the same splitter. For each chunk: embeds into ChromaDB and calls LLM to extract entities/relations for Neo4j. `ingest_file_stream()` is a generator that yields NDJSON progress events.

**`src/api/ingest.py`** — wraps `ingest_file_stream()` in a `StreamingResponse` with `media_type="application/x-ndjson"`. Files are saved to `data/uploads/`. Uses the async/sync bridge pattern: `asyncio.to_thread` + `asyncio.Queue` + `loop.call_soon_threadsafe` to push sync generator output into an async response.

**`src/api/chat.py`** — accepts `POST /api/chat` with `{question, debug}`. Invokes the compiled LangGraph and returns `{answer, debug}`. Set `debug: true` in the request body to receive the full retrieval trace (vector results, extracted entities, graph results, merged context, answer prompt).

**`src/database/neo4j_client.py`** — all Neo4j operations. Uses `_sanitize()` (regex `[^\w\s一-鿿㐀-䶿-]`) to strip unsafe characters before interpolating dynamic labels/relationship types into Cypher f-strings. Named parameters (`$name`, `$source`, etc.) handle all user-supplied data values. Entity labels in Neo4j are `Entity` plus a second type-label (e.g., `Entity:概念`).

**`src/database/chroma_client.py`** — wraps ChromaDB `PersistentClient`. Embeddings generated locally via Ollama. Falls back gracefully when embedding returns NaN — upstream retriever catches the exception and continues with graph-only context.

### Frontend (`frontend/src/`)

**`store/useStore.js`** — single Zustand store. Key state: `graphData` (nodes+links), `graphVersion` (increments on `setGraphData`; used as `key` prop on ForceGraph2D to force remount), `selectedNode`, `expandedNodes` (Set), `viewMode` ('graph' | 'document'), `messages`, `stats`, `theme` ('light' | 'dark', persisted in `localStorage`). `mergeGraphData` deduplicates before merging expanded node results.

**`lib/api.js`** — axios instance (`baseURL` from `VITE_API_URL` or `http://localhost:8000`, timeout 120s). `uploadFile()` uses `fetch` directly to read the NDJSON stream and call `onProgress` per line.

**Component responsibilities:**
- `GraphView` — renders `react-force-graph-2d`. Left-click selects node and centers camera; right-click triggers `expandNode` API and merges result (skipped if already expanded). `onEngineStop` freezes all settled nodes via `fx`/`fy` so subsequent expansions don't disturb them. Node type colors: 概念 indigo, 技術 cyan, 工具 amber, 人物 pink, default slate.
- `NodeInfoPanel` — shows selected node details; has "Ask AI" button that pre-fills chat input
- `ChatWindow` — sends to `/api/chat`, displays answer
- `FileUpload` — drag-and-drop or click to upload `.md`, `.txt`, `.pdf`, `.docx`; shows streaming progress bar
- `DocumentView` — lists uploaded files and renders selected file (markdown/txt as text, docx as extracted text, pdf via iframe)
- `StatsBar` — polls `/api/graph/stats`
- `ResetButton` — calls `/api/reset`, then resets Zustand store

### Data flow for document ingestion
1. Frontend uploads file → `POST /api/ingest` (multipart)
2. Backend saves file to `data/uploads/`, calls `ingest_file_stream()`
3. Each chunk: embedded → ChromaDB; LLM extracts entities/relations → Neo4j
4. Progress events streamed as NDJSON; frontend parses line-by-line
5. On success, frontend re-fetches graph init and stats

### Key invariants

**`@lru_cache` on every singleton in `deps.py`** — missing it causes the object (e.g. compiled LangGraph) to be rebuilt on every request.

**Async/sync bridge pattern** — when a sync generator needs to stream into an async `StreamingResponse`, use `asyncio.to_thread` + `asyncio.Queue` + `loop.call_soon_threadsafe`. See `src/api/ingest.py` `stream_generator()` for the reference implementation.

**`graphVersion` as ForceGraph2D `key`** — `setGraphData` increments `graphVersion`; passing it as `key` to `<ForceGraph2D>` forces a full remount and re-runs D3 forces. `mergeGraphData` (node expand) does not increment it, so the settled layout is preserved during incremental additions.

**Node freeze after simulation** — `onEngineStop` pins each node by setting `fx = x` / `fy = y`. Right-click node-expand adds new nodes at undetermined positions without disturbing already-pinned nodes.
