// ===== ⑤ 自评层 v4.0 =====
// 基于冲击自评历史，调整难度等级

import type { DifficultyLevel } from "./analyzer.js";
import type { ImpactRecord } from "./recommender.js";

export interface AssessmentResult {
  newDifficulty: DifficultyLevel;
  difficultyChanged: boolean;
  milestone: string | null;
}

/** ⑤ 自评：基于冲击自评历史，调整难度等级 */
export function adjustDifficulty(
  currentDifficulty: DifficultyLevel,
  impactHistory: ImpactRecord[]
): AssessmentResult {
  // 取最近 3 次自评
  const recent = impactHistory.slice(-3);
  if (recent.length < 3) {
    return { newDifficulty: currentDifficulty, difficultyChanged: false, milestone: null };
  }

  const avgScore = recent.reduce((sum, r) => sum + r.impactScore, 0) / recent.length;
  const allHigh = recent.every((r) => r.impactScore >= 4);
  const allLow = recent.every((r) => r.impactScore <= 2);

  let newDifficulty = currentDifficulty;
  let milestone: string | null = null;

  // 升级条件：连续3次 ≥4星
  if (allHigh) {
    if (currentDifficulty === "L1") {
      newDifficulty = "L2";
      milestone = "解锁 L2：中距盲区";
    } else if (currentDifficulty === "L2") {
      newDifficulty = "L3";
      milestone = "解锁 L3：远端盲区";
    }
  }

  // 降级条件：连续3次 ≤2星
  if (allLow) {
    if (currentDifficulty === "L3") {
      newDifficulty = "L2";
      milestone = "难度回调至 L2";
    } else if (currentDifficulty === "L2") {
      newDifficulty = "L1";
      milestone = "难度回调至 L1";
    }
  }

  return {
    newDifficulty,
    difficultyChanged: newDifficulty !== currentDifficulty,
    milestone,
  };
}

/** 检查里程碑触发 */
export function checkMilestones(
  impactHistory: ImpactRecord[],
  readHistory: string[],
  exposure: Map<string, number>,
  existingMilestones: string[]
): Array<{ type: string; description: string }> {
  const newMilestones: Array<{ type: string; description: string }> = [];

  // 首次接触某维度
  const dimensionsRead = new Set(impactHistory.map((r) => r.dimensionId));
  for (const dimId of dimensionsRead) {
    const milestoneId = `first_contact_${dimId}`;
    if (!existingMilestones.includes(milestoneId)) {
      const dimName = impactHistory.find((r) => r.dimensionId === dimId)?.title || dimId;
      newMilestones.push({
        type: "first_contact",
        description: `第一次接触 ${dimName}`,
      });
    }
  }

  // 连续阅读天数（简化：按 impactHistory 数量）
  if (impactHistory.length >= 7 && !existingMilestones.includes("streak_7")) {
    newMilestones.push({
      type: "streak_7",
      description: "一周爆破手 · 连续完成7次挑战",
    });
  }

  if (impactHistory.length >= 30 && !existingMilestones.includes("streak_30")) {
    newMilestones.push({
      type: "streak_30",
      description: "月度探索者 · 完成30次挑战",
    });
  }

  // 高冲击时刻：5星自评
  const fiveStarRecords = impactHistory.filter((r) => r.impactScore === 5);
  if (fiveStarRecords.length >= 1 && !existingMilestones.includes("high_impact_first")) {
    newMilestones.push({
      type: "high_impact",
      description: "认知颠覆时刻 · 首次5星冲击",
    });
  }

  // 维度覆盖数
  const coveredCount = Array.from(exposure.values()).filter((v) => v > 0).length;
  if (coveredCount >= 12 && !existingMilestones.includes("half_coverage")) {
    newMilestones.push({
      type: "dimension_unlocked",
      description: "认知半觉醒 · 覆盖12个维度",
    });
  }

  if (coveredCount >= 24 && !existingMilestones.includes("full_coverage")) {
    newMilestones.push({
      type: "dimension_unlocked",
      description: "认知全觉醒 · 覆盖全部24维度",
    });
  }

  return newMilestones;
}
