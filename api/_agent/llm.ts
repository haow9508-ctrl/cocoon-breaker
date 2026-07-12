// ===== DeepSeek LLM Client v6.0 =====
// 认知成长教练 Agent — 服务持续提升认知的人，在既定方向内拓展视野
// DeepSeek 在所有阶段都扮演"认知成长教练"角色
// v6.0 重构：移除固定 24 维度，改为"认知大方向 + 方向内子领域树"动态模型

import type { CognitiveDirection, SubfieldNode } from "../_knowledge/domains.js";

const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const MODEL = "deepseek-chat";

// 运行时读取，优先使用环境变量，回退到内置密钥（Railway 部署用）
function getApiKey(): string {
  return process.env.DEEPSEEK_API_KEY || "sk-55ab81d9334f41988ac612fac4dd4166";
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
export const ANTI_GEO_DIRECTIVE = `重要规则 — 抗 GEO 污染 + 方向内约束：
1. 不要生成搜索引擎排名靠前的"流行科普叙事"——那些往往是 GEO 优化的产物
2. 优先选择被主流叙事忽略的边缘视角、争议性理论、非共识观点
3. 如果某内容有"流行版本"和"真实版本"，用真实版本
4. 标注内容的争议性：哪些是共识，哪些是边缘观点
5. 避免"鸡汤化"简化——保留复杂性，不要为了易懂而扭曲
6. 【方向内约束】严格限定在用户的认知大方向内推荐，不得跨方向——学 Python 的用户不推美妆/体育/搞笑，只在 Python 大方向内拓展（如并发编程/编程范式/类比语言）
7. 【方向内约束】推荐的子领域必须在用户已识别的认知大方向内，类比拓展也须在同方向内（如 Python→C/Rust 是编程认知内的类比，而非跳到无关领域）`;

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
- 语气像朋友聊天，不要像医生问诊
- 永远不要说"作为一个AI"
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

  const res = await chatCompletion(chatMessages, { temperature: 0.7, maxTokens: 200 });
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

  const res = await chatCompletion(messages, { temperature: 0, maxTokens: 1200 });
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

// ===== Agent Pipeline ⑥ 反哺层 =====

/** ⑥ 反哺：基于用户冲击自评，教练给出反思引导 */
export async function coachFeedback(
  directionName: string,
  subfieldName: string,
  title: string,
  impactScore: number,
  reflection: string,
  profile: any
): Promise<string> {
  const context = buildCoachContext(profile);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是「茧房爆破器」的认知成长教练。用户刚刚读完一篇方向内拓展内容并完成了冲击自评。

${context}

你的任务：基于用户的冲击自评和反思，给出一段反思引导（不超过 100 字）。
- 如果冲击分高(4-5星)：肯定这次方向内的认知突破，引导深入
- 如果冲击分中(3星)：补充一个视角，帮助用户看到更多
- 如果冲击分低(1-2星)：不否定用户感受，温和地指出可能错过的角度

语气像朋友，不要说教。永远不要说"作为一个AI"。`,
    },
    {
      role: "user",
      content: `我读了《${title}》（${directionName} / ${subfieldName}）
冲击自评：${impactScore}星
我的反思：${reflection || "（用户没有写反思）"}

请给我一些反馈：`,
    },
  ];

  const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 200 });
  return res.content.trim();
}

// ===== Agent Pipeline ③ 决策层辅助：方向内子领域拓展价值评估 =====

/**
 * ③ 决策辅助：用 DeepSeek 评估同方向内"未接触子领域"的拓展价值
 * - 替代旧版 evaluateCognitiveDistances（跨维度认知距离评估，已废弃）
 * - 评估每个未接触子领域相对于用户已接触子领域的"方向内拓展价值"
 * - 返回 Map<subfieldId, expansionScore>，分数 0-1：0=拓展价值低（边缘/冷门），1=拓展价值高（核心且高价值）
 */
export async function evaluateSubfieldExpansion(
  unexploredSubfields: Array<{
    directionId: string;
    directionName: string;
    subfieldId: string;
    subfieldName: string;
  }>,
  knownSubfields: string[]
): Promise<Map<string, number>> {
  if (unexploredSubfields.length === 0) {
    return new Map();
  }
  if (knownSubfields.length === 0) {
    return new Map(unexploredSubfields.map((s) => [s.subfieldId, 0.5]));
  }

  const targetDesc = unexploredSubfields
    .map((s) => `${s.subfieldId}:${s.directionName}/${s.subfieldName}`)
    .join(", ");

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `你是认知方向内拓展价值评估器。评估每个"未接触子领域"相对于用户"已接触子领域"的方向内拓展价值。

拓展价值定义：
- 0.9-1.0：核心拓展——同方向内必学的高价值子领域，能显著拓宽认知（如 Python 学完基础 → 编程范式 / 算法思想）
- 0.7-0.8：高价值——同方向内重要分支，有显著认知提升（如 Python → 数据科学 / Web 框架）
- 0.5-0.6：中等——同方向内相关分支，有学习价值但非必学
- 0.3-0.4：较低——方向内边缘子领域，或类比跨度较大（如 Python → Haskell）
- 0.1-0.2：低——过于冷门或与已接触子领域重合度高

重要：评估的是"方向内拓展价值"，不是跨方向距离。所有候选都在用户既定认知大方向内。

输出 JSON 对象，key 是 subfieldId，value 是 0-1 的拓展价值分数。只输出 JSON。`,
    },
    {
      role: "user",
      content: `用户已接触子领域（用于判断拓展价值）：
${knownSubfields.join("、")}

需要评估的未接触子领域（均在用户认知大方向内）：
${targetDesc}

输出 JSON（{ "subfieldId": 拓展价值分数 }）：`,
    },
  ];

  try {
    const res = await chatCompletion(messages, { temperature: 0, maxTokens: 400 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const result = new Map<string, number>();
      for (const [k, v] of Object.entries(parsed)) {
        const score = Number(v);
        if (!isNaN(score)) result.set(k, Math.max(0, Math.min(1, score)));
      }
      // 确保所有子领域都有分数
      for (const s of unexploredSubfields) {
        if (!result.has(s.subfieldId)) result.set(s.subfieldId, 0.5);
      }
      return result;
    }
  } catch (e) {
    console.error("[LLM] 方向内拓展价值评估失败，使用默认值:", e);
  }

  // 失败时返回默认值 0.5
  return new Map(unexploredSubfields.map((s) => [s.subfieldId, 0.5]));
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
