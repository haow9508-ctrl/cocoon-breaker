"""FastAPI 入口：茧房爆破器 RAG 后端（实时互联网检索版）。

运行在 :8000，供 Node Express 中间层（:3001）调用。
架构变更：不使用固定知识库，所有内容来自实时互联网检索。
Qdrant 作为"实时检索缓存层"（TTL 过期），非持久化知识库。
检索源由 content_sources.fetch_realtime 统一调度：优先 Bing，备选 Tavily。

内容模型：基于"认知大方向 + 方向内子领域"组织（不再用固定 24 维度）。
  - direction_id / direction_name：LLM 在诊断阶段动态识别的认知大方向
  - subfield_id / subfield_name：方向内子领域

流程：
  /retrieve 请求 → 查 Qdrant 缓存 → 命中则 hybrid 检索返回
                                       → 未命中则触发实时搜索 → embedding → 缓存 → 返回
"""
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import config
import embedding
import qdrant_client
import bm25_retriever
import hybrid_retriever
import ingest


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时预加载模型并初始化向量库。"""
    print("[main] 启动中...")
    print("[main] 架构：实时互联网检索（Bing / Tavily）+ Qdrant 缓存层（非知识库）")
    # 预加载 embedding 模型（首次会下载约 80MB）
    print("[main] 预加载 embedding 模型...")
    embedding.get_model()
    # 初始化 Qdrant collection（缓存层）
    print("[main] 初始化 Qdrant 缓存 collection...")
    qdrant_client.ensure_collection()
    # 检查检索源配置：优先 Bing，备选 Tavily，均未配置则警告
    if config.BING_API_KEY:
        print("[main] ✅ Bing API 已配置，实时互联网检索就绪")
    elif config.TAVILY_API_KEY:
        print("[main] ✅ Tavily API 已配置（Bing 未配置），实时互联网检索就绪")
    else:
        print("[main] ⚠️ 警告：BING_API_KEY 和 TAVILY_API_KEY 均未配置，实时检索将不可用")
    print(f"[main] 启动完成，监听 {config.HOST}:{config.PORT}")
    yield
    print("[main] 关闭")


app = FastAPI(
    title="茧房爆破器 RAG 后端",
    description="实时互联网检索 + Qdrant 缓存层 + BM25 hybrid retrieval（非固定知识库）",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS：允许 Node Express 中间层调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- 请求模型 ----
class RetrieveRequest(BaseModel):
    query: str
    high_exposure_fields: list = Field(default_factory=list)
    # 认知大方向 + 方向内子领域（替代旧版 dimension_id）
    direction_id: str = ""
    direction_name: str = ""
    subfield_id: str = ""
    subfield_name: str = ""
    limit: int = 10


class IngestRequest(BaseModel):
    query: str
    # 认知大方向 + 方向内子领域（替代旧版 dimension_id）
    direction_id: str
    direction_name: str = ""
    subfield_id: str
    subfield_name: str = ""


# ---- TTL 清理 ----
def _purge_expired_cache():
    """清理过期的 Qdrant 缓存条目（基于 ingested_at + CACHE_TTL_HOURS）。"""
    try:
        ttl_seconds = config.CACHE_TTL_HOURS * 3600
        current_time = time.time()
        cutoff = current_time - ttl_seconds
        # Qdrant 内存模式不支持直接按 payload 字段删除，这里只做日志
        # 生产环境 Qdrant Cloud 可用 delete_by_payload
        count = qdrant_client.count_points()
        print(f"[cache] 当前缓存 {count} 条，TTL={config.CACHE_TTL_HOURS}h")
    except Exception as e:
        print(f"[cache] TTL 清理失败: {e}")


# ---- 接口 ----
@app.get("/health")
async def health():
    """健康检查。"""
    return {
        "success": True,
        "status": "ok",
        "bing_configured": bool(config.BING_API_KEY),
        "tavily_configured": bool(config.TAVILY_API_KEY),
        "cache_ttl_hours": config.CACHE_TTL_HOURS,
    }


@app.get("/collections")
async def collections():
    """查看 Qdrant 缓存层状态。"""
    try:
        c = qdrant_client.get_client()
        cols = c.get_collections().collections
        info = []
        for col in cols:
            try:
                detail = c.get_collection(col.name)
                info.append({
                    "name": col.name,
                    "points_count": detail.points_count,
                    "vectors_count": detail.vectors_count,
                })
            except Exception as e:
                info.append({"name": col.name, "error": str(e)})
        return {
            "success": True,
            "collections": info,
            "bm25": bm25_retriever.stats(),
            "bing_configured": bool(config.BING_API_KEY),
            "tavily_configured": bool(config.TAVILY_API_KEY),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/retrieve")
async def retrieve(req: RetrieveRequest):
    """混合检索：缓存优先 → 未命中则实时搜索 → embedding → 缓存 → hybrid 返回。

    流程：
    1. 先查 Qdrant 缓存是否有该 query + direction_id + subfield_id 的未过期内容
    2. 缓存命中 → BM25 + Vector hybrid 检索返回
    3. 缓存未命中 → 触发实时搜索（Bing / Tavily）→ embedding → 写入缓存 → hybrid 检索返回

    high_exposure_fields 标注用户当前高曝光领域（茧房）。
    """
    try:
        # 步骤 1：查缓存
        # 过滤条件：按 direction_id + subfield_id 缩小范围（替代旧版 dimension_id）
        filter_conditions = None
        if req.direction_id or req.subfield_id:
            filter_conditions = {}
            if req.direction_id:
                filter_conditions["direction_id"] = req.direction_id
            if req.subfield_id:
                filter_conditions["subfield_id"] = req.subfield_id

        query_vector = embedding.embed(req.query)
        results = hybrid_retriever.hybrid_search(
            query=req.query,
            query_vector=query_vector,
            limit=req.limit,
            filter_conditions=filter_conditions,
        )

        # 步骤 2：缓存命中则返回
        if len(results) >= req.limit:
            return {
                "success": True,
                "query": req.query,
                "direction_id": req.direction_id,
                "direction_name": req.direction_name,
                "subfield_id": req.subfield_id,
                "subfield_name": req.subfield_name,
                "high_exposure_fields": req.high_exposure_fields,
                "count": len(results),
                "results": results,
                "source": "cache_hit",
            }

        # 步骤 3：缓存未命中 → 实时搜索 → 入库缓存
        print(f"[retrieve] 缓存未命中（仅 {len(results)} 条），触发实时互联网搜索...")
        await ingest.ingest_query(
            req.query,
            req.direction_id,
            req.direction_name,
            req.subfield_id,
            req.subfield_name,
        )

        # 步骤 4：重新 hybrid 检索（此时缓存已填充）
        query_vector = embedding.embed(req.query)  # 重新 embedding（新内容可能影响语义）
        results = hybrid_retriever.hybrid_search(
            query=req.query,
            query_vector=query_vector,
            limit=req.limit,
            filter_conditions=filter_conditions,
        )

        return {
            "success": True,
            "query": req.query,
            "direction_id": req.direction_id,
            "direction_name": req.direction_name,
            "subfield_id": req.subfield_id,
            "subfield_name": req.subfield_name,
            "high_exposure_fields": req.high_exposure_fields,
            "count": len(results),
            "results": results,
            "source": "realtime",  # 实际 source_type 在每条 doc 上（bing / tavily）
        }

    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/ingest")
async def ingest_endpoint(req: IngestRequest):
    """手动触发实时互联网检索并入库缓存（Bing / Tavily）。"""
    try:
        result = await ingest.ingest_query(
            req.query,
            req.direction_id,
            req.direction_name,
            req.subfield_id,
            req.subfield_name,
        )
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
