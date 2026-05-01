# src/api/graph.py
"""知識圖譜視覺化 API"""
import logging
from fastapi import APIRouter, Depends, Query

from src.api.deps import get_neo4j, get_chroma

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/graph", tags=["graph"])


@router.get("/init")
def graph_init(limit: int = Query(150, ge=1, le=500), neo4j=Depends(get_neo4j)):
    """取得初始圖譜資料（nodes + links）"""
    return neo4j.get_graph_data(limit=limit)


@router.get("/expand/{node_name}")
def graph_expand(node_name: str, neo4j=Depends(get_neo4j)):
    """展開指定節點的第一層鄰居"""
    return neo4j.expand_node(name=node_name)


@router.get("/sources/{node_name}")
def graph_sources(node_name: str, neo4j=Depends(get_neo4j)):
    """取得某節點的來源文件列表"""
    return {"sources": neo4j.get_entity_sources(node_name)}


@router.get("/stats")
def graph_stats(neo4j=Depends(get_neo4j), chroma=Depends(get_chroma)):
    """取得圖譜與知識庫統計資訊"""
    neo4j_stats = neo4j.get_stats()
    neo4j_stats["chunk_count"] = chroma.count()
    return neo4j_stats
