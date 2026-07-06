// ===== 智能推荐器 =====
// 纯生成式 — 无知识库依赖
// ③ 决策：选择盲区维度
// ④ 生成：调用 DeepSeek 动态生成内容

import { COGNITIVE_DIMENSIONS, getDimensionById } from "../_knowledge/domains.js";
import { generateDailyContent, generateWhyRecommend, GeneratedContent } from "./llm.js";

export interface RecommendationItem {
  id: string;
  title: string;
  why: string;
  description: string;
  source: string;
  readTimeMinutes: number;
  dimensionName: string;
  whyGenerated: string;
  exposureCount: number;
}

export interface DailyFeedResult {
  items: RecommendationItem[];
  blindSpotCount: number;
}

/** ③ 决策 + ④ 生成：根据暴露值找到盲区，由 DeepSeek 动态生成内容 */
export async function generateDailyFeed(
  exposure: Map<string, number>,
  readContentIds: string[],
  limit: number = 3
): Promise<DailyFeedResult> {
  // ③ 决策：按暴露值升序排序，找到最大的盲区
  const sortedDims = COGNITIVE_DIMENSIONS
    .map((d) => ({
      id: d.id,
      name: d.name,
      exposureCount: exposure.get(d.id) ?? d.count,
    }))
    .sort((a, b) => a.exposureCount - b.exposureCount);

  // 优先选择未读的盲区维度
  const unreadBlindSpots = sortedDims.filter((d) => !readContentIds.includes(d.id));
  const blindSpots = (unreadBlindSpots.length >= limit
    ? unreadBlindSpots
    : sortedDims
  ).slice(0, limit);

  // 获取用户高频领域（用于生成认知冲击）
  const highExposureNames = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) >= 200)
    .map((d) => d.name);

  // ④ 生成：调用 DeepSeek 动态生成内容
  const generated: GeneratedContent[] = await generateDailyContent(
    blindSpots,
    highExposureNames
  );

  // 为每篇内容生成推荐理由
  const items: RecommendationItem[] = [];
  for (const gen of generated) {
    const dim = getDimensionById(gen.dimensionId) || getDimensionById(blindSpots[0]?.id);
    const exposureCount = exposure.get(gen.dimensionId) ?? dim?.count ?? 0;

    let whyGenerated: string;
    try {
      whyGenerated = await generateWhyRecommend(
        gen.dimensionName || dim?.name || gen.dimensionId,
        gen.dimensionId,
        gen.title,
        exposure,
        highExposureNames
      );
    } catch {
      whyGenerated = gen.why || `你在「${gen.dimensionName}」维度完全空白，这是典型的认知盲区。`;
    }

    items.push({
      id: gen.dimensionId,
      title: gen.title,
      why: gen.why,
      description: gen.description,
      source: gen.source,
      readTimeMinutes: gen.readTimeMinutes,
      dimensionName: gen.dimensionName || dim?.name || gen.dimensionId,
      whyGenerated,
      exposureCount,
    });
  }

  const blindSpotCount = COGNITIVE_DIMENSIONS.filter(
    (d) => (exposure.get(d.id) ?? d.count) < 30
  ).length;

  return { items, blindSpotCount };
}

/** 内容详情：由 DeepSeek 为单个维度动态生成内容 */
export async function getContentDetailForUser(
  dimensionId: string,
  exposure: Map<string, number>
): Promise<RecommendationItem | undefined> {
  const dim = getDimensionById(dimensionId);
  if (!dim) return undefined;

  const exposureCount = exposure.get(dimensionId) ?? dim.count;
  const highExposureNames = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) >= 200)
    .map((d) => d.name);

  // 调用 DeepSeek 为这个维度生成内容
  const generated: GeneratedContent[] = await generateDailyContent(
    [{ id: dimensionId, name: dim.name, exposureCount }],
    highExposureNames
  );

  if (generated.length === 0) return undefined;
  const gen = generated[0];

  let whyGenerated: string;
  try {
    whyGenerated = await generateWhyRecommend(
      dim.name,
      dimensionId,
      gen.title,
      exposure,
      highExposureNames
    );
  } catch {
    whyGenerated = gen.why || `你在「${dim.name}」维度完全空白，这是典型的认知盲区。`;
  }

  return {
    id: dimensionId,
    title: gen.title,
    why: gen.why,
    description: gen.description,
    source: gen.source,
    readTimeMinutes: gen.readTimeMinutes,
    dimensionName: dim.name,
    whyGenerated,
    exposureCount,
  };
}
