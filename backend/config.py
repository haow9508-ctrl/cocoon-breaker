"""配置管理：从环境变量读取，提供默认值。"""
import os
from dotenv import load_dotenv

# 加载 .env 文件（位于 backend 目录下）
load_dotenv()

# ---- Qdrant 向量数据库配置 ----
# 开发期使用内存模式 ":memory:"，生产切 Qdrant Cloud URL
# Qdrant 在本架构中是"实时检索缓存层"，不是持久化知识库
QDRANT_URL = os.getenv("QDRANT_URL", ":memory:")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

# ---- Embedding 模型配置 ----
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 输出维度

# ---- Qdrant Collection 名称 ----
COLLECTION_NAME = "cognitive_content"

# ---- Bing Web Search API 配置（实时互联网检索）----
# 不使用固定知识库——所有内容来自实时互联网搜索
# 服务高价值人群：播客、访谈、认知类内容、跨领域博客
BING_API_KEY = os.getenv("BING_API_KEY", "")
BING_SEARCH_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"
BING_MAX_RESULTS = int(os.getenv("BING_MAX_RESULTS", "10"))

# ---- Tavily Search API 配置（备选搜索 API，专为 AI 设计）----
# 当 BING_API_KEY 未配置时启用，免费额度 1000 次/月
# 返回结构化数据，适合 RAG 流程直接消费
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
TAVILY_ENDPOINT = "https://api.tavily.com/search"

# ---- 缓存 TTL 配置 ----
# Qdrant 作为实时检索缓存层，内容有 TTL 过期
# 缓存命中则直接检索，未命中则触发实时搜索
CACHE_TTL_HOURS = int(os.getenv("CACHE_TTL_HOURS", "24"))  # 默认 24 小时

# ---- 服务器配置 ----
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ---- CORS 配置：允许 Node Express 中间层 (:3001) 调用 ----
CORS_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

# 注：不再使用固定 24 维度模型（COGNITIVE_DIMENSIONS 已移除）
# 改为"认知大方向 + 方向内子领域"动态模型：
#   - direction_id / direction_name：用户在诊断阶段被识别出的认知大方向（如 AIPM / Python / 古诗）
#   - subfield_id / subfield_name：方向内子领域（如 Python 基础 / Web 框架 / 数据科学）
# 大方向与子领域由 LLM 在诊断时动态生成，不再硬编码
