# src/database/neo4j_client.py
import logging
import os
from neo4j import GraphDatabase

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
        """過濾字串，只保留安全字元（字母、數字、中文、底線、連字號、空格），
        避免 Cypher 語法錯誤或注入風險"""
        import re
        if not text:
            return "Unknown"
        # 只保留字母、數字、中文字元、底線、連字號和空格
        cleaned = re.sub(r'[^\w\s\u4e00-\u9fff\u3400-\u4dbf-]', '', str(text)).strip()
        return cleaned if cleaned else "Unknown"

    def entity_exists(self, name: str) -> bool:
        """檢查實體是否已存在"""
        with self.driver.session() as session:
            # 只要有名稱為 name 的 Entity 就算存在
            result = session.run(
                "MATCH (n:Entity {name: $name}) RETURN count(n) AS count",
                name=name
            )
            return result.single()["count"] > 0

    def create_entity(self, name: str, entity_type: str, properties: dict | None = None, source: str | None = None):
        """寫入一個實體節點，已存在則更新；若提供 source 則追加到 sources 列表"""
        if properties is None:
            properties = {}

        clean_type = self._sanitize(entity_type)

        action = "更新" if self.entity_exists(name) else "寫入"

        with self.driver.session() as session:
            query = f"MERGE (n:Entity {{name: $name}}) SET n:`{clean_type}`, n += $props"
            session.run(query, name=name, props=properties)

            if source:
                session.run(
                    "MATCH (n:Entity {name: $name}) "
                    "SET n.sources = CASE "
                    "  WHEN n.sources IS NULL THEN [$source] "
                    "  WHEN $source IN n.sources THEN n.sources "
                    "  ELSE n.sources + [$source] "
                    "END",
                    name=name, source=source
                )

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

    def create_relation(self, source: str, target: str, relation_type: str, source_file: str | None = None):
        """寫入關係，已存在則跳過（或補充 source_file）；若提供 source_file 則追加到 sources"""
        clean_rel = self._sanitize(relation_type)

        with self.driver.session() as session:
            query = (
                "MATCH (a:Entity {name: $source}) "
                "MATCH (b:Entity {name: $target}) "
                f"MERGE (a)-[r:`{clean_rel}`]->(b)"
            )
            session.run(query, source=source, target=target)

            if source_file:
                update_q = (
                    f"MATCH (a:Entity {{name: $source}})-[r:`{clean_rel}`]->(b:Entity {{name: $target}}) "
                    "SET r.sources = CASE "
                    "  WHEN r.sources IS NULL THEN [$sf] "
                    "  WHEN $sf IN r.sources THEN r.sources "
                    "  ELSE r.sources + [$sf] "
                    "END"
                )
                session.run(update_q, source=source, target=target, sf=source_file)

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

    def get_graph_data(self, limit: int = 150) -> dict:
        """取得初始圖譜資料，轉換為前端 { nodes, links } 格式"""
        with self.driver.session() as session:
            result = session.run(
                "MATCH (n:Entity)-[r]->(m:Entity) "
                "RETURN n.name AS source_name, labels(n) AS source_labels, "
                "m.name AS target_name, labels(m) AS target_labels, "
                "type(r) AS rel_type "
                "LIMIT $limit",
                limit=limit
            )

            nodes_map = {}
            links = []

            for record in result:
                src_name = record["source_name"]
                tgt_name = record["target_name"]
                src_labels = record["source_labels"]
                tgt_labels = record["target_labels"]
                rel_type = record["rel_type"]

                # 收集節點（去重）
                if src_name and src_name not in nodes_map:
                    node_type = self._extract_type(src_labels)
                    nodes_map[src_name] = {
                        "id": src_name,
                        "type": node_type,
                        "labels": src_labels
                    }
                if tgt_name and tgt_name not in nodes_map:
                    node_type = self._extract_type(tgt_labels)
                    nodes_map[tgt_name] = {
                        "id": tgt_name,
                        "type": node_type,
                        "labels": tgt_labels
                    }

                # 收集關係
                if src_name and tgt_name:
                    links.append({
                        "source": src_name,
                        "target": tgt_name,
                        "type": rel_type
                    })

            logger.info("圖譜資料: %d 節點, %d 關係", len(nodes_map), len(links))
            return {"nodes": list(nodes_map.values()), "links": links}

    def expand_node(self, name: str) -> dict:
        """取得指定節點的第一層鄰居（雙向），回傳增量 { nodes, links }"""
        with self.driver.session() as session:
            result = session.run(
                "MATCH (a:Entity {name: $name})-[r]-(b:Entity) "
                "RETURN a.name AS a_name, labels(a) AS a_labels, "
                "b.name AS b_name, labels(b) AS b_labels, "
                "type(r) AS rel_type, "
                "startNode(r) = a AS is_outgoing",
                name=name
            )

            nodes_map = {}
            links = []

            for record in result:
                a_name = record["a_name"]
                b_name = record["b_name"]
                b_labels = record["b_labels"]
                is_outgoing = record["is_outgoing"]

                if b_name and b_name not in nodes_map:
                    node_type = self._extract_type(b_labels)
                    nodes_map[b_name] = {
                        "id": b_name,
                        "type": node_type,
                        "labels": b_labels
                    }

                if a_name and b_name:
                    if is_outgoing:
                        links.append({"source": a_name, "target": b_name, "type": record["rel_type"]})
                    else:
                        links.append({"source": b_name, "target": a_name, "type": record["rel_type"]})

            logger.info("展開節點 %s: %d 鄰居, %d 關係", name, len(nodes_map), len(links))
            return {"nodes": list(nodes_map.values()), "links": links}

    def get_entity_sources(self, name: str) -> list:
        """回傳某個節點所屬的來源文件列表"""
        with self.driver.session() as session:
            result = session.run(
                "MATCH (n:Entity {name: $name}) RETURN coalesce(n.sources, []) AS sources",
                name=name
            )
            record = result.single()
            return list(record["sources"]) if record else []

    def delete_by_source(self, filename: str) -> dict:
        """刪除來源為 filename 的所有節點與關係。
        先從 sources 移除該檔名，再刪除 sources 為空的節點/關係。"""
        with self.driver.session() as session:
            # 關係：從 sources 移除，若空則刪除
            session.run(
                "MATCH ()-[r]->() WHERE $file IN coalesce(r.sources, []) "
                "SET r.sources = [s IN r.sources WHERE s <> $file]",
                file=filename
            )
            rel_result = session.run(
                "MATCH ()-[r]->() WHERE r.sources IS NOT NULL AND size(r.sources) = 0 "
                "DELETE r RETURN count(r) AS cnt"
            )
            deleted_relations = rel_result.single()["cnt"]

            # 節點：從 sources 移除，若空則 DETACH DELETE
            session.run(
                "MATCH (n:Entity) WHERE $file IN coalesce(n.sources, []) "
                "SET n.sources = [s IN n.sources WHERE s <> $file]",
                file=filename
            )
            node_result = session.run(
                "MATCH (n:Entity) WHERE n.sources IS NOT NULL AND size(n.sources) = 0 "
                "DETACH DELETE n RETURN count(n) AS cnt"
            )
            deleted_entities = node_result.single()["cnt"]

        logger.info("刪除來源 %s：%d 節點，%d 關係", filename, deleted_entities, deleted_relations)
        return {"deleted_entities": deleted_entities, "deleted_relations": deleted_relations}

    def get_stats(self) -> dict:
        """取得圖譜統計資訊"""
        with self.driver.session() as session:
            node_count = session.run("MATCH (n:Entity) RETURN count(n) AS count").single()["count"]
            rel_count = session.run("MATCH ()-[r]->() RETURN count(r) AS count").single()["count"]

            # 類型分佈
            type_result = session.run(
                "MATCH (n:Entity) "
                "UNWIND labels(n) AS label "
                "WITH label WHERE label <> 'Entity' "
                "RETURN label, count(*) AS count "
                "ORDER BY count DESC"
            )
            type_distribution = {r["label"]: r["count"] for r in type_result}

            return {
                "node_count": node_count,
                "relation_count": rel_count,
                "type_distribution": type_distribution
            }

    @staticmethod
    def _extract_type(labels: list) -> str:
        """從 Neo4j labels 中提取節點類型（排除 'Entity' 標籤）"""
        for label in labels:
            if label != "Entity":
                return label
        return "Entity"


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    client = Neo4jClient()
    client.test_connection()
    client.close()