# src/api/ingest.py
"""文件上傳與知識寫入 API"""
import logging
from pathlib import Path
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import json

from src.scripts.ingest import ingest_file_stream
from src.api.deps import get_neo4j, get_chroma, get_llm

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["ingest"])

UPLOAD_DIR = Path("data/uploads")





@router.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    neo4j=Depends(get_neo4j),
    chroma=Depends(get_chroma),
    llm=Depends(get_llm)
):
    """上傳 Markdown 檔案並即時透過 NDJSON 串流回傳知識庫匯入進度"""
    if not file.filename or not file.filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="僅接受 .md 格式的檔案")

    # 確保上傳目錄存在
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # 儲存上傳檔案
    file_path = UPLOAD_DIR / file.filename
    content = await file.read()
    file_path.write_bytes(content)
    logger.info("檔案已儲存: %s", file_path)

    async def stream_generator():
        try:
            # 遍歷執行 ingest_file_stream (同步)
            # 在真實生產環境中，長時間的同步 IO 可能需要放進 run_in_threadpool
            # 這裡為了展示單純串流進度將直接執行並 yield。
            for progress_data in ingest_file_stream(str(file_path), neo4j, chroma, llm):
                yield json.dumps(progress_data) + "\n"
        except Exception as e:
            logger.error("Ingest 失敗: %s", e)
            yield json.dumps({"status": "error", "error": str(e)}) + "\n"

    return StreamingResponse(stream_generator(), media_type="application/x-ndjson")
