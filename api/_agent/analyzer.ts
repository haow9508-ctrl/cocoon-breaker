// ===== 茧房扫描分析 v2 =====
// 关键修复：LLM 必须对所有 24 维度给出值，而非只覆盖少数
// 如果用户说"从不看XX"，对应维度必须降低

import { COGNITIVE_DIMENSIONS } from "../_knowledge/domains.js";
import { analyzeAllDimensions } from "./llm.js";

export async function buildExposureMap(userInput?: string): Promise<Map<string, number>> {
  // 无输入 → demo 默认值
  if (!userInput?.trim()) {
    const m = new Map<string, number>();
    COGNITIVE_DIMENSIONS.forEach((d) => m.set(d.id, d.count));
    return m;
  }

  try {
    // LLM 必须返回全部 24 维度的暴露值
    const llmExposure = await analyzeAllDimensions(userInput.trim());
    // 只保留已知维度
    const knownIds = new Set(COGNITIVE_DIMENSIONS.map((d) => d.id));
    const result = new Map<string, number>();
    COGNITIVE_DIMENSIONS.forEach((d) => {
      const val = llmExposure.get(d.id);
      result.set(d.id, val !== undefined ? val : d.count);
    });
    return result;
  } catch (e) {
    console.warn("[Analyzer] LLM failed, using defaults");
    const m = new Map<string, number>();
    COGNITIVE_DIMENSIONS.forEach((d) => m.set(d.id, d.count));
    return m;
  }
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
