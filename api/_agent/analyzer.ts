// ===== ② 分析层 v6.0 =====
// 从"24 维暴露扫描"改为"认知大方向识别 + 方向内子领域树"
// 不静默降级：LLM 失败时抛出错误

import type { CognitiveDirection } from "../_knowledge/domains.js";
// 以别名导入 llm.analyzeDirections，避免与本模块导出的 analyzeDirections 命名冲突
import { analyzeDirections as llmAnalyzeDirections } from "./llm.js";

export type DifficultyLevel = "L1" | "L2" | "L3";

/**
 * 分析结果（v6.0）
 * - directions：1-3 个认知大方向 + 方向内子领域树
 * - initialDifficulty：初始难度（新用户统一从 L1 开始）
 */
export interface AnalysisResult {
  directions: CognitiveDirection[];  // 1-3 个认知大方向 + 子领域树
  initialDifficulty: DifficultyLevel;
}

/**
 * ② 分析：识别用户认知大方向 + 子领域接触图
 * - 调用 LLM 从用户自然语言中推断 1-3 个大方向
 * - 每个方向下动态生成子领域树，标注 high/low/none 三档接触程度
 */
export async function analyzeDirections(userInput: string): Promise<AnalysisResult> {
  if (!userInput?.trim()) {
    return buildDefaultResult();
  }

  const { directions } = await llmAnalyzeDirections(userInput.trim());
  return {
    directions,
    initialDifficulty: "L1",
  };
}

/** 默认结果：用户输入为空时返回空方向列表 */
function buildDefaultResult(): AnalysisResult {
  return {
    directions: [],
    initialDifficulty: "L1",
  };
}

/**
 * 辅助：判断某子领域是否未接触（拓展候选）
 */
export function isUnexplored(direction: CognitiveDirection, subfieldId: string): boolean {
  const sub = direction.subfields.find((s) => s.id === subfieldId);
  return sub ? sub.exposure === "none" : false;
}

/**
 * 辅助：从方向树中提取所有"未接触"子领域（拓展候选）
 */
export function getUnexploredSubfields(directions: CognitiveDirection[]): Array<{
  directionId: string;
  directionName: string;
  subfieldId: string;
  subfieldName: string;
}> {
  const result: Array<{
    directionId: string;
    directionName: string;
    subfieldId: string;
    subfieldName: string;
  }> = [];
  for (const dir of directions) {
    for (const sub of dir.subfields) {
      if (sub.exposure === "none") {
        result.push({
          directionId: dir.id,
          directionName: dir.name,
          subfieldId: sub.id,
          subfieldName: sub.name,
        });
      }
    }
  }
  return result;
}

/**
 * 辅助：从方向树中提取所有"已接触"子领域名称（用于类比桥接）
 */
export function getKnownSubfields(directions: CognitiveDirection[]): string[] {
  const result: string[] = [];
  for (const dir of directions) {
    for (const sub of dir.subfields) {
      if (sub.exposure === "high" || sub.exposure === "low") {
        result.push(sub.name);
      }
    }
  }
  return result;
}
