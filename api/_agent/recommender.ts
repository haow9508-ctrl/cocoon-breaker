import { BLIND_SPOT_CONTENT, getBlindSpotContentById, BlindSpotContent } from "../_knowledge/content.js";
import { COGNITIVE_DIMENSIONS, getDimensionById } from "../_knowledge/domains.js";
import { generateWhyRecommend, smartSelectRecommendations } from "./llm.js";

export interface RecommendationItem extends BlindSpotContent {
  dimensionName: string;
  whyGenerated: string;
  exposureCount: number;
}

export interface DailyFeedResult {
  items: RecommendationItem[];
  blindSpotCount: number;
}

export async function generateDailyFeed(
  exposure: Map<string, number>,
  readContentIds: string[],
  limit: number = 3
): Promise<DailyFeedResult> {
  // 从未读的盲区内容中筛选候选
  let candidates = BLIND_SPOT_CONTENT.filter((c) => {
    if (readContentIds.includes(c.id)) return false;
    return true; // 保留所有未读内容作为候选
  });

  // 不足则补充已读的（兜底）
  if (candidates.length < limit) {
    candidates = [...BLIND_SPOT_CONTENT];
  }

  // 构造候选列表（附带维度名和暴露值）
  const candidatesWithMeta = candidates.map((c) => {
    const dim = getDimensionById(c.id);
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      dimensionName: dim?.name || c.id,
      exposureCount: exposure.get(c.id) ?? dim?.count ?? 0,
    };
  });

  const highExposureNames = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) >= 200)
    .map((d) => d.name);

  // 用 DeepSeek 智能选择最合适的 limit 篇
  const selectedIds = await smartSelectRecommendations(
    candidatesWithMeta,
    exposure,
    highExposureNames,
    limit
  );

  // 按 selectedIds 顺序构造推荐项
  const items: RecommendationItem[] = [];
  for (const contentId of selectedIds) {
    const content = BLIND_SPOT_CONTENT.find((c) => c.id === contentId);
    if (!content) continue;
    const dim = getDimensionById(content.id);
    const whyGenerated = await generateWhyRecommend(
      dim?.name || content.id,
      content.id,
      content.title,
      exposure,
      highExposureNames
    );
    items.push({
      ...content,
      dimensionName: dim?.name || content.id,
      whyGenerated,
      exposureCount: exposure.get(content.id) ?? dim?.count ?? 0,
    });
  }

  const blindSpotCount = COGNITIVE_DIMENSIONS.filter(
    (d) => (exposure.get(d.id) ?? d.count) < 30
  ).length;

  return { items, blindSpotCount };
}

export async function getContentDetailForUser(
  contentId: string,
  exposure: Map<string, number>
): Promise<any> {
  const content = getBlindSpotContentById(contentId);
  if (!content) return undefined;
  const dim = getDimensionById(contentId);
  const highExposureNames = COGNITIVE_DIMENSIONS
    .filter((d) => (exposure.get(d.id) ?? d.count) >= 200)
    .map((d) => d.name);

  const whyGenerated = await generateWhyRecommend(
    dim?.name || contentId,
    contentId,
    content.title,
    exposure,
    highExposureNames
  );

  return {
    ...content,
    dimensionName: dim?.name || contentId,
    whyGenerated,
    exposureCount: exposure.get(contentId) ?? dim?.count ?? 0,
  };
}
