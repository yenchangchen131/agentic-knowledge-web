# src/api/documents.py
import logging
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = Path("data/uploads")


@router.get("")
def list_documents():
    """列出所有上傳的 Markdown 筆記"""
    if not UPLOAD_DIR.exists():
        return {"documents": []}
        
    docs = []
    for file_path in UPLOAD_DIR.glob("*.md"):
        stats = file_path.stat()
        docs.append({
            "filename": file_path.name,
            "size": stats.st_size,
            "modified_time": stats.st_mtime
        })
    
    # 依修改時間降序
    docs.sort(key=lambda x: x["modified_time"], reverse=True)
    return {"documents": docs}


@router.get("/{filename}")
def get_document(filename: str):
    """讀取指定的 Markdown 檔案內容"""
    if not filename.endswith(".md"):
        raise HTTPException(status_code=400, detail="僅允許讀取 .md 檔案")
        
    file_path = UPLOAD_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="找不到指定檔案")
        
    try:
        content = file_path.read_text(encoding="utf-8")
        return PlainTextResponse(content)
    except Exception as e:
        logger.error(f"讀取檔案失敗: {e}")
        raise HTTPException(status_code=500, detail="讀取檔案失敗")
