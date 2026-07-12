// ===== RAG Client v5.0 =====
// 调用 Python FastAPI 后端（:8000）的实时互联网检索
// 架构：Bing Web Search API 实时检索 + Qdrant 缓存层（非固定知识库）
// 服务高价值人群：播客、访谈、认知类内容、跨领域博客
// 生产模式（Railway/Vercel）下 RAG 后端未部署，直接跳过，降级到纯 DeepSeek 生成

const RAG_BASE = process.env.RAG_BASE_URL || "http://localhost:8000";
// 生产环境（Railway）无 Python 后端，跳过 RAG 调用避免 8s 超时
const RAG_DISABLED = !process.env.RAG_BASE_URL;

export interface RagResult {
  id: string;
  title: string;
  description: string;
  source: string;
  source_type: "bing" | "unknown";  // v5.0：内容来自 Bing 实时检索
  url: string;
  read_time_minutes: number;
  dimension_id: string;
  score: number;
  retrieval_source: "bm25" | "vector" | "hybrid";
}

export interface RetrieveResponse {
  results: RagResult[];
  total: number;
}

/**
 * 调用 Python RAG 后端检索内容
 * 失败时返回空数组（不阻断主流程，fallback 到纯 DeepSeek 生成）
 */
export async function retrieveFromRag(params: {
  query: string;
  highExposureFields: string[];
  dimensionId: string;
  limit?: number;
}): Promise<RagResult[]> {
  // 生产环境无 RAG 后端，直接返回空数组，降级到纯 DeepSeek 生成
  if (RAG_DISABLED) {
    return [];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000); // 8s 超时

  try {
    const res = await fetch(`${RAG_BASE}/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: params.query,
        high_exposure_fields: params.highExposureFields,
        dimension_id: params.dimensionId,
        limit: params.limit ?? 5,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[RAG] retrieve HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.success) {
      console.error("[RAG] retrieve failed:", data.error);
      return [];
    }

    return data.results || [];
  } catch (e: any) {
    if (e.name === "AbortError") {
      console.error("[RAG] retrieve timeout (8s)");
    } else {
      console.error("[RAG] retrieve error:", e.message);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * 触发内容采集（异步，不等待完成）
 */
export async function ingestToRag(query: string, dimensionId: string): Promise<boolean> {
  if (RAG_DISABLED) return false;
  try {
    const res = await fetch(`${RAG_BASE}/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, dimension_id: dimensionId }),
    });
    const data = await res.json();
    return data.success === true;
  } catch (e: any) {
    console.error("[RAG] ingest error:", e.message);
    return false;
  }
}

/**
 * 检查 RAG 后端健康状态
 */
export async function checkRagHealth(): Promise<boolean> {
  if (RAG_DISABLED) return false;
  try {
    const res = await fetch(`${RAG_BASE}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
