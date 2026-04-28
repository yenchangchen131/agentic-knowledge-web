# src/api/deps.py
"""共用依賴注入：DB Client 與 LLM 單例管理"""
import logging
from functools import lru_cache

from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient
from src.scripts.llm import create_llm
from src.agents.supervisor import create_graph

logger = logging.getLogger(__name__)


@lru_cache()
def get_neo4j() -> Neo4jClient:
    """取得 Neo4jClient 單例"""
    logger.info("初始化 Neo4jClient 單例")
    return Neo4jClient()


@lru_cache()
def get_chroma() -> ChromaClient:
    """取得 ChromaClient 單例"""
    logger.info("初始化 ChromaClient 單例")
    return ChromaClient()


@lru_cache()
def get_llm():
    """取得 LLM 單例"""
    logger.info("初始化 LLM 單例")
    return create_llm()


@lru_cache()
def get_compiled_graph():
    """取得已編譯的 LangGraph 單例"""
    return create_graph(get_neo4j(), get_chroma(), get_llm())
