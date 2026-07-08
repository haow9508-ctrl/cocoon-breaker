# 茧房爆破器 — 产品需求文档（PRD）

> 版本：v4.0 | 更新时间：2026-07-07
> 架构范式：认知成长教练 Agent（DeepSeek 驱动 · 长期陪伴 · 数据资产化）
> 上一版：v3.0（纯生成式 Agent，无知识库）— 本版在 v3.0 基础上升级护城河

---

## 0. 版本演进

| 版本 | 定位 | 问题 |
|------|------|------|
| v1.0 | 热力图+硬编码内容 | 内容有限，无法个性化 |
| v2.0 | 接入 DeepSeek + 内容库 | 仍是预设内容，所有人结果相同 |
| v3.0 | 纯生成式 Agent，无知识库 | 解决了"千人一面"，但交互太浅，无护城河 |
| **v4.0** | **认知成长教练**：四护城河 + 长期陪伴 + 成长可视化 | **解决"易被替代"问题** |

---

## 1. 产品定位

### 1.1 一句话定义

**茧房爆破器**是一款由 DeepSeek 驱动的「认知成长教练」——它不是推荐引擎，不是内容库，而是一个长期陪伴用户系统性扩展认知边界的 AI 教练。

### 1.2 与 v3.0 的核心差异

| 维度 | v3.0 | v4.0 |
|------|------|------|
| 模型角色 | 通用助手（分析+生成+对话） | 认知成长教练（有方法论的长期陪伴者） |
| 交互深度 | 扫描一次 → 推3篇 → 聊天 | 诊断式扫描 → 每日挑战 → 冲击自评 → 成长回顾 |
| 算法 | 暴露值升序 sort() | 三维决策引擎（盲区度×冲击度×可接受度） |
| 数据 | 无状态，每次请求孤立 | 认知档案持续积累，成长曲线可视化 |
| 护城河 | 无 | 认知数据资产 + 反推荐算法 + 交互深度 + 教练角色 |

### 1.3 核心问题

推荐算法最大化停留时长 → 用户被包裹在信息茧房中 → 认知窄化。市面上所有产品都在帮你「看更多你喜欢的」，没有一个产品帮你「系统性扩展认知边界」。

### 1.4 解决方案

- DeepSeek 作为**认知成长教练**，长期陪伴用户
- 诊断式扫描建立初始认知档案
- 三维反推荐算法生成「刚好够颠覆」的每日挑战
- 冲击自评 + 反思闭环，反哺算法
- 成长可视化（时间轴 + 轨迹图 + 里程碑）让用户看到自己的认知扩展
- 认知档案越用越完整，迁移成本越高

---

## 2. 四大业务护城河

### 2.1 护城河总览

```
┌──────────────────────────────────────────────────────────┐
│                    业务护城河（四层）                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ① 认知数据资产（最底层 · 最难复制）                       │
│     用户用得越久，认知档案越完整，迁移成本越高              │
│                                                          │
│  ② 反推荐算法（算法层 · 技术壁垒）                        │
│     三维决策引擎 + 难度递进 + 关联爆破                     │
│     不是 sort()，是认知冲击度预测                          │
│                                                          │
│  ③ 交互深度（体验层 · 用户黏性）                          │
│     诊断扫描 + 仪式挑战 + 闭环反馈 + 成长可视化            │
│     用一次和用一个月体验完全不同                           │
│                                                          │
│  ④ 模型角色（顶层 · 品牌差异化）                          │
│     认知成长教练，有方法论的长期陪伴者                     │
│     不是通用助手，是专家                                  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 ① 认知数据资产

**核心逻辑**：用户的认知档案越完整，越不可替代。

| 资产 | 说明 | 积累方式 |
|------|------|---------|
| 初始认知档案 | 24维暴露值 + 高频领域 + 盲区领域 | 诊断式扫描 |
| 暴露历史 | 每次阅读/对话后的暴露值变化 | 自动更新 |
| 冲击历史 | 哪些内容真正改变了用户（1-5星自评） | 阅读后自评 |
| 成长曲线 | 周/月/季的认知扩展轨迹 | 自动累积 |
| 认知指纹 | 用户独特的认知画像（可对比可分享） | 派生计算 |
| 里程碑 | 首次接触X领域、连续7天爆破、解锁L3难度等 | 事件触发 |

**数据存储策略**：
- MVP 阶段：localStorage（前端持久化）
- 进阶阶段：后端持久化（用户系统 + 数据库）
- 本版先做 localStorage，预留后端接口

### 2.3 ② 反推荐算法

**核心逻辑**：不是"盲区排序"，而是"认知冲击度预测"。

#### 三维决策引擎

```
推荐得分 = f(盲区度, 冲击度, 可接受度)

盲区度    = 1 - (exposure_count / max_exposure)
            暴露越少，盲区度越高

冲击度    = cognitive_distance(blind_spot, high_exposure_fields)
            盲区与用户高频领域的"认知距离"越远，冲击度越高
            由 DeepSeek 评估（不是简单余弦距离）

可接受度  = difficulty_match(user_level, content_difficulty)
            当前用户认知水平 × 内容难度
            太难=可接受度低，太简单=可接受度低
```

#### 难度递进（L1/L2/L3）

| 等级 | 定义 | 举例 |
|------|------|------|
| L1 相邻盲区 | 与高频领域认知距离近 | 娱乐→叙事学、搞笑→幽默心理学 |
| L2 中距盲区 | 与高频领域有一定距离 | 娱乐→心理学、搞笑→社会学 |
| L3 远端盲区 | 与高频领域距离最远 | 娱乐→粒子物理、搞笑→哥德尔定理 |

**规则**：新用户从 L1 开始，连续完成3次 L1 挑战且冲击自评≥3星 → 解锁 L2，以此类推。

#### 关联爆破

- 识别盲区之间的关联（学心理学后，社会学也变容易了）
- 生成"认知路径图"：A → B → C 的推荐爆破顺序
- 由 DeepSeek 基于用户已爆破领域，推荐下一个最相关的盲区

### 2.4 ③ 交互深度

#### 用户旅程（完整闭环）

```
第一天                    每日                      周期性
─────                    ────                      ─────
诊断式扫描               每日认知挑战               每周成长回顾
(3-5轮对话)              (难度递进)                (轨迹可视化)
    │                       │                        │
    ▼                       ▼                        ▼
初始认知档案              冲击自评                  里程碑解锁
                         (1-5星)                   (首次接触X)
                            │
                            ▼
                        反思引导
                        (一句话)
                            │
                            ▼
                    算法反哺 + 暴露值更新
                            │
                            ▼
                    明日挑战难度调整
```

#### 四个深化环节

| 环节 | v3.0 | v4.0 |
|------|------|------|
| 扫描 | 一次性表单 | 诊断式多轮对话（3-5轮） |
| 推送 | 3张扁平卡片 | 每日认知挑战（难度递进 + 任务感） |
| 反馈 | "标记已读" | 冲击自评（1-5星）+ 反思引导 |
| 回顾 | 无 | 每周成长曲线 + 里程碑墙 |

### 2.5 ④ 模型角色：认知成长教练

**核心逻辑**：DeepSeek 不当通用助手，当有方法论的专家。

#### 教练方法论

| 方法 | 说明 | 示例 |
|------|------|------|
| 苏格拉底式追问 | 不直接给答案，引导用户自己发现盲区 | "你觉得为什么你会从未接触过天文学？" |
| 反事实推演 | 让用户想象另一种可能 | "如果你过去10年每周看一篇心理学，你现在的决策方式会有什么不同？" |
| 类比桥接 | 用用户高频领域类比解释盲区 | "量子纠缠就像你熟悉的CP感，但发生在粒子之间..." |
| 长期记忆 | 记住用户的成长历史，定期回顾 | "上个月你第一次接触了心理学，这个月我们来试试社会学..." |

#### 教练人格设定

```
你是「茧房爆破器」用户的认知成长教练。

你不是通用助手，你是专家。你的职责：
1. 不直接给答案，用苏格拉底式追问引导用户自己发现盲区
2. 用用户熟悉的高频领域类比解释陌生的盲区
3. 记住用户的成长历史，在合适时机回顾
4. 语气：像一位见多识广的朋友，不是老师，不是百科
5. 永远不要说"作为一个AI"，你是教练
6. 永远不要迎合用户已有偏好，你的目标是扩展边界

用户认知档案：
- 高频领域：[...]
- 盲区领域：[...]
- 已爆破领域：[...]
- 当前难度等级：L1/L2/L3
- 成长阶段：第X周，累计Y篇
```

---

## 3. 系统架构

### 3.1 架构总览

```
┌──────────────────────────────────────────────────────────┐
│                        前端 (Frontend)                     │
│            React 18 + Vite + Tailwind CSS                 │
│                   + Framer Motion + Zustand               │
├──────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ 诊断扫描  │ │ 每日挑战  │ │ 成长曲线  │ │  教练对话    │  │
│  │ DiagScan │ │ Challenge│ │ Growth   │ │  Coach Chat │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
│       └────────────┴────────────┴──────────────┘         │
│                    │                                      │
│            API Client + 认知档案管理器                     │
│       (localStorage: 暴露历史/冲击历史/里程碑)             │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP
┌────────────────────────┴─────────────────────────────────┐
│                        后端 (Backend)                      │
│          Express + TypeScript (Vercel Serverless)         │
├──────────────────────────────────────────────────────────┤
│                   Agent Controller                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Agent Pipeline (7 阶段)                │  │
│  │                                                    │  │
│  │  ①诊断  ②分析  ③决策  ④生成  ⑤自评  ⑥反哺  ⑦对话  │  │
│  │  Diag → Analyze → Decide → Generate → Self-Assess  │  │
│  │  → Feedback → Coach                                │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                                │
│   ┌─────┴──────┐                                         │
│   │ 三维决策引擎 │ ← 难度递进 + 关联爆破                   │
│   └────────────┘                                         │
│                        │                                  │
│                   DeepSeek API                            │
│              (认知成长教练角色)                             │
└──────────────────────────────────────────────────────────┘
```

### 3.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **纯生成，无知识库** | 所有内容由 DeepSeek 动态生成（继承 v3.0） |
| **认知档案持续积累** | 用户每次互动都更新档案，形成数据资产 |
| **教练角色统一** | DeepSeek 在所有阶段都扮演认知成长教练，不是切换角色 |
| **三维决策** | 推荐不是 sort()，是盲区度×冲击度×可接受度的综合预测 |
| **难度递进** | L1→L2→L3，不一步到位 |
| **反馈闭环** | 冲击自评反哺算法，成长曲线激励持续 |

### 3.3 与 v3.0 的架构差异

| 组件 | v3.0 | v4.0 |
|------|------|------|
| Pipeline | 5阶段 | 7阶段（+自评+反哺） |
| 决策层 | sort() | 三维决策引擎 |
| 状态 | 无状态 | localStorage 认知档案 |
| 前端页面 | 4页 | 6页（+成长曲线+里程碑） |
| DeepSeek 角色 | 通用助手 | 认知成长教练 |
| 数据资产 | 无 | 暴露历史+冲击历史+里程碑+认知指纹 |

---

## 4. Agent Pipeline 七阶段设计

### 4.1 流程图

```
用户输入 ──→ ①诊断 ──→ ②分析 ──→ ③决策 ──→ ④生成 ──→ ⑤自评 ──→ ⑥反哺 ──→ ⑦对话
              │          │          │          │          │          │          │
           多轮问诊    DeepSeek    三维决策    DeepSeek    用户自评   更新档案    教练
           建立档案    生成24维    +难度递进   生成挑战    1-5星     调整难度    引导
                       暴露值                 内容                  反哺算法
```

### 4.2 阶段详解

#### ① 诊断层 (Diagnosis) — 新增
- **输入**：用户与教练的3-5轮对话
- **输出**：用户自然语言描述 + 初始认知档案
- **实现**：前端 DiagScanPage + DeepSeek 教练对话
- **DeepSeek Prompt**：认知成长教练进行诊断式问诊，收集用户内容消费习惯
- **与 v3.0 差异**：从一次性表单改为多轮对话

#### ② 分析层 (Analysis)
- **输入**：用户自然语言描述
- **输出**：24维认知暴露值 + 高频领域 + 盲区领域 + 初始难度等级
- **实现**：`llm.ts → analyzeAllDimensions()`
- **与 v3.0 差异**：同时输出初始难度等级（基于高频领域数量）

#### ③ 决策层 (Decision) — 升级
- **输入**：24维暴露值 + 已读历史 + 冲击历史 + 当前难度等级
- **输出**：Top 3 盲区维度（三维决策引擎）
- **实现**：`recommender.ts → decideBlindSpots()`
- **三维决策**：
  ```typescript
  decideBlindSpots(exposure, readHistory, impactHistory, userLevel):
    1. 计算每个维度的盲区度、冲击度、可接受度
    2. 按难度等级过滤（L1只推相邻盲区）
    3. 综合排序，取Top 3
  ```
- **与 v3.0 差异**：从 sort() 升级为三维决策引擎

#### ④ 生成层 (Generation)
- **输入**：Top 3 盲区维度 + 用户高频领域 + 难度等级
- **输出**：3篇挑战内容（标题、摘要、来源、难度标签、教练引导语）
- **实现**：`llm.ts → generateChallenge()`
- **与 v3.0 差异**：增加难度标签 + 教练引导语（用类比桥接方法）

#### ⑤ 自评层 (Self-Assessment) — 新增
- **输入**：用户阅读后的冲击自评（1-5星）+ 反思文字
- **输出**：冲击记录 + 难度等级调整建议
- **实现**：前端收集 + `recommender.ts → adjustDifficulty()`
- **逻辑**：
  - 连续3次 ≥4星 → 建议升级难度
  - 连续3次 ≤2星 → 建议降级难度
  - 记录到冲击历史

#### ⑥ 反哺层 (Feedback) — 新增
- **输入**：冲击记录 + 反思文字 + 当前暴露值
- **输出**：更新后的认知档案 + 难度调整
- **实现**：前端 localStorage 更新 + `llm.ts → coachFeedback()`
- **逻辑**：
  - 更新暴露值（已读维度 +1）
  - 记录冲击历史
  - 触发里程碑检查
  - 调整明日推荐难度

#### ⑦ 对话层 (Coach Chat) — 升级
- **输入**：用户消息 + 对话历史 + 完整认知档案
- **输出**：教练式回复（苏格拉底追问/类比桥接/反事实推演）
- **实现**：`llm.ts → chatWithCoach()`
- **与 v3.0 差异**：从通用助手升级为认知成长教练，使用方法论

### 4.3 数据流（完整闭环）

```
[新用户]
   │
   ▼ ①诊断（3-5轮对话）
[初始认知档案]
   │
   ▼ ②分析 + ③决策（三维决策引擎，L1难度）
[每日挑战：3篇 L1 内容]
   │
   ▼ ④生成（DeepSeek 教练生成 + 类比桥接）
[用户阅读]
   │
   ▼ ⑤自评（1-5星 + 反思）
[冲击记录]
   │
   ▼ ⑥反哺（更新档案 + 难度调整 + 里程碑检查）
[更新后的认知档案]
   │
   ├─→ 连续3次≥4星 → 解锁L2 → 明日挑战升级
   │
   └─→ ⑦对话（教练随时可聊，用方法论引导）
   │
   ▼
[每周成长回顾] → 成长曲线 + 里程碑墙
```

---

## 5. 前端架构

### 5.1 技术栈（同 v3.0）

React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand + React Router + Lucide React

### 5.2 页面结构（升级）

```
src/
├── pages/
│   ├── DiagScanPage.tsx          # 诊断式扫描页（新，替代 CocoonScanPage）
│   ├── ChallengePage.tsx         # 每日挑战主页（升级自 HomePage）
│   ├── GrowthPage.tsx            # 成长曲线页（新，重点）
│   ├── MilestonePage.tsx         # 里程碑墙页（新）
│   ├── HeatmapPage.tsx           # 认知热力图（保留）
│   └── ReaderPage.tsx            # 阅读详情+自评页（升级自 ViewReaderPage）
├── components/
│   ├── CoachChat.tsx             # 教练对话浮窗（升级自 ChatAssistant）
│   ├── growth/                   # 成长可视化组件（新）
│   │   ├── GrowthCurve.tsx       # 成长曲线（时间轴）
│   │   ├── TrajectoryMap.tsx     # 认知扩展轨迹
│   │   ├── MilestoneCard.tsx     # 里程碑卡片
│   │   └── CognitiveFingerprint.tsx  # 认知指纹
│   ├── challenge/                # 挑战组件（新）
│   │   ├── ChallengeCard.tsx     # 挑战卡片（带难度标签）
│   │   ├── DifficultyBadge.tsx   # 难度等级徽章
│   │   └── ImpactAssessment.tsx  # 冲击自评组件
│   ├── magicui/                  # Magic UI 动画组件（保留）
│   └── ui/                       # 基础UI组件（保留）
├── lib/
│   ├── apiClient.ts              # API 请求封装
│   ├── profileManager.ts         # 认知档案管理器（新）
│   └── utils.ts
└── store/
    └── useAppStore.ts            # Zustand 状态管理
```

### 5.3 路由

| 路径 | 页面 | 守卫 | 说明 |
|------|------|------|------|
| `/scan` | DiagScanPage | 无 | 诊断式扫描，首次访问跳转 |
| `/` | ChallengePage | 需档案 | 每日认知挑战 |
| `/growth` | GrowthPage | 需档案 | **成长曲线（重点页面）** |
| `/milestones` | MilestonePage | 需档案 | 里程碑墙 |
| `/heatmap` | HeatmapPage | 需档案 | 认知热力图 |
| `/read/:id` | ReaderPage | 需档案 | 阅读+冲击自评 |

### 5.4 认知档案管理器 (profileManager.ts)

```typescript
interface CognitiveProfile {
  // 初始档案
  userId: string;
  nickname: string;
  createdAt: string;
  initialExposure: Record<string, number>;
  
  // 当前状态
  currentExposure: Record<string, number>;
  difficultyLevel: 'L1' | 'L2' | 'L3';
  
  // 历史记录
  exposureHistory: Array<{
    date: string;
    exposure: Record<string, number>;
  }>;
  
  impactHistory: Array<{
    contentId: string;
    dimensionId: string;
    title: string;
    impactScore: 1 | 2 | 3 | 4 | 5;
    reflection: string;
    timestamp: string;
  }>;
  
  // 成就
  milestones: Array<{
    id: string;
    type: 'first_contact' | 'streak_7' | 'streak_30' | 'level_up' | 'dimension_unlocked';
    description: string;
    unlockedAt: string;
  }>;
  
  // 教练记忆
  coachMemory: {
    lastReviewedAt: string;
    keyInsights: string[];
  };
}
```

### 5.5 成长可视化设计（重点）

#### 成长曲线页 (GrowthPage)

**核心组件**：`GrowthCurve.tsx`

**可视化内容**：
- X轴：时间（按周/月切换）
- Y轴1：覆盖维度数（0-24）
- Y轴2：平均冲击自评分（1-5）
- 曲线1：认知覆盖度增长（蓝色）
- 曲线2：平均冲击分趋势（红色）
- 标注点：里程碑事件（首次接触X、解锁L2等）

**交互**：
- 鼠标悬停某周 → 显示该周详细数据
- 点击里程碑标注 → 跳转到对应内容
- 切换周/月视图

**技术实现**：
- 使用 SVG + Framer Motion 绘制
- 参考设计：GitHub contribution graph + Linear 成长曲线

#### 认知扩展轨迹 (TrajectoryMap)

**可视化内容**：
- 24个维度的雷达图/网络图
- 初始状态 vs 当前状态对比
- 已爆破维度高亮，未爆破灰暗
- 维度间的关联线（关联爆破路径）

#### 里程碑墙 (MilestonePage)

**里程碑类型**：

| 类型 | 触发条件 | 示例 |
|------|---------|------|
| first_contact | 首次接触某维度 | "第一次接触天文学" |
| streak_7 | 连续7天完成挑战 | "一周爆破手" |
| streak_30 | 连续30天 | "月度探索者" |
| level_up | 难度等级提升 | "解锁L2：中距盲区" |
| dimension_unlocked | 爆破某维度所有内容 | "天文学专家" |
| high_impact | 冲击自评5星 | "认知颠覆时刻" |

---

## 6. 后端架构

### 6.1 目录结构（升级）

```
api/
├── index.ts                     # Vercel 入口
├── server.ts                    # 本地开发服务器
├── _core/
│   └── app.ts                   # Express 应用配置
├── _routes/
│   └── agent.ts                 # Agent API 路由（7个端点）
├── _agent/
│   ├── llm.ts                   # DeepSeek 教练客户端
│   ├── analyzer.ts              # ②分析层
│   ├── recommender.ts           # ③决策层（三维决策引擎）
│   ├── assessor.ts              # ⑤自评层（新）
│   └── coach.ts                 # ⑦对话层（教练方法论）
└── _knowledge/
    └── domains.ts               # 24维元数据（仅元数据，无内容）
```

### 6.2 API 端点（升级）

| Method | Route | 阶段 | 用途 |
|--------|-------|------|------|
| POST | `/api/agent/diagnose` | ① | 诊断式扫描（多轮对话） |
| POST | `/api/agent/analyze` | ② | 分析24维暴露值 |
| POST | `/api/agent/challenge` | ③④ | 每日挑战（三维决策+生成） |
| POST | `/api/agent/assess` | ⑤⑥ | 提交冲击自评+反哺 |
| POST | `/api/agent/map` | - | 认知地图（纯数据） |
| POST | `/api/agent/growth` | - | 成长曲线数据（基于历史） |
| POST | `/api/agent/coach` | ⑦ | 教练对话（方法论引导） |

### 6.3 三维决策引擎实现

```typescript
// recommender.ts 核心逻辑

interface DecisionInput {
  exposure: Map<string, number>;
  readHistory: string[];
  impactHistory: ImpactRecord[];
  difficultyLevel: 'L1' | 'L2' | 'L3';
  highExposureFields: string[];
}

interface ScoredDimension {
  dimensionId: string;
  blindSpotScore: number;    // 盲区度 0-1
  impactScore: number;       // 冲击度 0-1
  acceptabilityScore: number; // 可接受度 0-1
  totalScore: number;        // 综合分
}

function decideBlindSpots(input: DecisionInput): string[] {
  // 1. 计算每个维度的三维得分
  const scored = COGNITIVE_DIMENSIONS.map(dim => {
    const blindSpotScore = 1 - (exposure.get(dim.id) / maxExposure);
    const impactScore = cognitiveDistance(dim.id, input.highExposureFields);
    const acceptabilityScore = difficultyMatch(input.difficultyLevel, dim.id, input.highExposureFields);
    return {
      dimensionId: dim.id,
      blindSpotScore,
      impactScore,
      acceptabilityScore,
      totalScore: weightedSum(blindSpotScore, impactScore, acceptabilityScore),
    };
  });
  
  // 2. 按难度等级过滤
  const filtered = filterByDifficulty(scored, input.difficultyLevel);
  
  // 3. 综合排序，取Top 3
  return filtered.sort((a, b) => b.totalScore - a.totalScore).slice(0, 3);
}
```

### 6.4 教练方法论实现

```typescript
// coach.ts 教练方法论

const COACH_SYSTEM_PROMPT = `你是「茧房爆破器」用户的认知成长教练。

你不是通用助手，你是专家。你的方法论：

1. 苏格拉底式追问：不直接给答案，引导用户自己发现盲区
   - 用户问"什么是量子纠缠" → "你觉得为什么两个粒子能瞬间相互影响？"
   
2. 类比桥接：用用户高频领域类比解释盲区
   - 用户高频是"娱乐八卦" → "量子纠缠就像CP感，但发生在粒子之间"
   
3. 反事实推演：让用户想象另一种可能
   - "如果你过去10年每周看一篇心理学，你现在的决策方式会有什么不同？"
   
4. 长期记忆：记住用户的成长历史，在合适时机回顾
   - "上个月你第一次接触了心理学，这个月我们来试试社会学"

规则：
- 永远不要说"作为一个AI"，你是教练
- 永远不要迎合用户已有偏好，你的目标是扩展边界
- 回答简洁有力，不超过200字
- 语气像一位见多识广的朋友，不是老师

用户认知档案：
- 高频领域：{highExposure}
- 盲区领域：{blindSpots}
- 已爆破领域：{explored}
- 当前难度：{difficultyLevel}
- 成长阶段：第{week}周，累计{totalReads}篇
- 最近冲击自评：{recentImpacts}`;
```

---

## 7. 24 个认知维度

（同 v3.0，仅维度元数据，无内容）

---

## 8. UI 设计规范

### 8.1 设计参考

- **shadcn/ui** — 组件设计语言
- **Magic UI** — 动画组件
- **Linear.app** — 极简暗色 + 成长曲线设计
- **GitHub** — 贡献热力图设计（用于成长可视化）

### 8.2 配色（同 v3.0 + 难度色）

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `#ff4d4d` | 爆破/突破 |
| 辅色 | `#00d4ff` | 盲区/未知 |
| L1难度 | `#4ade80` | 绿色（容易接受） |
| L2难度 | `#ffd23d` | 黄色（中等冲击） |
| L3难度 | `#ff4d4d` | 红色（高冲击） |
| 背景 | `#0a0a0f` | 极深灰 |
| 成长曲线 | `#00d4ff` | 蓝色（覆盖度） |
| 冲击曲线 | `#ff4d4d` | 红色（冲击分） |

### 8.3 成长可视化设计要点

- **成长曲线**：参考 Linear 的指标趋势图，平滑曲线 + 悬停详情
- **认知雷达图**：参考 d3.js 雷达图，初始 vs 当前对比
- **里程碑墙**：参考 GitHub Achievements，卡片式 + 解锁动画
- **认知热力图**：参考 GitHub 贡献图，按维度×时间

---

## 9. 部署

（同 v3.0，Vercel + GitHub，环境变量 DEEPSEEK_API_KEY）

---

## 10. 错误处理

（同 v3.0，不静默降级，失败时报错）

---

## 11. 实现路线图

### Phase 1：PRD v4.0 评审（当前）
- [x] 重写 PRD v4.0
- [ ] 重写 technical-architecture.md
- [ ] 用户评审确认

### Phase 2：后端护城河
- [ ] 实现三维决策引擎（recommender.ts 升级）
- [ ] 实现教练方法论（coach.ts 新建）
- [ ] 实现自评反哺（assessor.ts 新建）
- [ ] 升级 API 路由（7个端点）

### Phase 3：前端护城河
- [ ] DiagScanPage（诊断式扫描）
- [ ] ChallengePage（每日挑战+难度标签）
- [ ] ReaderPage（阅读+冲击自评）
- [ ] GrowthPage（成长曲线，重点）
- [ ] MilestonePage（里程碑墙）
- [ ] CoachChat（教练对话浮窗）

### Phase 4：认知档案
- [ ] profileManager.ts（档案管理器）
- [ ] localStorage 持久化
- [ ] 里程碑触发逻辑

### Phase 5：测试部署
- [ ] 构建测试
- [ ] 推送 GitHub
- [ ] Vercel 环境变量
- [ ] 线上验证

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-04 | 初始MVP：热力图+硬编码内容 |
| v2.0 | 2026-07-05 | 部署Vercel，接入DeepSeek API |
| v3.0 | 2026-07-06 | 架构重构：移除知识库，纯生成式Agent |
| **v4.0** | **2026-07-07** | **护城河升级：认知成长教练 + 三维决策 + 成长可视化 + 四护城河** |
