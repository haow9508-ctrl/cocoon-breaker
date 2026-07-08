// ===== DeepSeek LLM Client v4.0 =====
// 认知成长教练 Agent — 纯生成式，无知识库
// DeepSeek 在所有阶段都扮演"认知成长教练"角色

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const MODEL = "deepseek-chat";

// 运行时读取，避免 ESM 模块加载顺序导致 dotenv 未及时注入
function getApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || "";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

/** 检查 API Key 是否配置 */
export function isApiKeyConfigured(): boolean {
  return !!getApiKey();
}

/** 通用 DeepSeek 调用函数 */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY not configured");
  }

  const res = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
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

// ===== 教练人格设定（所有阶段共享） =====

export function buildCoachContext(profile: {
  highExposure?: string[];
  blindSpots?: string[];
  explored?: string[];
  difficultyLevel?: string;
  weekNumber?: number;
  totalReads?: number;
  recentImpacts?: number[];
}): string {
  return `用户认知档案：
- 高频领域：${profile.highExposure?.join("、") || "暂无"}
- 盲区领域：${profile.blindSpots?.join("、") || "暂无"}
- 已爆破领域：${profile.explored?.join("、") || "暂无"}
- 当前难度：${profile.difficultyLevel || "L1"}
- 成长阶段：第${profile.weekNumber || 1}周，累计${profile.totalReads || 0}篇
- 最近冲击自评：${profile.recentImpacts?.join("、") || "暂无"}`;
}

// ===== 抗 GEO 污染策略 =====

/**
 * 内容生成的抗 GEO prompt 增强
 * 防止 DeepSeek 生成被 GEO 优化的"流行叙事"
 */
export const ANTI_GEO_DIRECTIVE = `重要规则 — 抗 GEO 污染：
1. 不要生成搜索引擎排名靠前的"流行科普叙事"——那些往往是 GEO 优化的产物
2. 优先选择被主流叙事忽略的边缘视角、争议性理论、非共识观点
3. 如果某内容有"流行版本"和"真实版本"，用真实版本
4. 标注内容的争议性：哪些是共识，哪些是边缘观点
5. 避免"鸡汤化"简化——保留复杂性，不要为了易懂而扭曲`;

// ===== Agent Pipeline ① 诊断层 =====

/** ① 诊断：多轮对话式扫描，收集用户内容消费习惯 */
export async function diagnoseConversation(
  messages: Array<{ role: string; content: string }>,
  nickname: string
): Promise<string> {
  const systemPrompt = `你是「茧房爆破器」用户的认知成长教练。现在正在进行诊断式扫描，通过多轮对话了解用户的内容消费习惯。

你的问诊方法论：
1. 从轻松的话题开始，让用户放松
2. 逐步深入，了解用户日常看什么、听什么、关注什么
3. 注意挖掘用户自己都没意识到的"认知舒适区"
4. 不追求固定轮数——苏格拉底式引导需要灵活深度，直到你认为已收集足够信息
5. 当你观察到用户的认知画像清晰时，可在回复末尾加一句简短总结

规则：
- 每次只问一个问题，不要一次问多个
- 语气像朋友聊天，不要像医生问诊
- 永远不要说"作为一个AI"
- 每轮回复不超过80字
- 用户昵称：${nickname}
- 对话轮数灵活——用户可在任意时刻主动结束并生成档案

${messages.length < 2 ? "这是第一轮对话，请用轻松的方式开场，问一个关于用户日常内容消费习惯的问题。" : "继续问诊，根据用户上一个回答深入挖掘。注意：不要为了收尾而收尾，只有在你真的认为已经了解用户习惯后才总结。"}`;

  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const res = await chatCompletion(chatMessages, { temperature: 0.7, maxTokens: 200 });
  return res.content.trim();
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

export interface ChallengeContent {
  dimensionId: string;
  dimensionName: string;
  title: string;
  why: string;
  description: string;
  source: string;
  readTimeMinutes: number;
  difficultyLevel: "L1" | "L2" | "L3";
  coachGuidance: string; // 教练引导语（类比桥接）
  sourceType?: "arxiv" | "wikipedia" | "deepseek_fallback"; // 内容来源（抗 GEO 透明度）
  sourceUrl?: string; // 真实链接（RAG 检索时提供）
}

/**
 * ④ 生成：根据盲区维度+高频领域+难度，生成挑战内容
 * v4.2：优先基于 RAG 检索的真实内容生成（抗 GEO），DeepSeek 只做教练引导
 *       RAG 无结果时 fallback 到纯 DeepSeek 生成
 */
export async function generateChallenge(
  blindSpots: Array<{ id: string; name: string; exposureCount: number }>,
  highExposureNames: string[],
  difficultyLevel: "L1" | "L2" | "L3",
  ragResultsByDim?: Map<string, Array<{
    title: string;
    description: string;
    source: string;
    sourceType: string;
    url: string;
    readTimeMinutes: number;
  }>>
): Promise<ChallengeContent[]> {
  const blindSpotDesc = blindSpots.map(b => `${b.id}(${b.name}, 暴露值:${b.exposureCount})`).join("、");
  const highDesc = highExposureNames.join("、") || "暂无明显高频领域";

  const difficultyHint = {
    L1: "L1相邻盲区：内容应与用户高频领域认知距离较近，容易接受。用用户熟悉的概念做类比。",
    L2: "L2中距盲区：内容应与用户高频领域有一定距离，需要一些认知跨越。",
    L3: "L3远端盲区：内容应与用户高频领域距离最远，最大化认知冲击。",
  }[difficultyLevel];

  // 构造 RAG context（如果有）
  let ragContext = "";
  const hasRag = ragResultsByDim && ragResultsByDim.size > 0;
  if (hasRag) {
    const ragParts: string[] = [];
    for (const [dimId, results] of ragResultsByDim!.entries()) {
      if (results.length === 0) continue;
      const docs = results.slice(0, 2).map((r, i) =>
        `  ${i + 1}. 标题：${r.title}\n     来源：${r.source} (${r.sourceType})\n     摘要：${r.description.slice(0, 300)}\n     链接：${r.url}`
      ).join("\n");
      ragParts.push(`维度 ${dimId} 的真实检索内容：\n${docs}`);
    }
    ragContext = `\n\n=== RAG 检索到的真实内容（来自 arXiv/Wikipedia，抗 GEO）===\n${ragParts.join("\n\n")}\n\n重要：请基于以上真实内容生成，标题和来源必须用检索到的真实内容。DeepSeek 只做：1) why 推荐理由；2) coachGuidance 类比引导；3) description 内容重组（保留事实，不要编造）。`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练，现在要为用户生成每日挑战内容。

${difficultyHint}

核心原则：
1. 标题要有吸引力、有悬念，不要百科式标题
2. 摘要150-200字，要有洞察力、有冲击力，能让人产生"原来如此"的感觉
3. 来源标注真实（维基百科/学术论文/经典著作/科学期刊）
4. 阅读时间5-10分钟
5. coachGuidance：用用户的高频领域做类比桥接，一句话引导用户进入内容
6. 推荐理由(why)：一句话说明为什么这条内容能打破用户的茧房${hasRag ? "\n7. 【重要】已提供 RAG 检索的真实内容，必须基于这些内容生成，不要凭空编造标题和来源" : ""}

${ANTI_GEO_DIRECTIVE}

输出格式：纯 JSON 数组，每个对象包含：
- dimensionId, dimensionName, title, why, description, source, readTimeMinutes, coachGuidance${hasRag ? ", sourceUrl" : ""}

只输出 JSON 数组。`,
    },
    {
      role: "user",
      content: `用户的认知盲区（需要生成内容的维度）：
${blindSpotDesc}

用户的高频领域（用于类比桥接和认知冲击）：
${highDesc}${ragContext}

请为这 ${blindSpots.length} 个盲区维度各生成一篇内容，输出 JSON 数组：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 2500 });
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
        difficultyLevel,
        coachGuidance: item.coachGuidance || "",
        sourceType: hasRag ? (item.sourceUrl ? "arxiv" : "deepseek_fallback") : "deepseek_fallback",
        sourceUrl: item.sourceUrl || "",
      }));
    }
  }

  throw new Error("DeepSeek 内容生成失败：无法解析生成结果");
}

// ===== Agent Pipeline ⑥ 反哺层 =====

/** ⑥ 反哺：基于用户冲击自评，教练给出反思引导 */
export async function coachFeedback(
  dimensionName: string,
  title: string,
  impactScore: number,
  reflection: string,
  profile: any
): Promise<string> {
  const context = buildCoachContext(profile);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练。用户刚刚读完一篇挑战内容并完成了冲击自评。

${context}

你的任务：基于用户的冲击自评和反思，给出一段反思引导（不超过100字）。
- 如果冲击分高(4-5星)：肯定这次认知突破，引导深入
- 如果冲击分中(3星)：补充一个视角，帮助用户看到更多
- 如果冲击分低(1-2星)：不否定用户感受，温和地指出可能错过的角度

语气像朋友，不要说教。永远不要说"作为一个AI"。`,
    },
    {
      role: "user",
      content: `我读了《${title}》（${dimensionName}维度）
冲击自评：${impactScore}星
我的反思：${reflection || "（用户没有写反思）"}

请给我一些反馈：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 200 });
  return res.content.trim();
}

// ===== Agent Pipeline ③ 决策层辅助：真正的认知距离评估 =====

/**
 * ③ 决策辅助：用 DeepSeek 评估盲区维度与用户高频领域的认知距离
 * 替代 recommender.ts 中的硬编码 5×5 矩阵
 * 返回 0-1 分数：0=认知距离近，1=认知距离远
 */
export async function evaluateCognitiveDistance(
  blindSpotName: string,
  highExposureNames: string[]
): Promise<number> {
  if (highExposureNames.length === 0) return 0.5;

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是认知距离评估器。评估一个"认知盲区"与用户"高频领域"之间的认知距离。

认知距离定义：
- 0.0-0.2：极度相邻（同一领域不同分支，如"娱乐八卦"→"影视综艺"）
- 0.3-0.4：相关但不同（有概念交集，如"科技数码"→"汽车"）
- 0.5-0.6：中等距离（需要认知跨越，如"美食"→"历史"）
- 0.7-0.8：远距（完全不同思维模式，如"搞笑视频"→"哲学"）
- 0.9-1.0：极远（认知范式断裂，如"娱乐八卦"→"粒子物理"）

只输出一个 0-1 的小数，不要任何解释。`,
    },
    {
      role: "user",
      content: `盲区维度：${blindSpotName}
用户高频领域：${highExposureNames.join("、")}

认知距离分数（0-1）：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0, maxTokens: 10 });
  const score = parseFloat(res.content.trim());
  if (isNaN(score)) return 0.5;
  return Math.max(0, Math.min(1, score));
}

/**
 * 批量评估认知距离（减少 API 调用次数）
 * 返回 Map<dimensionId, distanceScore>
 */
export async function evaluateCognitiveDistances(
  blindSpots: Array<{ id: string; name: string }>,
  highExposureNames: string[]
): Promise<Map<string, number>> {
  if (highExposureNames.length === 0 || blindSpots.length === 0) {
    return new Map(blindSpots.map((b) => [b.id, 0.5]));
  }

  const blindSpotDesc = blindSpots.map((b) => `${b.id}:${b.name}`).join(", ");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是认知距离评估器。评估每个"认知盲区"与用户"高频领域"之间的认知距离。

认知距离定义：
- 0.0-0.2：极度相邻
- 0.3-0.4：相关但不同
- 0.5-0.6：中等距离
- 0.7-0.8：远距
- 0.9-1.0：极远

输出 JSON 对象，key 是维度ID，value 是 0-1 的距离分数。只输出 JSON。`,
    },
    {
      role: "user",
      content: `用户高频领域：${highExposureNames.join("、")}

需要评估的盲区：${blindSpotDesc}

输出 JSON（{ "维度ID": 距离分数 }）：`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0, maxTokens: 300 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const result = new Map<string, number>();
      for (const [k, v] of Object.entries(parsed)) {
        const score = Number(v);
        if (!isNaN(score)) result.set(k, Math.max(0, Math.min(1, score)));
      }
      // 确保所有维度都有分数
      for (const b of blindSpots) {
        if (!result.has(b.id)) result.set(b.id, 0.5);
      }
      return result;
    }
  } catch (e) {
    console.error("[LLM] 批量评估认知距离失败，使用默认值:", e);
  }

  // 失败时返回默认值 0.5
  return new Map(blindSpots.map((b) => [b.id, 0.5]));
}

// ===== Agent Pipeline ⑥ 反哺层扩展：教练记忆 =====

/**
 * ⑥ 反哺扩展：从对话中提取关键洞察，存入教练记忆
 * PRD 承诺：coachMemory.keyInsights
 */
export async function extractKeyInsight(
  userMessage: string,
  coachReply: string,
  context: string
): Promise<string | null> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是认知成长教练的记忆助手。从一段对话中提取一个关键洞察——关于用户认知偏见的发现、用户自己的反思、或教练识别的思维模式。

要求：
1. 只提取 1 条最有价值的洞察
2. 不超过 50 字
3. 用第三人称记录（"用户..."）
4. 如果对话没有有价值的洞察，输出 "null"

只输出洞察文本或 "null"，不要任何额外解释。`,
    },
    {
      role: "user",
      content: `用户档案上下文：
${context}

对话记录：
用户：${userMessage}
教练：${coachReply}

提取关键洞察：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0.3, maxTokens: 80 });
  const insight = res.content.trim();
  if (insight === "null" || insight === "") return null;
  return insight;
}

// ===== Agent Pipeline ⑦ 对话层（在 coach.ts 中实现） =====
