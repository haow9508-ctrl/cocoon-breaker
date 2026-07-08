"""BM25 关键词检索：基于 rank-bm25 的 BM25Okapi。

维护一个内存文档库（id -> 文档字典）。中文采用字符级分词以避免引入 jieba 依赖。
"""
import re
from rank_bm25 import BM25Okapi

# 文档库：doc_id -> 完整文档字典（含 title/description 等字段）
_documents: dict = {}
# 有序 doc_id 列表（与 _tokenized_corpus 一一对应）
_doc_ids: list = []
# 分词后的语料
_tokenized_corpus: list = []
# BM25 实例
_bm25 = None


def _tokenize(text: str) -> list:
    """分词：中文按字符切分，英文按单词切分（小写化）。

    避免 jieba 依赖，采用最简单的字符级分词；对 BM25 关键词召回已足够。
    """
    if not text:
        return []
    tokens = []
    # 中文字符（CJK 统一汉字）逐字切分
    for ch in text:
        if "\u4e00" <= ch <= "\u9fff":
            tokens.append(ch)
    # 英文/数字按词切分
    tokens.extend(re.findall(r"[a-zA-Z0-9]+", text.lower()))
    return tokens


def _doc_text(doc: dict) -> str:
    """拼接文档的可索引文本（title + description + text）。"""
    parts = []
    for key in ("title", "description", "text"):
        val = doc.get(key)
        if val:
            parts.append(str(val))
    return " ".join(parts)


def index(documents: list) -> None:
    """建立索引：传入文档列表，重置内部状态并重建 BM25。"""
    global _documents, _doc_ids, _tokenized_corpus, _bm25
    _documents = {}
    _doc_ids = []
    _tokenized_corpus = []
    for doc in documents:
        doc_id = str(doc["id"])
        _documents[doc_id] = doc
        _doc_ids.append(doc_id)
        _tokenized_corpus.append(_tokenize(_doc_text(doc)))
    _bm25 = BM25Okapi(_tokenized_corpus) if _tokenized_corpus else None


def add_documents(documents: list) -> None:
    """增量添加文档并重建 BM25 索引（一次重建，避免逐条 O(n^2) 开销）。"""
    global _documents, _doc_ids, _tokenized_corpus, _bm25
    for doc in documents:
        doc_id = str(doc["id"])
        _documents[doc_id] = doc
        _doc_ids.append(doc_id)
        _tokenized_corpus.append(_tokenize(_doc_text(doc)))
    _bm25 = BM25Okapi(_tokenized_corpus) if _tokenized_corpus else None


def add_document(doc: dict) -> None:
    """添加单条文档（内部会重建索引）。"""
    add_documents([doc])


def get_document(doc_id: str) -> dict:
    """根据 doc_id 获取原始文档字典。"""
    return _documents.get(str(doc_id), {})


def search(query: str, limit: int = 10) -> list:
    """BM25 检索，返回 [(doc_id, score), ...]，按分数降序，过滤 0 分项。"""
    if _bm25 is None:
        return []
    tokens = _tokenize(query)
    if not tokens:
        return []
    scores = _bm25.get_scores(tokens)
    # 按分数降序取 top-limit，剔除非正分
    ranked = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)[:limit]
    return [(_doc_ids[i], float(s)) for i, s in ranked if s > 0]


def stats() -> dict:
    """返回当前索引统计信息。"""
    return {
        "doc_count": len(_doc_ids),
        "indexed": _bm25 is not None,
    }
