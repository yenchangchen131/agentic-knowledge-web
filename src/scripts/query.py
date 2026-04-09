# src/scripts/query.py
import logging
import argparse
import json
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "../.."))
from src.agents.supervisor import create_graph
from src.database.neo4j_client import Neo4jClient
from src.database.chroma_client import ChromaClient

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


def write_debug_report(question: str, result: dict, output_path: str):
    """將查詢的中間過程輸出成 debug 報告檔"""
    debug = result.get("debug", {})
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = []
    lines.append("=" * 70)
    lines.append(f"🐛 DEBUG REPORT — {timestamp}")
    lines.append("=" * 70)
    lines.append("")

    # 1. 問題
    lines.append("📝 [使用者問題]")
    lines.append(f"   {question}")
    lines.append("")

    # 2. 向量檢索結果
    lines.append("-" * 70)
    lines.append("🔎 [Step 1] 向量檢索結果 (Chroma)")
    lines.append("-" * 70)
    vector_results = debug.get("vector_results", [])
    if vector_results:
        for i, r in enumerate(vector_results, 1):
            lines.append(f"  [{i}] text:")
            # 每行縮排顯示
            for text_line in r["text"].split("\n"):
                lines.append(f"       {text_line}")
            if r.get("metadata"):
                lines.append(f"      metadata: {json.dumps(r['metadata'], ensure_ascii=False, indent=8)}")
            lines.append("")
    else:
        lines.append("  （無結果）")
        lines.append("")

    # 3. 實體抽取結果
    lines.append("-" * 70)
    lines.append("🏷️  [Step 2] LLM 抽取的實體")
    lines.append("-" * 70)
    entities = debug.get("extracted_entities", [])
    if entities:
        lines.append(f"  {entities}")
    else:
        lines.append("  （未抽取到實體）")
    lines.append("")

    # 4. 圖譜檢索結果
    lines.append("-" * 70)
    lines.append("🕸️  [Step 3] 圖譜檢索結果 (Neo4j)")
    lines.append("-" * 70)
    graph_results = debug.get("graph_results", [])
    if graph_results:
        for item in graph_results:
            lines.append(f"  實體: {item['entity']}")
            for rel in item.get("related", []):
                lines.append(f"    └─ [{rel['relation']}] → {rel['name']}")
            lines.append("")
    else:
        lines.append("  （無圖譜關聯）")
        lines.append("")

    # 5. 合併後的 Context
    lines.append("-" * 70)
    lines.append("📦 [Step 4] 合併後的 Context (送入 LLM)")
    lines.append("-" * 70)
    merged = debug.get("merged_context", "")
    for ctx_line in merged.split("\n"):
        lines.append(f"  {ctx_line}")
    lines.append("")

    # 6. 生成答案的完整 Prompt
    lines.append("-" * 70)
    lines.append("💬 [Step 5] 生成答案的 Prompt")
    lines.append("-" * 70)
    prompt = debug.get("answer_prompt", "")
    for p_line in prompt.split("\n"):
        lines.append(f"  {p_line}")
    lines.append("")

    # 7. 最終答案
    lines.append("=" * 70)
    lines.append("💡 [最終答案]")
    lines.append("=" * 70)
    lines.append(result.get("answer", ""))
    lines.append("")

    report = "\n".join(lines)

    # 寫入檔案
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(report)

    logger.info("Debug 報告已輸出至: %s", output_path)


def main():
    parser = argparse.ArgumentParser(description="知識圖譜查詢工具")
    parser.add_argument(
        "--question", required=True, help="要查詢的問題"
    )
    parser.add_argument(
        "--debug", action="store_true", help="啟用 debug 模式，輸出中間過程報告"
    )
    parser.add_argument(
        "--debug-output", default="./debug_output.txt",
        help="Debug 報告輸出路徑 (預設: %(default)s)"
    )
    args = parser.parse_args()

    # 初始化 LLM（與 ingest.py 保持一致）
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

    # 初始化資料庫
    neo4j = Neo4jClient()
    chroma = ChromaClient()

    # 建立 Supervisor Graph 並執行
    graph = create_graph(neo4j, chroma, llm)

    logger.info("開始查詢: %s", args.question)
    result = graph.invoke({
        "question": args.question,
        "context": "",
        "answer": "",
        "debug": {}
    })

    # 輸出結果
    print("\n" + "=" * 60)
    print(f"🔍 問題: {args.question}")
    print("=" * 60)
    print(f"💡 答案:\n{result['answer']}")
    print("=" * 60)

    # Debug 模式：輸出中間過程報告
    if args.debug:
        write_debug_report(args.question, result, args.debug_output)
        print(f"\n📄 Debug 報告已輸出至: {args.debug_output}")

    neo4j.close()
    logger.info("查詢完成")


if __name__ == "__main__":
    main()
