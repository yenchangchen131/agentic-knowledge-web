# src/agents/supervisor.py
import logging
from typing import TypedDict, Any
from langgraph.graph import StateGraph, START, END
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))
from src.agents.retriever import retrieve
from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient

logger = logging.getLogger(__name__)

ANSWER_PROMPT = """你是一個知識助理。根據以下檢索到的上下文，回答使用者的問題。
如果上下文中沒有相關資訊，請誠實地說你不知道。

上下文：
{context}

問題：{question}

請用繁體中文回答："""


class AgentState(TypedDict):
    question: str   # 使用者問題
    context: str    # 檢索到的 context
    answer: str     # LLM 生成的答案
    debug: dict     # 中間過程的 debug 資訊


def create_graph(neo4j: Neo4jClient, chroma: ChromaClient, llm):
    """
    建立 LangGraph Supervisor 狀態機。

    PoC 流程（線性）：
        START → retrieve_node → generate_node → END
    """

    def retrieve_node(state: AgentState) -> dict:
        """呼叫 Retriever Agent 取得合併的 context"""
        logger.info("執行 retrieve_node...")
        result = retrieve(state["question"], chroma, neo4j, llm)
        return {"context": result["context"], "debug": result["debug"]}

    def generate_node(state: AgentState) -> dict:
        """根據 context 用 LLM 生成答案"""
        logger.info("執行 generate_node...")
        prompt = ANSWER_PROMPT.format(
            context=state["context"],
            question=state["question"]
        )
        response = llm.invoke(prompt)
        # 將 prompt 也記錄到 debug
        debug = state.get("debug", {})
        debug["answer_prompt"] = prompt
        debug["raw_answer"] = response.content
        return {"answer": response.content, "debug": debug}

    # 建立 StateGraph
    graph = StateGraph(AgentState)
    graph.add_node("retrieve", retrieve_node)
    graph.add_node("generate", generate_node)

    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)

    return graph.compile()
