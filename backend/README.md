# 茧房爆破器 RAG 后端

认知扩展应用的核心检索层，运行在 `:8000`，供 Node Express 中间层（`:3001`）调用。
通过接入 arXiv / Wikipedia 等边缘信息源，用向量检索 + BM25 混合检索对抗 GEO（Generative Engine Optimization）污染。

## 技术栈

- FastAPI + uvicorn
- qdrant-client（向量数据库，开发期内存模式，生产切 Qdrant Cloud）
- sentence-transformers（all-MiniLM-L6-v2，384 维，本地 CPU）
- rank-bm25（BM25 关键词检索）
- httpx（arXiv / Wikipedia API）
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
| ARXIV_MAX_RESULTS | 10 | arXiv 单次采集条数 |
| WIKIPEDIA_MAX_RESULTS | 5 | Wikipedia 单次采集条数 |
| HOST / PORT | 0.0.0.0 / 8000 | 服务监听地址 |

## 接口

- `GET /health` — 健康检查
- `GET /collections` — 查看 Qdrant collection 与 BM25 索引状态
- `POST /ingest` — 采集入库，body：`{ query, dimension_id }`
- `POST /retrieve` — 混合检索（RRF 融合），body：`{ query, high_exposure_fields, dimension_id, limit }`

## 说明

- Qdrant 内存模式重启数据丢失，开发期可接受；生产请切 Qdrant Cloud。
- arXiv 返回 Atom XML（用 `xml.etree.ElementTree` 解析），Wikipedia 返回 JSON。
- 24 个认知维度见 `config.COGNITIVE_DIMENSIONS`。
