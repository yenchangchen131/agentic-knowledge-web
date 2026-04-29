# src/api/documents.py
import logging
import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from src.scripts.ingest import SUPPORTED_EXTENSIONS

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/documents", tags=["documents"])

UPLOAD_DIR = Path("data/uploads")


@router.get("")
def list_documents():
    """列出所有上傳的筆記檔案"""
    if not UPLOAD_DIR.exists():
        return {"documents": []}

    docs = []
    for file_path in UPLOAD_DIR.iterdir():
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            stats = file_path.stat()
            docs.append({
                "filename": file_path.name,
                "size": stats.st_size,
                "modified_time": stats.st_mtime,
                "type": file_path.suffix.lower().lstrip(".")
            })

    docs.sort(key=lambda x: x["modified_time"], reverse=True)
    return {"documents": docs}


@router.get("/{filename}/raw")
def get_document_raw(filename: str):
    """回傳原始檔案（帶正確 Content-Type），供 PDF iframe 使用"""
    file_path = UPLOAD_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="找不到指定檔案")
    mime_type, _ = mimetypes.guess_type(str(file_path))
    return FileResponse(str(file_path), media_type=mime_type or "application/octet-stream")


@router.get("/{filename}")
def get_document(filename: str):
    """讀取指定檔案內容，以 JSON 回傳 {type, content, url}"""
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"僅允許讀取 {', '.join(sorted(SUPPORTED_EXTENSIONS))} 檔案")

    file_path = UPLOAD_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="找不到指定檔案")

    try:
        if ext == ".pdf":
            return {"type": "pdf", "content": None, "url": f"/api/documents/{filename}/raw"}

        if ext == ".docx":
            import docx2txt
            content = docx2txt.process(str(file_path))
            return {"type": "docx", "content": content or "", "url": None}

        # .md / .txt
        content = file_path.read_text(encoding="utf-8")
        return {"type": ext.lstrip("."), "content": content, "url": None}

    except Exception as e:
        logger.error("讀取檔案失敗: %s", e)
        raise HTTPException(status_code=500, detail="讀取檔案失敗")
