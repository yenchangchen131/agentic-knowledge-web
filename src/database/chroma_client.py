# src/database/chroma_client.py
import logging
from chromadb import PersistentClient
from langchain_openai import OpenAIEmbeddings
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

class ChromaClient:
    def __init__(self):
        self.client = PersistentClient(
            path=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        )
        self.embeddings = OpenAIEmbeddings(
            api_key=os.getenv("OPENAI_API_KEY"),
            model="text-embedding-3-small"
        )
        self.collection = self.client.get_or_create_collection(
            name="knowledge_web"
        )
        logger.info("ChromaClient 初始化完成，目前 chunk 數量: %d", self.collection.count())

    def exists(self, chunk_id: str) -> bool:
        """檢查某個 chunk 是否已存在"""
        result = self.collection.get(ids=[chunk_id])
        return len(result["ids"]) > 0

    def add_chunk(self, chunk_id: str, text: str, metadata: dict = {}):
        """寫入一個文字 chunk 及其 embedding，若已存在則跳過"""
        if self.exists(chunk_id):
            logger.debug("chunk 已存在，跳過: %s", chunk_id)
            return
        embedding = self.embeddings.embed_query(text)
        self.collection.add(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata]
        )
        logger.info("chunk 寫入成功: %s", chunk_id)

    def update_chunk(self, chunk_id: str, text: str, metadata: dict = {}):
        """更新已存在的 chunk"""
        if not self.exists(chunk_id):
            logger.warning("chunk 不存在，無法更新: %s", chunk_id)
            return
        embedding = self.embeddings.embed_query(text)
        self.collection.update(
            ids=[chunk_id],
            embeddings=[embedding],
            documents=[text],
            metadatas=[metadata]
        )
        logger.info("chunk 更新成功: %s", chunk_id)

    def delete_chunk(self, chunk_id: str):
        """刪除某個 chunk"""
        if not self.exists(chunk_id):
            logger.warning("chunk 不存在，無法刪除: %s", chunk_id)
            return
        self.collection.delete(ids=[chunk_id])
        logger.info("chunk 刪除成功: %s", chunk_id)

    def query(self, question: str, n_results: int = 3) -> list:
        """用自然語言查詢最相似的 chunks"""
        logger.info("向量查詢: %s", question)
        embedding = self.embeddings.embed_query(question)
        results = self.collection.query(
            query_embeddings=[embedding],
            n_results=n_results
        )
        return [
            {"text": doc, "metadata": meta}
            for doc, meta in zip(
                results["documents"][0],
                results["metadatas"][0]
            )
        ]

    def count(self) -> int:
        return self.collection.count()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    client = ChromaClient()
    print("目前 collection 數量:", client.count())