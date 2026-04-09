# src/database/chroma_client.py
import logging
from chromadb import PersistentClient
from langchain_ollama import OllamaEmbeddings
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

class ChromaClient:
    def __init__(self):
        self.client = PersistentClient(
            path=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        )
        self.embeddings = OllamaEmbeddings(
            model="bge-m3",
            base_url="http://localhost:11434"
        )
        self.collection = self.client.get_or_create_collection(
            name="knowledge_web"
        )
        logger.info("ChromaClient 初始化完成，目前 chunk 數量: %d", self.collection.count())

    def exists(self, chunk_id: str) -> bool:
        result = self.collection.get(ids=[chunk_id])
        return len(result["ids"]) > 0

    def add_chunk(self, chunk_id: str, text: str, metadata: dict = {}):
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
        if not self.exists(chunk_id):
            logger.warning("chunk 不存在，無法刪除: %s", chunk_id)
            return
        self.collection.delete(ids=[chunk_id])
        logger.info("chunk 刪除成功: %s", chunk_id)

    def query(self, question: str, n_results: int = 3) -> list:
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