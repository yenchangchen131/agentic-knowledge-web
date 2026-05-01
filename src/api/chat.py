# src/api/chat.py
"""Agent 聊天 API"""
import logging
from pathlib import Path
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.api.deps import get_compiled_graph

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    debug: bool = False


class ChatResponse(BaseModel):
    answer: str
    extracted_entities: list[str] = []
    used_entities: list[str] = []
    numbered_sources: list[str] = []
    cited_sources: list[str] = []
    debug: dict | None = None


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, graph=Depends(get_compiled_graph)):
    """呼叫 LangGraph Agent 回答使用者問題"""
    logger.info("收到聊天請求: %s", req.question)

    result = graph.invoke({
        "question": req.question,
        "context": "",
        "answer": "",
        "debug": {}
    })

    debug_info = result.get("debug", {})

    extracted_entities = debug_info.get("extracted_entities", [])
    graph_results = debug_info.get("graph_results", [])
    used_entities = [item["entity"] for item in graph_results if item.get("related")]
    vector_results = debug_info.get("vector_results", [])
    numbered_sources = [
        Path(r["metadata"].get("source", "")).name
        for r in vector_results
    ]
    cited_sources = list(dict.fromkeys(s for s in numbered_sources if s))

    return ChatResponse(
        answer=result["answer"],
        extracted_entities=extracted_entities,
        used_entities=used_entities,
        numbered_sources=numbered_sources,
        cited_sources=cited_sources,
        debug=debug_info if req.debug else None,
    )

