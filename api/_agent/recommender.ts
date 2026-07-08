// ===== ③ 决策层 v4.1 — 真正的三维决策引擎 =====
// 冲击度由 DeepSeek 评估（不再用硬编码矩阵）
// 保留硬编码矩阵作为 fallback（API 失败时降级）

import { COGNITIVE_DIMENSIONS, getDimensionById } from "../_knowledge/domains.js";
import { generateChallenge, ChallengeContent, evaluateCognitiveDistances } from "./llm.js";
import type { DifficultyLevel } from "./analyzer.js";

export interface ImpactRecord {
  contentId: string;
  dimensionId: string;
  title: string;
  impactScore: 1 | 2 | 3 | 4 | 5;
  reflection: string;
  timestamp: string;
}

export interface DecisionInput {
  exposure: Map<string, number>;
  readHistory: string[];
  impactHistory: ImpactRecord[];
  difficultyLevel: DifficultyLevel;
  highExposureFields: string[];
}

interface ScoredDimension {
  dimensionId: string;
  dimensionName: string;
  blindSpotScore: number;     // 盲区度 0-1
  impactScore: number;        // 冲击度 0-1（DeepSeek 评估）
  acceptabilityScore: number; // 可接受度 0-1
  totalScore: number;
}

export interface ChallengeItem {
  id: string;
  dimensionId: string;
  dimensionName: string;
  title: string;
  why: string;
  description: string;
  source: string;
  readTimeMinutes: number;
  difficultyLevel: DifficultyLevel;
  coachGuidance: string;
  exposureCount: number;
}

export interface ChallengeResult {
  items: ChallengeItem[];
  blindSpotCount: number;
  selectedDimensions: string[];
}

// 维度类别映射（仅用于可接受度计算的 fallback）
const DIMENSION_CATEGORY: Record<string, "entertainment" | "life" | "knowledge" | "science" | "humanities"> = {
  entertainment: "entertainment", humor: "entertainment", beauty: "life", movie: "entertainment",
  food: "life", gaming: "entertainment", tech: "knowledge", auto: "life",
  sports: "life", finance: "knowledge", history: "humanities", psychology: "humanities",
  art: "humanities", literature: "humanities", sociology: "humanities", philosophy: "humanities",
  physics: "science", astronomy: "science", classical: "humanities", biology: "science",
  archaeology: "humanities", linguistics: "humanities", architecture: "humanities", math: "science",
};

// Fallback 距离矩阵（DeepSeek 不可用时降级）
const FALLBACK_DISTANCE: Record<string, Record<string, number>> = {
  entertainment: { entertainment: 0.1, life: 0.3, knowledge: 0.6, humanities: 0.8, science: 1.0 },
  life: { entertainment: 0.3, life: 0.1, knowledge: 0.4, humanities: 0.6, science: 0.8 },
  knowledge: { entertainment: 0.6, life: 0.4, knowledge: 0.1, humanities: 0.4, science: 0.5 },
  humanities: { entertainment: 0.8, life: 0.6, knowledge: 0.4, humanities: 0.1, science: 0.5 },
  science: { entertainment: 1.0, life: 0.8, knowledge: 0.5, humanities: 0.5, science: 0.1 },
};

/**
 * ③ 决策：三维决策引擎，选择 Top 3 盲区维度
 * v4.1：冲击度由 DeepSeek 评估，不再用硬编码矩阵
 */
export async function decideBlindSpots(
  input: DecisionInput
): Promise<Array<{ id: string; name: string; exposureCount: number }>> {
  const maxExposure = Math.max(...Array.from(input.exposure.values()), 100);

  // 候选维度：排除已读
  const candidates = COGNITIVE_DIMENSIONS.filter((d) => !input.readHistory.includes(d.id));

  // 用 DeepSeek 批量评估认知距离（冲击度）
  const distanceMap = await evaluateCognitiveDistances(
    candidates.map((d) => ({ id: d.id, name: d.name })),
    input.highExposureFields
  );

  const scored: ScoredDimension[] = candidates.map((dim) => {
    const exposureCount = input.exposure.get(dim.id) ?? dim.count;

    // ① 盲区度：暴露越少，盲区度越高
    const blindSpotScore = 1 - Math.min(exposureCount / maxExposure, 1);

    // ② 冲击度：DeepSeek 评估的认知距离（替代硬编码矩阵）
    const impactScore = distanceMap.get(dim.id) ?? 0.5;

    // ③ 可接受度：根据难度等级 + 类别距离（fallback 逻辑保留）
    const dimCategory = DIMENSION_CATEGORY[dim.id];
    const highExposureCategories = input.highExposureFields
      .map((name) => {
        const d = COGNITIVE_DIMENSIONS.find((x) => x.name === name);
        return d ? DIMENSION_CATEGORY[d.id] : null;
      })
      .filter(Boolean) as string[];

    const acceptabilityScore = calculateAcceptability(
      dimCategory,
      highExposureCategories,
      input.difficultyLevel
    );

    // 综合分：加权
    const weights = getWeights(input.difficultyLevel);
    const totalScore =
      blindSpotScore * weights.blindSpot +
      impactScore * weights.impact +
      acceptabilityScore * weights.acceptability;

    return {
      dimensionId: dim.id,
      dimensionName: dim.name,
      blindSpotScore,
      impactScore,
      acceptabilityScore,
      totalScore,
    };
  });

  // 按难度等级过滤
  const filtered = filterByDifficulty(scored, input.difficultyLevel, input.highExposureFields);

  // 综合排序，取 Top 3
  const top3 = filtered.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

  return top3.map((s) => ({
    id: s.dimensionId,
    name: s.dimensionName,
    exposureCount: input.exposure.get(s.dimensionId) ?? 0,
  }));
}

/** 计算可接受度：根据难度等级和类别距离 */
function calculateAcceptability(
  dimCategory: string,
  highExposureCategories: string[],
  difficultyLevel: DifficultyLevel
): number {
  if (highExposureCategories.length === 0) return 0.5;

  const avgDistance = highExposureCategories.reduce((sum, cat) =>
    sum + (FALLBACK_DISTANCE[dimCategory]?.[cat] ?? 0.5), 0) / highExposureCategories.length;

  switch (difficultyLevel) {
    case "L1":
      return 1 - avgDistance;
    case "L2":
      return 1 - Math.abs(avgDistance - 0.5) * 2;
    case "L3":
      return avgDistance;
  }
}

/** 按难度等级过滤维度（基于 DeepSeek 评估的距离） */
function filterByDifficulty(
  scored: ScoredDimension[],
  difficultyLevel: DifficultyLevel,
  highExposureFields: string[]
): ScoredDimension[] {
  // 使用 DeepSeek 评估的 impactScore 进行过滤
  return scored.filter((s) => {
    switch (difficultyLevel) {
      case "L1": return s.impactScore < 0.6;  // 相邻盲区
      case "L2": return s.impactScore >= 0.3 && s.impactScore <= 0.8; // 中距盲区
      case "L3": return s.impactScore >= 0.5;  // 远端盲区
    }
  });
}

/** 获取难度权重 */
function getWeights(level: DifficultyLevel): { blindSpot: number; impact: number; acceptability: number } {
  switch (level) {
    case "L1": return { blindSpot: 0.3, impact: 0.2, acceptability: 0.5 };
    case "L2": return { blindSpot: 0.3, impact: 0.4, acceptability: 0.3 };
    case "L3": return { blindSpot: 0.2, impact: 0.6, acceptability: 0.2 };
  }
}

/** ③④ 决策 + 生成：完整每日挑战流程 */
export async function generateDailyChallenge(
  input: DecisionInput
): Promise<ChallengeResult> {
  // ③ 决策：三维决策引擎选择盲区（现在是 async，调 DeepSeek）
  const selectedDims = await decideBlindSpots(input);

  if (selectedDims.length === 0) {
    return { items: [], blindSpotCount: 0, selectedDimensions: [] };
  }

  // ④ 生成：调用 DeepSeek 生成挑战内容
  const challenges: ChallengeContent[] = await generateChallenge(
    selectedDims,
    input.highExposureFields,
    input.difficultyLevel
  );

  const items: ChallengeItem[] = challenges.map((c, idx) => ({
    id: `${c.dimensionId}_${Date.now()}_${idx}`,
    dimensionId: c.dimensionId,
    dimensionName: c.dimensionName,
    title: c.title,
    why: c.why,
    description: c.description,
    source: c.source,
    readTimeMinutes: c.readTimeMinutes,
    difficultyLevel: c.difficultyLevel,
    coachGuidance: c.coachGuidance,
    exposureCount: input.exposure.get(c.dimensionId) ?? 0,
  }));

  const blindSpotCount = COGNITIVE_DIMENSIONS.filter(
    (d) => (input.exposure.get(d.id) ?? d.count) < 30
  ).length;

  return {
    items,
    blindSpotCount,
    selectedDimensions: selectedDims.map((d) => d.id),
  };
}

/** 内容详情：由 DeepSeek 为单个维度动态生成 */
export async function getChallengeDetail(
  dimensionId: string,
  exposure: Map<string, number>,
  difficultyLevel: DifficultyLevel
): Promise<ChallengeItem | undefined> {
  const dim = getDimensionById(dimensionId);
  if (!dim) return undefined;

  const highExposureNames = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) >= 200)
    .map((d) => d.name);

  const challenges = await generateChallenge(
    [{ id: dimensionId, name: dim.name, exposureCount: exposure.get(dimensionId) ?? dim.count }],
    highExposureNames,
    difficultyLevel
  );

  if (challenges.length === 0) return undefined;
  const c = challenges[0];

  return {
    id: `${dimensionId}_${Date.now()}`,
    dimensionId,
    dimensionName: dim.name,
    title: c.title,
    why: c.why,
    description: c.description,
    source: c.source,
    readTimeMinutes: c.readTimeMinutes,
    difficultyLevel,
    coachGuidance: c.coachGuidance,
    exposureCount: exposure.get(dimensionId) ?? dim.count,
  };
}
