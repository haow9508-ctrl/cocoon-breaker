# 茧房爆破器 — 认知成长教练

> 帮助持续提升认知的人，在既定方向内拓展视野，突破信息茧房。

## 项目定位

服务有成长需求的高价值用户（关注播客、访谈、认知类内容），在用户既定的认知大方向内（如 Python / 古诗 / 股市 / AIPM）拓展未接触的子领域，而非跨方向推荐无关内容。

**核心理念**：不跨方向推荐。学 Python 的用户不会被推美妆或体育，而是在 Python 大方向内拓展 C / Rust / 编程范式。

## 技术架构

**RAG + Transformer + Agent 混合架构**

### 三层服务架构

| 层 | 技术栈 | 端口 | 说明 |
|---|---|---|---|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS | :5173 | 6 页 SPA：诊断扫描 / 每日挑战 / 方向树 / 成长曲线 / 里程碑 / 阅读 |
| Node 中间层 | Express + DeepSeek API | :3001 | 7 阶段 Agent Pipeline，认知教练对话 |
| Python RAG 后端 | FastAPI + Qdrant + sentence-transformers + rank-bm25 | :8000 | Bing 实时互联网检索 + BM25+Vector 混合检索（RRF 融合） |

### 7 阶段 Pipeline

1. **诊断** — 多轮对话识别用户的 1-3 个认知大方向
2. **分析** — 识别方向内子领域树 + 初始难度等级
3. **决策** — 方向内拓展度评估（DeepSeek 评估 + 难度递进 L1→L2→L3）
4. **生成** — RAG 检索真实互联网内容 + DeepSeek 生成教练引导
5. **自评** — 用户冲击自评（星级 + 反思）
6. **反哺** — 难度调整 + 里程碑检查 + 教练反馈
7. **对话** — 苏格拉底方法论引导

### 抗 GEO 污染策略

- **ANTI_GEO_DIRECTIVE**：Prompt 层约束，不生成搜索引擎排名靠前的流行叙事
- **实时互联网检索**：Bing Web Search API（非固定知识库），支持播客/访谈/深度解读关键词增强
- **Qdrant 缓存层**：24 小时 TTL，作为实时检索缓存而非持久化知识库
- **方向内约束**：严格限定在用户认知大方向内推荐，不跨方向

## 本地运行

### 前置条件

- Node.js 18+
- Python 3.10+
- DeepSeek API Key

### 启动三层服务

```bash
# 1. 安装前端 + Node 依赖
npm install

# 2. 启动 Python RAG 后端
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
$env:HF_ENDPOINT="https://hf-mirror.com"  # 国内镜像
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 3. 启动前端 + Node 中间层（新终端）
npm run dev
```

前端访问 http://localhost:5173

### 环境变量

在项目根目录 `.env` 文件中配置：

```
DEEPSEEK_API_KEY=your_deepseek_api_key
BING_API_KEY=your_bing_api_key        # 可选，缺失时降级到纯 DeepSeek
TAVILY_API_KEY=your_tavily_api_key    # 可选，备用搜索
```

## 部署

### Railway 一键部署

项目已配置 `railway.json`，支持从 GitHub 自动部署：

1. 在 Railway 导入 GitHub 仓库
2. 在 Settings → Environment Variables 中添加 `DEEPSEEK_API_KEY`
3. Generate Domain 获取公网地址

生产模式下 Express 同时托管 API 路由和静态前端（`npm run build` + `npm start`）。Python RAG 后端可选，缺失时自动降级到纯 DeepSeek 生成。

## 项目结构

```
├── api/                    # Node 中间层（Express + DeepSeek Agent）
│   ├── _agent/             # 7 阶段 Pipeline 实现
│   ├── _knowledge/         # 认知方向模型（CognitiveDirection + SubfieldNode）
│   ├── _routes/            # API 路由
│   └── _core/              # Express app（生产模式托管静态前端）
├── backend/                # Python RAG 后端（FastAPI + Qdrant）
│   ├── main.py             # FastAPI 入口，/retrieve 缓存优先策略
│   ├── hybrid_retriever.py # BM25 + Vector 混合检索（RRF 融合）
│   ├── content_sources.py  # Bing/Tavily 实时互联网搜索
│   └── ingest.py           # Qdrant 缓存写入（24h TTL）
├── src/                    # 前端（React + Vite + Tailwind）
│   ├── pages/              # 6 页：诊断/挑战/方向树/成长/里程碑/阅读
│   ├── lib/                # apiClient + profileManager（localStorage 档案）
│   └── components/         # NavBar + CoachChat + UI 组件
├── .trae/documents/        # PRD v6.0 + 技术架构文档
└── railway.json            # Railway 部署配置
```

## 核心模型

### v6.0 认知方向模型

- **CognitiveDirection**（认知大方向）：用户既定的 1-3 个拓展方向
- **SubfieldNode**（子领域节点）：方向内细分领域，三档接触程度
  - `high`：已接触
  - `low`：偶尔接触
  - `none`：未接触（待拓展目标）

### 今日挑战缓存（v6.1）

当天生成的挑战缓存到 localStorage，重复进入挑战页不再重新生成，详情页直接从缓存读取，保证内容一致性。
