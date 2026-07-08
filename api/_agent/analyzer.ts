// ===== ② 分析层 v4.0 =====
// 不静默降级：LLM 失败时抛出错误

import { COGNITIVE_DIMENSIONS } from "../_knowledge/domains.js";
import { analyzeAllDimensions } from "./llm.js";

export type DifficultyLevel = "L1" | "L2" | "L3";

export interface AnalysisResult {
  exposure: Map<string, number>;
  highExposureFields: string[];
  blindSpotFields: string[];
  initialDifficulty: DifficultyLevel;
}

/** ② 分析：生成24维暴露值 + 高频领域 + 盲区领域 + 初始难度等级 */
export async function analyzeExposure(userInput: string): Promise<AnalysisResult> {
  if (!userInput?.trim()) {
    return buildDefaultResult();
  }

  const llmExposure = await analyzeAllDimensions(userInput.trim());
  const result = new Map<string, number>();
  COGNITIVE_DIMENSIONS.forEach((d) => {
    const val = llmExposure.get(d.id);
    result.set(d.id, val !== undefined ? val : d.count);
  });

  return buildResultFromExposure(result);
}

function buildDefaultResult(): AnalysisResult {
  const m = new Map<string, number>();
  COGNITIVE_DIMENSIONS.forEach((d) => m.set(d.id, d.count));
  return buildResultFromExposure(m);
}

function buildResultFromExposure(exposure: Map<string, number>): AnalysisResult {
  const highExposureFields = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) >= 200)
    .map((d) => d.name);

  const blindSpotFields = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) < 30)
    .map((d) => d.name);

  // 初始难度：高频领域越多，说明用户认知越窄，从 L1 开始
  // 高频领域 ≤3 → L1，4-6 → L1，>6 → L1（新用户统一从 L1 开始）
  const initialDifficulty: DifficultyLevel = "L1";

  return {
    exposure,
    highExposureFields,
    blindSpotFields,
    initialDifficulty,
  };
}

export function isBlindSpot(exposure: Map<string, number>, dimensionId: string): boolean {
  return (exposure.get(dimensionId) || 0) < 30;
}

export function getHighExposureDimensions(exposure: Map<string, number>): string[] {
  return Array.from(exposure.entries())
    .filter(([_, c]) => c >= 200)
    .map(([id]) => id);
}

export function getBlindSpotDimensions(exposure: Map<string, number>): string[] {
  return Array.from(exposure.entries())
    .filter(([_, c]) => c < 30)
    .map(([id]) => id);
}
