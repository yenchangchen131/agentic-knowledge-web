# Agentic Knowledge Web

> 從碎片到知識網：基於 GraphRAG 與 Multi-agent 的智能筆記系統

## Overview

傳統筆記工具（Notion、本地資料夾）面臨兩個核心問題：

* **知識孤島** ：跨平台散落，筆記之間缺乏有意義的關聯。
* **缺乏智能引導** ：只能查「已知」的關鍵字，無法回答「未知」的跨概念問題。

本專案目標是打造一個 **自動化、具備記憶的個人知識助理** ，結合 Multi-agent 框架與 GraphRAG，讓筆記從被動的資料儲存，進化為主動的推理夥伴。

## System Architecture

```
Input (Markdown / Code)
        │
        ▼
  Supervisor Agent        ← LangGraph 狀態機，判斷使用者意圖
        │
   ┌────┴────┐
   ▼         ▼
知識萃取    查詢檢索
 Agent      Agent
   │         │
   ▼         ▼
Neo4j     Chroma
(Graph DB) (Vector DB)
        │
        ▼
   LLM 生成答案
        │
        ▼
      Output
```

**技術棧：**

* **大腦層** ：LangGraph + Multi-agent（Supervisor + Worker Agents）
* **記憶層** ：Neo4j（知識圖譜）+ Chroma（向量資料庫）
* **檢索** ：GraphRAG（Local Search + Global Search）
* **LLM** ：OpenAI GPT-4o

## Core Features（PoC 範圍）

* [ ] Markdown 筆記解析與 Chunking
* [ ] LLM 自動抽取實體與關係，寫入 Neo4j
* [ ] Embedding 寫入 Chroma
* [ ] LangGraph Supervisor + 查詢 Agent
* [ ] 雙引擎檢索（Vector + Graph）並合併 Context
* [ ] 端對端 Q&A Demo

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/yenchangchen131/agentic-knowledge-web.git
cd agentic-knowledge-web

# 2. 安裝套件
pip install -r requirements.txt

# 3. 設定環境變數
cp .env.example .env
# 填入 OPENAI_API_KEY

# 4. 啟動 Neo4j（Docker）
docker run -d \
  --name neo4j-poc \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest

# 5. 執行寫入流程
python src/ingest.py --input data/sample_notes/

# 6. 執行查詢
python src/query.py --question "GraphRAG 和傳統 RAG 的差異是什麼？"
```

## Project Structure

```
agentic-knowledge-web/
├── data/
│   └── sample_notes/        # 測試用 Markdown 筆記
├── src/
│   ├── ingest.py            # 寫入流程（Chunking → Extraction → Loading）
│   ├── query.py             # 查詢入口
│   ├── agents/
│   │   ├── supervisor.py    # Supervisor Agent
│   │   └── retriever.py     # 查詢檢索 Agent
│   └── graph/
│       ├── neo4j_client.py  # Neo4j 操作
│       └── chroma_client.py # Chroma 操作
├── .env.example
├── requirements.txt
└── README.md
```

## Development Roadmap

| 階段  | 內容                      | 預計完成 |
| ----- | ------------------------- | -------- |
| PoC   | 寫入流程 + 基本 Q&A       | 4/20     |
| v0.2  | Self-Correction Loop      | 4/27     |
| v0.3  | Human-in-the-loop         | 5/4      |
| Final | 路徑規劃 Agent + 完整評估 | 5/11     |

## References

* [GraphRAG (Microsoft)](https://github.com/microsoft/graphrag)
* [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
* [Neo4j Python Driver](https://neo4j.com/docs/python-manual/current/)
