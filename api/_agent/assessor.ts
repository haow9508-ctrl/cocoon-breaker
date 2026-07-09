// ===== ⑤ 自评层 v6.0 =====
// 基于冲击自评历史，调整难度等级
// v6.0：ImpactRecord 使用 subfieldId（替代 dimensionId），里程碑基于方向内子领域覆盖

import type { DifficultyLevel } from "./analyzer.js";
import type { ImpactRecord } from "./recommender.js";
import type { CognitiveDirection } from "../_knowledge/domains.js";

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
      milestone = "解锁 L2：同方向中距子领域";
    } else if (currentDifficulty === "L2") {
      newDifficulty = "L3";
      milestone = "解锁 L3：同方向远端子领域（类比拓展）";
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

/**
 * 检查里程碑触发（v6.0：基于方向内子领域覆盖）
 * - exposure 参数已废弃，改用 directions（用户认知大方向 + 子领域树）
 */
export function checkMilestones(
  impactHistory: ImpactRecord[],
  readHistory: string[],
  directions: CognitiveDirection[],
  existingMilestones: string[]
): Array<{ type: string; description: string }> {
  const newMilestones: Array<{ type: string; description: string }> = [];

  // 首次接触某子领域（方向内拓展）
  const subfieldsRead = new Set(impactHistory.map((r) => r.subfieldId));
  for (const subId of subfieldsRead) {
    const milestoneId = `first_contact_${subId}`;
    if (!existingMilestones.includes(milestoneId)) {
      const record = impactHistory.find((r) => r.subfieldId === subId);
      const subName = record?.subfieldName || subId;
      const dirName = record?.directionName || "";
      newMilestones.push({
        type: "first_contact",
        description: `首次拓展子领域：${dirName ? dirName + " / " : ""}${subName}`,
      });
    }
  }

  // 连续阅读天数（简化：按 impactHistory 数量）
  if (impactHistory.length >= 7 && !existingMilestones.includes("streak_7")) {
    newMilestones.push({
      type: "streak_7",
      description: "一周探索者 · 连续完成 7 次方向内拓展",
    });
  }

  if (impactHistory.length >= 30 && !existingMilestones.includes("streak_30")) {
    newMilestones.push({
      type: "streak_30",
      description: "月度探索者 · 完成 30 次方向内拓展",
    });
  }

  // 高冲击时刻：5星自评
  const fiveStarRecords = impactHistory.filter((r) => r.impactScore === 5);
  if (fiveStarRecords.length >= 1 && !existingMilestones.includes("high_impact_first")) {
    newMilestones.push({
      type: "high_impact",
      description: "认知颠覆时刻 · 首次 5 星冲击",
    });
  }

  // 方向内子领域覆盖数
  const coveredSubfields = new Set(impactHistory.map((r) => r.subfieldId));
  const coveredCount = coveredSubfields.size;

  // 统计所有方向下的子领域总数
  const totalSubfields = directions.reduce(
    (sum, d) => sum + d.subfields.length, 0
  );

  // 覆盖 5 个子领域
  if (coveredCount >= 5 && !existingMilestones.includes("coverage_5")) {
    newMilestones.push({
      type: "subfield_coverage",
      description: "方向内拓展 · 覆盖 5 个子领域",
    });
  }

  // 覆盖 10 个子领域
  if (coveredCount >= 10 && !existingMilestones.includes("coverage_10")) {
    newMilestones.push({
      type: "subfield_coverage",
      description: "方向内深耕 · 覆盖 10 个子领域",
    });
  }

  // 覆盖某方向全部子领域
  if (totalSubfields > 0) {
    for (const dir of directions) {
      const dirSubIds = dir.subfields.map((s) => s.id);
      const dirCovered = dirSubIds.filter((id) => coveredSubfields.has(id)).length;
      if (dirCovered === dirSubIds.length && dirSubIds.length > 0) {
        const milestoneId = `direction_complete_${dir.id}`;
        if (!existingMilestones.includes(milestoneId)) {
          newMilestones.push({
            type: "direction_complete",
            description: `方向深耕完成 · 已覆盖 ${dir.name} 全部子领域`,
          });
        }
      }
    }
  }

  return newMilestones;
}
