// ===== API Client v4.0 =====
// 认知成长教练 7 阶段 Pipeline 前端封装

import { profileManager } from "./profileManager";

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

// ① 诊断式扫描
export async function diagnose(
  nickname: string,
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const data = await post("/diagnose", { nickname, messages });
  return data.reply;
}

// ② 分析：生成24维暴露值
export async function analyze(input: string): Promise<any> {
  return await post("/analyze", { input });
}

// ③④ 每日挑战
export async function getChallenge(): Promise<any> {
  const profile = getApiProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/challenge", profile);
}

// ⑤⑥ 提交冲击自评
export async function submitAssessment(
  contentId: string,
  dimensionId: string,
  dimensionName: string,
  title: string,
  impactScore: 1 | 2 | 3 | 4 | 5,
  reflection: string
): Promise<any> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");

  const data = await post("/assess", {
    contentId,
    dimensionId,
    dimensionName,
    title,
    impactScore,
    reflection,
    exposure: profile.currentExposure,
    profile: profileManager.toApiFormat(profile),
  });

  // 更新本地档案
  profileManager.updateExposure(data.newExposure);
  profileManager.updateDifficulty(data.newDifficulty);
  profileManager.recordImpact({
    contentId,
    dimensionId,
    dimensionName,
    title,
    impactScore,
    reflection,
  });
  if (data.newMilestones?.length > 0) {
    profileManager.addMilestones(data.newMilestones);
  }

  return data;
}

// 认知地图
export async function getCognitiveMap(): Promise<any[]> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/map", { exposure: profile.currentExposure });
}

// 成长曲线数据
export async function getGrowthData(): Promise<any> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/growth", { profile: profileManager.toApiFormat(profile) });
}

// ⑦ 教练对话
export async function chatWithCoach(
  message: string,
  history: Array<{ role: string; content: string }>
): Promise<string> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  const data = await post("/coach", {
    message,
    history,
    profile: profileManager.toApiFormat(profile),
  });
  return data.reply;
}

// 内容详情
export async function getContentDetail(contentId: string): Promise<any> {
  const profile = getProfile();
  if (!profile) throw new Error("请先完成诊断扫描");
  return await post("/content", {
    contentId,
    exposure: profile.currentExposure,
    difficultyLevel: profile.difficultyLevel,
  });
}
