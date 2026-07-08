"""Embedding 服务：基于 sentence-transformers 的 all-MiniLM-L6-v2（384 维）。

模型单例加载，避免重复初始化。首次运行会从 HuggingFace 下载约 80MB 模型权重。
Windows 兼容：用 local_dir 模式下载，避免 symlink 权限问题。
"""
import os
import config

# 模型单例（全局只加载一次）
_model = None

# 本地模型目录（避免 Windows symlink 权限问题）
_LOCAL_MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "all-MiniLM-L6-v2")


def get_model():
    """获取（必要时加载）sentence-transformers 模型单例。"""
    global _model
    if _model is None:
        print(f"[embedding] 正在加载模型 {config.EMBEDDING_MODEL}（首次运行将下载约 80MB 权重，请耐心等待）...")
        from sentence_transformers import SentenceTransformer

        # Windows 兼容：用 local_dir 模式下载，不用 symlink
        if not os.path.exists(os.path.join(_LOCAL_MODEL_DIR, "config.json")):
            os.makedirs(_LOCAL_MODEL_DIR, exist_ok=True)
            print(f"[embedding] 首次下载模型到本地目录 {_LOCAL_MODEL_DIR}")
            try:
                from huggingface_hub import snapshot_download
                snapshot_download(
                    repo_id=f"sentence-transformers/{config.EMBEDDING_MODEL}",
                    local_dir=_LOCAL_MODEL_DIR,
                    local_dir_use_symlinks=False,  # 关键：不用 symlink，直接复制文件
                )
                print(f"[embedding] 模型下载完成")
            except Exception as e:
                print(f"[embedding] 模型下载失败: {e}")
                raise

        # 从本地目录加载（避免每次启动都检查 huggingface.co）
        _model = SentenceTransformer(_LOCAL_MODEL_DIR)
        print(f"[embedding] 模型加载完成，输出维度: {_model.get_sentence_embedding_dimension()}")
    return _model


def embed(text: str) -> list:
    """对单条文本生成 384 维向量（归一化，便于余弦相似度）。"""
    model = get_model()
    vec = model.encode(text, normalize_embeddings=True)
    return vec.tolist()


def embed_batch(texts: list) -> list:
    """对多条文本批量生成向量，返回 list[list[float]]。"""
    model = get_model()
    vecs = model.encode(texts, normalize_embeddings=True)
    return [v.tolist() for v in vecs]
