// ===== RAG Client v4.2 =====
// 调用 Python FastAPI 后端（:8000）的 RAG 检索
// 抗 GEO 核心：内容来自 arXiv/Wikipedia 等边缘信息源，绕过 LLM 训练数据偏见

const RAG_BASE = process.env.RAG_BASE_URL || "http://localhost:8000";

export interface RagResult {
  id: string;
  title: string;
  description: string;
  source: string;
  source_type: "arxiv" | "wikipedia" | "unknown";
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
  try {
    const res = await fetch(`${RAG_BASE}/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}
