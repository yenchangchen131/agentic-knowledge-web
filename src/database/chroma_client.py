# src/database/chroma_client.py
import logging
import os
from chromadb import PersistentClient
from langchain_ollama import OllamaEmbeddings

logger = logging.getLogger(__name__)

class ChromaClient:
    def __init__(self):
        self.client = PersistentClient(
            path=os.getenv("CHROMA_PERSIST_DIR", "./chroma_db")
        )
        self.embeddings = OllamaEmbeddings(
            model=os.getenv("EMBEDDING_MODEL", "nomic-embed-text"),
            base_url=os.getenv("EMBEDDING_BASE_URL", "http://localhost:11434")
        )
        self.collection = self.client.get_or_create_collection(
            name="knowledge_web"
        )
        logger.info("ChromaClient 初始化完成，目前 chunk 數量: %d", self.collection.count())

    def reset_collection(self):
        """刪除並重建 Collection，確保 reference 是最新的"""
        try:
            self.client.delete_collection("knowledge_web")
        except Exception as e:
            logger.warning("刪除 ChromaDB Collection 時發生狀況: %s", e)
        self.collection = self.client.get_or_create_collection("knowledge_web")
        logger.info("ChromaDB Collection 已重置並重建")

    def _sanitize_metadata(self, metadata: dict) -> dict:
        """過濾 metadata 中 Chroma 不支援的值（None、nested dict、list）"""
        clean = {}
        for key, value in metadata.items():
            if value is None:
                continue
            if isinstance(value, (str, int, float, bool)):
                clean[key] = value
            else:
                clean[key] = str(value)
        return clean

    def exists(self, chunk_id: str) -> bool:
        result = self.collection.get(ids=[chunk_id])
        return len(result["ids"]) > 0

    def add_chunk(self, chunk_id: str, text: str, metadata: dict | None = None):
        if metadata is None:
            metadata = {}
        metadata = self._sanitize_metadata(metadata)
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

    def update_chunk(self, chunk_id: str, text: str, metadata: dict | None = None):
        if metadata is None:
            metadata = {}
        metadata = self._sanitize_metadata(metadata)
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