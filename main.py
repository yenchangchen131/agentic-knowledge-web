# main.py
"""Agentic Knowledge Web — FastAPI 應用程式入口"""
import logging
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from src.api import chat, ingest, reset, graph
from src.api.deps import get_neo4j

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """應用程式生命週期管理"""
    logger.info("Agentic Knowledge Web 啟動中...")
    yield
    # 關閉資源
    try:
        neo4j = get_neo4j()
        neo4j.close()
        logger.info("Neo4j 連線已關閉")
    except Exception:
        pass
    logger.info("Agentic Knowledge Web 已關閉")


app = FastAPI(
    title="Agentic Knowledge Web",
    description="互動式知識圖譜 RAG 系統 API",
    version="0.1.0",
    lifespan=lifespan
)

# CORS 設定 — 允許前端開發伺服器
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",   # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 掛載 API Router
app.include_router(chat.router)
app.include_router(ingest.router)
app.include_router(reset.router)
app.include_router(graph.router)

# 生產環境：serve 前端 build 產物
frontend_dist = Path("frontend/dist")
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="spa")
    logger.info("已掛載前端靜態檔案: frontend/dist")
