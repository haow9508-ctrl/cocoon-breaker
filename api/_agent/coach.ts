// ===== ⑦ 对话层 v4.0 — 认知成长教练 =====
// 使用方法论：苏格拉底追问 / 类比桥接 / 反事实推演 / 长期记忆

import { chatCompletion, buildCoachContext, ChatMessage } from "./llm.js";
import { COGNITIVE_DIMENSIONS } from "../_knowledge/domains.js";

interface CoachProfile {
  highExposure?: string[];
  blindSpots?: string[];
  explored?: string[];
  difficultyLevel?: string;
  weekNumber?: number;
  totalReads?: number;
  recentImpacts?: number[];
}

/** ⑦ 对话：认知成长教练多轮对话 */
export async function chatWithCoach(
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  profile: CoachProfile
): Promise<string> {
  const context = buildCoachContext(profile);

  const systemPrompt = `你是「茧房爆破器」用户的认知成长教练。

你不是通用助手，你是专家。你的方法论：

1. 苏格拉底式追问：不直接给答案，引导用户自己发现盲区
   - 用户问"什么是量子纠缠" → "你觉得为什么两个粒子能瞬间相互影响？"
2. 类比桥接：用用户高频领域类比解释盲区
   - 用户高频是"娱乐八卦" → "量子纠缠就像CP感，但发生在粒子之间"
3. 反事实推演：让用户想象另一种可能
   - "如果你过去10年每周看一篇心理学，你现在的决策方式会有什么不同？"
4. 长期记忆：记住用户的成长历史，在合适时机回顾
   - "上个月你第一次接触了心理学，这个月我们来试试社会学"

${context}

规则：
- 永远不要说"作为一个AI"，你是教练
- 永远不要迎合用户已有偏好，你的目标是扩展边界
- 回答简洁有力，不超过200字
- 语气像一位见多识广的朋友，不是老师，不是百科
- 如果用户问推荐什么，根据盲区领域引导，不要直接给答案`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 300 });
  return res.content.trim();
}

/** 从暴露数据构建 CoachProfile */
export function buildProfileFromExposure(
  exposure: Map<string, number>,
  difficultyLevel: string = "L1",
  impactHistory: Array<{ dimensionId: string; impactScore: number; title: string }> = [],
  totalReads: number = 0
): CoachProfile {
  const sorted = Array.from(exposure.entries()).sort((a, b) => b[1] - a[1]);

  const highExposure = sorted
    .filter(([_, c]) => c >= 200)
    .slice(0, 5)
    .map(([id]) => COGNITIVE_DIMENSIONS.find((d) => d.id === id)?.name || id);

  const blindSpots = sorted
    .filter(([_, c]) => c < 30)
    .slice(0, 8)
    .map(([id]) => COGNITIVE_DIMENSIONS.find((d) => d.id === id)?.name || id);

  const explored = Array.from(new Set(impactHistory.map((r) => r.dimensionId)))
    .map((id) => COGNITIVE_DIMENSIONS.find((d) => d.id === id)?.name || id);

  const recentImpacts = impactHistory.slice(-5).map((r) => r.impactScore);

  const weekNumber = Math.max(1, Math.ceil((Date.now() - Date.parse("2026-07-07")) / (7 * 24 * 60 * 60 * 1000)));

  return {
    highExposure,
    blindSpots,
    explored,
    difficultyLevel,
    weekNumber,
    totalReads,
    recentImpacts,
  };
}
