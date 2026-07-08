"""内容采集层（抗 GEO 核心）。

优先接入 arXiv 学术论文——它们不受搜索引擎排名优化（GEO）污染；
辅以 Wikipedia 条目摘要作为背景知识。每个文档标注 source_type 与 url。
"""
import re
import xml.etree.ElementTree as ET
import httpx
import config

# arXiv API（返回 Atom XML，必须用 HTTPS 避免 301 重定向）
ARXIV_API = "https://export.arxiv.org/api/query"
# Wikipedia REST API（返回 JSON）
WIKIPEDIA_API = "https://zh.wikipedia.org/w/api.php"

# Atom 命名空间
_ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


def _clean(text: str) -> str:
    """清理文本：折叠空白、去除换行。"""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


async def fetch_arxiv(query: str, max_results: int = None) -> list:
    """调用 arXiv API 采集论文，返回文档列表。

    抗 GEO 策略：arXiv 是学术预印本库，不受商业搜索引擎排名干预。
    """
    if max_results is None:
        max_results = config.ARXIV_MAX_RESULTS
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": max_results,
        "sortBy": "relevance",
        "sortOrder": "descending",
    }
    docs = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(ARXIV_API, params=params)
            resp.raise_for_status()
        root = ET.fromstring(resp.text)
        for entry in root.findall("atom:entry", _ATOM_NS):
            title_el = entry.find("atom:title", _ATOM_NS)
            summary_el = entry.find("atom:summary", _ATOM_NS)
            id_el = entry.find("atom:id", _ATOM_NS)
            url = id_el.text.strip() if id_el is not None and id_el.text else ""
            pdf_url = None
            for link in entry.findall("atom:link", _ATOM_NS):
                if link.get("title") == "pdf":
                    pdf_url = link.get("href")
            docs.append({
                "title": _clean(title_el.text if title_el is not None else ""),
                "description": _clean(summary_el.text if summary_el is not None else ""),
                "url": url,
                "pdf_url": pdf_url,
                "source": "arXiv",
                "source_type": "arxiv",
            })
    except Exception as e:
        print(f"[content_sources] arXiv 采集失败 query='{query}': {e}")
    return docs


async def fetch_wikipedia(query: str, max_results: int = None) -> list:
    """调用 Wikipedia API 采集条目摘要，返回文档列表。

    流程：先搜索条目标题，再批量获取摘要（extracts）。
    """
    if max_results is None:
        max_results = config.WIKIPEDIA_MAX_RESULTS
    docs = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            # 第一步：搜索条目
            search_params = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "srlimit": max_results,
                "format": "json",
                "utf8": 1,
            }
            resp = await client.get(WIKIPEDIA_API, params=search_params)
            resp.raise_for_status()
            data = resp.json()
            search_hits = data.get("query", {}).get("search", [])
            titles = [h["title"] for h in search_hits]
            if not titles:
                return docs
            # 第二步：批量获取摘要
            extract_params = {
                "action": "query",
                "prop": "extracts",
                "exintro": 1,
                "explaintext": 1,
                "titles": "|".join(titles),
                "format": "json",
                "utf8": 1,
            }
            resp2 = await client.get(WIKIPEDIA_API, params=extract_params)
            resp2.raise_for_status()
            data2 = resp2.json()
            pages = data2.get("query", {}).get("pages", {})
            for _page_id, page in pages.items():
                title = page.get("title", "")
                extract = page.get("extract", "")
                if not extract:
                    continue
                docs.append({
                    "title": title,
                    "description": _clean(extract),
                    "url": f"https://zh.wikipedia.org/wiki/{title}",
                    "pdf_url": None,
                    "source": "Wikipedia",
                    "source_type": "wikipedia",
                })
    except Exception as e:
        print(f"[content_sources] Wikipedia 采集失败 query='{query}': {e}")
    return docs
