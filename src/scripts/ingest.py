# src/scripts/ingest.py
import logging
import hashlib
import json
import argparse
from pathlib import Path
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))
from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

llm = ChatOllama(
    model="gemma4:31b-cloud",
    base_url="https://ollama.com",
    temperature=0,
    client_kwargs={
        "headers": {
            "Authorization": f"Bearer {os.environ.get('OLLAMA_API_KEY', '')}"
        }
    }
)

EXTRACT_PROMPT = """你是一個知識圖譜抽取專家。
請從以下文字中抽取實體與關係，並以 JSON 格式回傳。

規則：
- entities: 每個實體需有 name（名稱）和 type（類型，如：概念、技術、工具、人物）
- relations: 每條關係需有 source、target、type（如：使用、依賴、包含、屬於）
- 只抽取文字中明確提到的內容，不要推測

文字：
{text}

請只回傳 JSON，不要有其他文字：
{{
  "entities": [{{"name": "...", "type": "..."}}],
  "relations": [{{"source": "...", "target": "...", "type": "..."}}]
}}
"""

def chunk_markdown(file_path: str) -> list:
    text = Path(file_path).read_text(encoding="utf-8")
    header_splitter = MarkdownHeaderTextSplitter(
        headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")]
    )
    header_chunks = header_splitter.split_text(text)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = text_splitter.split_documents(header_chunks)
    logger.info("檔案 %s 切成 %d 個 chunks", file_path, len(chunks))
    return chunks

def extract_graph(text: str) -> dict:
    prompt = EXTRACT_PROMPT.format(text=text)
    response = llm.invoke(prompt)
    # 清理 LLM 可能回傳的 markdown 代碼塊
    content = response.content.strip()
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        logger.warning("LLM 回傳格式錯誤，跳過此 chunk:\n%s", content)
        return {"entities": [], "relations": []}

def ingest_file(file_path: str, neo4j: Neo4jClient, chroma: ChromaClient):
    logger.info("開始處理: %s", file_path)
    chunks = chunk_markdown(file_path)

    for i, chunk in enumerate(chunks):
        text = chunk.page_content
        metadata = {**chunk.metadata, "source": file_path, "chunk_index": i}
        chunk_id = hashlib.md5(f"{file_path}_{i}".encode()).hexdigest()

        chroma.add_chunk(chunk_id, text, metadata)

        graph_data = extract_graph(text)

        for entity in graph_data.get("entities", []):
            neo4j.create_entity(entity["name"], entity["type"])

        for relation in graph_data.get("relations", []):
            neo4j.create_relation(
                relation["source"],
                relation["target"],
                relation["type"]
            )

    logger.info("完成處理: %s，共 %d chunks", file_path, len(chunks))

def ingest_directory(dir_path: str, neo4j: Neo4jClient, chroma: ChromaClient):
    md_files = list(Path(dir_path).glob("**/*.md"))
    logger.info("找到 %d 個 Markdown 檔案", len(md_files))
    for file_path in md_files:
        ingest_file(str(file_path), neo4j, chroma)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="./data", help="Markdown 檔案或資料夾路徑(預設: %(default)s)")
    args = parser.parse_args()

    neo4j = Neo4jClient()
    chroma = ChromaClient()

    input_path = Path(args.input)
    if input_path.is_file():
        ingest_file(str(input_path), neo4j, chroma)
    elif input_path.is_dir():
        ingest_directory(str(input_path), neo4j, chroma)
    else:
        logger.error("路徑不存在: %s", args.input)

    neo4j.close()
    logger.info("全部完成，Chroma 總 chunk 數: %d", chroma.count())