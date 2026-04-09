# src/agents/retriever.py
import logging
import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))
from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient

logger = logging.getLogger(__name__)

ENTITY_EXTRACT_PROMPT = """從以下問題中抽取關鍵實體名稱（人名、技術、工具、概念等）。
只回傳 JSON 陣列，不要有其他文字。

問題：{question}

範例回傳：["GraphRAG", "Neo4j"]
"""


def extract_entities(question: str, llm) -> list:
    """用 LLM 從問題中抽取關鍵實體"""
    prompt = ENTITY_EXTRACT_PROMPT.format(question=question)
    response = llm.invoke(prompt)
    content = response.content.strip()
    # 清理 LLM 可能回傳的 markdown 代碼塊
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    try:
        entities = json.loads(content)
        return entities if isinstance(entities, list) else []
    except json.JSONDecodeError:
        logger.warning("實體抽取格式錯誤: %s", content)
        return []


def retrieve(question: str, chroma: ChromaClient, neo4j: Neo4jClient, llm) -> dict:
    """
    雙引擎檢索：Vector（Chroma）+ Graph（Neo4j），合併為統一 context。

    回傳 dict 包含：
    - context: 合併後的 context 字串
    - debug: 中間過程的詳細資訊

    流程：
    1. 向量檢索 — 取得語義相關的文字片段
    2. 實體抽取 — 用 LLM 從問題抽取關鍵實體
    3. 圖譜檢索 — 查詢每個實體的圖譜關聯
    4. 合併 context — 結構化輸出
    """
    debug = {}

    # 1. Vector search
    logger.info("開始向量檢索...")
    vector_results = chroma.query(question, n_results=3)
    logger.info("向量檢索完成，取得 %d 筆結果", len(vector_results))
    debug["vector_results"] = vector_results

    # 2. Extract entities from question
    logger.info("抽取問題中的實體...")
    entities = extract_entities(question, llm)
    logger.info("抽取到的實體: %s", entities)
    debug["extracted_entities"] = entities

    # 3. Graph search
    logger.info("開始圖譜檢索...")
    graph_results = []
    for entity in entities:
        related = neo4j.query_related(entity)
        if related:
            graph_results.append({"entity": entity, "related": related})
    logger.info("圖譜檢索完成，找到 %d 個實體的關聯", len(graph_results))
    debug["graph_results"] = graph_results

    # 4. Merge context
    context_parts = []

    if vector_results:
        context_parts.append("【向量檢索結果】")
        for i, result in enumerate(vector_results, 1):
            context_parts.append(f"{i}. {result['text']}")

    if graph_results:
        context_parts.append("\n【知識圖譜檢索結果】")
        for item in graph_results:
            relations_str = ", ".join(
                f"{r['relation']} → {r['name']}" for r in item["related"]
            )
            context_parts.append(f"- {item['entity']}: {relations_str}")

    if not context_parts:
        context = "（未找到相關資訊）"
    else:
        context = "\n".join(context_parts)

    logger.info("合併 context 完成，長度: %d 字元", len(context))
    debug["merged_context"] = context

    return {"context": context, "debug": debug}
