# 茧房爆破器 — 产品需求文档（PRD）

> 版本：v3.0 | 更新时间：2026-07-06
> 架构范式：纯生成式 Agent（无知识库、无 RAG）

---

## 1. 产品定位

### 1.1 一句话定义
**茧房爆破器**是世界上第一个「反推荐引擎」——算法目标不是「让你看更久」，而是「让你看到你从没见过的东西」。

### 1.2 核心问题
推荐算法最大化停留时长 → 用户被包裹在信息茧房中 → 认知窄化。市面上所有产品都在帮你「看更多你喜欢的」，没有一个产品帮你「看到你不知道的」。

### 1.3 解决方案
- Agent 扫描用户的信息消费习惯，构建认知暴露图
- DeepSeek Transformer 分析用户的认知盲区
- DeepSeek 动态生成盲区内容（**不从任何知识库中检索，纯生成**）
- 聊天式智能助手提供个性化对话和推荐
- 游戏化勋章系统激励持续探索

---

## 2. 系统架构

### 2.1 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                     │
│            React 18 + Vite + Tailwind CSS                 │
│                   + Framer Motion + Zustand               │
├──────────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │  扫描页     │  │  推送主页   │  │  智能聊天助手       │  │
│  │ ScanPage   │  │ HomePage   │  │ ChatAssistant     │  │
│  └─────┬──────┘  └─────┬──────┘  └────────┬──────────┘  │
│        │               │                   │             │
│        └───────────────┴───────────────────┘             │
│                        │                                  │
│                   API Client Layer                       │
│              (fetch → /api/agent/*)                       │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP
┌────────────────────────┴─────────────────────────────────┐
│                        后端 (Backend)                      │
│          Express + TypeScript (Vercel Serverless)         │
├──────────────────────────────────────────────────────────┤
│                   Agent Controller                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Agent Pipeline (5 阶段)                │  │
│  │                                                    │  │
│  │  ① 感知    ② 分析    ③ 决策    ④ 生成    ⑤ 交互   │  │
│  │  Perception→Analysis→Decision→Generation→Interact  │  │
│  │     │         │         │         │         │      │  │
│  │  用户输入  DeepSeek   DeepSeek   DeepSeek   多轮    │  │
│  │  收集      暴露分析   盲区决策   内容生成   对话    │  │
│  └────────────────────────────────────────────────────┘  │
│                        │                                  │
│                   DeepSeek API                            │
│              (deepseek-chat Transformer)                  │
│                    ↕ 云端知识                             │
│             (模型训练数据 = 知识源)                        │
└──────────────────────────────────────────────────────────┘
```

### 2.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **纯生成，无知识库** | 所有内容由 DeepSeek Transformer 动态生成，不从任何本地数据库/知识库中检索 |
| **无 RAG** | 不使用检索增强生成（Retrieval-Augmented Generation），DeepSeek 的训练数据本身就是知识源 |
| **无状态后端** | 后端不存储任何用户数据，每次请求由前端携带用户暴露数据 |
| **每用户独立 Agent** | 每个用户的暴露画像作为 Agent 上下文，驱动个性化生成 |
| **DeepSeek = 大脑 + 内容源** | DeepSeek 同时承担分析、决策、内容生成、对话四种角色 |

### 2.3 为什么不用知识库 / RAG？

| 方案 | 问题 |
|------|------|
| 硬编码内容库 | 内容有限、无法个性化、维护成本高、无法覆盖所有维度 |
| RAG（检索增强） | 需要维护向量数据库、检索质量不可控、内容仍然是预设的 |
| **纯生成（本方案）** | DeepSeek 的训练数据覆盖几乎所有人类知识领域，每次生成都是新鲜的、个性化的 |

---

## 3. Agent Pipeline 设计

### 3.1 五阶段流程

```
用户输入 ──→ ①感知 ──→ ②分析 ──→ ③决策 ──→ ④生成 ──→ ⑤交互
                │          │          │          │          │
                │          │          │          │          │
             收集用户    DeepSeek    DeepSeek    DeepSeek    多轮
             消费习惯    生成24维    选择Top3    生成具体    对话
             自然语言    暴露值     盲区维度    盲区内容
```

### 3.2 阶段详解

#### ① 感知层 (Perception)
- **输入**：用户描述自己的内容消费习惯（3轮问答或自由输入）
- **输出**：用户自然语言文本
- **实现**：前端 CocoonScanPage 收集，发送到 `/api/agent/scan`

#### ② 分析层 (Analysis)
- **输入**：用户自然语言文本
- **输出**：24维认知暴露值（0-1000整数/维度）
- **实现**：`llm.ts → analyzeAllDimensions()`
- **DeepSeek Prompt 策略**：
  - System: "你是认知暴露分析器。根据用户描述，为24个维度的内容接触次数打分。"
  - 规则：经常看→200-800，偶尔看→50-150，从不看→0-10，未提及→10-30
  - 输出：纯JSON对象，24个key

#### ③ 决策层 (Decision)
- **输入**：24维暴露值 + 已读内容ID
- **输出**：Top 3 盲区维度（暴露值最低的3个维度）
- **实现**：`recommender.ts → generateDailyFeed()`
- **逻辑**：按暴露值升序排序，排除已读维度，取前3

#### ④ 生成层 (Generation) — 核心创新
- **输入**：Top 3 盲区维度 + 用户高频领域
- **输出**：3篇完整内容（标题、摘要、来源、阅读时间、推荐理由）
- **实现**：`llm.ts → generateDailyContent()`
- **DeepSeek Prompt 策略**：
  - System: "你是反推荐引擎的内容生成器。为用户的认知盲区生成教育性内容。"
  - 输入：盲区维度名 + 用户高频领域
  - 生成规则：
    - 内容必须与用户高频领域形成认知冲击
    - 标题要有吸引力，不要百科式
    - 摘要150-200字，要有洞察力和冲击力
    - 来源标注真实（维基百科/学术论文/经典著作）
    - 阅读时间5-10分钟
    - 推荐理由一句话，说明为什么这条能打破茧房
  - 输出：JSON数组，3个对象

#### ⑤ 交互层 (Interaction)
- **输入**：用户消息 + 对话历史 + 暴露数据
- **输出**：个性化回复
- **实现**：`llm.ts → chatWithAssistant()`
- **特性**：多轮对话（携带最近6条历史）、根据暴露数据个性化回答

### 3.3 数据流图

```
[用户] --输入消费习惯--> [扫描页]
                           │
                           ▼ POST /api/agent/scan
                    [Agent: ①感知→②分析]
                           │
                           ▼ 24维暴露值 (JSON)
                    [存入 localStorage]
                           │
                           ▼ POST /api/agent/daily
                    [Agent: ③决策→④生成]
                           │
                           ▼ 3篇动态生成的内容
                    [推送主页展示]
                           │
                           ├─→ 用户阅读 → 更新暴露值 → 回到③
                           │
                           └─→ 用户对话 → POST /api/agent/chat
                                      → [Agent: ⑤交互]
                                      → 个性化回复
```

---

## 4. 前端架构

### 4.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI框架 |
| TypeScript | 5.x | 类型安全 |
| Vite | 5.x | 构建工具 |
| Tailwind CSS | 3.x | 样式系统 |
| Framer Motion | 11.x | 动画引擎 |
| Zustand | 4.x | 状态管理 |
| React Router DOM | 6.x | 路由 |
| Lucide React | latest | 图标库 |

### 4.2 页面结构

```
src/
├── App.tsx                      # 路由配置
├── main.tsx                     # 入口
├── pages/
│   ├── CocoonScanPage.tsx       # 茧房扫描页（首次访问跳转至此）
│   ├── HomePage.tsx             # 每日盲区推送主页
│   ├── HeatmapPage.tsx          # 认知热力图可视化
│   └── ViewReaderPage.tsx       # 阅读详情页
├── components/
│   ├── ChatAssistant.tsx        # 浮动智能聊天助手
│   ├── magicui/                 # Magic UI 风格动画组件
│   │   ├── MagicCard.tsx        # 鼠标跟随高亮卡片
│   │   ├── NumberTicker.tsx     # 数字滚动动画
│   │   ├── BorderBeam.tsx       # 边框光束动画
│   │   └── DotPattern.tsx       # 点阵背景
│   └── ui/                      # 基础UI组件（Button/Card/Input）
├── lib/
│   ├── apiClient.ts             # API请求封装
│   └── utils.ts                 # 工具函数
└── store/
    └── useAppStore.ts           # Zustand状态管理
```

### 4.3 路由

| 路径 | 页面 | 守卫 | 说明 |
|------|------|------|------|
| `/scan` | CocoonScanPage | 无 | 茧房扫描，首次访问自动跳转 |
| `/` | HomePage | 需暴露数据 | 每日盲区推送 |
| `/heatmap` | HeatmapPage | 需暴露数据 | 认知热力图 |
| `/read/:id` | ViewReaderPage | 需暴露数据 | 内容阅读详情 |

### 4.4 前端状态管理 (Zustand)

```typescript
interface AppState {
  // 用户数据
  userId: string | null;
  nickname: string;
  exposure: Record<string, number>;     // 24维暴露值
  readContentIds: string[];              // 已读内容ID

  // 推送数据
  dailyFeed: RecommendationItem[];
  blindSpotCount: number;

  // 操作
  scanCognitiveMap: (input: string) => Promise<void>;
  fetchDailyFeed: () => Promise<void>;
  markAsRead: (contentId: string) => void;
}
```

### 4.5 localStorage 持久化

| Key | 内容 | 说明 |
|-----|------|------|
| `cocoon_userId` | 用户ID | 扫描后生成 |
| `cocoon_nickname` | 昵称 | 扫描时输入 |
| `cocoon_exposure` | 24维暴露值JSON | 扫描结果 |
| `cocoon_readContentIds` | 已读内容ID数组 | 阅读后更新 |

---

## 5. 后端架构

### 5.1 技术栈

| 技术 | 用途 |
|------|------|
| Express | HTTP框架 |
| TypeScript | 类型安全 |
| Vercel Serverless Functions | 部署平台 |
| DeepSeek API (deepseek-chat) | AI能力（分析+决策+生成+对话） |

### 5.2 目录结构

```
api/
├── index.ts                     # 入口，挂载Express应用到Vercel
├── server.ts                    # 本地开发服务器
├── _core/
│   └── app.ts                   # Express应用配置 + CORS + 路由挂载
├── _routes/
│   └── agent.ts                 # Agent API路由（5个端点）
├── _agent/
│   ├── llm.ts                   # DeepSeek LLM客户端（核心AI逻辑）
│   ├── analyzer.ts              # 暴露值分析器
│   └── recommender.ts           # 智能推荐器（动态生成）
└── _knowledge/
    └── domains.ts               # 24个认知维度定义（仅维度元数据，无内容）
```

### 5.3 后端设计原则

| 原则 | 说明 |
|------|------|
| **无状态** | 不存储用户数据，每次请求由前端携带 |
| **无数据库** | 不使用任何数据库 |
| **无知识库** | 不使用任何内容库，内容由DeepSeek动态生成 |
| **Agent驱动** | 每个API端点对应Agent Pipeline的一个阶段 |
| **错误可见** | API失败时返回明确错误，不静默降级 |

### 5.4 DeepSeek 集成

```typescript
// llm.ts 核心架构
const DEEPSEEK_BASE = "https://api.deepseek.com/v1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;  // 环境变量
const MODEL = "deepseek-chat";  // Transformer模型

// 4个核心函数（对应Agent Pipeline）
1. analyzeAllDimensions(input)     → ②分析：生成24维暴露值
2. generateDailyContent(blindSpots) → ④生成：动态生成盲区内容
3. generateWhyRecommend(...)        → 推荐理由生成
4. chatWithAssistant(message)       → ⑤交互：多轮对话
```

---

## 6. 24 个认知维度

维度定义在 `api/_knowledge/domains.ts`，仅包含维度元数据（ID、名称、描述），**不包含任何内容**。

| 类别 | 维度ID | 中文名 |
|------|--------|--------|
| 高频暴露区 | entertainment | 娱乐八卦 |
| | humor | 搞笑视频 |
| | beauty | 美妆穿搭 |
| | movie | 影视综艺 |
| | food | 美食 |
| | gaming | 游戏电竞 |
| | tech | 科技数码 |
| | auto | 汽车 |
| | sports | 体育 |
| 低频暴露区 | finance | 财经投资 |
| | history | 历史 |
| | psychology | 心理学 |
| | art | 艺术设计 |
| | literature | 文学 |
| | sociology | 社会学 |
| | philosophy | 哲学 |
| 认知盲区 | physics | 粒子物理 |
| | astronomy | 天文学 |
| | classical | 古典音乐 |
| | biology | 生物学 |
| | archaeology | 考古学 |
| | linguistics | 语言学 |
| | architecture | 建筑学 |
| | math | 数学 |

---

## 7. API 接口定义

### 7.1 扫描接口（Agent ①②阶段）

```
POST /api/agent/scan
Body: { nickname: string, input?: string }
Response: {
  success: boolean,
  data: {
    userId: string,
    nickname: string,
    exposure: Record<string, number>,  // 24维暴露值
    blindSpotCount: number,
    highExposureCount: number,
    map: Array<Dimension & { userCount, isBlindSpot }>
  }
}
```

**Agent流程**：感知用户输入 → DeepSeek分析 → 生成24维暴露值

### 7.2 每日推送（Agent ③④阶段）

```
POST /api/agent/daily
Body: { exposure: Record<string, number>, readContentIds: string[] }
Response: {
  success: boolean,
  data: {
    items: Array<{
      id: string,              // 维度ID
      title: string,           // DeepSeek动态生成
      why: string,             // DeepSeek动态生成
      description: string,     // DeepSeek动态生成
      source: string,          // DeepSeek动态生成
      readTimeMinutes: number, // DeepSeek动态生成
      dimensionName: string,
      whyGenerated: string,    // DeepSeek动态生成
      exposureCount: number
    }>,
    blindSpotCount: number
  }
}
```

**Agent流程**：选择Top3盲区维度 → DeepSeek动态生成内容 → 返回

**关键**：`items` 中的所有内容字段都由 DeepSeek 实时生成，不从任何数据库/知识库中检索。

### 7.3 内容详情（Agent ④阶段）

```
POST /api/agent/content
Body: { contentId: string, exposure: Record<string, number> }
Response: {
  success: boolean,
  data: {
    id: string,
    title: string,           // DeepSeek动态生成
    description: string,     // DeepSeek动态生成
    source: string,          // DeepSeek动态生成
    readTimeMinutes: number,
    dimensionName: string,
    whyGenerated: string,
    exposureCount: number
  }
}
```

**注意**：由于内容是动态生成的，`contentId` 实际上是维度ID。每次请求时 DeepSeek 会根据用户当前暴露数据重新生成内容。前端会在 localStorage 中缓存已读过的生成内容。

### 7.4 认知地图

```
POST /api/agent/map
Body: { exposure: Record<string, number> }
Response: {
  success: boolean,
  data: Array<Dimension & { userCount, isBlindSpot }>
}
```

### 7.5 智能聊天（Agent ⑤阶段）

```
POST /api/agent/chat
Body: {
  message: string,
  history: Array<{ role: string, content: string }>,
  exposure: Record<string, number>
}
Response: {
  success: boolean,
  data: { reply: string }
}
```

**Agent流程**：携带用户暴露数据 + 对话历史 → DeepSeek生成个性化回复

---

## 8. UI 设计规范

### 8.1 设计参考

参考 GitHub 顶级 UI 项目：
- **shadcn/ui** (108K stars) — 组件设计语言
- **Magic UI** — 动画组件（MagicCard、NumberTicker、BorderBeam）
- **Linear.app** — 极简暗色设计风格
- **Vercel** — 现代感布局

### 8.2 配色

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `#ff4d4d` | 爆破/突破 |
| 辅色 | `#00d4ff` | 盲区/未知 |
| 背景 | `#0a0a0f` | 极深灰 |
| 卡片 | `bg-white/[0.02]` | 半透明白 |
| 边框 | `border-white/[0.08]` | 微弱边框 |

### 8.3 认知热力图配色

| 暴露值范围 | 颜色 | 含义 |
|-----------|------|------|
| > 500 | `#ff4d4d` | 过度暴露（红） |
| 201-500 | `#ff8a3d` | 高频暴露（橙） |
| 51-200 | `#ffd23d` | 中等暴露（黄） |
| 6-50 | `#4ade80` | 低频暴露（绿） |
| < 6 | 蓝色斜纹 | 认知盲区 |

### 8.4 动效

| 组件 | 动画 | 触发 |
|------|------|------|
| 卡片入场 | opacity 0→1 + y 20→0 | 页面加载 |
| MagicCard | 鼠标跟随径向高亮 | 鼠标移动 |
| NumberTicker | 数字滚动 | 数据更新 |
| BorderBeam | 边框光束旋转 | 持续 |
| 聊天面板 | spring 弹性 | 打开/关闭 |
| 浮动按钮 | scale 缩放 | hover |

---

## 9. 部署

### 9.1 部署架构

```
GitHub (haow9508-ctrl/cocoon-breaker)
    │
    │ git push
    ▼
Vercel (自动部署)
    ├── 前端: 静态文件 (dist/)
    └── 后端: Serverless Functions (api/)
            │
            ▼
        DeepSeek API
        (api.deepseek.com)
```

### 9.2 环境变量

| Key | Value | 用途 | 配置位置 |
|-----|-------|------|---------|
| `DEEPSEEK_API_KEY` | `<your-deepseek-api-key>` | DeepSeek API认证 | Vercel Dashboard → Settings → Environment Variables |

> **必须配置**：Production + Preview + Development 三个环境都要勾选。
> 如果未配置，所有 Agent 功能将完全失效（不是降级，是报错）。

### 9.3 构建配置

| 项 | 值 |
|----|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| API目录 | `api` (Vercel自动识别) |
| Node版本 | 20.x |

### 9.4 本地开发

```bash
# 1. 创建 .env 文件
echo "DEEPSEEK_API_KEY=<your-deepseek-api-key>" > .env

# 2. 同时启动前端+后端
npm run dev

# 3. 或分别启动
npm run client:dev   # 前端 http://localhost:5173
npm run server:dev   # 后端 http://localhost:3001
```

---

## 10. 错误处理策略

### 10.1 原则
- **不静默降级**：API失败时返回明确错误，前端显示错误提示
- **不使用默认值**：DeepSeek分析失败时，不回退到硬编码默认值
- **错误可见**：前端显示「AI分析失败，请重试」而非假装成功

### 10.2 错误码

| 场景 | HTTP状态 | 响应 |
|------|---------|------|
| DeepSeek API Key 未配置 | 500 | `{ success: false, error: "DEEPSEEK_API_KEY not configured" }` |
| DeepSeek API 调用失败 | 502 | `{ success: false, error: "DeepSeek API error: ..." }` |
| 暴露数据缺失 | 400 | `{ success: false, error: "Exposure data required" }` |
| 内容生成失败 | 500 | `{ success: false, error: "Content generation failed" }` |

---

## 11. 待优化方向

### P0 — 紧急
| 项目 | 说明 |
|------|------|
| Vercel 环境变量配置 | 设置 DEEPSEEK_API_KEY |
| 错误处理改造 | 移除静默降级，失败时报错 |

### P1 — 功能增强
| 项目 | 说明 |
|------|------|
| 领域细分树 | 允许用户在感兴趣领域内继续细分 |
| 偏好收集向导 | 首次使用聊天式收集：深耕型/跨界型、感兴趣领域、内容深度 |
| 流式回复 | 聊天助手改用 SSE 流式输出 |
| 内容缓存 | 已读内容缓存到 localStorage，避免重复生成 |

### P2 — 技术优化
| 项目 | 说明 |
|------|------|
| 用户系统 | 注册登录，跨设备同步 |
| 数据持久化 | 后端数据库存储暴露数据 |
| API缓存 | DeepSeek调用结果缓存 |
| 内容管理 | 动态调整维度配置 |

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-04 | 初始MVP：热力图+推送+勋章（硬编码内容库） |
| v2.0 | 2026-07-05 | 部署Vercel，接入DeepSeek API（仍用内容库） |
| v3.0 | 2026-07-06 | **架构重构**：移除知识库，改为DeepSeek纯生成式Agent；完整架构文档 |
