// ===== ③ 决策层 v6.0 — 方向内拓展决策引擎 =====
// 从"三维决策引擎（盲区度×冲击度×可接受度）跨维度推荐"改为"方向内拓展度推荐"
// 在用户认知大方向内找"认知相邻但未接触"的子领域，而非跨方向找盲区

import type { CognitiveDirection } from "../_knowledge/domains.js";
import { generateChallenge, ChallengeContent, evaluateSubfieldExpansion, shouldTriggerCognitiveLeap, generateCognitiveLeap } from "./llm.js";
import { retrieveFromRag } from "./ragClient.js";
import { getUnexploredSubfields, getKnownSubfields } from "./analyzer.js";
import type { DifficultyLevel } from "./analyzer.js";

/**
 * 冲击自评记录（v6.0：基于方向内子领域）
 * - directionId / directionName：所属认知大方向
 * - subfieldId / subfieldName：拓展的具体子领域
 */
export interface ImpactRecord {
  contentId: string;
  directionId: string;        // 所属认知大方向
  directionName: string;
  subfieldId: string;          // 拓展的子领域
  subfieldName: string;
  title: string;
  impactScore: 1 | 2 | 3 | 4 | 5;
  reflection: string;
  timestamp: string;
}

/**
 * 决策输入（v6.0）
 * - directions：用户认知大方向 + 子领域树（替代旧的 exposure Map）
 * - 不再需要 highExposureFields（信息已在 directions 中）
 */
export interface DecisionInput {
  directions: CognitiveDirection[];  // 用户认知大方向 + 子领域树
  readHistory: string[];              // 已读内容 ID（避免重复推荐）
  impactHistory: ImpactRecord[];
  difficultyLevel: DifficultyLevel;
}

/** 评分后的子领域候选 */
interface ScoredSubfield {
  directionId: string;
  directionName: string;
  subfieldId: string;
  subfieldName: string;
  expansionScore: number;   // 拓展价值 0-1（DeepSeek 评估）
  behaviorAdjustment: number; // v6.2：行为数据调整值 -0.3 ~ +0.3
  totalScore: number;
}

/**
 * v6.2：基于用户行为数据计算调整值
 * - 某方向平均冲击分高 → 提升该方向子领域权重（+0.1~+0.3）
 * - 某方向平均冲击分低 → 降低该方向子领域权重（-0.1~-0.3）
 * - 用户连续 3 次低分（≤2）→ 整体降低拓展难度
 */
function computeBehaviorAdjustment(
  directionId: string,
  impactHistory: ImpactRecord[]
): number {
  const directionImpacts = impactHistory.filter((r) => r.directionId === directionId);
  if (directionImpacts.length === 0) return 0;

  const avgScore = directionImpacts.reduce((s, r) => s + r.impactScore, 0) / directionImpacts.length;
  
  // 平均冲击分 3 为基准：高于 3 加分，低于 3 减分
  const delta = (avgScore - 3) * 0.15; // 每偏离 1 分，调整 0.15
  return Math.max(-0.3, Math.min(0.3, delta));
}

/**
 * 挑战条目（v6.0）
 * - directionId / directionName：所属认知大方向
 * - subfieldId / subfieldName：方向内具体子领域（拓展目标）
 */
export interface ChallengeItem {
  id: string;
  directionId: string;
  directionName: string;
  subfieldId: string;
  subfieldName: string;
  title: string;
  why: string;
  description: string;
  source: string;
  readTimeMinutes: number;
  difficultyLevel: DifficultyLevel;
  coachGuidance: string;
  sourceType?: "bing" | "deepseek_fallback";
  sourceUrl?: string;
  isCognitiveLeap?: boolean;     // v6.2：标记为认知跳跃内容
  leapBridge?: string;            // v6.2：认知桥梁描述
}

export interface ChallengeResult {
  items: ChallengeItem[];
  unexploredCount: number;        // 未接触子领域总数
  selectedSubfields: string[];    // 选中的子领域 ID
}

/**
 * ③ 决策：在用户认知大方向内找"认知相邻但未接触"的子领域
 * - 难度递进：
 *   - L1=同方向相邻子领域（拓展价值高的优先，认知相邻易接受）
 *   - L2=同方向中距子领域（拓展价值中等的）
 *   - L3=同方向远端子领域（拓展价值低但属类比拓展，如 Python→C/Rust）
 */
export async function decideExpansionTargets(
  input: DecisionInput
): Promise<Array<{
  directionId: string;
  directionName: string;
  subfieldId: string;
  subfieldName: string;
}>> {
  // 候选：所有未接触子领域（已在用户大方向内，不会跨方向）
  const allUnexplored = getUnexploredSubfields(input.directions);
  if (allUnexplored.length === 0) return [];

  // 排除已读子领域（按 subfieldId 去重）
  const readSubfieldIds = new Set(
    input.impactHistory.map((r) => r.subfieldId).filter(Boolean)
  );
  const candidates = allUnexplored.filter((s) => !readSubfieldIds.has(s.subfieldId));
  if (candidates.length === 0) return [];

  // 用 DeepSeek 评估每个未接触子领域的方向内拓展价值
  const knownSubfields = getKnownSubfields(input.directions);
  const expansionMap = await evaluateSubfieldExpansion(candidates, knownSubfields);

  const scored: ScoredSubfield[] = candidates.map((s) => {
    const expansionScore = expansionMap.get(s.subfieldId) ?? 0.5;
    // v6.2：行为数据调整——基于用户历史冲击自评调整推荐权重
    const behaviorAdjustment = computeBehaviorAdjustment(s.directionId, input.impactHistory);
    // 综合分：拓展价值 + 行为调整
    const totalScore = Math.max(0, Math.min(1, expansionScore + behaviorAdjustment));
    return {
      directionId: s.directionId,
      directionName: s.directionName,
      subfieldId: s.subfieldId,
      subfieldName: s.subfieldName,
      expansionScore,
      behaviorAdjustment,
      totalScore,
    };
  });

  // 按难度等级过滤
  const filtered = filterByDifficulty(scored, input.difficultyLevel);

  // 综合排序，取 Top 3
  const top3 = filtered.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);

  return top3.map((s) => ({
    directionId: s.directionId,
    directionName: s.directionName,
    subfieldId: s.subfieldId,
    subfieldName: s.subfieldName,
  }));
}

/**
 * 按难度等级过滤子领域（基于拓展价值分数）
 * - L1：拓展价值高的（认知相邻，易接受）— 分数 ≥ 0.6
 * - L2：拓展价值中等的（同方向中距）— 0.3 ≤ 分数 ≤ 0.8
 * - L3：拓展价值低的（同方向远端，类比拓展）— 分数 ≤ 0.5
 * 注：L1 与 L3 在分数区间上有意重叠（边界值），保证不同难度都有候选
 */
function filterByDifficulty(
  scored: ScoredSubfield[],
  difficultyLevel: DifficultyLevel
): ScoredSubfield[] {
  // 如果过滤后为空，回退使用全部候选（按难度排序）
  const filtered = scored.filter((s) => {
    switch (difficultyLevel) {
      case "L1": return s.expansionScore >= 0.6;   // 同方向相邻
      case "L2": return s.expansionScore >= 0.3 && s.expansionScore <= 0.8; // 同方向中距
      case "L3": return s.expansionScore <= 0.5;    // 同方向远端（类比拓展）
    }
  });
  if (filtered.length > 0) return filtered;
  // 回退：直接按难度对全部候选排序后取前 3
  return scored;
}

/** ③④ 决策 + 生成：完整每日挑战流程 */
export async function generateDailyChallenge(
  input: DecisionInput
): Promise<ChallengeResult> {
  // ③ 决策：在用户大方向内选未接触子领域（async，调 DeepSeek 评估拓展价值）
  const selectedTargets = await decideExpansionTargets(input);

  // 统计未接触子领域总数（无论是否被选中）
  const unexploredCount = getUnexploredSubfields(input.directions).length;

  if (selectedTargets.length === 0) {
    return { items: [], unexploredCount, selectedSubfields: [] };
  }

  // ④a RAG 检索：为每个子领域从 Bing 实时互联网检索真实内容（抗 GEO）
  const ragResultsBySubfield = new Map<string, Array<{
    title: string;
    description: string;
    source: string;
    sourceType: string;
    url: string;
    readTimeMinutes: number;
  }>>();

  const knownSubfields = getKnownSubfields(input.directions);

  await Promise.all(selectedTargets.map(async (target) => {
    // 构造查询：方向名 + 子领域名 + 深度内容关键词
    const query = `${target.directionName} ${target.subfieldName} 深度解读 播客 访谈`.trim();
    const results = await retrieveFromRag({
      query,
      highExposureFields: knownSubfields,
      // RAG 后端字段保留 dimension_id 名称（兼容 Python 后端契约）
      dimensionId: target.subfieldId,
      limit: 3,
    });
    if (results.length > 0) {
      ragResultsBySubfield.set(target.subfieldId, results.map(r => ({
        title: r.title,
        description: r.description,
        source: r.source,
        sourceType: r.source_type,
        url: r.url,
        readTimeMinutes: r.read_time_minutes,
      })));
    }
  }));

  // ④b 生成：基于 RAG 真实内容生成挑战（DeepSeek 只做教练引导）
  const challenges: ChallengeContent[] = await generateChallenge(
    selectedTargets,
    knownSubfields,
    input.difficultyLevel,
    ragResultsBySubfield
  );

  const items: ChallengeItem[] = challenges.map((c, idx) => ({
    id: `${c.subfieldId}_${Date.now()}_${idx}`,
    directionId: c.directionId,
    directionName: c.directionName,
    subfieldId: c.subfieldId,
    subfieldName: c.subfieldName,
    title: c.title,
    why: c.why,
    description: c.description,
    source: c.source,
    readTimeMinutes: c.readTimeMinutes,
    difficultyLevel: c.difficultyLevel,
    coachGuidance: c.coachGuidance,
    sourceType: c.sourceType,
    sourceUrl: c.sourceUrl,
  }));

  // v6.2：认知跳跃触发——用户在某方向深耕到一定深度后，追加一篇远距离类比内容
  for (const direction of input.directions) {
    if (shouldTriggerCognitiveLeap(direction.id, input.directions, input.impactHistory)) {
      const recentTitles = input.impactHistory
        .filter((r) => r.directionId === direction.id)
        .slice(-3)
        .map((r) => r.title);
      const leapContent = await generateCognitiveLeap(
        { id: direction.id, name: direction.name },
        knownSubfields,
        recentTitles
      );
      if (leapContent) {
        items.push({
          id: `leap_${direction.id}_${Date.now()}`,
          directionId: leapContent.directionId,
          directionName: leapContent.directionName,
          subfieldId: leapContent.subfieldId,
          subfieldName: leapContent.subfieldName,
          title: leapContent.title,
          why: leapContent.why,
          description: leapContent.description,
          source: leapContent.source,
          readTimeMinutes: leapContent.readTimeMinutes,
          difficultyLevel: "L3",
          coachGuidance: leapContent.coachGuidance,
          sourceType: "deepseek_fallback",
          isCognitiveLeap: true,
        });
        break; // 每次挑战最多追加一篇认知跳跃
      }
    }
  }

  return {
    items,
    unexploredCount,
    selectedSubfields: selectedTargets.map((t) => t.subfieldId),
  };
}

/** 内容详情：由 DeepSeek 为单个子领域动态生成（基于 RAG 真实内容） */
export async function getChallengeDetail(
  directionId: string,
  subfieldId: string,
  directions: CognitiveDirection[],
  difficultyLevel: DifficultyLevel
): Promise<ChallengeItem | undefined> {
  // 在方向树中找到该方向和子领域
  const direction = directions.find((d) => d.id === directionId);
  if (!direction) return undefined;
  const subfield = direction.subfields.find((s) => s.id === subfieldId);
  if (!subfield) return undefined;

  // 已接触子领域（用于类比桥接）
  const knownSubfields = getKnownSubfields(directions);

  // RAG 检索真实内容（抗 GEO）
  const ragResultsBySubfield = new Map<string, Array<{
    title: string;
    description: string;
    source: string;
    sourceType: string;
    url: string;
    readTimeMinutes: number;
  }>>();

  const query = `${direction.name} ${subfield.name} 深度解读 播客 访谈`.trim();
  const results = await retrieveFromRag({
    query,
    highExposureFields: knownSubfields,
    // RAG 后端字段保留 dimension_id 名称（兼容 Python 后端契约）
    dimensionId: subfieldId,
    limit: 3,
  });
  if (results.length > 0) {
    ragResultsBySubfield.set(subfieldId, results.map(r => ({
      title: r.title,
      description: r.description,
      source: r.source,
      sourceType: r.source_type,
      url: r.url,
      readTimeMinutes: r.read_time_minutes,
    })));
  }

  const challenges = await generateChallenge(
    [{
      directionId: direction.id,
      directionName: direction.name,
      subfieldId: subfield.id,
      subfieldName: subfield.name,
    }],
    knownSubfields,
    difficultyLevel,
    ragResultsBySubfield
  );

  if (challenges.length === 0) return undefined;
  const c = challenges[0];

  return {
    id: `${subfieldId}_${Date.now()}`,
    directionId,
    directionName: direction.name,
    subfieldId,
    subfieldName: subfield.name,
    title: c.title,
    why: c.why,
    description: c.description,
    source: c.source,
    readTimeMinutes: c.readTimeMinutes,
    difficultyLevel,
    coachGuidance: c.coachGuidance,
    sourceType: c.sourceType,
    sourceUrl: c.sourceUrl,
  };
}
