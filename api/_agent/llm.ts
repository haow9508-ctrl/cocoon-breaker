// ===== DeepSeek LLM Client =====
// 用于生成「为什么推荐」解释、推荐排序和认知分析

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const MODEL = "deepseek-chat";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 800,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${errText}`);
  }

  const data: any = await res.json();
  return {
    content: data.choices[0].message.content,
    usage: data.usage,
  };
}

/** 根据用户的认知暴露图，生成「为什么推荐」的 AI 解释 */
export async function generateWhyRecommend(
  dimensionName: string,
  dimensionId: string,
  title: string,
  userExposure: Map<string, number>,
  highExposureDimensions: string[]
): Promise<string> {
  const exposureCount = userExposure.get(dimensionId) || 0;
  const sorted = Array.from(userExposure.entries()).sort((a, b) => b[1] - a[1]);
  const topExposure = sorted.slice(0, 3).map(([name, count]) => `${name}(${count}次)`).join("、");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是「茧房爆破器」的反推荐解释引擎。你要用一句话解释为什么推荐某个内容给用户。语气要犀利、直接、有洞察力。",
    },
    {
      role: "user",
      content: `用户在「${dimensionName}」维度过去30天只接触了 ${exposureCount} 次。${exposureCount === 0 ? "这是完全空白区" : "这是极低暴露区"}。用户最常接触的维度是：${topExposure || "暂无数据"}。现在推荐内容是「${title}」。请生成一句不超过40字的推荐解释，说明为什么这条内容能打破用户的茧房。`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 80 });
    return res.content.trim().replace(/^["\s]+|["\s]+$/g, "");
  } catch {
    return exposureCount === 0
      ? `你在「${dimensionName}」维度完全空白，这是典型的认知盲区。`
      : `你过去30天只接触过${exposureCount}次「${dimensionName}」，它需要被重新唤醒。`;
  }
}

/** 强制 LLM 返回全部 24 维度暴露值（修复差异化 bug） */
export async function analyzeAllDimensions(
  userInput: string
): Promise<Map<string, number>> {
  const dimensionList = "entertainment,humor,beauty,movie,food,gaming,tech,auto,sports,finance,history,psychology,art,literature,sociology,philosophy,physics,astronomy,classical,biology,archaeology,linguistics,architecture,math";
  const names = "娱乐八卦,搞笑视频,美妆穿搭,影视综艺,美食,游戏电竞,科技数码,汽车,体育,财经投资,历史,心理学,艺术设计,文学,社会学,哲学,粒子物理,天文学,古典音乐,生物学,考古学,语言学,建筑学,数学";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是认知暴露分析器。根据用户描述，为其 30 天内在这 24 个维度的内容接触次数（0-1000 整数）打分。关键规则：
1. 用户明确提到"经常看/天天刷"→ 200-800；"偶尔看"→ 50-150；"从不/不看"→ 0-10；未提及 → 保留低值(10-30)
2. 不要用默认值！根据用户实际描述推断。
3. 输出纯 JSON 对象，24 个 key 必须全部包含。只输出 JSON。

维度ID: ${dimensionList}
中文名: ${names}`,
    },
    { role: "user", content: userInput },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0, maxTokens: 800 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const result = new Map<string, number>();
      for (const [k, v] of Object.entries(parsed)) {
        result.set(k, typeof v === "number" ? v : Number(v) || 0);
      }
      if (result.size >= 20) return result; // 必须覆盖大部分维度
    }
  } catch {}

  return new Map(); // 失败则返回空，上层用默认值
}

/** 根据用户输入的自然语言，抽取 24 个维度的暴露次数（旧版，保留兼容） */
export async function analyzeCocoonExposure(
  userInput: string
): Promise<Map<string, number>> {
  return analyzeAllDimensions(userInput);
}

/** 生成「这刷新了我什么认知」的引导反馈 */
export async function generateFeedbackPrompt(
  dimensionName: string,
  title: string
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是反推荐 Agent。用户在阅读了一条盲区内容后，你要给出一个 1 句话的反馈提示，引导他思考「这条内容刷新了我什么认知」。要求：不超过 25 字，有启发性。",
    },
    {
      role: "user",
      content: `维度：${dimensionName}，内容：${title}`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 60 });
    return res.content.trim().replace(/^["\s]+|["\s]+$/g, "");
  } catch {
    return `这条关于「${dimensionName}」的内容，刷新了你什么认知？`;
  }
}

/**
 * 智能推荐：让 DeepSeek 根据用户的具体暴露数据，
 * 从候选内容中选择最合适的 3 篇，并给出选择理由。
 * 返回选中的 contentId 数组（顺序即优先级）。
 */
export async function smartSelectRecommendations(
  candidates: Array<{ id: string; title: string; description: string; dimensionName: string; exposureCount: number }>,
  userExposure: Map<string, number>,
  highExposureNames: string[],
  limit: number = 3
): Promise<string[]> {
  if (candidates.length <= limit) {
    return candidates.map((c) => c.id);
  }

  // 构造用户画像摘要
  const sorted = Array.from(userExposure.entries()).sort((a, b) => b[1] - a[1]);
  const topExposure = sorted.slice(0, 5).map(([name, count]) => `${name}(${count})`).join("、");
  const blindSpots = sorted.slice(-8).filter(([_, c]) => c < 30).map(([name, count]) => `${name}(${count})`).join("、");

  const candidateList = candidates.map((c, i) =>
    `${i + 1}. [${c.dimensionName}] ${c.title}（暴露:${c.exposureCount}）- ${c.description.slice(0, 60)}...`
  ).join("\n");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的反推荐引擎。你的任务：根据用户的认知暴露数据，从候选内容中选择 ${limit} 篇最能让用户突破认知茧房的内容。

选择原则：
1. 优先选择用户完全没接触过的领域（暴露值为0或极低）
2. 与用户高频领域形成对比和冲击（比如用户天天看娱乐八卦，就推哲学/物理）
3. 3篇内容应来自不同维度，保证多样性
4. 考虑内容的「冲击力」——能真正让用户产生认知震荡的优先

输出格式：只输出选中的编号，用逗号分隔，如 "3,7,12"。不要输出其他内容。`,
    },
    {
      role: "user",
      content: `用户画像：
- 高频领域：${topExposure || "暂无"}
- 盲区领域：${blindSpots || "暂无"}

候选内容：
${candidateList}

请选择 ${limit} 篇，输出编号（用逗号分隔）：`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.5, maxTokens: 50 });
    const numbers = res.content.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      const selectedIds: string[] = [];
      for (const numStr of numbers) {
        const idx = parseInt(numStr) - 1;
        if (idx >= 0 && idx < candidates.length && !selectedIds.includes(candidates[idx].id)) {
          selectedIds.push(candidates[idx].id);
        }
        if (selectedIds.length >= limit) break;
      }
      if (selectedIds.length > 0) return selectedIds;
    }
  } catch (e) {
    console.warn("[LLM] smartSelect failed, falling back to random");
  }

  // fallback: 随机选择
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit).map((c) => c.id);
}

/**
 * 智能聊天：支持多轮对话，根据用户输入和暴露数据给出个性化回复。
 */
export async function chatWithAssistant(
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  userExposure: Map<string, number>,
  availableContent: Array<{ id: string; title: string; dimensionName: string; description: string }>
): Promise<string> {
  const sorted = Array.from(userExposure.entries()).sort((a, b) => b[1] - a[1]);
  const topExposure = sorted.slice(0, 5).map(([name, count]) => `${name}(${count}次)`).join("、");
  const blindSpots = sorted.filter(([_, c]) => c < 30).slice(0, 8).map(([name]) => name).join("、");
  const contentList = availableContent.map((c) => `- [${c.dimensionName}] ${c.title}: ${c.description.slice(0, 50)}`).join("\n");

  const systemPrompt = `你是「茧房爆破器」的智能助手。用户的数据如下：
- 高频领域（用户经常看的）：${topExposure || "暂无"}
- 盲区领域（用户从没看过的）：${blindSpots || "暂无"}

可用内容库：
${contentList}

你的职责：
1. 根据用户的问题，给出个性化的回答和建议
2. 如果用户问推荐什么，从内容库中选择1-2篇最适合的，并说明为什么
3. 如果用户问某个领域，介绍该领域的内容并引导阅读
4. 回答要简洁有力，不超过200字
5. 语气像朋友聊天，不要太正式，不要太"AI"`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 300 });
    return res.content.trim();
  } catch (e) {
    return "抱歉，我暂时无法回复。请稍后再试。";
  }
}
