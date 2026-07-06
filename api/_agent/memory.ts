// ===== 用户会话记忆 =====
// 每个用户独立的认知茧房数据

export interface UserExposure {
  dimensionId: string;
  count: number;
}

export interface UserSession {
  userId: string;
  createdAt: string;
  nickname: string;
  exposure: Map<string, number>; // dimensionId -> exposure count
  readContentIds: string[];
  savedContentIds: string[];
  unlockedBadges: string[];
  feedbacks: Array<{ contentId: string; insight: string; timestamp: string }>;
  lastActive: string;
}

const userStore = new Map<string, UserSession>();

export function createUser(nickname: string, initialExposure?: Map<string, number>): UserSession {
  const userId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user: UserSession = {
    userId,
    createdAt: new Date().toISOString(),
    nickname,
    exposure: initialExposure || new Map(),
    readContentIds: [],
    savedContentIds: [],
    unlockedBadges: [],
    feedbacks: [],
    lastActive: new Date().toISOString(),
  };
  userStore.set(userId, user);
  return user;
}

export function getUser(userId: string): UserSession | undefined {
  return userStore.get(userId);
}

export function setUserExposure(userId: string, exposure: Map<string, number>): UserSession | undefined {
  const user = userStore.get(userId);
  if (!user) return undefined;
  user.exposure = new Map(exposure);
  user.lastActive = new Date().toISOString();
  return user;
}

export function markContentRead(userId: string, contentId: string, dimensionId: string): UserSession | undefined {
  const user = userStore.get(userId);
  if (!user) return undefined;
  if (user.readContentIds.includes(contentId)) return user;

  user.readContentIds.push(contentId);
  const current = user.exposure.get(dimensionId) || 0;
  user.exposure.set(dimensionId, current + 1);

  // 解锁勋章：只要在该维度有阅读，就解锁探索者铜勋章
  const badgeId = `${dimensionId}-bronze`;
  if (!user.unlockedBadges.includes(badgeId)) {
    user.unlockedBadges.push(badgeId);
  }

  user.lastActive = new Date().toISOString();
  return user;
}

export function addFeedback(userId: string, contentId: string, insight: string): UserSession | undefined {
  const user = userStore.get(userId);
  if (!user) return undefined;
  user.feedbacks.push({ contentId, insight, timestamp: new Date().toISOString() });
  user.lastActive = new Date().toISOString();
  return user;
}

export function toggleSave(userId: string, contentId: string): UserSession | undefined {
  const user = userStore.get(userId);
  if (!user) return undefined;
  const idx = user.savedContentIds.indexOf(contentId);
  if (idx >= 0) user.savedContentIds.splice(idx, 1);
  else user.savedContentIds.push(contentId);
  user.lastActive = new Date().toISOString();
  return user;
}

export function getUserExposure(userId: string): Map<string, number> | undefined {
  return userStore.get(userId)?.exposure;
}
