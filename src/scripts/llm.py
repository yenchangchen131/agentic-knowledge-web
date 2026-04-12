# src/scripts/llm.py
"""共用的 LLM 工廠函式，統一管理模型設定"""
import os
from langchain_ollama import ChatOllama
from dotenv import load_dotenv

load_dotenv()


def create_llm() -> ChatOllama:
    """建立 ChatOllama LLM 實例，設定從環境變數讀取"""
    return ChatOllama(
        model=os.getenv("LLM_MODEL", "gemma4:31b-cloud"),
        base_url=os.getenv("OLLAMA_BASE_URL", "https://ollama.com"),
        temperature=0,
        client_kwargs={
            "headers": {
                "Authorization": f"Bearer {os.environ.get('OLLAMA_API_KEY', '')}"
            }
        }
    )
