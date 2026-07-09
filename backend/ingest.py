"""内容入库：实时互联网检索 → embedding → 写入 Qdrant 缓存 + BM25 索引。

不是固定知识库——每次请求时实时从互联网检索内容，
将结果 embedding 后存入 Qdrant 作为近期缓存（TTL 过期）。
Qdrant 是"实时检索缓存层"，不是持久化知识库。

模型：内容按"认知大方向 + 方向内子领域"组织，
不再使用固定 dimension_id。检索源由 fetch_realtime 统一调度
（优先 Bing，备选 Tavily）。
"""
import time
import uuid
import config
import embedding
import qdrant_client
import bm25_retriever
import content_sources


def _estimate_read_time(text: str) -> int:
    """粗略估算阅读时间（分钟）：按中文每分钟 300 字折中。"""
    if not text:
        return 1
    return max(1, len(text) // 300)


async def ingest_query(
    query: str,
    direction_id: str,
    direction_name: str,
    subfield_id: str,
    subfield_name: str,
) -> dict:
    """实时从互联网检索内容并入库缓存（基于认知大方向 + 方向内子领域）。

    返回 { success, count, direction_id, direction_name, subfield_id, subfield_name, query }。
    内容来自实时互联网搜索（播客、访谈、认知类内容），非固定知识库——每日信息持续更新。
    检索源由 content_sources.fetch_realtime 统一调度（优先 Bing，备选 Tavily）。

    参数：
      query: 原始检索查询
      direction_id: 认知大方向 ID（由 LLM 在诊断阶段动态生成）
      direction_name: 认知大方向名（如 "古诗"、"Python 编程"），用于查询增强
      subfield_id: 方向内子领域 ID
      subfield_name: 方向内子领域名（如 "诗论"、"Web 框架"），用于查询增强
    """
    print(
        f"[ingest] 实时检索 direction={direction_name}({direction_id}) "
        f"subfield={subfield_name}({subfield_id}) query='{query}'"
    )

    # 实时互联网检索（统一入口：优先 Bing，备选 Tavily）
    docs = await content_sources.fetch_realtime(query, direction_name, subfield_name)

    if not docs:
        return {
            "success": False,
            "error": "实时检索未返回结果（请检查 BING_API_KEY / TAVILY_API_KEY 配置或网络连接）",
            "count": 0,
            "direction_id": direction_id,
            "direction_name": direction_name,
            "subfield_id": subfield_id,
            "subfield_name": subfield_name,
            "query": query,
        }

    # 为每个文档分配 id、方向/子领域元数据、时间戳
    current_time = time.time()
    for doc in docs:
        doc["id"] = str(uuid.uuid4())
        doc["direction_id"] = direction_id
        doc["direction_name"] = direction_name
        doc["subfield_id"] = subfield_id
        doc["subfield_name"] = subfield_name
        doc["read_time_minutes"] = _estimate_read_time(doc.get("description", ""))
        doc["ingested_at"] = current_time  # 用于 TTL 过期判断

    # 批量生成 embedding（title + description 拼接作为语义文本）
    texts = [f"{d['title']}. {d['description']}" for d in docs]
    vectors = embedding.embed_batch(texts)

    # 组装 Qdrant 写入点
    points = []
    for doc, vec in zip(docs, vectors):
        payload = {
            "direction_id": doc["direction_id"],
            "direction_name": doc["direction_name"],
            "subfield_id": doc["subfield_id"],
            "subfield_name": doc["subfield_name"],
            "title": doc["title"],
            "description": doc["description"],
            "source": doc["source"],
            "source_type": doc["source_type"],  # "bing" 或 "tavily"
            "url": doc["url"],
            "display_url": doc.get("display_url", ""),
            "date_published": doc.get("date_published", ""),
            "read_time_minutes": doc["read_time_minutes"],
            "ingested_at": doc["ingested_at"],  # TTL 时间戳
            "query": query,
        }
        points.append({
            "id": doc["id"],
            "vector": vec,
            "payload": payload,
        })

    # 写入 Qdrant 缓存层
    qdrant_client.upsert_points(points)

    # 写入 BM25 关键词索引
    bm25_docs = [{"id": p["id"], **p["payload"]} for p in points]
    bm25_retriever.add_documents(bm25_docs)

    print(f"[ingest] 入库缓存完成: {len(docs)} 条实时互联网内容")
    return {
        "success": True,
        "count": len(docs),
        "direction_id": direction_id,
        "direction_name": direction_name,
        "subfield_id": subfield_id,
        "subfield_name": subfield_name,
        "query": query,
        "source": "realtime",  # 实际 source_type 在每条 doc 上（bing / tavily）
    }
