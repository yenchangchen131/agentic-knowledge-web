# src/api/reset.py
"""資料庫重置 API"""
import logging
from fastapi import APIRouter
from pydantic import BaseModel

from src.scripts.reset import reset_neo4j, reset_chroma

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["reset"])


class ResetResponse(BaseModel):
    status: str


@router.post("/reset", response_model=ResetResponse)
def reset():
    """清空 Neo4j 與 ChromaDB 所有資料"""
    logger.info("收到資料庫重置請求")
    try:
        reset_neo4j()
        reset_chroma()
        return ResetResponse(status="success")
    except Exception as e:
        logger.error("重置失敗: %s", e)
        return ResetResponse(status=f"error: {e}")
