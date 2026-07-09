"""内容采集层：实时互联网检索（Bing / Tavily）。

不使用固定知识库——所有内容来自实时互联网搜索。
服务高价值人群：播客、访谈、认知类内容、跨领域博客。
每日信息持续更新，知识库无法长久支撑，只能依赖云端实时检索。

模型：基于"认知大方向 + 方向内子领域"动态生成检索查询，
不再依赖固定 24 维度。每个查询附带 direction_name 与 subfield_name，
用于增强检索语义（如"古诗"+"诗论"+"播客 访谈 深度解读 认知"）。

入口：
  fetch_realtime(query, direction_name, subfield_name, max_results)
    优先 Bing，备选 Tavily，均未配置则返回空列表。
"""
import re
import httpx
import config


def _clean(text: str) -> str:
    """清理文本：折叠空白、去除 HTML 标签残留。"""
    if not text:
        return ""
    # 去除 HTML 标签（搜索 API 返回的 snippet 可能含标签）
    text = re.sub(r"<[^>]+>", "", text)
    return re.sub(r"\s+", " ", text).strip()


def _enhance_query_for_high_value(query: str, direction_name: str = "", subfield_name: str = "") -> str:
    """针对高价值人群增强检索查询（基于认知大方向 + 方向内子领域）。

    不搜裸关键词，而是搜"关键词 + 播客/访谈/深度解读/认知"，
    确保检索到的是认知类内容而非 SEO 垃圾。

    参数：
      direction_name: 认知大方向名（如 "古诗"、"Python 编程"）
      subfield_name: 方向内子领域名（如 "诗论"、"Web 框架"）
    """
    # 通用增强：基于认知大方向与子领域拼装高价值内容关键词
    suffix = f"{direction_name} {subfield_name} 播客 访谈 深度解读 认知".strip()
    return f"{query} {suffix}"


async def fetch_from_bing(query: str, direction_name: str = "", subfield_name: str = "", max_results: int = None) -> list:
    """调用 Bing Web Search API 实时检索互联网内容。

    检索策略：针对高价值人群，优先播客、访谈、认知类内容。
    返回文档列表，每个文档标注 source_type="bing"。

    参数：
      query: 原始查询（如"古诗 诗论"）
      direction_name: 认知大方向名（用于查询增强）
      subfield_name: 方向内子领域名（用于查询增强）
      max_results: 期望返回结果数，未指定则用 config.BING_MAX_RESULTS
    """
    if max_results is None:
        max_results = config.BING_MAX_RESULTS

    if not config.BING_API_KEY:
        print("[content_sources] 警告：BING_API_KEY 未配置，无法进行实时检索")
        return []

    # 针对高价值人群的检索增强：加入播客/访谈/深度内容关键词
    # 不是搜"量子力学"，而是搜"量子力学 播客 访谈 深度解读"
    enhanced_query = _enhance_query_for_high_value(query, direction_name, subfield_name)

    headers = {
        "Ocp-Apim-Subscription-Key": config.BING_API_KEY,
        "Accept": "application/json",
    }
    params = {
        "q": enhanced_query,
        "count": max_results,
        "offset": 0,
        "mkt": "zh-CN",
        "safesearch": "Moderate",
        "responseFilter": "Webpages",
        "textDecorations": False,
        "textFormat": "Raw",
    }

    docs = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(config.BING_SEARCH_ENDPOINT, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        web_pages = data.get("webPages", {}).get("value", [])
        for page in web_pages:
            title = _clean(page.get("name", ""))
            snippet = _clean(page.get("snippet", ""))
            url = page.get("url", "")
            display_url = page.get("displayUrl", url)
            date_published = page.get("dateLastCrawled", "")

            if not title or not snippet:
                continue

            docs.append({
                "title": title,
                "description": snippet,
                "url": url,
                "display_url": display_url,
                "date_published": date_published,
                "source": _extract_source_name(display_url),
                "source_type": "bing",
            })

        print(f"[content_sources] Bing 检索成功 query='{enhanced_query}' → {len(docs)} 条结果")

    except httpx.HTTPStatusError as e:
        print(f"[content_sources] Bing API HTTP 错误: {e.response.status_code} - {e.response.text[:200]}")
    except Exception as e:
        print(f"[content_sources] Bing 检索失败 query='{enhanced_query}': {e}")

    return docs


async def fetch_from_tavily(query: str, direction_name: str = "", subfield_name: str = "", max_results: int = None) -> list:
    """调用 Tavily Search API 实时检索互联网内容（备选搜索 API，专为 AI 设计）。

    Tavily 返回结构化数据（title / content / url / score），适合 RAG 直接消费。
    返回文档列表，每个文档标注 source_type="tavily"，字段与 fetch_from_bing 对齐。

    参数：
      query: 原始查询
      direction_name: 认知大方向名（用于查询增强）
      subfield_name: 方向内子领域名（用于查询增强）
      max_results: 期望返回结果数，未指定则用 config.BING_MAX_RESULTS（共用上限）
    """
    if max_results is None:
        max_results = config.BING_MAX_RESULTS

    if not config.TAVILY_API_KEY:
        print("[content_sources] 警告：TAVILY_API_KEY 未配置，无法进行 Tavily 检索")
        return []

    # 复用 Bing 的查询增强逻辑（统一高价值内容关键词策略）
    enhanced_query = _enhance_query_for_high_value(query, direction_name, subfield_name)

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = {
        "api_key": config.TAVILY_API_KEY,
        "query": enhanced_query,
        "max_results": max_results,
        # 偏好深度内容（播客/访谈/长文），与"高价值人群"策略一致
        "search_depth": "advanced",
        # 排除纯导航类结果
        "include_answer": False,
        "include_raw_content": False,
    }

    docs = []
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.post(config.TAVILY_ENDPOINT, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()

        # Tavily 返回结构：{ results: [ { title, url, content, score, ... } ], ... }
        results = data.get("results", []) or []
        for item in results:
            title = _clean(item.get("title", ""))
            content = _clean(item.get("content", ""))
            url = item.get("url", "")

            if not title or not content:
                continue

            docs.append({
                "title": title,
                "description": content,
                "url": url,
                "display_url": url,  # Tavily 不单独返回 displayUrl，直接用 url
                "date_published": item.get("published_date", "") or "",
                "source": _extract_source_name(url),
                "source_type": "tavily",
            })

        print(f"[content_sources] Tavily 检索成功 query='{enhanced_query}' → {len(docs)} 条结果")

    except httpx.HTTPStatusError as e:
        print(f"[content_sources] Tavily API HTTP 错误: {e.response.status_code} - {e.response.text[:200]}")
    except Exception as e:
        print(f"[content_sources] Tavily 检索失败 query='{enhanced_query}': {e}")

    return docs


async def fetch_realtime(query: str, direction_name: str = "", subfield_name: str = "", max_results: int = None) -> list:
    """实时互联网检索统一入口：优先 Bing，备选 Tavily，均未配置则返回空列表。

    参数：
      query: 原始查询
      direction_name: 认知大方向名
      subfield_name: 方向内子领域名
      max_results: 期望返回结果数

    返回：文档列表，字段格式由 Bing / Tavily 统一对齐。
    """
    if config.BING_API_KEY:
        return await fetch_from_bing(query, direction_name, subfield_name, max_results)
    elif config.TAVILY_API_KEY:
        return await fetch_from_tavily(query, direction_name, subfield_name, max_results)
    else:
        print("[content_sources] 警告：BING_API_KEY 和 TAVILY_API_KEY 均未配置")
        return []


def _extract_source_name(display_url: str) -> str:
    """从 displayUrl 提取来源站点名（如 youtube.com → YouTube）。"""
    if not display_url:
        return "互联网"
    try:
        # 去除协议前缀
        url_clean = display_url.replace("https://", "").replace("http://", "")
        domain = url_clean.split("/")[0].replace("www.", "")
        # 简单映射常见域名
        domain_map = {
            "youtube.com": "YouTube",
            "bilibili.com": "B站",
            "xiayuzhan.com": "下语站",
            "zhihu.com": "知乎",
            "douban.com": "豆瓣",
            "sspai.com": "少数派",
            "medium.com": "Medium",
            "substack.com": "Substack",
            "xiaogushi.com": "小故事",
            "ted.com": "TED",
            "coursera.org": "Coursera",
            "douban.fm": "豆瓣FM",
            "xiaoyuzhoufm.com": "小宇宙FM",
        }
        for d, name in domain_map.items():
            if d in domain:
                return name
        return domain
    except Exception:
        return "互联网"
