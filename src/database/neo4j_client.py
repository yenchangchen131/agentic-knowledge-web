# src/database/neo4j_client.py
import logging
from neo4j import GraphDatabase
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

class Neo4jClient:
    def __init__(self):
        self.driver = GraphDatabase.driver(
            os.getenv("NEO4J_URI"),
            auth=(os.getenv("NEO4J_USERNAME"), os.getenv("NEO4J_PASSWORD"))
        )
        logger.info("Neo4jClient 初始化完成")

    def close(self):
        self.driver.close()
        logger.info("Neo4jClient 連線關閉")

    def test_connection(self) -> bool:
        with self.driver.session() as session:
            result = session.run("RETURN 1 AS test")
            ok = result.single()["test"] == 1
            logger.info("連線測試: %s", "成功" if ok else "失敗")
            return ok
    
    def _sanitize(self, text: str) -> str:
        """過濾字串中的反引號，避免 Cypher 語法錯誤或注入風險"""
        if not text:
            return "Unknown"
        return str(text).replace("`", "").strip()

    def entity_exists(self, name: str) -> bool:
        """檢查實體是否已存在"""
        with self.driver.session() as session:
            # 只要有名稱為 name 的 Entity 就算存在
            result = session.run(
                "MATCH (n:Entity {name: $name}) RETURN count(n) AS count",
                name=name
            )
            return result.single()["count"] > 0

    def create_entity(self, name: str, entity_type: str, properties: dict = {}):
        """寫入一個實體節點，已存在則更新"""
        if properties is None:
            properties = {}

        clean_type = self._sanitize(entity_type)

        action = "更新" if self.entity_exists(name) else "寫入"

        with self.driver.session() as session:
            # 使用 f-string 動態插入標籤，並用反引號包覆處理中文或空格
            # 格式例如: MERGE (n:Entity:`概念` {name: $name})
            query = f"MERGE (n:Entity {{name: $name}}) SET n:`{clean_type}`, n += $props"
            session.run(query, name=name, props=properties)

        logger.info("實體%s成功: %s (%s)", action, name, entity_type)

    def relation_exists(self, source: str, target: str, relation_type: str) -> bool:
        """檢查關係是否已存在"""
        clean_rel = self._sanitize(relation_type)
        with self.driver.session() as session:
            # 動態插入關係類型
            query = (
                f"MATCH (a:Entity {{name: $source}})-[r:`{clean_rel}`]->(b:Entity {{name: $target}}) "
                "RETURN count(r) AS count"
            )
            result = session.run(query, source=source, target=target)
            return result.single()["count"] > 0

    def create_relation(self, source: str, target: str, relation_type: str):
        """寫入關係，已存在則跳過"""
        clean_rel = self._sanitize(relation_type)
        
        if self.relation_exists(source, target, relation_type):
            logger.debug("關係已存在，跳過: %s -[%s]-> %s", source, clean_rel, target)
            return
            
        with self.driver.session() as session:
            query = (
                "MATCH (a:Entity {name: $source}) "
                "MATCH (b:Entity {name: $target}) "
                f"MERGE (a)-[r:`{clean_rel}`]->(b)"
            )
            session.run(query, source=source, target=target)
            
        logger.info("關係寫入成功: %s -[%s]-> %s", source, clean_rel, target)

    def delete_entity(self, name: str):
        """刪除實體及其所有關係"""
        if not self.entity_exists(name):
            logger.warning("實體不存在，無法刪除: %s", name)
            return
        with self.driver.session() as session:
            session.run(
                "MATCH (n:Entity {name: $name}) DETACH DELETE n",
                name=name
            )
        logger.info("實體刪除成功: %s", name)

    def query_related(self, entity_name: str) -> list:
        """查詢與某個實體相關的所有節點"""
        logger.info("圖譜查詢: %s", entity_name)
        with self.driver.session() as session:
            result = session.run(
                "MATCH (a:Entity {name: $name})-[r]->(b) "
                "RETURN b.name AS name, type(r) AS relation",
                name=entity_name
            )
            return [{"name": r["name"], "relation": r["relation"]} for r in result]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    client = Neo4jClient()
    client.test_connection()
    client.close()