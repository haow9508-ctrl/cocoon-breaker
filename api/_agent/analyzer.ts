// ===== 茧房扫描分析 v2 =====
// 不静默降级：LLM 失败时抛出错误，由上层路由处理

import { COGNITIVE_DIMENSIONS } from "../_knowledge/domains.js";
import { analyzeAllDimensions } from "./llm.js";

export async function buildExposureMap(userInput?: string): Promise<Map<string, number>> {
  // 无输入 → demo 默认值（仅用于"直接体验"模式）
  if (!userInput?.trim()) {
    const m = new Map<string, number>();
    COGNITIVE_DIMENSIONS.forEach((d) => m.set(d.id, d.count));
    return m;
  }

  // 有输入 → 必须调用 DeepSeek 分析，失败则抛错
  const llmExposure = await analyzeAllDimensions(userInput.trim());
  const result = new Map<string, number>();
  COGNITIVE_DIMENSIONS.forEach((d) => {
    const val = llmExposure.get(d.id);
    result.set(d.id, val !== undefined ? val : d.count);
  });
  return result;
}

export const analyzeExposure = buildExposureMap;

export function isBlindSpot(exposure: Map<string, number>, dimensionId: string): boolean {
  // 阈值提高到30：LLM给未提及维度默认10-20，低于30即为实际盲区
  return (exposure.get(dimensionId) || 0) < 30;
}

export function getHighExposureDimensions(exposure: Map<string, number>): string[] {
  return Array.from(exposure.entries())
    .filter(([_, c]) => c >= 100)
    .map(([id]) => id);
}

export function getBlindSpotDimensions(exposure: Map<string, number>): string[] {
  return Array.from(exposure.entries())
    .filter(([_, c]) => c < 30)
    .map(([id]) => id);
}
