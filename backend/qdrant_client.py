"""Qdrant 向量数据库客户端封装。

注意：本文件名 `qdrant_client.py` 与已安装的 `qdrant-client` 包同名，
直接 `from qdrant_client import ...` 会发生自引用循环导入。
因此通过 `_import_real_qdrant()` 临时移除 cwd 与 sys.modules 占位，
从 site-packages 导入真正的包，再恢复本模块的 sys.modules 占位。

开发期使用内存模式 ":memory:"（重启数据丢失，开发期可接受）；
生产环境切换至 Qdrant Cloud（URL + API Key）。
"""
import sys
import os
import importlib
import config


def _import_real_qdrant():
    """导入真正的 qdrant-client 包及其 http.models 子模块。

    解决本文件与包同名导致的循环导入问题。
    """
    cwd = os.path.abspath(os.getcwd())
    saved_path = list(sys.path)
    # 临时移除 cwd 相关路径条目（含空字符串 ''），使 import 定位到 site-packages
    sys.path = [p for p in saved_path if not (p == "" or os.path.abspath(p) == cwd)]
    # 临时移除本模块在 sys.modules 中的占位（避免自引用）
    self_mod = sys.modules.pop("qdrant_client", None)
    try:
        pkg = importlib.import_module("qdrant_client")
        models = importlib.import_module("qdrant_client.http.models")
    finally:
        # 恢复 sys.path 与本模块占位
        sys.path = saved_path
        if self_mod is not None:
            sys.modules["qdrant_client"] = self_mod
    return pkg, models


# 一次性导入真正的包（在模块加载时完成）
_pkg, _models = _import_real_qdrant()

QdrantClient = _pkg.QdrantClient
Distance = _models.Distance
VectorParams = _models.VectorParams
PointStruct = _models.PointStruct
Filter = _models.Filter
FieldCondition = _models.FieldCondition
MatchValue = _models.MatchValue

# 客户端单例
_client = None


def get_client():
    """获取 QdrantClient 单例：开发用内存模式，生产用 Qdrant Cloud。"""
    global _client
    if _client is None:
        if config.QDRANT_URL == ":memory:":
            print("[qdrant] 使用内存模式（开发期，重启数据丢失）")
            _client = QdrantClient(":memory:")
        else:
            print(f"[qdrant] 连接 Qdrant Cloud: {config.QDRANT_URL}")
            _client = QdrantClient(
                url=config.QDRANT_URL,
                api_key=config.QDRANT_API_KEY or None,
            )
    return _client


def ensure_collection() -> None:
    """确保 collection 存在；不存在则创建（384 维，余弦距离）。"""
    c = get_client()
    existing = [col.name for col in c.get_collections().collections]
    if config.COLLECTION_NAME in existing:
        print(f"[qdrant] collection 已存在: {config.COLLECTION_NAME}")
        return
    print(f"[qdrant] 创建 collection: {config.COLLECTION_NAME} (dim={config.EMBEDDING_DIM}, cosine)")
    c.create_collection(
        collection_name=config.COLLECTION_NAME,
        vectors_config=VectorParams(
            size=config.EMBEDDING_DIM,
            distance=Distance.COSINE,
        ),
    )


def upsert_points(points: list) -> None:
    """批量写入向量。每个 point 结构: { id, vector, payload }。

    payload 结构: { direction_id, direction_name, subfield_id, subfield_name,
                   title, description, source, source_type (bing|tavily|unknown),
                   url, read_time_minutes, ingested_at }
    """
    c = get_client()
    structs = [
        PointStruct(
            id=p["id"],
            vector=p["vector"],
            payload=p.get("payload", {}),
        )
        for p in points
    ]
    c.upsert(collection_name=config.COLLECTION_NAME, points=structs)


def vector_search(query_vector: list, limit: int = 10, filter_conditions: dict = None) -> list:
    """向量检索，返回 [{ id, score, payload }, ...]。"""
    c = get_client()
    query_filter = None
    if filter_conditions:
        query_filter = Filter(
            must=[
                FieldCondition(key=k, match=MatchValue(value=v))
                for k, v in filter_conditions.items()
            ]
        )
    response = c.query_points(
        collection_name=config.COLLECTION_NAME,
        query=query_vector,
        query_filter=query_filter,
        limit=limit,
        with_payload=True,
    )
    out = []
    for r in response.points:
        out.append({
            "id": str(r.id),
            "score": float(r.score),
            "payload": r.payload or {},
        })
    return out


def count_points() -> int:
    """返回 collection 中点数。"""
    c = get_client()
    try:
        info = c.count(collection_name=config.COLLECTION_NAME)
        return info.count
    except Exception:
        return 0
