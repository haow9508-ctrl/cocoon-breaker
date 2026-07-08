"""内容入库：采集 arXiv + Wikipedia → embedding → 写入 Qdrant + BM25 索引。

抗 GEO 核心：每个认知维度都从边缘学术源采集内容，绕过 LLM 训练数据偏见。
"""
import uuid
import config
import embedding
import qdrant_client
import bm25_retriever
import content_sources

# 维度英文关键词映射（arXiv 只支持英文搜索）
DIMENSION_KEYWORDS = {
    "entertainment": "pop culture entertainment media",
    "humor": "humor comedy psychology",
    "beauty": "beauty aesthetics cosmetics",
    "movie": "film cinema movie studies",
    "food": "food science gastronomy nutrition",
    "gaming": "game design video game studies",
    "tech": "technology computer science",
    "auto": "automotive engineering vehicle",
    "sports": "sports science athletics",
    "finance": "finance economics markets",
    "history": "history historiography",
    "psychology": "psychology cognitive science",
    "art": "art history visual arts",
    "literature": "literature literary criticism",
    "sociology": "sociology social science",
    "philosophy": "philosophy ethics metaphysics",
    "physics": "physics quantum mechanics",
    "astronomy": "astronomy astrophysics cosmology",
    "classical": "classical music musicology",
    "biology": "biology evolution genetics",
    "archaeology": "archaeology anthropology",
    "linguistics": "linguistics language studies",
    "architecture": "architecture urban design",
    "math": "mathematics topology geometry",
}


def _estimate_read_time(text: str) -> int:
    """粗略估算阅读时间（分钟）：按中文每分钟 300 字、英文每分钟 200 词折中。"""
    if not text:
        return 1
    return max(1, len(text) // 300)


async def ingest_query(query: str, dimension_id: str) -> dict:
    """采集 query 相关的 arXiv + Wikipedia 内容并入库。

    返回 { success, count, arxiv, wikipedia, dimension_id }。
    抗 GEO 策略：优先 arXiv 学术论文（不受 GEO 污染），辅以 Wikipedia。
    """
    # 优先用维度英文关键词搜 arXiv（arXiv 只支持英文）
    arxiv_query = DIMENSION_KEYWORDS.get(dimension_id, query)
    print(f"[ingest] 采集 dimension={dimension_id} arxiv_query='{arxiv_query}'")

    # 抗 GEO：优先 arXiv 学术论文，辅以 Wikipedia
    arxiv_docs = await content_sources.fetch_arxiv(arxiv_query)
    # Wikipedia 可能被墙，失败时优雅降级（只用 arXiv）
    wiki_docs = await content_sources.fetch_wikipedia(query)
    all_docs = arxiv_docs + wiki_docs

    if not all_docs:
        return {
            "success": False,
            "error": "未采集到任何内容（arXiv/Wikipedia 均无结果）",
            "count": 0,
            "dimension_id": dimension_id,
            "arxiv_query": arxiv_query,
        }

    # 为每个文档分配 id 与 dimension_id
    for doc in all_docs:
        doc["id"] = str(uuid.uuid4())
        doc["dimension_id"] = dimension_id
        doc["read_time_minutes"] = _estimate_read_time(doc.get("description", ""))

    # 批量生成 embedding（title + description 拼接作为语义文本）
    texts = [f"{d['title']}. {d['description']}" for d in all_docs]
    vectors = embedding.embed_batch(texts)

    # 组装 Qdrant 写入点
    points = []
    for doc, vec in zip(all_docs, vectors):
        payload = {
            "dimension_id": doc["dimension_id"],
            "title": doc["title"],
            "description": doc["description"],
            "source": doc["source"],
            "source_type": doc["source_type"],
            "url": doc["url"],
            "read_time_minutes": doc["read_time_minutes"],
        }
        if doc.get("pdf_url"):
            payload["pdf_url"] = doc["pdf_url"]
        points.append({
            "id": doc["id"],
            "vector": vec,
            "payload": payload,
        })

    # 写入 Qdrant 向量库
    qdrant_client.upsert_points(points)

    # 写入 BM25 关键词索引（一次性增量添加）
    bm25_docs = [{"id": p["id"], **p["payload"]} for p in points]
    bm25_retriever.add_documents(bm25_docs)

    print(f"[ingest] 入库完成: arxiv={len(arxiv_docs)} wikipedia={len(wiki_docs)} total={len(all_docs)}")
    return {
        "success": True,
        "count": len(all_docs),
        "arxiv": len(arxiv_docs),
        "wikipedia": len(wiki_docs),
        "dimension_id": dimension_id,
    }


async def ingest_predefined() -> list:
    """为 24 个认知维度各采集内容入库（开发期可选）。
    用维度英文关键词搜索 arXiv，抗 GEO。
    """
    results = []
    for dim in config.COGNITIVE_DIMENSIONS:
        try:
            keyword = DIMENSION_KEYWORDS.get(dim, dim)
            r = await ingest_query(keyword, dim)
            results.append({"dimension": dim, **r})
        except Exception as e:
            results.append({"dimension": dim, "success": False, "error": str(e)})
    return results
