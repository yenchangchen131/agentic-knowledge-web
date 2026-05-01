# src/scripts/reset.py
"""資料庫重置邏輯，可被 API 呼叫或 CLI 直接執行"""
import logging
from pathlib import Path

from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient

UPLOAD_DIR = Path("data/uploads")

logger = logging.getLogger(__name__)


def reset_neo4j(client: Neo4jClient | None = None):
    """清空 Neo4j 所有資料。若未提供 client，則自行建立並於完成後關閉。"""
    own_client = client is None
    if own_client:
        client = Neo4jClient()
    logger.info("開始清空 Neo4j...")
    with client.driver.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    logger.info("Neo4j 已清空！")
    if own_client:
        client.close()


def reset_chroma(client: ChromaClient | None = None):
    """清空 ChromaDB 的 knowledge_web Collection。若未提供 client，則自行建立。"""
    own_client = client is None
    if own_client:
        client = ChromaClient()
    logger.info("開始清空 ChromaDB...")
    try:
        client.reset_collection()
        logger.info("ChromaDB 的 knowledge_web Collection 已清空並重建！")
    except Exception as e:
        logger.error("重置 ChromaDB 失敗: %s", e)


def reset_uploads():
    """刪除 data/uploads/ 內的所有上傳檔案（保留資料夾）"""
    if not UPLOAD_DIR.exists():
        logger.info("上傳目錄不存在，跳過")
        return
    deleted = 0
    for f in UPLOAD_DIR.iterdir():
        if f.is_file():
            f.unlink()
            deleted += 1
    logger.info("已刪除 %d 個上傳檔案", deleted)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    confirm = input("⚠️ 警告：這將會刪除所有 Neo4j 和 Chroma 的資料！確定要繼續嗎？(y/n): ")
    if confirm.lower() == 'y':
        reset_neo4j()
        reset_chroma()
        print("✅ 所有資料庫皆已重置完畢。")
    else:
        print("已取消操作。")