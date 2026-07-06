const API_BASE = "/api";

// localStorage keys
const EXPOSURE_KEY = "cocoonExposure";
const READ_KEY = "cocoonReadContentIds";
const NICKNAME_KEY = "cocoonNickname";

export function getExposure(): Record<string, number> {
  const raw = localStorage.getItem(EXPOSURE_KEY);
  return raw ? JSON.parse(raw) : {};
}

export function setExposure(exp: Record<string, number>) {
  localStorage.setItem(EXPOSURE_KEY, JSON.stringify(exp));
}

export function getReadContentIds(): string[] {
  const raw = localStorage.getItem(READ_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function addReadContentId(id: string) {
  const ids = getReadContentIds();
  if (!ids.includes(id)) {
    ids.push(id);
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  }
}

export function getNickname(): string {
  return localStorage.getItem(NICKNAME_KEY) || "探索者";
}

export function hasScanned(): boolean {
  return !!localStorage.getItem(EXPOSURE_KEY);
}

// ===== 扫描 =====
export async function scanCocoon(nickname: string, input?: string): Promise<any> {
  const res = await fetch(`${API_BASE}/agent/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname, input }),
  });
  const json = await res.json();
  if (json.success) {
    localStorage.setItem(NICKNAME_KEY, nickname);
    setExposure(json.data.exposure);
  }
  return json.data;
}

// ===== 每日推送 =====
export async function getDailyFeed(): Promise<any> {
  const res = await fetch(`${API_BASE}/agent/daily`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      exposure: getExposure(),
      readContentIds: getReadContentIds(),
    }),
  });
  return res.json().then((j) => j.data);
}

// ===== 认知地图 =====
export async function getCognitiveMap(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/agent/map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ exposure: getExposure() }),
  });
  return res.json().then((j) => j.data);
}

// ===== 内容详情 =====
export async function getContentDetail(contentId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/agent/content`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contentId,
      exposure: getExposure(),
    }),
  });
  return res.json().then((j) => j.data);
}

// ===== 标记已读（前端本地存储） =====
export async function markAsRead(contentId: string, dimensionId: string): Promise<void> {
  addReadContentId(contentId);
  // 更新 exposure
  const exp = getExposure();
  exp[dimensionId] = (exp[dimensionId] || 0) + 1;
  setExposure(exp);
}

// ===== 提交反馈（前端本地存储） =====
export async function submitFeedback(contentId: string, insight: string): Promise<void> {
  const feedbacks = JSON.parse(localStorage.getItem("cocoonFeedbacks") || "[]");
  feedbacks.push({ contentId, insight, timestamp: new Date().toISOString() });
  localStorage.setItem("cocoonFeedbacks", JSON.stringify(feedbacks));
}

// ===== 智能聊天 =====
export async function chatWithAgent(
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      history,
      exposure: getExposure(),
    }),
  });
  const json = await res.json();
  if (json.success) return json.data.reply;
  throw new Error(json.error || "聊天失败");
}
