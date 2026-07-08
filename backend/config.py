"""配置管理：从环境变量读取，提供默认值。"""
import os
from dotenv import load_dotenv

# 加载 .env 文件（位于 backend 目录下）
load_dotenv()

# ---- Qdrant 向量数据库配置 ----
# 开发期使用内存模式 ":memory:"，生产切 Qdrant Cloud URL
QDRANT_URL = os.getenv("QDRANT_URL", ":memory:")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")

# ---- Embedding 模型配置 ----
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 输出维度

# ---- Qdrant Collection 名称 ----
COLLECTION_NAME = "cognitive_content"

# ---- 内容采集配置 ----
ARXIV_MAX_RESULTS = int(os.getenv("ARXIV_MAX_RESULTS", "10"))
WIKIPEDIA_MAX_RESULTS = int(os.getenv("WIKIPEDIA_MAX_RESULTS", "5"))

# ---- 服务器配置 ----
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

# ---- CORS 配置：允许 Node Express 中间层 (:3001) 调用 ----
CORS_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

# ---- 24 个认知维度（用于 dimension_id）----
# 覆盖主流推荐系统容易形成茧房的领域，接入边缘信息源以对抗 GEO 污染
COGNITIVE_DIMENSIONS = [
    "entertainment", "humor", "beauty", "movie", "food", "gaming",
    "tech", "auto", "sports", "finance", "history", "psychology",
    "art", "literature", "sociology", "philosophy", "physics", "astronomy",
    "classical", "biology", "archaeology", "linguistics", "architecture", "math",
]
