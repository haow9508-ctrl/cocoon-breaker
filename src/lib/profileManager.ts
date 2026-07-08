// ===== 认知档案管理器 v4.0 =====
// 管理用户认知档案的 localStorage 持久化

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

export interface Milestone {
  id: string;
  type: string;
  description: string;
  unlockedAt: string;
}

export interface CognitiveProfile {
  userId: string;
  nickname: string;
  createdAt: string;
  initialExposure: Record<string, number>;
  currentExposure: Record<string, number>;
  difficultyLevel: DifficultyLevel;
  impactHistory: ImpactRecord[];
  milestones: Milestone[];
  readHistory: string[];
}

const PROFILE_KEY = "cocoon_profile_v4";

function loadProfile(): CognitiveProfile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveProfile(profile: CognitiveProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export const profileManager = {
  getProfile(): CognitiveProfile | null {
    return loadProfile();
  },

  hasProfile(): boolean {
    return !!loadProfile();
  },

  createProfile(nickname: string, exposure: Record<string, number>, difficultyLevel: DifficultyLevel = "L1"): CognitiveProfile {
    const profile: CognitiveProfile = {
      userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      nickname,
      createdAt: new Date().toISOString(),
      initialExposure: { ...exposure },
      currentExposure: { ...exposure },
      difficultyLevel,
      impactHistory: [],
      milestones: [],
      readHistory: [],
    };
    saveProfile(profile);
    return profile;
  },

  updateExposure(exposure: Record<string, number>): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    profile.currentExposure = { ...exposure };
    saveProfile(profile);
    return profile;
  },

  addReadContent(contentId: string, dimensionId: string): CognitiveProfile | null {
    const profile = loadProfile();
    if (!profile) return null;
    if (!profile.readHistory.includes(contentId)) {
      profile.readHistory.push(contentId);
    }
    // 更新暴露值
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

  // 生成用于后端的简化档案
  toApiFormat(profile: CognitiveProfile) {
    return {
      exposure: profile.currentExposure,
      readHistory: profile.readHistory,
      impactHistory: profile.impactHistory,
      difficultyLevel: profile.difficultyLevel,
      highExposureFields: Object.entries(profile.currentExposure)
        .filter(([_, v]) => v >= 200)
        .map(([k]) => k),
      totalReads: profile.impactHistory.length,
      milestones: profile.milestones,
    };
  },
};
