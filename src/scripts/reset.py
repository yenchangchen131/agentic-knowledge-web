# src/scripts/reset_db.py
import logging
from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def reset_neo4j():
    client = Neo4jClient()
    logger.info("開始清空 Neo4j...")
    with client.driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    logger.info("Neo4j 已清空！")
    client.close()

def reset_chroma():
    client = ChromaClient()
    logger.info("開始清空 ChromaDB...")
    try:
        # 直接刪除名為 knowledge_web 的 Collection
        client.client.delete_collection("knowledge_web")
        logger.info("ChromaDB 的 knowledge_web Collection 已清空並刪除！")
    except Exception as e:
        logger.warning(f"清除 ChromaDB 時發生狀況 (可能原本就是空的): {e}")

if __name__ == "__main__":
    confirm = input("⚠️ 警告：這將會刪除所有 Neo4j 和 Chroma 的資料！確定要繼續嗎？(y/n): ")
    if confirm.lower() == 'y':
        reset_neo4j()
        reset_chroma()
        print("✅ 所有資料庫皆已重置完畢。")
    else:
        print("已取消操作。")