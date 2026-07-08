// ===== 认知档案管理器 v4.1 =====
// 实现 PRD 承诺：profileVersion + impactHistory 上限 + 导出导入 + 暴露快照 + 认知指纹

export type DifficultyLevel = "L1" | "L2" | "L3";

export interface ImpactRecord {
  contentId: string;
  dimensionId: string;
  dimensionName: string;
  title: string;
  impactScore: 1 | 2 | 3 | 4 | 5;
  reflection: string;
  timestamp: string;
}

export interface ExposureSnapshot {
  date: string; // ISO date (yyyy-mm-dd)
  exposure: Record<string, number>;
}

export interface Milestone {
  id: string;
  type: string;
  description: string;
  unlockedAt: string;
}

export interface CognitiveFingerprint {
  topFields: string[];        // 高频领域 top3
  blindSpotCount: number;     // 盲区数
  coverageRate: number;       // 覆盖率 0-1
  avgImpact: number;          // 平均冲击分
  difficultyLevel: DifficultyLevel;
  signature: string;          // 简短指纹签名
}

export interface CognitiveProfile {
  // 元数据
  profileVersion: number;     // schema 版本，支持迁移
  userId: string;
  nickname: string;
  createdAt: string;

  // 暴露数据
  initialExposure: Record<string, number>;
  currentExposure: Record<string, number>;
  exposureSnapshots: ExposureSnapshot[]; // PRD 承诺：暴露历史快照

  // 状态
  difficultyLevel: DifficultyLevel;

  // 历史记录（上限 100 条 + 聚合）
  impactHistory: ImpactRecord[];
  impactAggregate: {
    totalReads: number;
    totalDimensions: string[];
    avgImpact: number;
  };

  // 成就
  milestones: Milestone[];
  readHistory: string[];

  // 教练记忆 — PRD 承诺
  coachMemory: {
    lastReviewedAt: string;
    keyInsights: string[]; // 每次对话后提取的关键洞察
  };
}

const PROFILE_KEY = "cocoon_profile_v4";
const CURRENT_VERSION = 2; // v4.1 = version 2

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

/** Schema 迁移：确保旧档案兼容新结构 */
function migrateProfile(data: any): CognitiveProfile {
  // v1 (无 profileVersion) → v2
  if (!data.profileVersion || data.profileVersion < 2) {
    data.profileVersion = CURRENT_VERSION;
    if (!data.exposureSnapshots) data.exposureSnapshots = [];
    if (!data.impactAggregate) {
      data.impactAggregate = {
        totalReads: data.impactHistory?.length || 0,
        totalDimensions: Array.from(new Set((data.impactHistory || []).map((r: ImpactRecord) => r.dimensionId))),
        avgImpact: data.impactHistory?.length > 0
          ? data.impactHistory.reduce((s: number, r: ImpactRecord) => s + r.impactScore, 0) / data.impactHistory.length
          : 0,
      };
    }
    if (!data.coachMemory) {
      data.coachMemory = { lastReviewedAt: "", keyInsights: [] };
    }
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

/** 生成认知指纹 — PRD 承诺 */
export function generateFingerprint(profile: CognitiveProfile): CognitiveFingerprint {
  const entries = Object.entries(profile.currentExposure);
  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const topFields = sorted.slice(0, 3).map(([id]) => id);
  const blindSpotCount = entries.filter(([_, v]) => v < 30).length;
  const coverageRate = entries.filter(([_, v]) => v > 0).length / entries.length;
  const avgImpact = profile.impactAggregate.avgImpact || 0;

  // 简短签名：高频领域首字母 + 盲区数 + 覆盖率
  const signature = `${topFields.join("").slice(0, 6).toUpperCase()}-${blindSpotCount}B-${Math.round(coverageRate * 100)}%`;

  return {
    topFields,
    blindSpotCount,
    coverageRate,
    avgImpact: Number(avgImpact.toFixed(2)),
    difficultyLevel: profile.difficultyLevel,
    signature,
  };
}

export const profileManager = {
  getProfile(): CognitiveProfile | null {
    return loadProfile();
  },

  hasProfile(): boolean {
    return !!loadProfile();
  },

  createProfile(
    nickname: string,
    exposure: Record<string, number>,
    difficultyLevel: DifficultyLevel = "L1"
  ): CognitiveProfile {
    const today = new Date().toISOString().slice(0, 10);
    const profile: CognitiveProfile = {
      profileVersion: CURRENT_VERSION,
      userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nickname,
      createdAt: new Date().toISOString(),
      initialExposure: { ...exposure },
      currentExposure: { ...exposure },
      exposureSnapshots: [{ date: today, exposure: { ...exposure } }],
      difficultyLevel,
      impactHistory: [],
      impactAggregate: { totalReads: 0, totalDimensions: [], avgImpact: 0 },
      milestones: [],
      readHistory: [],
      coachMemory: { lastReviewedAt: "", keyInsights: [] },
    };
    saveProfile(profile);
    return profile;
  },

  updateExposure(exposure: Record<string, number>): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    profile.currentExposure = { ...exposure };

    // 记录暴露快照（每天最多一条，更新当天的）
    const today = new Date().toISOString().slice(0, 10);
    const existingIdx = profile.exposureSnapshots.findIndex((s) => s.date === today);
    if (existingIdx >= 0) {
      profile.exposureSnapshots[existingIdx].exposure = { ...exposure };
    } else {
      profile.exposureSnapshots.push({ date: today, exposure: { ...exposure } });
      // 快照上限 90 天
      if (profile.exposureSnapshots.length > 90) {
        profile.exposureSnapshots = profile.exposureSnapshots.slice(-90);
      }
    }

    saveProfile(profile);
    return profile;
  },

  addReadContent(contentId: string, dimensionId: string): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    if (!profile.readHistory.includes(contentId)) {
      profile.readHistory.push(contentId);
    }
    profile.currentExposure[dimensionId] = (profile.currentExposure[dimensionId] || 0) + 1;
    saveProfile(profile);
    return profile;
  },

  recordImpact(record: Omit<ImpactRecord, "timestamp">): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;

    profile.impactHistory.push({
      ...record,
      timestamp: new Date().toISOString(),
    });

    // 上限 100 条：超出时归档到 aggregate
    if (profile.impactHistory.length > 100) {
      const archived = profile.impactHistory.slice(0, profile.impactHistory.length - 100);
      profile.impactHistory = profile.impactHistory.slice(-100);

      // 更新聚合统计
      profile.impactAggregate.totalReads += archived.length;
      profile.impactAggregate.totalDimensions = Array.from(new Set([
        ...profile.impactAggregate.totalDimensions,
        ...archived.map((r) => r.dimensionId),
      ]));
    }

    // 重新计算聚合
    const allRecords = profile.impactHistory;
    profile.impactAggregate.totalReads = profile.impactAggregate.totalReads - (profile.impactAggregate.totalReads - allRecords.length > 0 ? 0 : 0) + 0;
    // 简化：totalReads = 历史归档数 + 当前数
    profile.impactAggregate.avgImpact = allRecords.length > 0
      ? allRecords.reduce((s, r) => s + r.impactScore, 0) / allRecords.length
      : 0;
    profile.impactAggregate.totalDimensions = Array.from(new Set(allRecords.map((r) => r.dimensionId)));

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

  /** PRD 承诺：教练记忆 — 添加关键洞察 */
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

  /** PRD 承诺：认知指纹 */
  getFingerprint(): CognitiveFingerprint | null {
    const profile = loadProfile();
    if (!profile) return null;
    return generateFingerprint(profile);
  },

  /** PRD 承诺：数据导出 */
  exportProfile(): string {
    const profile = loadProfile();
    if (!profile) throw new Error("无档案可导出");
    return JSON.stringify(profile, null, 2);
  },

  /** PRD 承诺：数据导入 */
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

  toApiFormat(profile: CognitiveProfile) {
    return {
      exposure: profile.currentExposure,
      readHistory: profile.readHistory,
      impactHistory: profile.impactHistory,
      difficultyLevel: profile.difficultyLevel,
      highExposureFields: Object.entries(profile.currentExposure)
        .filter(([_, v]) => v >= 200)
        .map(([k]) => k),
      totalReads: profile.impactAggregate.totalReads + profile.impactHistory.length,
      milestones: profile.milestones,
      coachMemory: profile.coachMemory,
    };
  },
};
