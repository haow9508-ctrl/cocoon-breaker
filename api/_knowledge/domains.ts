// 严格遵循 cocoon-breaker.html 中定义的 24 个认知维度
export interface CognitiveDimension {
  id: string;
  name: string;
  count: number; // 默认模拟暴露次数（demo 用）
  category: "highExposure" | "lowExposure" | "blindSpot";
}

export const COGNITIVE_DIMENSIONS: CognitiveDimension[] = [
  { id: "entertainment", name: "娱乐八卦", count: 847, category: "highExposure" },
  { id: "humor", name: "搞笑视频", count: 623, category: "highExposure" },
  { id: "beauty", name: "美妆穿搭", count: 412, category: "highExposure" },
  { id: "movie", name: "影视综艺", count: 358, category: "highExposure" },
  { id: "food", name: "美食", count: 287, category: "highExposure" },
  { id: "gaming", name: "游戏电竞", count: 245, category: "highExposure" },
  { id: "tech", name: "科技数码", count: 189, category: "highExposure" },
  { id: "auto", name: "汽车", count: 124, category: "highExposure" },
  { id: "sports", name: "体育", count: 87, category: "highExposure" },
  { id: "finance", name: "财经投资", count: 56, category: "lowExposure" },
  { id: "history", name: "历史", count: 32, category: "lowExposure" },
  { id: "psychology", name: "心理学", count: 18, category: "lowExposure" },
  { id: "art", name: "艺术设计", count: 11, category: "lowExposure" },
  { id: "literature", name: "文学", count: 7, category: "lowExposure" },
  { id: "sociology", name: "社会学", count: 4, category: "lowExposure" },
  { id: "philosophy", name: "哲学", count: 2, category: "lowExposure" },
  { id: "physics", name: "粒子物理", count: 0, category: "blindSpot" },
  { id: "astronomy", name: "天文学", count: 0, category: "blindSpot" },
  { id: "classical", name: "古典音乐", count: 1, category: "blindSpot" },
  { id: "biology", name: "生物学", count: 0, category: "blindSpot" },
  { id: "archaeology", name: "考古学", count: 0, category: "blindSpot" },
  { id: "linguistics", name: "语言学", count: 0, category: "blindSpot" },
  { id: "architecture", name: "建筑学", count: 2, category: "blindSpot" },
  { id: "math", name: "数学", count: 0, category: "blindSpot" },
];

export function getDimensionById(id: string): CognitiveDimension | undefined {
  return COGNITIVE_DIMENSIONS.find((d) => d.id === id);
}

export function getAllDimensions(): CognitiveDimension[] {
  return COGNITIVE_DIMENSIONS;
}

export function getBlindSpotDimensions(): CognitiveDimension[] {
  return COGNITIVE_DIMENSIONS.filter((d) => d.count < 6);
}

export function getHighExposureDimensions(): CognitiveDimension[] {
  return COGNITIVE_DIMENSIONS.filter((d) => d.count >= 501);
}

export function getColorByCount(count: number): string {
  if (count === 0) return "blind";
  if (count < 6) return "blind";
  if (count < 51) return "#4ade80";
  if (count < 201) return "#ffd23d";
  if (count < 501) return "#ff8a3d";
  return "#ff4d4d";
}
