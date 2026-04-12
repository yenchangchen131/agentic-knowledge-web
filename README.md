# Agentic Knowledge Web

> 從碎片到知識網：基於 GraphRAG 與 Multi-agent 的全端智能筆記與互動系統

## Overview

傳統筆記工具（Notion、本地資料夾）面臨兩個核心問題：

- **知識孤島**：跨平台散落，筆記之間缺乏有意義的關聯。
- **缺乏智能引導**：只能查「已知」的關鍵字，無法回答「未知」的跨概念問題。

本專案目標是打造一個**自動化、具備視覺化互動介面的個人知識助理**，結合 Multi-agent 框架與 GraphRAG，並透過 React 力導向圖譜（Force-Directed Graph）呈現，讓筆記從被動的資料儲存，進化為主動的推理夥伴與視覺化地圖。

## System Architecture

```mermaid
graph TD
    A[使用者介面 React + Vite] -->|上傳筆記 / api/ingest| B(FastAPI 後端)
    A -->|圖譜操作 / api/graph| B
    A -->|詢問 AI / api/chat| B
  
    B -.->|處理邏輯| C[Supervisor - LangGraph]
    C --> D[retrieve_node]
    D --> E[Chroma - 向量檢索]
    D --> F[LLM - 實體/關聯抽取]
    F --> G[Neo4j - 知識圖譜檢索]
    E --> H[Merged Context]
    G --> H
    H --> I[generate_node]
    I --> J[LLM - 生成精確回答]
    J -.->|回傳回答| A
```

**技術棧：**

- **前端介面**：React 19, Vite, Tailwind CSS v3, Zustand, react-force-graph-2d
- **後端 API**：FastAPI
- **大腦層**：LangGraph + Multi-agent
- **記憶層**：Neo4j（知識圖譜，本地運行）+ Chroma（向量資料庫，本地持久化）
- **RAG 檢索**：GraphRAG 概念（Vector + Graph 雙引擎）
- **LLM**：Ollama (gemma4:31b-cloud 等模型)，Embedding 使用本地 Ollama 模型 (nomic-embed-text)

## Quick Start

```bash
# 1. 取得專案原始碼
git clone https://github.com/<your-username>/agentic-knowledge-web.git
cd agentic-knowledge-web

# 2. 安裝後端 Python 套件（使用 uv）
uv sync

# 3. 設定環境變數
cp .env.example .env
# 填入 OLLAMA_API_KEY 以及本地 Neo4j 的連線設定（預設 user: neo4j, password: password）

# 4. 啟動依賴服務
# 確保你的工作環境已啟動以下兩項本地服務：
# - Neo4j 服務 (例如 Neo4j Desktop 或 Docker)
# - Ollama 服務 (需預先 run 或是 pull 相關模型)

# 5. 啟動後端 API 伺服器
uv run python -m uvicorn main:app --reload
# 伺服器將運行在 http://127.0.0.1:8000

# 6. 啟動前端開發伺服器（請另開一個終端機）
cd frontend
cmd /c npm install
cmd /c npm run dev
# 前端介面將運行在 http://localhost:5173
```

> **操作小提示**：
> 打開瀏覽器進入前端畫面後，可以直接透過畫面左下方的按鈕**拖拽或上傳 Markdown (.md) 筆記檔案**。系統會自動進行向量寫入及圖譜實體抽取，成功後圖譜將自動在畫面上渲染出來。你可以支援**點擊節點查看詳情**、**右鍵點擊展開鄰居**，以及在此同時於右側聊天室**直接對指定概念呼叫 Agent 詢問問題**。

## Project Structure

```
agentic-knowledge-web/
├── frontend/                    # Vite + React 前端專案
│   ├── src/
│   │   ├── components/          # 視覺圖譜、對話視窗、節點資訊等 UI 元件
│   │   ├── store/               # Zustand 全域狀態管理
│   │   └── lib/                 # axios API 呼叫封裝
│   └── package.json
├── src/
│   ├── api/                     # FastAPI Router 層 (chat, graph, ingest, reset)
│   ├── agents/                  # LangGraph Supervisor 與 Retriever Agents
│   ├── database/                # Neo4j 客戶端 (含圖譜檢索邏輯) 與 Chroma 客戶端
│   └── scripts/                 # CLI 與共用設定 (llm.py)
├── main.py                      # FastAPI 主程式入口點
├── pyproject.toml               # 專案 Python 依賴管理 (Hatchling)
├── .env.example                 # 環境變數範例
└── README.md
```

## Features

- **✅ 雙引擎混合檢索**：結合 Chroma 的語義相似度與 Neo4j 的知識圖譜邏輯關聯，減少大模型幻覺。
- **✅ 力導向圖譜互動化**：透過 `react-force-graph` 高效渲染巨量節點，支援拖曳探索、右鍵動態展開未知的關聯網路。
- **✅ 容錯機制與獨立運作**：具備檢索保護機制，遇到特定模型限制（如部分 Embedding 返回 NaN）時會無縫轉向純圖譜檢索。
- **✅ 一鍵整合分析**：支援從圖譜單個節點觸發聊天，引導大腦層針對單點深度推理。
