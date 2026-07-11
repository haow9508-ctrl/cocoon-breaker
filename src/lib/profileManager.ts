// ===== 认知档案管理器 v6.0 =====
// v6.0：从"固定 24 维暴露值（exposure Map）"重构为"认知大方向 + 方向内子领域树"
// schema 迁移：profileVersion < 6 的旧档案加载时清除 24 维数据，强制用户重新诊断

// 子领域节点：某认知大方向下的细分领域，三档接触程度
export interface SubfieldNode {
  id: string;
  name: string;
  exposure: "high" | "low" | "none"; // high=已接触 / low=偶尔接触 / none=未接触
}

// 认知大方向：用户既定的认知拓展方向
export interface CognitiveDirection {
  id: string;
  name: string;
  subfields: SubfieldNode[];
}

export type DifficultyLevel = "L1" | "L2" | "L3";

/**
 * 冲击自评记录（v6.0：基于方向内子领域）
 * - directionId / directionName：所属认知大方向
 * - subfieldId / subfieldName：方向内具体子领域（拓展目标）
 */
export interface ImpactRecord {
  contentId: string;
  directionId: string;
  directionName: string;
  subfieldId: string;
  subfieldName: string;
  title: string;
  impactScore: 1 | 2 | 3 | 4 | 5;
  reflection: string;
  timestamp: string;
}

/**
 * 暴露快照（v6.0：基于方向树，替代旧的 24 维 exposure Map）
 * 每天一条，记录当时的 directions 树状态
 */
export interface ExposureSnapshot {
  date: string; // ISO date (yyyy-mm-dd)
  directions: CognitiveDirection[];
}

export interface Milestone {
  id: string;
  type: string;
  description: string;
  unlockedAt: string;
}

/**
 * 认知指纹（v6.0：基于方向树而非 24 维 exposure）
 */
export interface CognitiveFingerprint {
  topDirections: string[];       // 高频接触的方向 top3
  unexploredCount: number;       // 未接触子领域数
  coverageRate: number;          // 子领域覆盖率 0-1
  avgImpact: number;             // 平均冲击分
  difficultyLevel: DifficultyLevel;
  signature: string;             // 简短指纹签名
}

/**
 * 认知档案（v6.0）
 * - directions：1-3 个认知大方向 + 方向内子领域树（替代旧的 24 维 exposure Map）
 * - impactHistory：subfieldId 替代 dimensionId
 */
export interface CognitiveProfile {
  profileVersion: number;
  userId: string;
  nickname: string;
  createdAt: string;

  // v6.0：从 24 维数值 exposure 改为方向+子领域
  directions: CognitiveDirection[];
  exposureSnapshots: ExposureSnapshot[]; // 暴露历史快照（基于 subfield）

  difficultyLevel: DifficultyLevel;

  // 历史记录（上限 100 条 + 聚合）
  impactHistory: ImpactRecord[];
  impactAggregate: {
    totalReads: number;
    totalSubfields: number;
    avgImpact: number;
  };

  milestones: Milestone[];
  readHistory: string[]; // subfieldId 列表

  coachMemory: {
    lastReviewedAt: string;
    keyInsights: string[];
  };

  // 今日挑战缓存：当天进入挑战页直接复用，避免重复生成 + 保证详情页内容一致
  todayChallenge: {
    date: string; // ISO date (yyyy-mm-dd) — 用于判断缓存是否过期
    result: TodayChallengeCache;
  } | null;
}

// 挑战条目快照（与 apiClient.ChallengeItem 字段对齐，用于本地缓存）
export interface ChallengeItemSnapshot {
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
  difficultyLevel: "L1" | "L2" | "L3";
  coachGuidance: string;
  sourceType?: "bing" | "deepseek_fallback";
  sourceUrl?: string;
}

// 今日挑战缓存对象（与 apiClient.ChallengeResult 对齐）
export interface TodayChallengeCache {
  items: ChallengeItemSnapshot[];
  unexploredCount: number;
  selectedSubfields: string[];
}

const PROFILE_KEY = "cocoon_profile_v6";
const CURRENT_VERSION = 6; // v6.0：方向树结构

/** 加载档案，含 schema 迁移 */
function loadProfile(): CognitiveProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return migrateProfile(data);
  } catch (e) {
    console.error("[ProfileManager] 加载档案失败:", e);
    return null;
  }
}

/**
 * Schema 迁移：
 * - 旧 key（cocoon_profile_v4）的档案 profileVersion < 6，视为不兼容
 * - 直接清空旧的 24 维数据（initialExposure/currentExposure/exposure Map）
 *   旧档案结构与新结构无法无损映射，要求用户重新诊断
 */
function migrateProfile(data: any): CognitiveProfile {
  if (!data || typeof data !== "object") {
    throw new Error("档案数据损坏");
  }

  // v6.0 之前（含 v4/v5 的 24 维结构）：清除旧数据，标记为新版空档案
  if (!data.profileVersion || data.profileVersion < CURRENT_VERSION) {
    data.profileVersion = CURRENT_VERSION;
    // 清除旧的 24 维数据
    delete data.initialExposure;
    delete data.currentExposure;
    // 旧 exposureSnapshots 中可能包含 exposure Map，整体清空
    data.exposureSnapshots = [];
    // 旧 impactHistory 中的 dimensionId 字段在 v6.0 已废弃
    // 保留历史记录但 directions 必须为空（用户需重新诊断）
    data.directions = [];
    // 重置聚合（旧的 totalDimensions 字段废弃）
    data.impactAggregate = {
      totalReads: 0,
      totalSubfields: 0,
      avgImpact: 0,
    };
    if (!data.coachMemory) {
      data.coachMemory = { lastReviewedAt: "", keyInsights: [] };
    }
    if (!Array.isArray(data.milestones)) data.milestones = [];
    if (!Array.isArray(data.readHistory)) data.readHistory = [];
    if (!Array.isArray(data.impactHistory)) data.impactHistory = [];
    // v6.1：新增 todayChallenge 缓存字段
    if (!data.todayChallenge) data.todayChallenge = null;
  }

  return data as CognitiveProfile;
}

/** 保存档案，含配额处理 */
function saveProfile(profile: CognitiveProfile): boolean {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch (e: any) {
    if (e.name === "QuotaExceededError") {
      // 配额不足：归档最老的 impactHistory
      if (profile.impactHistory.length > 20) {
        profile.impactHistory = profile.impactHistory.slice(-20);
        try {
          localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
          return true;
        } catch {
          console.error("[ProfileManager] 归档后仍配额不足");
        }
      }
    }
    console.error("[ProfileManager] 保存失败:", e);
    return false;
  }
}

/**
 * 计算认知指纹（v6.0：基于方向树）
 * - topDirections：按已接触子领域数排序，取前 3 个方向名
 * - unexploredCount：所有方向下未接触子领域总数
 * - coverageRate：已接触子领域数 / 子领域总数
 */
export function generateFingerprint(profile: CognitiveProfile): CognitiveFingerprint {
  const directions = profile.directions || [];
  let total = 0;
  let touched = 0;
  let untouched = 0;
  const dirCounts: Array<{ name: string; touched: number }> = [];

  for (const dir of directions) {
    let dirTouched = 0;
    for (const sub of dir.subfields) {
      total++;
      if (sub.exposure === "high" || sub.exposure === "low") {
        touched++;
        dirTouched++;
      } else {
        untouched++;
      }
    }
    dirCounts.push({ name: dir.name, touched: dirTouched });
  }

  const topDirections = dirCounts
    .sort((a, b) => b.touched - a.touched)
    .slice(0, 3)
    .map((d) => d.name);

  const coverageRate = total > 0 ? touched / total : 0;
  const avgImpact = profile.impactAggregate?.avgImpact || 0;

  // 简短签名：方向首字母 + 未接触数 + 覆盖率
  const signature = `${topDirections.join("").slice(0, 6)}-${untouched}U-${Math.round(coverageRate * 100)}%`;

  return {
    topDirections,
    unexploredCount: untouched,
    coverageRate,
    avgImpact: Number(avgImpact.toFixed(2)),
    difficultyLevel: profile.difficultyLevel,
    signature,
  };
}

/** 辅助：将 subfieldId 加入方向树的接触记录（用于 addReadContent） */
function bumpSubfieldExposure(directions: CognitiveDirection[], subfieldId: string): CognitiveDirection[] {
  return directions.map((dir) => ({
    ...dir,
    subfields: dir.subfields.map((sub) =>
      sub.id === subfieldId && sub.exposure !== "high"
        ? { ...sub, exposure: sub.exposure === "none" ? "low" : "high" as const }
        : sub
    ),
  }));
}

export const profileManager = {
  getProfile(): CognitiveProfile | null {
    return loadProfile();
  },

  hasProfile(): boolean {
    return !!loadProfile();
  },

  /**
   * 创建档案（v6.0）
   * @param nickname 用户昵称
   * @param directions 诊断识别出的 1-3 个认知大方向 + 子领域树
   * @param difficultyLevel 初始难度（默认 L1）
   */
  createProfile(
    nickname: string,
    directions: CognitiveDirection[],
    difficultyLevel: DifficultyLevel = "L1"
  ): CognitiveProfile {
    const today = new Date().toISOString().slice(0, 10);
    const profile: CognitiveProfile = {
      profileVersion: CURRENT_VERSION,
      userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nickname,
      createdAt: new Date().toISOString(),
      directions: directions || [],
      exposureSnapshots: [{ date: today, directions: directions || [] }],
      difficultyLevel,
      impactHistory: [],
      impactAggregate: { totalReads: 0, totalSubfields: 0, avgImpact: 0 },
      milestones: [],
      readHistory: [],
      coachMemory: { lastReviewedAt: "", keyInsights: [] },
      todayChallenge: null,
    };
    saveProfile(profile);
    return profile;
  },

  /**
   * 更新方向树（v6.0：替代旧的 updateExposure）
   * @param directions 新的方向树（含子领域接触标注）
   */
  updateDirections(directions: CognitiveDirection[]): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    profile.directions = directions;

    // 记录暴露快照（每天最多一条，更新当天的）
    const today = new Date().toISOString().slice(0, 10);
    const existingIdx = profile.exposureSnapshots.findIndex((s) => s.date === today);
    if (existingIdx >= 0) {
      profile.exposureSnapshots[existingIdx].directions = directions;
    } else {
      profile.exposureSnapshots.push({ date: today, directions });
      // 快照上限 90 天
      if (profile.exposureSnapshots.length > 90) {
        profile.exposureSnapshots = profile.exposureSnapshots.slice(-90);
      }
    }

    saveProfile(profile);
    return profile;
  },

  /**
   * 标记某子领域已读（v6.0：替代旧的 addReadContent(dimensionId)）
   * @param contentId 内容 ID（用于去重）
   * @param subfieldId 子领域 ID
   */
  addReadContent(contentId: string, subfieldId: string): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    if (!profile.readHistory.includes(contentId)) {
      profile.readHistory.push(contentId);
    }
    profile.directions = bumpSubfieldExposure(profile.directions, subfieldId);
    saveProfile(profile);
    return profile;
  },

  /**
   * 记录冲击自评（v6.0：ImpactRecord 使用 directionId/subfieldId）
   */
  recordImpact(record: Omit<ImpactRecord, "timestamp">): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;

    profile.impactHistory.push({
      ...record,
      timestamp: new Date().toISOString(),
    });

    // 上限 100 条：超出时归档到 aggregate
    if (profile.impactHistory.length > 100) {
      profile.impactHistory = profile.impactHistory.slice(-100);
    }

    // 重新计算聚合（v6.0：基于 subfieldId）
    const allRecords = profile.impactHistory;
    profile.impactAggregate.avgImpact = allRecords.length > 0
      ? allRecords.reduce((s, r) => s + r.impactScore, 0) / allRecords.length
      : 0;
    profile.impactAggregate.totalSubfields = Array.from(new Set(allRecords.map((r) => r.subfieldId))).length;
    // totalReads = 当前 impactHistory 数（归档的已丢失，简化处理）
    profile.impactAggregate.totalReads = allRecords.length;

    saveProfile(profile);
    return profile;
  },

  updateDifficulty(level: DifficultyLevel): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    profile.difficultyLevel = level;
    saveProfile(profile);
    return profile;
  },

  addMilestones(milestones: Array<{ type: string; description: string }>): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return profile;
    for (const m of milestones) {
      const id = `${m.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      profile.milestones.push({
        id,
        type: m.type,
        description: m.description,
        unlockedAt: new Date().toISOString(),
      });
    }
    saveProfile(profile);
    return profile;
  },

  /** 教练记忆：添加关键洞察 */
  addKeyInsight(insight: string): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    profile.coachMemory.keyInsights.push(insight);
    // 上限 20 条
    if (profile.coachMemory.keyInsights.length > 20) {
      profile.coachMemory.keyInsights = profile.coachMemory.keyInsights.slice(-20);
    }
    profile.coachMemory.lastReviewedAt = new Date().toISOString();
    saveProfile(profile);
    return profile;
  },

  /** 认知指纹 */
  getFingerprint(): CognitiveFingerprint | null {
    const profile = loadProfile();
    if (!profile) return null;
    return generateFingerprint(profile);
  },

  /**
   * 获取今日挑战缓存（v6.1）
   * - 若 todayChallenge.date 等于今天，返回完整 result（items+unexploredCount+selectedSubfields）；否则返回 null
   * - 跨日自动失效（返回 null 由调用方重新拉取）
   */
  getTodayChallenge(): TodayChallengeCache | null {
    const profile = loadProfile();
    if (!profile?.todayChallenge) return null;
    const today = new Date().toISOString().slice(0, 10);
    if (profile.todayChallenge.date !== today) return null;
    return profile.todayChallenge.result || null;
  },

  /** 保存今日挑战缓存（v6.1） */
  setTodayChallenge(result: TodayChallengeCache): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    const today = new Date().toISOString().slice(0, 10);
    profile.todayChallenge = { date: today, result };
    saveProfile(profile);
    return profile;
  },

  /**
   * 按 ID 在今日挑战缓存中查找单条挑战详情（v6.1）
   * 用于 ReaderPage 直接复用挑战列表中的内容，跳过二次 API 调用
   */
  findChallengeById(challengeId: string): ChallengeItemSnapshot | null {
    const cached = this.getTodayChallenge();
    if (!cached) return null;
    return cached.items.find((it) => it.id === challengeId) || null;
  },

  /**
   * 按 directionId + subfieldId 在今日挑战缓存中查找（v6.1）
   * 用于路由 /read/:directionId/:subfieldId 的兼容查找
   */
  findChallengeBySubfield(directionId: string, subfieldId: string): ChallengeItemSnapshot | null {
    const cached = this.getTodayChallenge();
    if (!cached) return null;
    return cached.items.find((it) => it.directionId === directionId && it.subfieldId === subfieldId) || null;
  },

  /** 数据导出 */
  exportProfile(): string {
    const profile = loadProfile();
    if (!profile) throw new Error("无档案可导出");
    return JSON.stringify(profile, null, 2);
  },

  /** 数据导入（含 schema 迁移） */
  importProfile(json: string): CognitiveProfile | null {
    try {
      const data = JSON.parse(json);
      const migrated = migrateProfile(data);
      saveProfile(migrated);
      return migrated;
    } catch (e) {
      console.error("[ProfileManager] 导入失败:", e);
      return null;
    }
  },

  updateProfile(updates: Partial<CognitiveProfile>): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    Object.assign(profile, updates);
    saveProfile(profile);
    return profile;
  },

  clearProfile(): void {
    localStorage.removeItem(PROFILE_KEY);
  },

  /**
   * 转换为 API 请求格式（v6.0）
   * 后端 /api/agent/* 路由期望以下字段：
   * - challenge: { directions, readHistory, impactHistory, difficultyLevel }
   * - assess:    { directions, profile: { ... } }
   * - coach:     { profile: { directions, impactHistory, difficultyLevel, ... } }
   * - content:   { directionId, subfieldId, directions, difficultyLevel }
   * - map:       { directions }
   */
  toApiFormat(profile: CognitiveProfile) {
    return {
      directions: profile.directions,
      readHistory: profile.readHistory,
      impactHistory: profile.impactHistory,
      difficultyLevel: profile.difficultyLevel,
      milestones: profile.milestones,
      coachMemory: profile.coachMemory,
      totalReads: profile.impactAggregate.totalReads + profile.impactHistory.length,
    };
  },
};
