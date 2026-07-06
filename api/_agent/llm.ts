// ===== DeepSeek LLM Client =====
// 纯生成式 Agent — 无知识库、无RAG
// 所有内容由 DeepSeek Transformer 动态生成

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

/** 检查 API Key 是否配置 */
export function isApiKeyConfigured(): boolean {
  return !!DEEPSEEK_API_KEY;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

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

// ===== Agent Pipeline ② 分析层 =====

/** ② 分析：根据用户自然语言输入，生成24维认知暴露值 */
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

  const res = await chatCompletion(messages, { temperature: 0, maxTokens: 800 });
  const jsonMatch = res.content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    const result = new Map<string, number>();
    for (const [k, v] of Object.entries(parsed)) {
      result.set(k, typeof v === "number" ? v : Number(v) || 0);
    }
    if (result.size >= 20) return result;
  }

  throw new Error("DeepSeek 分析失败：无法解析24维暴露值");
}

// ===== Agent Pipeline ④ 生成层 =====

export interface GeneratedContent {
  dimensionId: string;
  dimensionName: string;
  title: string;
  why: string;
  description: string;
  source: string;
  readTimeMinutes: number;
}

/** ④ 生成：根据用户的盲区维度，由 DeepSeek 动态生成教育性内容 */
export async function generateDailyContent(
  blindSpots: Array<{ id: string; name: string; exposureCount: number }>,
  highExposureNames: string[]
): Promise<GeneratedContent[]> {
  const blindSpotDesc = blindSpots.map(b => `${b.id}(${b.name}, 暴露值:${b.exposureCount})`).join("、");
  const highDesc = highExposureNames.join("、") || "暂无明显高频领域";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的反推荐引擎内容生成器。你的任务：为用户的认知盲区动态生成教育性内容。

核心原则：
1. 内容必须与用户高频领域形成认知冲击和对比
2. 标题要有吸引力、有悬念，不要百科式标题
3. 摘要150-200字，要有洞察力、有冲击力，能让人产生"原来如此"的感觉
4. 来源标注真实（维基百科/学术论文/经典著作/科学期刊）
5. 阅读时间5-10分钟
6. 推荐理由一句话，说明为什么这条内容能打破用户的信息茧房

输出格式：纯 JSON 数组，每个对象包含：
- dimensionId: 维度ID
- dimensionName: 维度中文名
- title: 标题
- why: 推荐理由（一句话）
- description: 摘要（150-200字）
- source: 来源
- readTimeMinutes: 阅读时间（整数）

只输出 JSON 数组，不要输出其他内容。`,
    },
    {
      role: "user",
      content: `用户的认知盲区（需要生成内容的维度）：
${blindSpotDesc}

用户的高频领域（用于形成认知冲击）：
${highDesc}

请为这 ${blindSpots.length} 个盲区维度各生成一篇内容，输出 JSON 数组：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 2000 });
  const jsonMatch = res.content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        dimensionId: item.dimensionId || "",
        dimensionName: item.dimensionName || "",
        title: item.title || "",
        why: item.why || "",
        description: item.description || "",
        source: item.source || "",
        readTimeMinutes: item.readTimeMinutes || 5,
      }));
    }
  }

  throw new Error("DeepSeek 内容生成失败：无法解析生成结果");
}

/** 生成「为什么推荐」的 AI 解释（用于内容详情页） */
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

// ===== Agent Pipeline ⑤ 交互层 =====

/** ⑤ 交互：多轮对话，根据用户暴露数据个性化回复 */
export async function chatWithAssistant(
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  userExposure: Map<string, number>
): Promise<string> {
  const sorted = Array.from(userExposure.entries()).sort((a, b) => b[1] - a[1]);
  const topExposure = sorted.slice(0, 5).map(([name, count]) => `${name}(${count}次)`).join("、");
  const blindSpots = sorted.filter(([_, c]) => c < 30).slice(0, 8).map(([name]) => name).join("、");

  const systemPrompt = `你是「茧房爆破器」的智能助手，一个反推荐引擎的对话界面。

用户的认知暴露数据：
- 高频领域（用户经常看的）：${topExposure || "暂无"}
- 盲区领域（用户从没看过的）：${blindSpots || "暂无"}

你的职责：
1. 根据用户的认知暴露数据，给出个性化的回答和建议
2. 如果用户问推荐什么，根据用户的盲区领域，描述一个值得探索的方向或概念（不需要具体的文章，描述领域本身的价值）
3. 如果用户问某个领域，介绍该领域为什么值得探索，以及它和用户高频领域的关联
4. 回答要简洁有力，不超过200字
5. 语气像朋友聊天，不要太正式，不要太"AI"
6. 你的目标是帮助用户突破认知茧房，不是迎合用户已有偏好`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 300 });
  return res.content.trim();
}
