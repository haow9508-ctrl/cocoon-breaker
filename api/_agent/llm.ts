// ===== LLM Client v6.2 =====
// 认知成长教练 Agent — 服务持续提升认知的人，在既定方向内拓展视野
// 支持任意 OpenAI 兼容 API（DeepSeek / Step Plan / 其他）
// 通过环境变量配置：DEEPSEEK_BASE_URL / DEEPSEEK_MODEL / DEEPSEEK_API_KEY
// v6.0 重构：移除固定 24 维度，改为"认知大方向 + 方向内子领域树"动态模型

import type { CognitiveDirection, SubfieldNode } from "../_knowledge/domains.js";

// 动态读取（不缓存在模块级常量，确保 dotenv 加载后能读到最新值）
// trim() 防御 Railway 等平台在环境变量前后引入不可见字符
// 默认值改为 Step Plan（项目已迁移，不再使用 DeepSeek 官方 API）
function getBaseUrl(): string {
  return (process.env.DEEPSEEK_BASE_URL || "https://api.stepfun.com/step_plan/v1").trim();
}
function getModel(): string {
  return (process.env.DEEPSEEK_MODEL || "step-3.5-flash").trim();
}

// 运行时读取，优先使用环境变量
function getApiKey(): string {
  return (process.env.DEEPSEEK_API_KEY || "").trim();
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// ===== 安全 JSON 解析（兼容 Step Plan 等非标准 JSON 输出）=====
// 处理常见格式问题：markdown 包裹、尾逗号、控制字符、单引号、未闭合括号

/**
 * 清理 LLM 返回的 JSON 文本
 */
function cleanJsonText(raw: string): string {
  let s = raw;
  // 1. 去除 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）
  s = s.replace(/```(?:json|JSON)?\s*/g, "").replace(/```\s*/g, "");
  // 2. 去除 JSON 前后的解释性文字（只保留首个 { 或 [ 到最后一个 } 或 ]）
  const firstBrace = s.search(/[{[]/);
  const lastBrace = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }
  // 3. 去除注释（// 行注释 和 /* 块注释 */）
  s = s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  // 4. 去除尾逗号（,] 或 ,}）
  s = s.replace(/,(\s*[}\]])/g, "$1");
  // 5. 去除控制字符（保留 \n \t \r）
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return s.trim();
}

/**
 * 尝试修复 JSON 字符串中未转义的内部引号
 * 例如 "description": "他说"你好"了吗" → 修复为 "他说\"你好\"了吗"
 */
function fixUnescapedQuotes(s: string): string {
  // 这个修复很危险，只在标准 parse 失败后作为最后手段尝试
  // 策略：逐字符扫描，跟踪是否在字符串内，遇到可疑的内部引号转义
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      if (inString) {
        // 检查这个引号是否是字符串结束：后面应该是 , } ] : 或空白+这些
        const after = s.slice(i + 1).trimStart();
        if (/^[,}\]:]/.test(after)) {
          // 字符串结束
          inString = false;
          result += ch;
        } else {
          // 内部未转义引号，转义它
          result += '\\"';
        }
      } else {
        inString = true;
        result += ch;
      }
    } else {
      result += ch;
    }
  }
  return result;
}

/**
 * 安全 JSON 解析：先清理，再尝试 parse，失败则尝试渐进式修复
 */
export function safeJsonParse<T = any>(raw: string): T | null {
  if (!raw || typeof raw !== "string") return null;

  // 第一次尝试：清理后 parse
  const cleaned = cleanJsonText(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch (e1) {
    // 第二次尝试：修复未转义引号
    try {
      const fixed = fixUnescapedQuotes(cleaned);
      return JSON.parse(fixed) as T;
    } catch (e2) {
      // 第三次尝试：更激进的清理
      try {
        let s = cleaned;
        // 单引号转双引号（仅在非字符串内部）
        s = s.replace(/'([^']*)'/g, '"$1"');
        // 再次去尾逗号
        s = s.replace(/,(\s*[}\]])/g, "$1");
        return JSON.parse(s) as T;
      } catch (e3) {
        console.error("[safeJsonParse] 三次尝试均失败:", (e1 as Error).message);
        console.error("[safeJsonParse] 清理后文本前 500 字:", cleaned.slice(0, 500));
        return null;
      }
    }
  }
}

export interface LLMResponse {
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

// ===== 教练回复质量自检 =====
// 用户要求："检查一遍之后再进行回答"
// 检测模板化回复、空话套话、自我指涉词，不达标则重新生成

const TEMPLATE_PATTERNS = [
  // AI 自我指涉
  "作为AI", "作为一个AI", "让我来", "让我为你", "我会帮你",
  // 模板连接词
  "值得注意的是", "综上所述", "总的来说", "总而言之",
  "首先", "其次", "最后", "一方面", "另一方面",
  // 空话套话
  "你的思考很有深度", "这是一个很好的问题", "这是个好问题",
  "希望对你有帮助", "希望能帮到你", "以上是",
  "我们可以从以下几个方面", "让我们一起来",
  // 机械鼓励
  "继续加油", "继续努力", "相信自己", "你一定可以",
];

/** 检测回复是否包含模板化表达，返回命中列表 */
export function detectTemplateFlaws(content: string): string[] {
  if (!content || content.trim().length < 5) return ["回复过短"];
  const hits: string[] = [];
  for (const pattern of TEMPLATE_PATTERNS) {
    if (content.includes(pattern)) hits.push(pattern);
  }
  return hits;
}

/** 判断回复质量是否达标 */
export function isReplyQualified(content: string): boolean {
  return detectTemplateFlaws(content).length === 0;
}

/** 检查 API Key 是否配置 */
export function isApiKeyConfigured(): boolean {
  return !!getApiKey();
}

/** 通用 LLM 调用函数（兼容任意 OpenAI 格式 API） */
export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; maxTokens?: number }
): Promise<LLMResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API_KEY not configured");
  }

  const res = await fetch(`${getBaseUrl()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM API error (${res.status}): ${errText}`);
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
 * 防止 LLM 生成被 GEO 优化的"流行叙事"
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
- 回复 100-180 字，有实质内容，不要敷衍
- 不要说"首先""其次""最后""综上所述""值得注意的是"等模板词
- 不要机械鼓励（"继续加油""相信自己"），要像真朋友一样有判断
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

  // 第一次生成
  const res = await chatCompletion(chatMessages, { temperature: 0.7, maxTokens: 2000 });
  let reply = res.content.trim();

  // 质量自检：如果包含模板词，重新生成一次（temperature 提高）
  const flaws = detectTemplateFlaws(reply);
  if (flaws.length > 0) {
    console.warn(`[LLM] 诊断回复质量不达标，命中模板词: ${flaws.join("、")}，重新生成`);
    const retryMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "assistant", content: reply },
      { role: "system", content: `你刚才的回复包含模板化表达：${flaws.join("、")}。请重新回复，这次要像一个有独立判断的朋友说话，不要用任何模板词，不要机械鼓励，回复 100-180 字。` },
    ];
    const retryRes = await chatCompletion(retryMessages, { temperature: 0.9, maxTokens: 2000 });
    if (retryRes.content.trim()) {
      reply = retryRes.content.trim();
    }
  }

  return reply;
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

【重要】输出格式要求：
- 输出纯 JSON 对象，不要输出任何其他内容
- 顶层键名必须是 "directions"（不要用 cognitive_directions 或其他变体）
- 每个方向必须包含 "id"、"name"、"subfields" 三个字段
- subfields 是数组，每项必须包含 "id"、"name"、"exposure" 三个字段
- exposure 只能是 "high"、"low"、"none" 之一

输出格式：
{
  "directions": [
    {
      "id": "kebab-case-id",
      "name": "方向中文名",
      "subfields": [
        { "id": "kebab-case-id", "name": "子领域中文名", "exposure": "high" }
      ]
    }
  ]
}

只输出 JSON 对象，不要输出其他任何内容。`,
    },
    { role: "user", content: userInput },
  ];

  const res = await chatCompletion(messages, { temperature: 0, maxTokens: 4000 });

  // 兼容多种 JSON 格式（LLM 可能返回不同的键名）
  const jsonMatch = res.content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = safeJsonParse<any>(jsonMatch[0]);
    if (parsed) {
      // 兼容多种字段名：directions / cognitive_directions / direction_list
      const rawDirs = parsed.directions || parsed.cognitive_directions || parsed.direction_list || parsed.directions_list;
      if (rawDirs && Array.isArray(rawDirs) && rawDirs.length > 0) {
        const directions: CognitiveDirection[] = rawDirs.map((d: any, di: number) => {
          // 兼容多种字段名：name / direction_name / title
          const dirName = String(d.name || d.direction_name || d.title || d.directionName || `方向${di + 1}`);
          const dirId = String(d.id || dirName.replace(/\s+/g, "-").toLowerCase() || `dir-${di}`);
          // 兼容：subfields 可能有也可能没有
          const rawSubs = Array.isArray(d.subfields) ? d.subfields : [];
          // 如果没有 subfields，基于方向名生成默认子领域
          const subfields: SubfieldNode[] = rawSubs.length > 0
            ? rawSubs.map((s: any, si: number) => ({
                id: String(s.id || s.subfield_id || `sub-${di}-${si}`),
                name: String(s.name || s.subfield_name || s.title || `子领域${si + 1}`),
                exposure: (s.exposure === "high" || s.exposure === "low") ? s.exposure : "none" as "high" | "low" | "none",
              }))
            : [
                { id: `${dirId}-core`, name: `${dirName}核心`, exposure: "high" },
                { id: `${dirId}-intermediate`, name: `${dirName}进阶`, exposure: "low" },
                { id: `${dirId}-advanced`, name: `${dirName}高阶`, exposure: "none" },
                { id: `${dirId}-analog`, name: `${dirName}类比拓展`, exposure: "none" },
              ];
          return { id: dirId, name: dirName, subfields };
        });
        return { directions: directions.slice(0, 3) };
      }
    }
  }

  // 如果 JSON 解析完全失败，再试一次（更简短的 prompt）
  console.warn("[LLM] analyze 第一次失败，尝试简化 prompt 重试");
  const retryMessages: ChatMessage[] = [
    {
      role: "system",
      content: `识别用户的 1-3 个认知大方向，为每个方向生成子领域树。只输出 JSON：
{"directions":[{"id":"python","name":"Python编程","subfields":[{"id":"py-1","name":"基础","exposure":"high"},{"id":"py-2","name":"进阶","exposure":"none"}]}]}`,
    },
    { role: "user", content: userInput },
  ];
  const retryRes = await chatCompletion(retryMessages, { temperature: 0, maxTokens: 4000 });
  const retryMatch = retryRes.content.match(/\{[\s\S]*\}/);
  if (retryMatch) {
    const parsed = safeJsonParse<any>(retryMatch[0]);
    if (parsed && parsed.directions && Array.isArray(parsed.directions) && parsed.directions.length > 0) {
      const directions: CognitiveDirection[] = parsed.directions.map((d: any, di: number) => ({
        id: String(d.id || `dir-${di}`),
        name: String(d.name || `方向${di + 1}`),
        subfields: Array.isArray(d.subfields)
          ? d.subfields.map((s: any, si: number) => ({
              id: String(s.id || `sub-${di}-${si}`),
              name: String(s.name || `子领域${si + 1}`),
              exposure: s.exposure === "high" || s.exposure === "low" ? s.exposure : "none",
            }))
          : [],
      }));
      return { directions: directions.slice(0, 3) };
    }
  }

  throw new Error("LLM 分析失败：无法识别认知大方向");
}

// ===== Agent Pipeline ④ 生成层 =====

/**
 * 挑战内容结构（v6.0）
 * - directionId / directionName：所属认知大方向
 * - subfieldId / subfieldName：方向内具体子领域（拓展目标）
 * - sourceType：内容来源类型，bing=实时互联网检索 / deepseek_fallback=LLM 降级生成
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
  sourceType?: "bing" | "deepseek_fallback"; // Bing 实时互联网检索 / LLM 降级
  sourceUrl?: string; // 真实链接（RAG 检索时提供）
}

/**
 * ④ 生成：基于方向内子领域生成挑战内容
 * - 输入：选中的拓展子领域（在用户大方向内，认知相邻但未接触）
 * - v6.0：优先基于 RAG 检索的真实内容生成（Bing 实时互联网），LLM 只做教练引导
 * - RAG 无结果时 fallback 到纯 LLM 生成，并标注 sourceType: "deepseek_fallback"
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
    ragContext = `\n\n=== RAG 检索到的真实内容（来自 Bing 实时互联网检索，抗 GEO）===\n${ragParts.join("\n\n")}\n\n重要：请基于以上真实内容生成，标题和来源必须用检索到的真实内容。LLM 只做：1) why 推荐理由；2) coachGuidance 类比引导；3) description 内容重组（保留事实，不要编造）。`;
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

  const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 5000 });
  const jsonMatch = res.content.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    const parsed = safeJsonParse<any>(jsonMatch[0]);
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

  throw new Error("LLM 内容生成失败：无法解析生成结果");
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
  const systemPrompt = `你是「茧房爆破器」的认知成长教练。

${context}

你的方法论：
1. 苏格拉底式追问：不直接给答案，引导用户自己发现认知边界
2. 类比桥接：用用户已接触的子领域类比解释未接触的子领域
3. 反事实推演：让用户想象另一种可能
4. 长期记忆：记住用户的成长历史，在合适时机回顾

核心原则：
- 不迎合用户偏好，在方向内拓展边界，不推无关方向
- 回答 100-200 字，一次只说一件事，有实质内容
- 有观点，可以质疑，不要骑墙
- 禁止"作为AI""让我来""我会帮你"
- 禁止模板词："首先""其次""最后""综上所述""值得注意的是""总的来说"
- 禁止空话套话："你的思考很有深度""这是个好问题""希望对你有帮助"
- 禁止机械鼓励："继续加油""相信自己""你一定可以"
- 要像一个有独立判断、有棱角的朋友在跟你聊天

回复格式：纯 JSON：
{"method":"socratic|analogy|counterfactual|memory|general","content":"回复正文","keyInsight":"≤40字洞察或null"}

只输出 JSON。`;

  // 构造消息列表：修复 history 重复传递 bug
  // 前端传的 history 可能已包含用户最新消息，检查最后一条
  const trimmedHistory = chatHistory.slice(-6);
  const lastMsg = trimmedHistory[trimmedHistory.length - 1];
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...trimmedHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ];
  // 只有当 history 最后一条不是用户当前消息时才追加
  if (!lastMsg || lastMsg.role !== "user" || lastMsg.content !== userMessage) {
    messages.push({ role: "user", content: userMessage });
  }

  let rawContent = "";
  try {
    const res = await chatCompletion(messages, { temperature: 0.7, maxTokens: 2500 });
    rawContent = res.content;
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = safeJsonParse<any>(jsonMatch[0]);
      if (parsed && parsed.content) {
        const method = ["socratic", "analogy", "counterfactual", "memory", "general"].includes(parsed.method)
          ? parsed.method : "general";
        const insight = parsed.keyInsight && parsed.keyInsight !== "null" ? parsed.keyInsight : null;
        let finalContent: string = parsed.content;

        // 质量自检：检测模板词，不达标重新生成
        const flaws = detectTemplateFlaws(finalContent);
        if (flaws.length > 0) {
          console.warn(`[LLM] 教练回复质量不达标，命中: ${flaws.join("、")}，重新生成`);
          const retryMessages: ChatMessage[] = [
            ...messages,
            { role: "assistant", content: rawContent },
            { role: "system", content: `你刚才的回复包含模板化表达：${flaws.join("、")}。请重新回复，要像一个有独立判断的朋友说话——有棱角、有立场、不骑墙。不要用任何模板词，不要机械鼓励。回复 100-200 字。只输出 JSON。` },
          ];
          const retryRes = await chatCompletion(retryMessages, { temperature: 0.9, maxTokens: 2500 });
          const retryMatch = retryRes.content.match(/\{[\s\S]*\}/);
          if (retryMatch) {
            const retryParsed = safeJsonParse<any>(retryMatch[0]);
            if (retryParsed && retryParsed.content) {
              finalContent = retryParsed.content;
            }
          }
        }

        return { method, content: finalContent, keyInsight: insight };
      }
    }
    // JSON 解析失败：用原始文本作为回复（LLM 可能没遵守 JSON 格式，直接返回了文本）
    if (rawContent.trim()) {
      console.warn("[LLM] 教练回复 JSON 解析失败，使用原始文本 fallback");
      return { method: "general", content: rawContent.trim(), keyInsight: null };
    }
  } catch (e: any) {
    console.error("[LLM] 合并教练回复失败:", e.message);
  }

  return { method: "general", content: rawContent.trim() || "嗯，我在听，继续说。", keyInsight: null };
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
    const res = await chatCompletion(messages, { temperature: 0.6, maxTokens: 3000 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = safeJsonParse<any>(jsonMatch[0]);
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
    const res = await chatCompletion(messages, { temperature: 0.8, maxTokens: 6000 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = safeJsonParse<any>(jsonMatch[0]);
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
    const res = await chatCompletion(messages, { temperature: 0.9, maxTokens: 3000 });
    const jsonMatch = res.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const item = safeJsonParse<any>(jsonMatch[0]);
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
