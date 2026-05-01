# src/api/reset.py
"""資料庫重置 API"""
import logging
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.scripts.reset import reset_neo4j, reset_chroma, reset_uploads
from src.api.deps import get_neo4j, get_chroma

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["reset"])


class ResetResponse(BaseModel):
    status: str


@router.post("/reset", response_model=ResetResponse)
def reset(neo4j=Depends(get_neo4j), chroma=Depends(get_chroma)):
    """清空 Neo4j 與 ChromaDB 所有資料"""
    logger.info("收到資料庫重置請求")
    try:
        reset_neo4j(client=neo4j)
        reset_chroma(client=chroma)
        reset_uploads()
        return ResetResponse(status="success")
    except Exception as e:
        logger.error("重置失敗: %s", e)
        raise HTTPException(status_code=500, detail=f"重置失敗: {e}")

