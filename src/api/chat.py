# src/api/chat.py
"""Agent 聊天 API"""
import logging
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from src.agents.supervisor import create_graph
from src.api.deps import get_neo4j, get_chroma, get_llm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    debug: bool = False


class ChatResponse(BaseModel):
    answer: str
    debug: dict | None = None


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, neo4j=Depends(get_neo4j), chroma=Depends(get_chroma), llm=Depends(get_llm)):
    """呼叫 LangGraph Agent 回答使用者問題"""
    logger.info("收到聊天請求: %s", req.question)

    graph = create_graph(neo4j, chroma, llm)
    result = graph.invoke({
        "question": req.question,
        "context": "",
        "answer": "",
        "debug": {}
    })

    return ChatResponse(
        answer=result["answer"],
        debug=result.get("debug") if req.debug else None
    )
