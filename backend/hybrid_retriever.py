"""混合检索：BM25 关键词检索 + 向量检索，使用 RRF（Reciprocal Rank Fusion）融合排序。

RRF 公式: score(d) = sum( 1 / (k + rank_i(d)) )，k=60。
返回每个结果的来源（bm25|vector|hybrid）与融合分数。
"""
import bm25_retriever
import qdrant_client

# RRF 平滑常数
RRF_K = 60


def hybrid_search(query: str, query_vector: list, limit: int = 10, filter_conditions: dict = None) -> list:
    """混合检索：BM25 + 向量 → RRF 融合 → 返回 top-N。

    返回结构: [{ id, score, source, title, description, url,
                source_type, payload }, ...]
    """
    # 多召回一些候选用于融合
    candidate_limit = max(limit * 2, 20)

    # 1) BM25 关键词检索
    bm25_results = bm25_retriever.search(query, limit=candidate_limit)

    # 2) 向量语义检索
    vector_results = qdrant_client.vector_search(
        query_vector, limit=candidate_limit, filter_conditions=filter_conditions
    )

    # 3) RRF 融合
    scores: dict = {}      # doc_id -> 融合分数
    payloads: dict = {}    # doc_id -> payload
    sources: dict = {}     # doc_id -> 来源标签

    # BM25 排名贡献
    for rank, (doc_id, _score) in enumerate(bm25_results):
        rrf = 1.0 / (RRF_K + rank + 1)
        scores[doc_id] = scores.get(doc_id, 0.0) + rrf
        sources[doc_id] = "bm25"
        payloads[doc_id] = bm25_retriever.get_document(doc_id)

    # 向量排名贡献
    for rank, r in enumerate(vector_results):
        doc_id = str(r["id"])
        rrf = 1.0 / (RRF_K + rank + 1)
        scores[doc_id] = scores.get(doc_id, 0.0) + rrf
        payloads[doc_id] = r["payload"]
        # 若同时出现在两个通道，标记为 hybrid
        sources[doc_id] = "hybrid" if doc_id in sources else "vector"

    # 4) 按融合分数排序，取 top-N
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]

    out = []
    for doc_id, score in ranked:
        payload = payloads.get(doc_id, {})
        out.append({
            "id": doc_id,
            "score": float(score),
            "source": sources.get(doc_id, "hybrid"),
            "title": payload.get("title", ""),
            "description": payload.get("description", ""),
            "url": payload.get("url", ""),
            "source_type": payload.get("source_type", ""),
            "dimension_id": payload.get("dimension_id", ""),
            "read_time_minutes": payload.get("read_time_minutes"),
            "payload": payload,
        })
    return out
