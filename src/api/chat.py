# src/api/chat.py
"""Agent 聊天 API"""
import logging
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

    return ChatResponse(
        answer=result["answer"],
        debug=result.get("debug") if req.debug else None
    )

