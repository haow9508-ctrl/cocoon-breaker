import { create } from "zustand";
import { domainTree, flatDomains, expertViews, badges } from "../data/mockData";
import { DomainNode, ExpertView, SingleView, UserPreference, ChatMessage, UserProgress, Badge, DomainExposure, ReadingFeedback, RecommendationReason } from "../../shared/types";

interface AppState {
  domainTree: DomainNode[];
  expertViews: ExpertView[];
  badges: Badge[];
  userPreference: UserPreference;
  userProgress: UserProgress;
  selectedDomainId: string | null;
  chatMessages: ChatMessage[];
  isOnboarding: boolean;

  setSelectedDomain: (id: string | null) => void;
  toggleInterestDomain: (id: string) => void;
  toggleExcludeDomain: (id: string) => void;
  setPreferenceType: (type: 'specialist' | 'generalist') => void;
  setContentDepth: (depth: 'lite' | 'standard' | 'deep') => void;
  completeOnboarding: () => void;
  startOnboarding: () => void;

  addChatMessage: (message: ChatMessage) => void;
  clearChat: () => void;

  markViewRead: (viewId: string) => void;
  toggleSaveView: (viewId: string) => void;
  submitFeedback: (viewId: string, insight: string) => void;
  getViewById: (viewId: string) => SingleView | undefined;
  getViewsByDomain: (domainId: string) => SingleView[];
  /** 反推荐：从用户的认知盲区中推荐内容 */
  getRecommendedViews: (limit?: number) => SingleView[];
  /** 获取某条推荐的"为什么推荐"解释 */
  getRecommendationReason: (viewId: string) => RecommendationReason | undefined;
  /** 获取用户的认知盲区维度列表 */
  getBlindSpotDomains: () => string[];
  /** 获取维度暴露度 */
  getDomainExposure: (domainId: string) => DomainExposure | undefined;
}

/** 获取所有24个维度ID */
function getAllDomainIds(): string[] {
  return flatDomains.map((d) => d.id);
}

/** 从view中提取关联的领域（包括父领域） */
function getViewDomains(view: SingleView): string[] {
  const ids = new Set(view.domainIds);
  // 同时添加子领域对应的父领域
  for (const childId of view.domainIds) {
    const node = flatDomains.find((d) => d.id === childId);
    if (node?.parentId) ids.add(node.parentId);
  }
  return Array.from(ids);
}

export const useAppStore = create<AppState>((set, get) => ({
  domainTree,
  expertViews,
  badges,
  userPreference: {
    type: 'generalist',
    interestedDomains: [],
    excludedDomains: [],
    contentDepth: 'standard',
    onboarded: false,
  },
  userProgress: {
    readViewIds: [],
    totalReads: 0,
    streakDays: 0,
    savedViewIds: [],
    unlockedBadgeIds: [],
    domainExposure: [],
    feedbacks: [],
  },
  selectedDomainId: null,
  chatMessages: [],
  isOnboarding: false,

  setSelectedDomain: (id) => set({ selectedDomainId: id }),

  toggleInterestDomain: (id) =>
    set((state) => {
      const isInterested = state.userPreference.interestedDomains.includes(id);
      return {
        userPreference: {
          ...state.userPreference,
          interestedDomains: isInterested
            ? state.userPreference.interestedDomains.filter((d) => d !== id)
            : [...state.userPreference.interestedDomains, id],
          excludedDomains: state.userPreference.excludedDomains.filter((d) => d !== id),
        },
      };
    }),

  toggleExcludeDomain: (id) =>
    set((state) => {
      const isExcluded = state.userPreference.excludedDomains.includes(id);
      return {
        userPreference: {
          ...state.userPreference,
          excludedDomains: isExcluded
            ? state.userPreference.excludedDomains.filter((d) => d !== id)
            : [...state.userPreference.excludedDomains, id],
          interestedDomains: state.userPreference.interestedDomains.filter((d) => d !== id),
        },
      };
    }),

  setPreferenceType: (type) =>
    set((state) => ({
      userPreference: { ...state.userPreference, type },
    })),

  setContentDepth: (depth) =>
    set((state) => ({
      userPreference: { ...state.userPreference, contentDepth: depth },
    })),

  completeOnboarding: () =>
    set((state) => ({
      userPreference: { ...state.userPreference, onboarded: true },
      isOnboarding: false,
    })),

  startOnboarding: () => set({ isOnboarding: true }),

  addChatMessage: (message) =>
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
    })),

  clearChat: () => set({ chatMessages: [] }),

  // ===== 核心：标记已读 + 领域暴露追踪 + 勋章检查 =====
  markViewRead: (viewId) =>
    set((state) => {
      if (state.userProgress.readViewIds.includes(viewId)) return state;

      // 找到该view，获取关联的领域
      const view = get().getViewById(viewId);
      const relatedDomains = view ? getViewDomains(view) : [];

      // 更新阅读记录
      const newReadIds = [...state.userProgress.readViewIds, viewId];
      const now = new Date().toISOString();

      // 更新各维度的暴露度
      const newExposures = [...state.userProgress.domainExposure];
      for (const domainId of relatedDomains) {
        const existing = newExposures.find((e) => e.domainId === domainId);
        if (existing) {
          existing.exposureCount += 1;
          existing.lastExposedAt = now;
        } else {
          newExposures.push({
            domainId,
            exposureCount: 1,
            lastExposedAt: now,
          });
        }
      }

      // 检查勋章解锁
      const newBadgeIds = [...state.userProgress.unlockedBadgeIds];
      const { badges } = get();
      for (const badge of badges) {
        if (newBadgeIds.includes(badge.id)) continue;
        // 计算该badge对应领域的总阅读数
        const exposure = newExposures.find((e) => e.domainId === badge.domainId);
        const count = exposure?.exposureCount || 0;
        if (count >= badge.requirements) {
          newBadgeIds.push(badge.id);
        }
      }

      return {
        userProgress: {
          ...state.userProgress,
          readViewIds: newReadIds,
          totalReads: newReadIds.length,
          domainExposure: newExposures,
          unlockedBadgeIds: newBadgeIds,
        },
      };
    }),

  toggleSaveView: (viewId) =>
    set((state) => {
      const isSaved = state.userProgress.savedViewIds.includes(viewId);
      return {
        userProgress: {
          ...state.userProgress,
          savedViewIds: isSaved
            ? state.userProgress.savedViewIds.filter((id) => id !== viewId)
            : [...state.userProgress.savedViewIds, viewId],
        },
      };
    }),

  submitFeedback: (viewId, insight) =>
    set((state) => ({
      userProgress: {
        ...state.userProgress,
        feedbacks: [
          ...state.userProgress.feedbacks,
          { viewId, insight, submittedAt: new Date().toISOString() },
        ],
      },
    })),

  getViewById: (viewId) => {
    const { expertViews } = get();
    for (const ev of expertViews) {
      const view = ev.views.find((v) => v.id === viewId);
      if (view) return view;
    }
    return undefined;
  },

  getViewsByDomain: (domainId) => {
    const { expertViews } = get();
    return expertViews.flatMap((ev) => ev.views).filter((v) =>
      v.domainIds.includes(domainId)
    );
  },

  // ===== 核心：反推荐引擎 — 从盲区推荐 =====
  getRecommendedViews: (limit = 3) => {
    const { expertViews, userPreference, userProgress } = get();
    const allViews = expertViews.flatMap((ev) => ev.views);

    // 获取所有维度
    const allDomainIds = getAllDomainIds();
    // 用户已暴露的维度
    const exposedDomainIds = new Set(userProgress.domainExposure.map((e) => e.domainId));
    // 用户排除的维度
    const excludedSet = new Set(userPreference.excludedDomains);

    // 盲区维度：所有维度 - 已暴露维度 - 排除维度
    const blindSpotIds = allDomainIds.filter(
      (id) => !exposedDomainIds.has(id) && !excludedSet.has(id)
    );

    // 如果有感兴趣的维度但还没暴露，也视作盲区
    if (userPreference.interestedDomains.length > 0) {
      for (const id of userPreference.interestedDomains) {
        if (!exposedDomainIds.has(id) && !blindSpotIds.includes(id)) {
          blindSpotIds.push(id);
        }
      }
    }

    // 去重
    const uniqueBlindSpotIds = [...new Set(blindSpotIds)];

    // 从所有view中找出在盲区维度中的内容
    const blindSpotViews = allViews
      .filter((view) => {
        // 排除用户明确排除的领域
        if (view.domainIds.some((d) => excludedSet.has(d))) return false;
        // 排除已读的
        if (userProgress.readViewIds.includes(view.id)) return false;
        // 检查是否涉及盲区维度
        const viewDomains = getViewDomains(view);
        return viewDomains.some((d) => uniqueBlindSpotIds.includes(d));
      })
      .map((view) => {
        // 计算该view覆盖了多少个盲区维度
        const viewDomains = getViewDomains(view);
        const blindCount = viewDomains.filter((d) =>
          uniqueBlindSpotIds.includes(d)
        ).length;
        return { view, blindCount };
      })
      .sort((a, b) => b.blindCount - a.blindCount); // 优先推荐覆盖盲区维度最多的

    // 如果盲区推荐不够，补充未读的低暴露度内容
    if (blindSpotViews.length < limit) {
      const remaining = allViews
        .filter((v) => !userProgress.readViewIds.includes(v.id))
        .filter(
          (v) => !blindSpotViews.some((b) => b.view.id === v.id)
        )
        .filter(
          (v) => !v.domainIds.some((d) => excludedSet.has(d))
        )
        .map((view) => {
          const viewDomains = getViewDomains(view);
          const avgExposure =
            viewDomains.reduce((sum, d) => {
              const exp = userProgress.domainExposure.find((e) => e.domainId === d);
              return sum + (exp?.exposureCount || 0);
            }, 0) / Math.max(viewDomains.length, 1);
          return { view, avgExposure };
        })
        .sort((a, b) => a.avgExposure - b.avgExposure); // 低暴露度优先

      const needed = limit - blindSpotViews.length;
      const supplements = remaining.slice(0, needed);
      return [
        ...blindSpotViews.map((b) => b.view),
        ...supplements.map((s) => s.view),
      ].slice(0, limit);
    }

    // 随机抽取，增加多样性
    const shuffled = [...blindSpotViews].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, limit).map((b) => b.view);
  },

  // ===== "为什么推荐"解释 =====
  getRecommendationReason: (viewId) => {
    const { userProgress } = get();
    const view = get().getViewById(viewId);
    if (!view) return undefined;

    const viewDomains = getViewDomains(view);

    // 找出该view涉及的盲区维度
    const blindDomains: string[] = [];
    for (const domainId of viewDomains) {
      const exposure = userProgress.domainExposure.find((e) => e.domainId === domainId);
      if (!exposure || exposure.exposureCount === 0) {
        blindDomains.push(domainId);
      }
    }

    if (blindDomains.length === 0) {
      // 全部都有暴露，但暴露度低
      const domainName = viewDomains.map((d) => {
        const node = flatDomains.find((n) => n.id === d);
        return node ? node.name : d;
      })[0] || "新领域";

      return {
        viewId,
        blindSpotDomain: viewDomains[0] || "",
        reason: `推荐这条是因为你在「${domainName}」维度的内容接触极少——是时候扩展一下认知边界了！`,
      };
    }

    const domainName = blindDomains.map((d) => {
      const node = flatDomains.find((n) => n.id === d);
      return node ? node.name : d;
    })[0] || "新领域";

    return {
      viewId,
      blindSpotDomain: blindDomains[0],
      reason: `推荐这条是因为你过去30天从未接触过「${domainName}」的内容——这是你的认知盲区！`,
    };
  },

  // ===== 获取认知盲区 =====
  getBlindSpotDomains: () => {
    const { userProgress, userPreference } = get();
    const allIds = getAllDomainIds();
    const exposed = new Set(userProgress.domainExposure.map((e) => e.domainId));
    const excluded = new Set(userPreference.excludedDomains);

    return allIds.filter((id) => !exposed.has(id) && !excluded.has(id));
  },

  // ===== 获取维度暴露度 =====
  getDomainExposure: (domainId) => {
    const { userProgress } = get();
    return userProgress.domainExposure.find((e) => e.domainId === domainId);
  },
}));
