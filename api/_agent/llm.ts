// ===== DeepSeek LLM Client v6.0 =====
// 认知成长教练 Agent — 服务持续提升认知的人，在既定方向内拓展视野
// DeepSeek 在所有阶段都扮演"认知成长教练"角色
// v6.0 重构：移除固定 24 维度，改为"认知大方向 + 方向内子领域树"动态模型

import type { CognitiveDirection, SubfieldNode } from "../_knowledge/domains.js";

const DEEPSEEK_BASE = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// 运行时读取，优先使用环境变量
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

/**
 * 构建教练上下文（v6.0：基于方向树而非暴露值）
 * 接收方向树作为输入，输出教练可读的用户认知档案
 */
export function buildCoachContext(profile: {
  directions?: CognitiveDirection[];
  explored?: string[];
  difficultyLevel?: string;
  weekNumber?: number;
  totalReads?: number;
  recentImpacts?: number[];
}): string {
  // 渲染方向树：每个方向列出已接触/未接触子领域
  const renderDirections = (dirs: CognitiveDirection[]): string => {
    if (!dirs || dirs.length === 0) return "暂未识别";
    return dirs.map((d) => {
      const high = d.subfields.filter((s) => s.exposure === "high").map((s) => s.name);
      const low = d.subfields.filter((s) => s.exposure === "low").map((s) => s.name);
      const none = d.subfields.filter((s) => s.exposure === "none").map((s) => s.name);
      return `  · ${d.name}
    - 高频接触：${high.join("、") || "无"}
    - 偶尔接触：${low.join("、") || "无"}
    - 未接触（拓展候选）：${none.join("、") || "无"}`;
    }).join("\n");
  };

  return `用户认知档案：
- 认知大方向与子领域接触图：
${renderDirections(profile.directions || [])}
- 已拓展子领域：${profile.explored?.join("、") || "暂无"}
- 当前难度：${profile.difficultyLevel || "L1"}
- 成长阶段：第${profile.weekNumber || 1}周，累计${profile.totalReads || 0}篇
- 最近冲击自评：${profile.recentImpacts?.join("、") || "暂无"}`;
}

// ===== 抗 GEO 污染策略 =====

/**
 * 内容生成的抗 GEO prompt 增强
 * 防止 DeepSeek 生成被 GEO 优化的"流行叙事"
 */
export const ANTI_GEO_DIRECTIVE = `规则：
1. 不要生成搜索引擎热门的"流行科普"——那些往往是 GEO 优化产物
2. 优先选择被主流叙事忽略的边缘视角、争议性观点、非共识理论
3. 严格限定在用户认知大方向内，不跨方向推荐（学 Python 不推美妆/体育/搞笑）
4. 类比拓展也须在同方向内（Python→C/Rust 是编程认知内的类比）
5. 禁止"第一/第二"罗列式、禁止"综上所述""值得注意的是"等模板词
6. 禁止"作为AI""让我来"等自我指涉，禁止机械鼓励和结尾总结
7. 标题要有观点或悬念，不要百科式标题
8. 要像有独立观点的人写的，有棱角、有判断、有立场`;

// ===== Agent Pipeline ① 诊断层 =====

/**
 * ① 诊断：从"扫描 24 维暴露值"改为"识别 1-3 个认知大方向"
 * - 用户方向明确时：识别方向并准备生成子领域树（在分析层完成）
 * - 用户方向不明确时：用苏格拉底式追问引导（"你最近在读什么书？做什么工作？在思考什么问题？"）
 */
export async function diagnoseConversation(
  messages: Array<{ role: string; content: string }>,
  nickname: string
): Promise<string> {
  const systemPrompt = `你是「茧房爆破器」用户的认知成长教练。现在正在进行诊断式对话，目标是识别用户的 1-3 个"认知大方向"——用户既定的、愿意持续投入精力去提升的认知方向。

你的核心认知：
1. 服务对象是"持续提升自身认知的人"，不是想消遣娱乐的人
2. 不要让用户跳到无关方向（如学 Python 的用户去推美妆/体育/搞笑段子）——这是 v5.0 的错误
3. 正确逻辑是：在用户既定的认知大方向内（如 AIPM / Python / 古诗 / 股市 / 思考方法论）拓展视野
4. 方向举例：编程认知 / 古典文学 / 投资认知 / 思考方法论 / 行为经济学 / 系统思维

你的问诊方法论：
1. 从开放问题开始，了解用户的"认知投入方向"
   - "你最近在读什么书？"
   - "你做什么工作？工作中在思考什么问题？"
   - "你最近在学什么、研究什么？"
2. 如果用户回答模糊（如"我想提升认知"），用苏格拉底式追问引导明确方向
   - "提升认知这个目标很大，能说说你最近一次主动学习是为了解决什么问题吗？"
   - "你最近一次感到'原来如此'的瞬间，是在什么场景下？"
3. 当你识别到 1-3 个清晰的认知大方向后，可在回复末尾简短确认
4. 不追求固定轮数——苏格拉底式引导需要灵活深度

规则：
- 每次只问一个问题，不要一次问多个
- 语气像朋友聊天，不要像医生问诊或心理咨询师
- 永远不要说"作为一个AI"或"让我来帮你"
- 不要用"了解了""明白了"等模板回复开头
- 每轮回复不超过 80 字
- 用户昵称：${nickname}
- 对话轮数灵活——用户可在任意时刻主动结束并生成档案

${messages.length < 2 ? "这是第一轮对话，请用开放问题开场，了解用户的认知投入方向（最近在读什么书、做什么工作、在思考什么问题）。" : "继续诊断，根据用户上一个回答深入挖掘其认知大方向。如果你已识别到明确方向，可在末尾简短确认（如'所以你的认知大方向是 Python 编程和思考方法论，对吗？'）。"}`;

  const chatMessages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];

  const res = await chatCompletion(chatMessages, { temperature: 0.7, maxTokens: 150 });
  return res.content.trim();
}

// ===== Agent Pipeline ② 分析层 =====

/**
 * ② 分析：从用户自然语言中识别 1-3 个认知大方向，并为每个方向生成子领域树
 * - 输出：{ directions: [{ id, name, subfields: [{ id, name, exposure }] }] }
 * - exposure 三档：high=高频接触 / low=偶尔接触 / none=未接触
 * - 不再输出 24 维 exposure Map
 */
export async function analyzeDirections(
  userInput: string
): Promise<{ directions: CognitiveDirection[] }> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是认知方向识别器。从用户的自然语言描述中，识别 1-3 个用户既定的"认知大方向"，并为每个方向动态生成子领域树。

核心原则：
1. 服务"持续提升认知的人"——他们的认知方向是有投入感的领域（如 Python 编程 / 古诗 / 股市投资 / 思考方法论 / 行为经济学），不是消遣方向（如娱乐/搞笑/美妆）
2. 在每个大方向下，识别用户已接触和未接触的子领域
3. 子领域树应包含"类比拓展"项（如学 Python → 类比语言 C/Rust/Haskell；读古诗 → 其他朝代诗歌/中外对比）

举例：
- 用户："我在做 AIPM 工作，最近在读《思考，快与慢》，想提升产品决策能力"
  → directions: [
    { id: "aipm-product", name: "AIPM 产品方法论", subfields: [
      { id: "pm-user-research", name: "用户研究", exposure: "high" },
      { id: "pm-roadmap", name: "路线图规划", exposure: "high" },
      { id: "pm-metrics", name: "产品度量", exposure: "low" },
      { id: "pm-org-design", name: "组织设计", exposure: "none" },
      { id: "pm-classic-theory", name: "经典产品理论（跨越鸿沟/创新者窘境）", exposure: "none" }
    ]},
    { id: "thinking-methodology", name: "思考方法论", subfields: [
      { id: "tm-system1-2", name: "系统 1/系统 2", exposure: "high" },
      { id: "tm-prospect-theory", name: "前景理论", exposure: "none" },
      { id: "tm-anchoring", name: "锚定效应", exposure: "none" },
      { id: "tm-mental-models", name: "心智模型清单（Munger）", exposure: "none" },
      { id: "tm-decision-theory", name: "决策理论进阶", exposure: "none" }
    ]}
  ]
- 用户："我在学 Python"
  → directions: [{ id: "python-programming", name: "Python 编程", subfields: [
    { id: "py-basics", name: "Python 基础", exposure: "high" },
    { id: "py-web-frameworks", name: "Web 框架（FastAPI/Flask）", exposure: "low" },
    { id: "py-data-science", name: "数据科学（pandas/numpy）", exposure: "none" },
    { id: "py-algorithms", name: "算法思想", exposure: "none" },
    { id: "py-programming-paradigms", name: "编程范式（OOP/函数式）", exposure: "none" },
    { id: "py-analog-c-rust", name: "类比语言：C/Rust（内存管理认知差异）", exposure: "none" }
  ]}]

推断规则：
- 用户明确提到"经常做/在学/在做"→ high
- 用户提到"偶尔/接触过一点"→ low
- 用户未提及，但属于该方向应有的子领域 → none
- 不要把无关方向（如娱乐/美妆/体育）塞进方向树

输出格式：纯 JSON 对象，结构如下：
{
  "directions": [
    {
      "id": "kebab-case-id",
      "name": "方向中文名",
      "subfields": [
        { "id": "kebab-case-id", "name": "子领域中文名", "exposure": "high" | "low" | "none" }
      ]
    }
  ]
}

只输出 JSON 对象。`,
    },
    { role: "user", content: userInput },
  ];

  const res = await chatCompletion(messages, { temperature: 0, maxTokens: 1000 });
  const jsonMatch = res.content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.directions && Array.isArray(parsed.directions) && parsed.directions.length > 0) {
      // 规范化：确保每个 subfield 有 exposure 字段
      const directions: CognitiveDirection[] = parsed.directions.map((d: any) => ({
        id: String(d.id || ""),
        name: String(d.name || ""),
        subfields: Array.isArray(d.subfields)
          ? d.subfields.map((s: any): SubfieldNode => ({
              id: String(s.id || ""),
              name: String(s.name || ""),
              exposure: s.exposure === "high" || s.exposure === "low" ? s.exposure : "none",
            }))
          : [],
      }));
      // 限制 1-3 个方向
      return { directions: directions.slice(0, 3) };
    }
  }

  throw new Error("DeepSeek 分析失败：无法识别认知大方向");
}

// ===== Agent Pipeline ④ 生成层 =====

/**
 * 挑战内容结构（v6.0）
 * - directionId / directionName：所属认知大方向
 * - subfieldId / subfieldName：方向内具体子领域（拓展目标）
 * - sourceType：内容来源类型，bing=实时互联网检索 / deepseek_fallback=DeepSeek 降级生成
 */
export interface ChallengeContent {
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
  coachGuidance: string; // 教练引导语（类比桥接，用用户已接触子领域做类比）
  sourceType?: "bing" | "deepseek_fallback"; // Bing 实时互联网检索 / DeepSeek 降级
  sourceUrl?: string; // 真实链接（RAG 检索时提供）
}

/**
 * ④ 生成：基于方向内子领域生成挑战内容
 * - 输入：选中的拓展子领域（在用户大方向内，认知相邻但未接触）
 * - v6.0：优先基于 RAG 检索的真实内容生成（Bing 实时互联网），DeepSeek 只做教练引导
 * - RAG 无结果时 fallback 到纯 DeepSeek 生成，并标注 sourceType: "deepseek_fallback"
 */
export async function generateChallenge(
  expansionTargets: Array<{
    directionId: string;
    directionName: string;
    subfieldId: string;
    subfieldName: string;
  }>,
  knownSubfields: string[],
  difficultyLevel: "L1" | "L2" | "L3",
  ragResultsBySubfield?: Map<string, Array<{
    title: string;
    description: string;
    source: string;
    sourceType: string;
    url: string;
    readTimeMinutes: number;
  }>>
): Promise<ChallengeContent[]> {
  const targetsDesc = expansionTargets
    .map((t) => `${t.directionName} / ${t.subfieldName}（${t.subfieldId}）`)
    .join("\n");
  const knownDesc = knownSubfields.join("、") || "暂无明显已接触子领域";

  // 难度递进：L1=同方向相邻子领域 / L2=同方向中距 / L3=同方向远端（类比拓展）
  const difficultyHint = {
    L1: "L1 同方向相邻子领域：内容应与用户已接触子领域认知相邻，容易接受。用用户已接触的子领域做类比桥接。",
    L2: "L2 同方向中距子领域：内容应与用户已接触子领域有一定认知距离，需要一些跨越。",
    L3: "L3 同方向远端子领域（类比拓展）：内容应是同方向内最远的拓展，如 Python→C/Rust 的内存管理认知差异，最大化方向内认知冲击。",
  }[difficultyLevel];

  // 构造 RAG context（如果有）
  let ragContext = "";
  const hasRag = ragResultsBySubfield && ragResultsBySubfield.size > 0;
  if (hasRag) {
    const ragParts: string[] = [];
    for (const [subfieldId, results] of ragResultsBySubfield!.entries()) {
      if (results.length === 0) continue;
      const docs = results.slice(0, 2).map((r, i) =>
        `  ${i + 1}. 标题：${r.title}\n     来源：${r.source} (${r.sourceType})\n     摘要：${r.description.slice(0, 300)}\n     链接：${r.url}`
      ).join("\n");
      ragParts.push(`子领域 ${subfieldId} 的真实检索内容（Bing 实时互联网）：\n${docs}`);
    }
    ragContext = `\n\n=== RAG 检索到的真实内容（来自 Bing 实时互联网检索，抗 GEO）===\n${ragParts.join("\n\n")}\n\n重要：请基于以上真实内容生成，标题和来源必须用检索到的真实内容。DeepSeek 只做：1) why 推荐理由；2) coachGuidance 类比引导；3) description 内容重组（保留事实，不要编造）。`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练，现在要为用户生成方向内拓展挑战内容。

${difficultyHint}

核心原则：
1. 标题要有吸引力、有悬念，不要百科式标题
2. 摘要 150-200 字，要有洞察力、有冲击力，能让人产生"原来如此"的感觉
3. 来源标注真实（维基百科/学术论文/经典著作/科学期刊/权威博客）
4. 阅读时间 5-10 分钟
5. coachGuidance：用用户已接触的子领域做类比桥接，一句话引导用户进入内容
6. 推荐理由(why)：一句话说明为什么这条内容能在用户既定方向内拓展视野${hasRag ? "\n7. 【重要】已提供 RAG 检索的真实内容，必须基于这些内容生成，不要凭空编造标题和来源" : ""}

${ANTI_GEO_DIRECTIVE}

输出格式：纯 JSON 数组，每个对象包含：
- directionId, directionName, subfieldId, subfieldName, title, why, description, source, readTimeMinutes, coachGuidance${hasRag ? ", sourceUrl" : ""}

只输出 JSON 数组。`,
    },
    {
      role: "user",
      content: `需要生成内容的拓展子领域（在用户认知大方向内）：
${targetsDesc}

用户已接触的子领域（用于类比桥接）：
${knownDesc}${ragContext}

请为这 ${expansionTargets.length} 个拓展子领域各生成一篇内容，输出 JSON 数组：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 2500 });
  const jsonMatch = res.content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: any) => ({
        directionId: item.directionId || "",
        directionName: item.directionName || "",
        subfieldId: item.subfieldId || "",
        subfieldName: item.subfieldName || "",
        title: item.title || "",
        why: item.why || "",
        description: item.description || "",
        source: item.source || "",
        readTimeMinutes: item.readTimeMinutes || 5,
        difficultyLevel,
        coachGuidance: item.coachGuidance || "",
        sourceType: hasRag ? (item.sourceUrl ? "bing" : "deepseek_fallback") : "deepseek_fallback",
        sourceUrl: item.sourceUrl || "",
      }));
    }
  }

  throw new Error("DeepSeek 内容生成失败：无法解析生成结果");
}

// ===== Agent Pipeline ⑦ 对话层（合并版：回复+洞察一次生成）=====

/**
 * ⑦ 对话合并：一次性生成教练回复 + 关键洞察
 * 原来需要 2 次 API 调用（chatWithCoach + extractKeyInsight）
 * 现在合并为 1 次，token 消耗降低 40%+
 */
export interface MergedCoachReply {
  method: string;
  content: string;
  keyInsight: string | null;
}

export async function buildMergedCoachReply(
  userMessage: string,
  chatHistory: Array<{ role: string; content: string }>,
  context: string
): Promise<MergedCoachReply> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练。

${context}

你的方法论：
1. 苏格拉底式追问：不直接给答案，引导用户自己发现认知边界
2. 类比桥接：用用户已接触的子领域类比解释未接触的子领域
3. 反事实推演：让用户想象另一种可能
4. 长期记忆：记住用户的成长历史，在合适时机回顾

核心原则：不迎合用户偏好、在方向内拓展边界、不推无关方向。
回答≤180字，一次只说一件事。有观点，可以质疑，不要骑墙。
禁止"作为AI"、禁止模板词、禁止罗列。

回复格式：纯 JSON：
{"method":"socratic|analogy|counterfactual|memory|general","content":"回复正文","keyInsight":"≤40字洞察或null"}

只输出 JSON。`,
    },
    ...chatHistory.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 600 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const method = ["socratic", "analogy", "counterfactual", "memory", "general"].includes(parsed.method)
        ? parsed.method : "general";
      const insight = parsed.keyInsight && parsed.keyInsight !== "null" ? parsed.keyInsight : null;
      return { method, content: parsed.content || "", keyInsight: insight };
    }
  } catch (e: any) {
    console.error("[LLM] 合并教练回复失败:", e.message);
  }

  return { method: "general", content: "", keyInsight: null };
}

// ===== Agent Pipeline ⑥ 反哺层（合并版：反馈+洞察+实践脚手架一次生成）=====

/**
 * ⑥ 反哺合并：基于用户冲击自评，一次性生成教练反馈 + 关键洞察 + 实践脚手架
 * 原来需要 3 次 API 调用（coachFeedback + extractKeyInsight + generatePracticeScaffold）
 * 现在合并为 1 次，token 消耗降低 60%+
 */
export interface MergedFeedbackResult {
  feedback: string;
  keyInsight: string | null;
  practiceScaffold: PracticeScaffold | null;
}

export async function generateMergedFeedback(
  directionName: string,
  subfieldName: string,
  title: string,
  impactScore: number,
  reflection: string,
  profile: any
): Promise<MergedFeedbackResult> {
  const context = buildCoachContext(profile);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练。用户刚读完一篇方向内拓展内容并完成了冲击自评。一次性生成三部分内容。

${context}

输出纯 JSON，包含：
- feedback: 教练反馈（不超过 100 字）
  - 冲击分高(4-5星)：不要说"太棒了"，要说具体哪里好、或者指出一个更深的追问
  - 冲击分中(3星)：直接补充一个用户可能错过的视角，不要铺垫
  - 冲击分低(1-2星)：可以质疑——"这篇内容对你来说可能太浅了"或"你是不是已经有这个认知了"
  - 要有立场，不要骑墙。可以不同意用户的反思
  - 像微信聊天，一次只说一件事，不要罗列
  - 禁止"作为AI""让我来""你的思考很有深度"
- keyInsight: 关键洞察（≤50字，第三人称记录"用户..."，关于用户认知偏见的发现或教练识别的思维模式。无价值则输出 null）
- practiceScaffold: 24h内可完成的行动建议
  - action: 具体可执行的行动（不是"多思考"这种空话）
  - timeframe: 时间框架（24小时内）
  - successHint: 成功标志——怎么知道做对了
  - 如果冲击分低（≤2），给更轻量的行动

规则：不要罗列、不要"作为AI"、不要模板连接词、不要结尾总结。只输出 JSON。`,
    },
    {
      role: "user",
      content: `我读了《${title}》（${directionName} / ${subfieldName}）
冲击自评：${impactScore}星
我的反思：${reflection || "（用户没有写反思）"}

请给我反馈、洞察和行动建议：`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.6, maxTokens: 900 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const scaffold = parsed.practiceScaffold;
      return {
        feedback: parsed.feedback || "",
        keyInsight: parsed.keyInsight && parsed.keyInsight !== "null" ? parsed.keyInsight : null,
        practiceScaffold: scaffold && scaffold.action
          ? { action: scaffold.action, timeframe: scaffold.timeframe || "今天内", successHint: scaffold.successHint || "" }
          : null,
      };
    }
  } catch (e: any) {
    console.error("[LLM] 合并反馈生成失败:", e.message);
  }

  return { feedback: "", keyInsight: null, practiceScaffold: null };
}

// ===== Agent Pipeline ③④ 合并：决策+生成一次性完成 =====

/**
 * ③④ 合并：一次性完成子领域拓展价值评估 + 挑战内容生成
 * 原来需要 2 次 API 调用（evaluateSubfieldExpansion + generateChallenge）
 * 现在合并为 1 次，token 消耗降低 40%+
 * 返回：{ challenges: ChallengeContent[], expansionScores: Map<subfieldId, number> }
 */
export async function evaluateAndGenerateChallenge(
  expansionTargets: Array<{
    directionId: string;
    directionName: string;
    subfieldId: string;
    subfieldName: string;
  }>,
  knownSubfields: string[],
  difficultyLevel: "L1" | "L2" | "L3",
  ragResultsBySubfield?: Map<string, Array<{
    title: string;
    description: string;
    source: string;
    sourceType: string;
    url: string;
    readTimeMinutes: number;
  }>>
): Promise<{ challenges: ChallengeContent[]; expansionScores: Map<string, number> }> {
  if (expansionTargets.length === 0) {
    return { challenges: [], expansionScores: new Map() };
  }

  const targetsDesc = expansionTargets
    .map((t) => `${t.directionName} / ${t.subfieldName}（${t.subfieldId}）`)
    .join("\n");
  const knownDesc = knownSubfields.join("、") || "暂无明显已接触子领域";

  const difficultyHint = {
    L1: "L1 同方向相邻子领域：认知相邻，易接受，用已接触子领域做类比桥接。",
    L2: "L2 同方向中距子领域：有一定认知距离，需要跨越。",
    L3: "L3 同方向远端子领域（类比拓展）：同方向内最远拓展，最大化认知冲击。",
  }[difficultyLevel];

  // 构造 RAG context（如果有）
  let ragContext = "";
  const hasRag = ragResultsBySubfield && ragResultsBySubfield.size > 0;
  if (hasRag) {
    const ragParts: string[] = [];
    for (const [subfieldId, results] of ragResultsBySubfield!.entries()) {
      if (results.length === 0) continue;
      const docs = results.slice(0, 2).map((r, i) =>
        `  ${i + 1}. ${r.title} — ${r.source}\n     ${r.description.slice(0, 200)}`
      ).join("\n");
      ragParts.push(`子领域 ${subfieldId} 真实内容：\n${docs}`);
    }
    ragContext = `\n\n真实检索内容（Bing）：\n${ragParts.join("\n\n")}\n请基于以上内容生成，不要编造标题和来源。`;
  }

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练。一次性完成两件事：1) 评估每个子领域的拓展价值 2) 为每个子领域生成挑战内容。

${difficultyHint}

核心原则：
1. 标题要有吸引力、有悬念，不要百科式标题
2. 摘要 150-200 字，要有洞察力、有冲击力，能让人产生"原来如此"的感觉
3. 来源标注真实（维基百科/学术论文/经典著作/科学期刊/权威博客）
4. 阅读时间 5-10 分钟
5. coachGuidance：用用户已接触的子领域做类比桥接，一句话引导用户进入内容
6. 推荐理由(why)：一句话说明为什么这条内容能在用户既定方向内拓展视野${hasRag ? "\n7. 【重要】已提供真实检索内容，必须基于这些内容生成，不要凭空编造标题和来源" : ""}

拓展价值定义：
- 0.9-1.0：核心拓展——同方向内必学的高价值子领域
- 0.7-0.8：高价值——同方向内重要分支
- 0.5-0.6：中等——同方向内相关分支
- 0.3-0.4：较低——方向内边缘子领域
- 0.1-0.2：低——过于冷门或重合度高

${ANTI_GEO_DIRECTIVE}

输出纯 JSON 对象：
{
  "items": [
    { "directionId": "", "directionName": "", "subfieldId": "", "subfieldName": "", "title": "", "why": "", "description": "150-200字", "source": "", "readTimeMinutes": 5, "coachGuidance": "类比引导"${hasRag ? ", \"sourceUrl\": \"\"" : ""} }
  ],
  "scores": { "subfieldId": 0.8 }
}

只输出 JSON。`,
    },
    {
      role: "user",
      content: `需要生成内容的拓展子领域（在用户认知大方向内）：
${targetsDesc}

用户已接触的子领域（用于类比桥接）：
${knownDesc}${ragContext}

请为这 ${expansionTargets.length} 个拓展子领域各生成一篇内容，并评估每个的拓展价值（0-1）。输出 JSON：`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 3000 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const items = Array.isArray(parsed.items) ? parsed.items : [];
      const challenges: ChallengeContent[] = items.map((item: any) => ({
        directionId: item.directionId || "",
        directionName: item.directionName || "",
        subfieldId: item.subfieldId || "",
        subfieldName: item.subfieldName || "",
        title: item.title || "",
        why: item.why || "",
        description: item.description || "",
        source: item.source || "",
        readTimeMinutes: item.readTimeMinutes || 5,
        difficultyLevel,
        coachGuidance: item.coachGuidance || "",
        sourceType: hasRag ? (item.sourceUrl ? "bing" : "deepseek_fallback") : "deepseek_fallback",
        sourceUrl: item.sourceUrl || "",
      }));
      const expansionScores = new Map<string, number>();
      if (parsed.scores) {
        for (const [k, v] of Object.entries(parsed.scores)) {
          const score = Number(v);
          if (!isNaN(score)) expansionScores.set(k, Math.max(0, Math.min(1, score)));
        }
      }
      for (const t of expansionTargets) {
        if (!expansionScores.has(t.subfieldId)) expansionScores.set(t.subfieldId, 0.5);
      }
      return { challenges, expansionScores };
    }
  } catch (e: any) {
    console.error("[LLM] 合并决策+生成失败:", e.message);
  }

  return { challenges: [], expansionScores: new Map(expansionTargets.map((t) => [t.subfieldId, 0.5])) };
}

// ===== 认知跳跃机制（v6.2）=====
// 在用户方向内拓展到一定深度后，引入"有认知连接的远距离类比"
// 不是跨方向推荐（学 Python 推美妆是错的），而是有认知桥梁的跨界启发
// 类似查理·芒格的"多元思维模型"——刻意跨学科但底层逻辑相通

/**
 * 判断是否触发认知跳跃
 * 条件：某方向已读 ≥ 5 篇 + 该方向未接触子领域已拓展过半
 */
export function shouldTriggerCognitiveLeap(
  directionId: string,
  directions: CognitiveDirection[],
  impactHistory: Array<{ directionId: string; subfieldId: string }>
): boolean {
  const direction = directions.find((d) => d.id === directionId);
  if (!direction) return false;

  // 该方向的已读记录
  const directionImpacts = impactHistory.filter((r) => r.directionId === directionId);
  if (directionImpacts.length < 5) return false;

  // 该方向的未接触子领域数量
  const unexploredCount = direction.subfields.filter((s) => s.exposure === "none").length;
  if (unexploredCount === 0) return false;

  // 已拓展的未接触子领域数量
  const exploredSubfieldIds = new Set(directionImpacts.map((r) => r.subfieldId));
  const exploredUnexploredCount = direction.subfields.filter(
    (s) => s.exposure === "none" && exploredSubfieldIds.has(s.id)
  ).length;

  // 已拓展过半时触发
  return exploredUnexploredCount >= Math.ceil(unexploredCount / 2);
}

/**
 * 认知跳跃内容生成
 * 生成一篇有认知桥梁的远距离类比内容
 * - 用户方向：如 Python 编程
 * - 跳跃目标：如 哲学分类学（类型系统 → 分类学的认知桥梁）
 * - coachGuidance 必须明确说明认知桥梁
 */
export async function generateCognitiveLeap(
  direction: { id: string; name: string },
  knownSubfields: string[],
  recentTitles: string[]
): Promise<ChallengeContent | null> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知跳跃引擎。用户在「${direction.name}」方向已经深耕到一定深度，现在需要一次"有认知连接的远距离类比"——类似查理·芒格的多元思维模型。

这不是跨方向推荐（不是推无关内容），而是找一个底层逻辑相通的远领域，用认知桥梁连接。

核心规则：
1. 跳跃目标必须是"看似无关但底层逻辑相通"的领域
   - 编程类型系统 → 哲学分类学（底层：如何给世界分类）
   - Python GIL 锁 → 管理学资源瓶颈（底层：有限资源的并发调度）
   - 古诗意境 → 电影构图（底层：用有限信息激发想象）
   - 股市波动 → 群体心理学（底层：群体非理性行为）
2. coachGuidance 必须明确说明认知桥梁——用户已接触的子领域如何映射到跳跃目标
3. 标题要有冲击力，让人产生"这两个领域居然有关联"的惊喜感
4. description 150-200 字，要有洞察力，不是科普
5. why 说明这次跳跃能带来什么认知突破

${ANTI_GEO_DIRECTIVE}

输出格式：纯 JSON 对象，包含：
- directionId, directionName, subfieldId, subfieldName
- title, why, description, source, readTimeMinutes, coachGuidance
- cognitiveLeap: true（标记为认知跳跃内容）
- leapBridge: 认知桥梁描述（一句话说明两个领域的底层连接）

只输出 JSON 对象。`,
    },
    {
      role: "user",
      content: `用户深耕方向：${direction.name}
用户已接触子领域：${knownSubfields.join("、") || "暂无"}
最近读过的内容：${recentTitles.join("、") || "暂无"}

请生成一次认知跳跃——找一个与「${direction.name}」底层逻辑相通的远领域，用认知桥梁连接它们。`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0.9, maxTokens: 800 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const item = JSON.parse(jsonMatch[0]);
      return {
        directionId: direction.id,
        directionName: direction.name,
        subfieldId: item.subfieldId || `leap_${Date.now()}`,
        subfieldName: item.subfieldName || "认知跳跃",
        title: item.title || "",
        why: item.why || "",
        description: item.description || "",
        source: item.source || "",
        readTimeMinutes: item.readTimeMinutes || 7,
        difficultyLevel: "L3",
        coachGuidance: item.coachGuidance || "",
        sourceType: "deepseek_fallback",
        sourceUrl: item.sourceUrl || "",
      };
    }
  } catch (e: any) {
    console.error("[LLM] 认知跳跃生成失败:", e.message);
  }

  return null;
}

// ===== PracticeScaffold 接口（实现已合并到 generateMergedFeedback）=====

export interface PracticeScaffold {
  action: string;
  timeframe: string;
  successHint: string;
}
