"""FastAPI 入口：茧房爆破器 RAG 后端。

运行在 :8000，供 Node Express 中间层（:3001）调用。
启动时预加载 embedding 模型并初始化 Qdrant collection。
"""
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
    """应用生命周期：启动时预加载模型与初始化向量库。"""
    print("[main] 启动中...")
    # 预加载 embedding 模型（首次会下载约 80MB）
    print("[main] 预加载 embedding 模型...")
    embedding.get_model()
    # 初始化 Qdrant collection
    print("[main] 初始化 Qdrant collection...")
    qdrant_client.ensure_collection()
    print(f"[main] 启动完成，监听 {config.HOST}:{config.PORT}")
    yield
    print("[main] 关闭")


app = FastAPI(
    title="茧房爆破器 RAG 后端",
    description="认知扩展应用的核心检索层——通过 arXiv/Wikipedia 等边缘信息源对抗 GEO 污染",
    version="1.0.0",
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
    dimension_id: str = ""
    limit: int = 10


class IngestRequest(BaseModel):
    query: str
    dimension_id: str


# ---- 接口 ----
@app.get("/health")
async def health():
    """健康检查。"""
    return {"success": True, "status": "ok"}


@app.get("/collections")
async def collections():
    """查看 Qdrant collection 状态。"""
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
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/retrieve")
async def retrieve(req: RetrieveRequest):
    """混合检索：BM25 + 向量 → RRF 融合，返回 top-N 结果。

    high_exposure_fields 用于标注用户当前高曝光领域（茧房），
    检索结果可据此调整推荐策略。
    """
    try:
        query_vector = embedding.embed(req.query)
        # 按 dimension_id 过滤向量检索（若指定）
        filter_conditions = {"dimension_id": req.dimension_id} if req.dimension_id else None
        results = hybrid_retriever.hybrid_search(
            query=req.query,
            query_vector=query_vector,
            limit=req.limit,
            filter_conditions=filter_conditions,
        )
        return {
            "success": True,
            "query": req.query,
            "dimension_id": req.dimension_id,
            "high_exposure_fields": req.high_exposure_fields,
            "count": len(results),
            "results": results,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/ingest")
async def ingest_endpoint(req: IngestRequest):
    """触发内容采集入库：arXiv + Wikipedia → embedding → Qdrant + BM25。"""
    try:
        result = await ingest.ingest_query(req.query, req.dimension_id)
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
