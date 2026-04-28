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

**`src/api/deps.py`** — single source of truth for all singletons. `Neo4jClient`, `ChromaClient`, and the LLM are each created once via `@lru_cache`. `get_compiled_graph()` composes them into a compiled LangGraph. FastAPI routers receive these via `Depends(...)`.

**`src/agents/supervisor.py`** — LangGraph `StateGraph` with a linear flow: `retrieve → generate`. `AgentState` carries `question`, `context`, `answer`, and `debug`.

**`src/agents/retriever.py`** — dual-engine retrieval: (1) vector search via ChromaDB, (2) LLM extracts entities from the question, (3) Neo4j graph traversal per entity, (4) merged context string returned.

**`src/scripts/ingest.py`** — Markdown ingestion pipeline. Splits files with `MarkdownHeaderTextSplitter` then `RecursiveCharacterTextSplitter` (500 chars, 50 overlap). For each chunk: embeds into ChromaDB and calls LLM to extract entities/relations for Neo4j. `ingest_file_stream()` is a generator that yields NDJSON progress events.

**`src/api/ingest.py`** — wraps `ingest_file_stream()` in a `StreamingResponse` with `media_type="application/x-ndjson"`. Files are saved to `data/uploads/`.

**`src/database/neo4j_client.py`** — all Neo4j operations. Uses `_sanitize()` (regex allowlist) to prevent Cypher injection before interpolating dynamic labels/relationship types into queries. Entity labels in Neo4j are `Entity` plus a second type-label (e.g., `Entity:概念`).

**`src/database/chroma_client.py`** — wraps ChromaDB `PersistentClient`. Embeddings generated locally via Ollama. Falls back gracefully when embedding returns NaN — upstream retriever catches the exception and continues with graph-only context.

### Frontend (`frontend/src/`)

**`store/useStore.js`** — single Zustand store. Key state: `graphData` (nodes+links), `selectedNode`, `expandedNodes` (Set), `viewMode` ('graph' | 'document'), `messages`, `stats`. `mergeGraphData` deduplicates before merging expanded node results.

**`lib/api.js`** — axios instance (`baseURL` from `VITE_API_URL` or `http://localhost:8000`, timeout 120s). `uploadFile()` uses `fetch` directly to read the NDJSON stream and call `onProgress` per line.

**Component responsibilities:**
- `GraphView` — renders `react-force-graph-2d`; left-click selects node, right-click triggers `expandNode` API and merges result
- `NodeInfoPanel` — shows selected node details; has "Ask AI" button that pre-fills chat input
- `ChatWindow` — sends to `/api/chat`, displays answer
- `FileUpload` — drag-and-drop or click to upload `.md`, shows streaming progress bar
- `DocumentView` — lists uploaded files and renders selected file as markdown
- `StatsBar` — polls `/api/graph/stats`
- `ResetButton` — calls `/api/reset`, then resets Zustand store

### Data flow for document ingestion
1. Frontend uploads `.md` → `POST /api/ingest` (multipart)
2. Backend saves file to `data/uploads/`, calls `ingest_file_stream()`
3. Each chunk: embedded → ChromaDB; LLM extracts entities/relations → Neo4j
4. Progress events streamed as NDJSON; frontend parses line-by-line
5. On success, frontend re-fetches graph init and stats

### Cypher injection protection
`Neo4jClient._sanitize()` strips all characters outside `[\w\s一-鿿㐀-䶿-]` before inserting dynamic values into Cypher f-strings. Named parameters (`$name`, `$source`, etc.) are used for all user-supplied data values.
