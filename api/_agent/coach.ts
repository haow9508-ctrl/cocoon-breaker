// ===== ⑦ 对话层 v6.0 — 认知成长教练 =====
// 使用方法论：苏格拉底追问 / 类比桥接 / 反事实推演 / 长期记忆
// v6.0：从"扩展跨维度盲区"改为"在用户既定认知方向内拓展未接触子领域"

import { chatCompletion, buildCoachContext, ChatMessage } from "./llm.js";
import type { CognitiveDirection } from "../_knowledge/domains.js";
import type { ImpactRecord } from "./recommender.js";

/**
 * 教练用户画像（v6.0：基于方向树而非暴露值）
 */
interface CoachProfile {
  directions?: CognitiveDirection[];       // 用户认知大方向 + 子领域树
  explored?: string[];                       // 已拓展的子领域名
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
): Promise<{ method: string; content: string }> {
  const context = buildCoachContext(profile);

  const systemPrompt = `你是「茧房爆破器」用户的认知成长教练。

你不是通用助手，你是专家。你的方法论：

1. 苏格拉底式追问：不直接给答案，引导用户自己发现认知边界
   - 用户问"Python 的 GIL 是什么" → "你觉得为什么单线程也能跑并发 IO？"
2. 类比桥接：用用户已接触的子领域类比解释未接触的子领域
   - 用户已学 Python 基础，问"编程范式是什么" → "你写 class 时其实就在用 OOP 范式，函数式是另一种思考方式"
3. 反事实推演：让用户想象另一种可能
   - "如果你学 Python 时同时接触 C 的内存模型，你写代码的方式会有什么不同？"
4. 长期记忆：记住用户的成长历史，在合适时机回顾
   - "上周你拓展了数据科学，这周我们可以试试算法思想"

${context}

核心原则（v6.0）：
- 永远不要说"作为一个AI"或"让我来帮你"，你是教练
- 永远不要迎合用户已有偏好，你的目标是在用户既定方向内拓展边界
- 不要把用户推向无关方向（如学 Python 的用户去推美妆/体育/搞笑段子）——这是 v5.0 的错误
- 推荐的子领域必须在用户已识别的认知大方向内
- 回答简洁有力，不超过 200 字，一次只说一件事
- 语气像一位见多识广的朋友，不是老师，不是百科，不是客服
- 如果用户问推荐什么，根据方向内未接触子领域引导，不要直接给答案
- 禁止"你的思考很有深度""这个问题很好"等空泛鼓励
- 要有观点，可以不同意用户，可以质疑，不要骑墙
- 不要用"第一/第二/第三"罗列，用自然对话节奏

【重要】回复格式要求：
- 必须在回复的最开头用以下四个标签之一标注本次回复使用的方法论：
  - [socratic] 表示使用了苏格拉底式追问
  - [analogy] 表示使用了类比桥接
  - [counterfactual] 表示使用了反事实推演
  - [memory] 表示使用了长期记忆回顾
- 标签之后直接跟回复正文，标签与正文之间不要换行，不要加冒号或其它分隔符
- 示例：[socratic]你觉得为什么单线程也能跑并发 IO？
- 每次回复必须选择最契合本次回复的方法论标签，且只能使用一个标签`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-8).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 300 });
  const raw = res.content.trim();

  // 解析开头的 [标签]，识别本次回复使用的方法论
  const tagMatch = raw.match(/^\[(socratic|analogy|counterfactual|memory)\]\s*([\s\S]*)$/i);
  if (tagMatch) {
    const method = tagMatch[1].toLowerCase();
    const content = tagMatch[2].trim();
    return { method, content };
  }

  // LLM 未加标签时，默认 method 为 general，保留全部正文
  return { method: "general", content: raw };
}

/**
 * 从方向树构建 CoachProfile（v6.0：替代旧的 buildProfileFromExposure）
 * - directions：用户认知大方向 + 子领域树
 * - explored：从 impactHistory 提取已拓展的子领域名
 */
export function buildProfileFromDirections(
  directions: CognitiveDirection[],
  difficultyLevel: string = "L1",
  impactHistory: ImpactRecord[] = [],
  totalReads: number = 0
): CoachProfile {
  // 已拓展的子领域名：从 impactHistory 中提取 subfieldName 去重
  const explored = Array.from(new Set(impactHistory.map((r) => r.subfieldName).filter(Boolean)));

  const recentImpacts = impactHistory.slice(-5).map((r) => r.impactScore);

  // 周数计算：以 2026-07-07 为起点
  const weekNumber = Math.max(1, Math.ceil((Date.now() - Date.parse("2026-07-07")) / (7 * 24 * 60 * 60 * 1000)));

  return {
    directions,
    explored,
    difficultyLevel,
    weekNumber,
    totalReads,
    recentImpacts,
  };
}
