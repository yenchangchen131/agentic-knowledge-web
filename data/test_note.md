# GraphRAG 筆記

## 什麼是 GraphRAG

GraphRAG 是 Microsoft 提出的技術，結合知識圖譜與向量檢索。
相較於傳統 RAG，GraphRAG 能回答跨文件的總結性問題。

## 核心元件

GraphRAG 使用 Neo4j 儲存圖譜，使用 Chroma 儲存向量。
LLM 負責從文字中抽取實體與關係。
