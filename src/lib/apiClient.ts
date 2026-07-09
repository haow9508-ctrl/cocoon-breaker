// ===== API Client v6.0 =====
// v6.0：从"24 维暴露扫描"适配为"认知大方向 + 方向内子领域树"
// 7 阶段 Pipeline 前端封装（与后端 api/_routes/agent.ts 对齐）

import { profileManager, type CognitiveDirection } from "./profileManager";

const API_BASE = "/api";

function getProfile() {
  return profileManager.getProfile();
}

function getApiProfile() {
  const profile = getProfile();
  if (!profile) return null;
  return profileManager.toApiFormat(profile);
}

async function post(path: string, body: any): Promise<any> {
  const res = await fetch(`${API_BASE}/agent${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "API 调用失败");
  return json.data;
}

// ① 诊断：识别用户的认知大方向（多轮对话式）
export async function diagnose(
  nickname: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const data = await post("/diagnose", { nickname, messages });
  return data.reply;
}

// ② 分析：识别认知大方向 + 方向内子领域树 + 初始难度等级
// 返回 { directions: CognitiveDirection[], difficultyLevel }
export async function analyze(input: string): Promise<{
  directions: CognitiveDirection[];
  difficultyLevel: "L1" | "L2" | "L3";
}> {
  return await post("/analyze", { input });
}

// ③④ 每日挑战：方向内拓展决策 + DeepSeek 生成
// 后端 ChallengeItem 字段：directionId/directionName/subfieldId/subfieldName
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
  difficultyLevel: "L1" | "L2" | "L3";
  coachGuidance: string;
  sourceType?: "bing" | "deepseek_fallback";
  sourceUrl?: string;
}

export interface ChallengeResult {
  items: ChallengeItem[];
  unexploredCount: number;        // 未接触子领域总数
  selectedSubfields: string[];    // 选中的子领域 ID
}

export async function getChallenge(): Promise<ChallengeResult> {
  const profile = getApiProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/challenge", {
    directions: profile.directions,
    readHistory: profile.readHistory,
    impactHistory: profile.impactHistory,
    difficultyLevel: profile.difficultyLevel,
  });
}

// ⑤⑥ 提交冲击自评 + 反哺
// v6.0：参数从 dimensionId/dimensionName 改为 directionId/directionName/subfieldId/subfieldName
export async function submitAssessment(
  contentId: string,
  directionId: string,
  directionName: string,
  subfieldId: string,
  subfieldName: string,
  title: string,
  impactScore: 1 | 2 | 3 | 4 | 5,
  reflection: string
): Promise<any> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");

  const data = await post("/assess", {
    contentId,
    directionId,
    directionName,
    subfieldId,
    subfieldName,
    title,
    impactScore,
    reflection,
    directions: profile.directions,
    profile: profileManager.toApiFormat(profile),
  });

  // v6.0：后端不再返回 newExposure，前端基于 impactHistory + directions 自行更新
  if (data.newDifficulty) {
    profileManager.updateDifficulty(data.newDifficulty);
  }
  // 记录冲击自评（本地基于 subfieldId 聚合统计）
  profileManager.recordImpact({
    contentId,
    directionId,
    directionName,
    subfieldId,
    subfieldName,
    title,
    impactScore,
    reflection,
  });
  if (data.newMilestones?.length > 0) {
    profileManager.addMilestones(data.newMilestones);
  }
  // 标记该子领域已读（更新方向树接触状态）
  profileManager.addReadContent(contentId, subfieldId);
  // 存入教练记忆（PRD 承诺：coachMemory.keyInsights）
  if (data.keyInsight) {
    profileManager.addKeyInsight(data.keyInsight);
  }

  return data;
}

// 认知地图：v6.0 返回 directions 数组（替代旧的 24 维列表）
export async function getCognitiveMap(): Promise<CognitiveDirection[]> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/map", { directions: profile.directions });
}

// 成长曲线数据：v6.0 后端返回 totalSubfields（替代旧的 totalDimensions/24）
export async function getGrowthData(): Promise<any> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/growth", { profile: profileManager.toApiFormat(profile) });
}

// ⑦ 教练对话
export interface CoachReply {
  method: string; // socratic | analogy | counterfactual | memory | general
  content: string;
  keyInsight: string | null;
}

export async function chatWithCoach(
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<CoachReply> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  const data = await post("/coach", {
    message,
    history,
    profile: profileManager.toApiFormat(profile),
  });
  // 存入教练记忆（PRD 承诺：coachMemory.keyInsights）
  if (data.keyInsight) {
    profileManager.addKeyInsight(data.keyInsight);
  }
  return { method: data.method, content: data.content, keyInsight: data.keyInsight };
}

// 内容详情：v6.0 后端期望 directionId/subfieldId/directions/difficultyLevel
export async function getContentDetail(
  directionId: string,
  subfieldId: string
): Promise<ChallengeItem | undefined> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/content", {
    directionId,
    subfieldId,
    directions: profile.directions,
    difficultyLevel: profile.difficultyLevel,
  });
}
