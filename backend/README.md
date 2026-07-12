# 茧房爆破器 RAG 后端

认知扩展应用的核心检索层，运行在 `:8000`，供 Node Express 中间层（`:3001`）调用。
通过 Bing/Tavily 实时互联网搜索获取播客、访谈、认知类内容，用 BM25 + Vector 混合检索对抗 GEO（Generative Engine Optimization）污染。
Qdrant 作为实时检索缓存层（24 小时 TTL），非持久化知识库。

## 技术栈

- FastAPI + uvicorn
- qdrant-client（向量数据库，实时检索缓存层，24h TTL）
- sentence-transformers（all-MiniLM-L6-v2，384 维，本地 CPU）
- rank-bm25（BM25 关键词检索）
- httpx（Bing Web Search API / Tavily 实时搜索）
- pydantic（数据校验）

## 启动

```bash
# 安装依赖
pip install -r requirements.txt

# 启动方式一：uvicorn 热重载
uvicorn main:app --reload --port 8000

# 启动方式二：直接运行
python main.py
```

首次启动会自动下载 sentence-transformers 模型（约 80MB），并在 Qdrant 内存模式中创建 `cognitive_content` collection。

## 配置

复制 `.env.example` 为 `.env` 并按需修改：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| QDRANT_URL | `:memory:` | 内存模式；生产填 Qdrant Cloud URL |
| QDRANT_API_KEY | 空 | Qdrant Cloud API Key |
| EMBEDDING_MODEL | all-MiniLM-L6-v2 | sentence-transformers 模型名 |
| BING_API_KEY | 空 | Bing Web Search API Key（缺失时降级到纯 DeepSeek） |
| TAVILY_API_KEY | 空 | Tavily 搜索 API Key（备用） |
| CACHE_TTL_HOURS | 24 | Qdrant 缓存过期时间（小时） |
| HOST / PORT | 0.0.0.0 / 8000 | 服务监听地址 |

## 接口

- `GET /health` — 健康检查
- `GET /collections` — 查看 Qdrant collection 与 BM25 索引状态
- `POST /ingest` — 采集入库，body：`{ query, direction_id, direction_name, subfield_id, subfield_name }`
- `POST /retrieve` — 混合检索（RRF 融合），body：`{ query, high_exposure_fields, dimension_id, limit }`

## 说明

- Qdrant 内存模式重启数据丢失，开发期可接受；生产请切 Qdrant Cloud。
- 内容来源为 Bing/Tavily 实时互联网搜索，不依赖固定知识库。
- 检索缓存优先策略：先查 Qdrant 缓存，未命中则触发 Bing 实时搜索，结果写入 Qdrant（24h TTL）。
- 认知大方向 + 方向内子领域由 LLM 在诊断阶段动态识别，不再使用固定维度模型。
