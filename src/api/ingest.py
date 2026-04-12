# src/api/ingest.py
"""文件上傳與知識寫入 API"""
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from pydantic import BaseModel

from src.scripts.ingest import ingest_file
from src.api.deps import get_neo4j, get_chroma

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ingest"])

UPLOAD_DIR = Path("data/uploads")


class IngestResponse(BaseModel):
    status: str
    filename: str
    chunks: int = 0


@router.post("/ingest", response_model=IngestResponse)
async def ingest(
    file: UploadFile = File(...),
    neo4j=Depends(get_neo4j),
    chroma=Depends(get_chroma)
):
    """上傳 Markdown 檔案並寫入知識庫"""
    if not file.filename or not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="僅接受 .md 格式的檔案")

    # 確保上傳目錄存在
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # 儲存上傳檔案
    file_path = UPLOAD_DIR / file.filename
    content = await file.read()
    file_path.write_bytes(content)
    logger.info("檔案已儲存: %s", file_path)

    # 呼叫現有的 ingest 邏輯
    try:
        chunk_count_before = chroma.count()
        ingest_file(str(file_path), neo4j, chroma)
        chunk_count_after = chroma.count()
        new_chunks = chunk_count_after - chunk_count_before

        return IngestResponse(
            status="success",
            filename=file.filename,
            chunks=new_chunks
        )
    except Exception as e:
        logger.error("Ingest 失敗: %s", e)
        raise HTTPException(status_code=500, detail=f"處理失敗: {e}")
