# 茧房爆破器 — 产品需求文档（PRD）

> 版本：v6.0 | 更新时间：2026-07-09
> 架构范式：**实时互联网检索 + Qdrant 缓存层 + DeepSeek 教练**（Bing Web Search API + 向量检索 + BM25 hybrid）
> 上一版：v5.1（误用 24 个固定认知维度做跨领域盲区推荐）— v6.0 纠正为「认知大方向 + 方向内拓展」

---

## 0. 版本演进

| 版本 | 定位 | 问题 |
|------|------|------|
| v1.0 | 热力图+硬编码内容 | 内容有限，无法个性化 |
| v2.0 | 接入 DeepSeek + 内容库 | 仍是预设内容，所有人结果相同 |
| v3.0 | 纯生成式 Agent，无知识库 | 解决了"千人一面"，但交互太浅，无护城河 |
| v4.0 | 认知成长教练：四护城河 + 长期陪伴 + 成长可视化 | 解决"易被替代"问题，但缺失 RAG 架构 |
| v5.0 | RAG + Transformer + Agent 混合架构（arXiv 知识库） | **错误**：arXiv 是固定知识库，每日信息更新无法支撑 |
| v5.1 | 实时互联网检索 + Qdrant 缓存层（Bing API + BM25 hybrid） | **错误**：保留 24 个固定认知维度，把推荐理解为"找用户没接触过的维度"，导致跑偏 |
| **v6.0** | **认知大方向 + 方向内拓展**（Bing API + BM25 hybrid） | **纠正**：服务持续提升认知的人，在既定认知大方向内拓展视野，而非跳到功能方向 |

### 0.1 v6.0 核心纠正

v5.1 的根本问题：它保留了 v4.0 遗留下来的"24 个认知维度"模型（entertainment / humor / beauty / auto / sports 等固定维度），把推荐理解为"找用户没接触过的维度"。结果是：一个 AIPM 用户聊完天后被推荐美妆、汽车、体育——完全跑偏。

用户的核心诉求是：**服务持续提升自身认知的人，在他们既定的认知大方向内（如 AIPM / Python / 古诗 / 股市 / 思考方法论）拓展视野，而非跳到搞笑段子、美妆等功能方向。**

v6.0 纠正为：
- **移除 24 个固定认知维度**和数值型暴露值模型（0-847）
- **新增「认知大方向 + 方向内子领域树」模型**
- 推荐逻辑从"盲区突破（跨领域）"改为"方向内拓展（同大方向内）"
- 接触程度从数值改为三档标注：`high` / `low` / `none`
- 难度递进改为：L1=同方向相邻子领域 / L2=同方向中距 / L3=同方向远端（类比拓展）
- 热力图从"24 维色块"改为"方向树视图"

### 0.2 v6.0 典型场景

| 用户认知大方向 | 已接触子领域 | L1 相邻拓展 | L2 中距拓展 | L3 远端类比拓展 |
|---------------|------------|------------|------------|---------------|
| 学 Python | 语法、Web 框架 | 数据库、并发编程 | C / Rust、编程范式 | 编译原理、类型论 |
| 读《思考，快与慢》 | 双系统理论 | 行为经济学其他著作 | 认知心理学经典 | 神经科学决策机制 |
| 学古诗 | 唐诗 | 诗论、文学批评 | 宋词、其他朝代诗 | 中外诗歌对比、翻译理论 |
| 关注股市 | 技术分析 | 基本面分析、宏观 | 行为金融学、市场历史 | 量化思维、风险管理 |

### 0.3 与 v5.1 的核心差异

| 维度 | v5.1 | v6.0 |
|------|------|------|
| 维度模型 | 24 个固定认知维度（entertainment/humor/beauty/auto...） | **认知大方向 + 方向内子领域树**（动态、用户驱动） |
| 推荐逻辑 | 盲区突破（跨领域推荐） | **方向内拓展（同大方向内）** |
| 产品定位 | 服务高价值人群的通用认知成长 | **服务持续提升认知的人，在既定方向内拓展** |
| 诊断层 | 24 维暴露扫描 | **认知大方向识别** |
| 决策层 | 三维决策引擎（跨维度推荐） | **方向内拓展度（同方向内推荐）** |
| 接触程度 | 数值（0-847） | **三档标注（high / low / none）** |
| 热力图 | 24 维色块 | **方向树视图** |
| 难度递进 | L1=相邻盲区 / L2=中距盲区 / L3=远端盲区（跨领域） | **L1=同方向相邻子领域 / L2=同方向中距 / L3=同方向远端（类比拓展）** |

### 0.4 v6.0 保留不变的部分

- 三层架构：前端 → Node 中间层 → Python RAG 后端 + DeepSeek
- Qdrant 作为实时检索缓存层（TTL 24h），非持久化知识库
- BM25 + Vector hybrid retrieval（RRF 融合）
- 7 阶段 Pipeline
- 教练角色 + 4 种方法论（苏格拉底 / 类比 / 反事实 / 记忆）
- 难度递进 L1 / L2 / L3 三档结构
- 认知档案 localStorage 持久化
- 实时互联网检索（Bing Web Search API），非固定知识库

---

## 1. 产品定位

### 1.1 一句话定义

**茧房爆破器**是一款基于 RAG + Transformer + Agent 混合架构的「认知成长教练」——它服务于**持续提升自身认知的人**，在他们**既定的认知大方向内**（如 AIPM / Python / 古诗 / 股市 / 思考方法论）拓展视野。通过实时互联网检索真实内容（抗 GEO 污染），再由 DeepSeek 教练基于真实内容生成个性化认知挑战，长期陪伴用户在大方向内系统性拓展认知边界。

### 1.2 v6.0 定位核心纠正

v5.1 的定位偏移：把"高价值人群"理解为需要"全方位认知成长"，于是给 AIPM 用户推荐美妆、体育、汽车——这是把"方向"误解为"维度"。

v6.0 纠正为：
- 用户来时已有一个或多个**认知大方向**（不是空白）
- 产品在大方向内做**子领域拓展**，而非跨方向跳转
- "破茧"的含义从"突破到无关领域"纠正为"在大方向内突破信息茧房"
- 服务对象明确为"持续提升认知的人"，不是消遣型用户

### 1.3 核心问题

推荐算法最大化停留时长 → 用户被包裹在信息茧房中 → 即便在自己感兴趣的领域内，也只能看到算法推给他的同质化内容 → 认知在大方向内窄化。

市面上所有产品都在帮你「看更多你喜欢的」，没有一个产品帮你「在你关心的方向内，系统性地拓展到你看不到的子领域」。

**更深一层的问题**：即使是 AI 搜索/生成的内容，也可能被 GEO（Generative Engine Optimization，生成式引擎优化）污染——用户"以为在拓展视野，实际进入了一个被精心优化过的伪盲区"。

### 1.4 解决方案

- **认知大方向识别**：诊断阶段识别用户的认知大方向（不是 24 维度扫描）
- **方向内子领域树**：在大方向下构建子领域树，动态标注 high/low/none 三档接触度
- **RAG 检索层**：从实时互联网采集真实内容（播客、访谈、博客、文章），不依赖固定知识库
- **Transformer Embedding**：用 sentence-transformers 将内容编码为 384 维向量，支持语义检索
- **BM25 + Vector Hybrid**：关键词检索 + 语义检索的 RRF 融合，兼顾精确性与语义性
- **DeepSeek 教练**：基于 RAG 检索的真实内容，用教练方法论在大方向内生成个性化挑战
- **抗 GEO 三层防御**：内容源（实时互联网检索）+ 检索层（RAG）+ Prompt 层（ANTI_GEO_DIRECTIVE）

---

## 2. 五大业务护城河

### 2.1 护城河总览

```
┌──────────────────────────────────────────────────────────┐
│                    业务护城河（五层）                       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ① 实时互联网检索（最底层 · 最难复制）                     │
│     Bing Web Search API，每日信息持续更新                  │
│     不依赖固定知识库，内容始终是最新的                       │
│                                                          │
│  ② RAG 混合检索架构（算法层 · 技术壁垒）                  │
│     BM25 + Vector hybrid + RRF 融合排序                   │
│     Qdrant 作为缓存层，非持久化知识库                       │
│                                                          │
│  ③ 认知数据资产（数据层 · 用户黏性）                      │
│     用户用得越久，方向内子领域树越完整，迁移成本越高        │
│                                                          │
│  ④ 方向内拓展算法（决策层 · 技术壁垒）                    │
│     方向内拓展度 + 难度递进 + 类比拓展                     │
│     不是 sort()，是认知冲击度预测                          │
│                                                          │
│  ⑤ 教练角色（体验层 · 品牌差异化）                        │
│     认知成长教练，有方法论的长期陪伴者                     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 ① 实时互联网检索

**核心逻辑**：不使用固定知识库——所有内容来自实时互联网搜索（Bing Web Search API）。

| 维度 | 固定知识库 | 实时互联网检索（v6.0） |
|------|------------|------------|
| 内容时效 | 预采集时定格，逐日陈旧 | **每日实时更新** |
| 内容类型 | 单一（如仅学术论文） | **多元**（播客/访谈/博客/文章/纪录片） |
| 目标用户匹配 | 通用 | **持续提升认知的人** |
| 维护成本 | 需定期重新采集 | **零维护**（实时检索） |
| 可持续性 | 知识库无法长久支撑 | **可持续**（互联网是源头） |

**查询增强策略**（针对大方向内拓展）：
- 不搜裸关键词"Python"，而是搜"Python 编程范式 深度访谈 播客"
- 根据大方向自动调整：古诗→"诗论 文学批评 对谈"、股市→"行为金融学 市场历史 访谈"
- 确保检索到的是认知类内容而非 SEO 垃圾
- 检索限定在用户的大方向相关的子领域，不跨方向

### 2.3 ② RAG 混合检索架构

**核心逻辑**：BM25 关键词检索 + Vector 语义检索的 RRF 融合。Qdrant 作为缓存层（TTL 24h），非知识库。

```
用户查询（大方向 + 子领域）
   │
   ├─→ 查 Qdrant 缓存（TTL 24h）
   │       命中？→ 直接 hybrid 检索返回
   │
   ├─→ 缓存未命中 → Bing 实时搜索
   │       → embedding（sentence-transformers 384维）
   │       → 写入 Qdrant 缓存 + BM25 索引
   │
   └─→ Hybrid 检索
           BM25 关键词（精确匹配）
           + Vector 语义（语义相似）
           → RRF 融合排序（k=60）
```

**技术栈**：
- Bing Web Search API（实时互联网检索）
- Python FastAPI（:8000）
- Qdrant 向量库（内存模式，TTL 24h 缓存层，384 维余弦距离）
- sentence-transformers all-MiniLM-L6-v2（384 维，归一化 embedding）
- rank-bm25（BM25Okapi，中文字符级分词）

### 2.4 ③ 认知数据资产

**核心逻辑**：用户的认知档案越完整，越不可替代。v6.0 的资产结构围绕「认知大方向 + 方向内子领域树」组织。

| 资产 | 说明 | 积累方式 |
|------|------|---------|
| 认知大方向 | 用户自述的 1~N 个认知大方向（如 AIPM / 古诗） | 诊断识别 + 用户确认 |
| 方向内子领域树 | 每个大方向下的子领域树 + 三档接触度（high/low/none） | 诊断 + 增量更新 |
| 接触历史 | 每次阅读/对话后的子领域接触度变化（快照） | 自动更新 |
| 冲击历史 | 哪些内容真正改变了用户（1-5 星自评） | 阅读后自评 |
| 成长曲线 | 周/月/季的方向内拓展轨迹 | 自动累积 |
| 认知指纹 | 用户独特的认知画像（可对比可分享） | 派生计算 |
| 里程碑 | 首次接触某子领域、连续 7 天爆破、解锁 L3 难度等 | 事件触发 |

**数据存储策略**：
- MVP 阶段：localStorage（前端持久化）+ schema 迁移
- 进阶阶段：后端持久化（用户系统 + 数据库）
- 本版先做 localStorage，预留后端接口

### 2.5 ④ 方向内拓展算法

**核心逻辑**：不是"跨维度盲区排序"，而是"同大方向内拓展度预测"。在用户已选定的认知大方向内，找出他还没接触过（或浅接触）的子领域，按难度递进推荐。

#### 认知大方向 + 子领域树模型

```
认知大方向（用户驱动，动态识别）
   │
   ├─ 子领域 A（接触度: high）  ← 已深耕
   │   └─ 子主题 A1, A2, ...
   │
   ├─ 子领域 B（接触度: low）   ← 浅接触，可加深
   │   └─ 子主题 B1, B2, ...
   │
   └─ 子领域 C（接触度: none）  ← 完全空白，最有拓展价值
       └─ 子主题 C1, C2, ...
```

**接触度三档标注**：

| 标注 | 含义 | 判定 |
|------|------|------|
| `high` | 已深耕 | 用户主动提及、多次接触、有深度内容 |
| `low`  | 浅接触 | 偶尔提及、了解概念但未深入 |
| `none` | 完全空白 | 诊断中未提及，且不属高频子领域 |

> v6.0 移除 v5.1 的数值型暴露值（0-847）。接触度只做三档定性标注——更符合"方向内拓展"的语义，避免假精确。

#### 方向内拓展度决策

```
拓展得分 = f(接触空白度, 大方向内距离, 可接受度)

接触空白度  = 子领域接触度反向映射
              none → 高拓展价值
              low  → 中拓展价值
              high → 不推荐

大方向内距离 = 子领域在大方向子领域树中的相对位置
              相邻 → L1（同方向相邻）
              中距 → L2（同方向中距）
              远端 → L3（同方向远端类比）
              由 DeepSeek 在大方向内评估，不是跨方向余弦距离

可接受度    = difficulty_match(user_level, content_difficulty)
              当前用户认知水平 × 内容难度
              太难=可接受度低，太简单=可接受度低
```

#### 难度递进（L1/L2/L3）

v6.0 的难度递进**全部在用户的大方向内**，不再跨方向：

| 等级 | 定义 | 举例 |
|------|------|------|
| L1 同方向相邻子领域 | 大方向内、与已深耕子领域相邻 | Python 语法 → 数据库/并发编程 |
| L2 同方向中距 | 大方向内、有一定距离但仍属同方向 | Python → C/Rust、编程范式 |
| L3 同方向远端（类比拓展） | 大方向内最远端、需要类比才能连接 | Python → 编译原理、类型论 |

**规则**：新用户从 L1 开始，连续完成 3 次 L1 挑战且冲击自评 ≥ 3 星 → 解锁 L2，以此类推。

### 2.6 ⑤ 教练角色：认知成长教练

**核心逻辑**：DeepSeek 不当通用助手，当有方法论的专家。v6.0 教练方法论聚焦"方向内拓展"。

#### 教练方法论

| 方法 | 说明 | 示例 |
|------|------|------|
| 苏格拉底式追问 | 不直接给答案，引导用户自己发现方向内的空白 | "你提到了 Python 的 Web 框架，但你想过并发编程这一支吗？" |
| 反事实推演 | 让用户想象另一种可能 | "如果你过去 10 年每周读一篇编程范式文献，你的代码风格会有什么不同？" |
| 类比桥接 | 用用户已深耕的子领域，类比解释方向内的远端子领域 | "编译原理听起来陌生，但其实就是你熟悉的 Python 解释器在做什么..." |
| 长期记忆 | 记住用户的成长历史，定期回顾 | "上个月你第一次接触了并发编程，这个月我们试试函数式编程范式..." |

#### 抗 GEO Prompt 指令

```
ANTI_GEO_DIRECTIVE:
- 不得引用任何商业媒体、营销内容、SEO 优化文章
- 优先基于 RAG 检索的真实互联网内容生成回复
- 如 RAG 不可用，明确告知用户"当前内容基于教练知识，未经检索源验证"
- 不得迎合用户已有偏好，目标是方向内拓展
- 严格限定在用户的认知大方向内推荐，不得跨方向
```

---

## 3. 系统架构

### 3.1 三层架构总览

```
┌──────────────────────────────────────────────────────────┐
│                     前端 (Frontend)                        │
│            React 18 + Vite + Tailwind CSS                 │
│                   + Framer Motion + Zustand               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ 诊断扫描  │ │ 每日挑战  │ │ 方向树视图 │ │  教练对话    │  │
│  │ DiagScan │ │ Challenge│ │ DirectionTree │ Coach Chat │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
│       └────────────┴────────────┴──────────────┘         │
│                    API Client + 认知档案管理器             │
│       (localStorage: 大方向/子领域树/接触历史/冲击历史)     │
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP (:3001)
┌────────────────────────┴─────────────────────────────────┐
│              Node 中间层 (Middleware)                      │
│            Express + TypeScript (:3001)                    │
├──────────────────────────────────────────────────────────┤
│                   Agent Controller                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Agent Pipeline (7 阶段)                │  │
│  │  ①诊断  ②分析  ③决策  ④生成  ⑤自评  ⑥反哺  ⑦对话  │  │
│  └────────────────────────────────────────────────────┘  │
│         │                                    │            │
│   ┌─────┴──────┐                    ┌──────┴──────┐    │
│   │ 方向内拓展  │                    │ RAG Client  │    │
│   │   引擎     │                    │             │    │
│   └────────────┘                    └──────┬──────┘    │
│                                            │             │
└────────────────────────────────────────────┼─────────────┘
                                             │ HTTP (:8000)
┌────────────────────────────────────────────┴──────────────┐
│              Python RAG 后端 (Backend)                     │
│              FastAPI + Qdrant + BM25 (:8000)              │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  内容采集层   │  │  Embedding   │  │  混合检索    │  │
│  │ content_     │  │  Pipeline    │  │  hybrid_     │  │
│  │ sources.py   │  │ embedding.py │  │  retriever.py│  │
│  │ (Bing API)   │  │ (Transformer)│  │  (BM25+Vec)  │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │            │
│         └─────────────────┴─────────────────┘            │
│                           │                              │
│                    Qdrant 向量库                          │
│              (collection: cognitive_content)             │
│                   384 维余弦距离                          │
│                   TTL 24h 缓存层                          │
└──────────────────────────────────────────────────────────┘
                         │
                    DeepSeek API
              (认知成长教练角色)
```

### 3.2 核心设计原则

| 原则 | 说明 |
|------|------|
| **RAG + Agent 混合** | 不是纯生成，是检索增强生成——先从实时互联网检索真实内容，再让 DeepSeek 教练生成 |
| **抗 GEO 三层防御** | 内容源（实时互联网检索）+ 检索层（RAG）+ Prompt 层（ANTI_GEO_DIRECTIVE） |
| **Transformer Embedding** | sentence-transformers all-MiniLM-L6-v2，384 维归一化向量 |
| **Hybrid Retrieval** | BM25 关键词 + Vector 语义，RRF (k=60) 融合排序 |
| **认知大方向驱动** | 所有推荐限定在用户的大方向内，不跨方向 |
| **方向内拓展** | 推荐不是跨维度 sort()，是同方向内拓展度预测 |
| **三档接触度** | high / low / none 定性标注，避免假精确 |
| **教练角色统一** | DeepSeek 在所有阶段都扮演认知成长教练 |
| **难度递进** | L1→L2→L3，全部在方向内，不跨方向 |
| **反馈闭环** | 冲击自评反哺算法，成长曲线激励持续 |
| **认知档案持续积累** | 用户每次互动都更新大方向子领域树，形成数据资产 |

### 3.3 与 v5.1 的架构差异

| 组件 | v5.1 | v6.0 |
|------|------|------|
| 维度模型 | 24 个固定认知维度 | **认知大方向 + 方向内子领域树（动态）** |
| 诊断层 | 24 维暴露扫描 | **认知大方向识别 + 子领域树初始化** |
| 决策层 | 三维决策引擎（跨维度推荐） | **方向内拓展度（同方向内推荐）** |
| 接触程度 | 数值（0-847） | **三档标注（high / low / none）** |
| 热力图 | 24 维色块 | **方向树视图** |
| 难度递进 | L1/L2/L3（跨领域） | **L1/L2/L3（方向内）** |
| 架构层级 | 三层 | 三层（不变） |
| RAG 后端 | Python + Qdrant + BM25 | Python + Qdrant + BM25（不变） |
| 内容来源 | Bing 实时检索 | Bing 实时检索（不变） |
| Pipeline | 7 阶段 | 7 阶段（不变） |
| 教练方法论 | 4 种 | 4 种（不变，但聚焦方向内） |

---

## 4. Agent Pipeline 七阶段设计

### 4.1 流程图

```
用户输入 ──→ ①诊断 ──→ ②分析 ──→ ③决策 ──→ ④生成 ──→ ⑤自评 ──→ ⑥反哺 ──→ ⑦对话
              │          │          │          │          │          │          │
           多轮问诊    DeepSeek    方向内     RAG检索    用户自评   更新档案    教练
           识别大方向  构建子领域  拓展度    +DeepSeek   1-5星     调整难度    引导
                      树+三档    +难度递进   生成挑战               反哺算法
                      接触度
```

### 4.2 阶段详解

#### ① 诊断层 (Diagnosis)
- **输入**：用户与教练的多轮对话（最低 3 轮，用户自主结束）
- **输出**：用户自然语言描述 + **认知大方向（1~N 个）** + 子领域树初稿
- **实现**：前端 DiagScanPage + DeepSeek 教练对话
- **与 v5.1 差异**：从"24 维暴露扫描"改为"认知大方向识别"。教练通过对话识别用户在哪些方向上持续投入认知（如 AIPM、Python、古诗），而非套用固定维度。

#### ② 分析层 (Analysis)
- **输入**：用户自然语言描述 + 识别出的大方向
- **输出**：每个大方向的**子领域树** + 每个子领域的三档接触度（high/low/none）+ 初始难度等级
- **实现**：`llm.ts → analyzeDirections()`，由 DeepSeek 在大方向下生成子领域树并标注接触度
- **与 v5.1 差异**：从"24 维暴露值"改为"方向内子领域树 + 三档接触度"

#### ③ 决策层 (Decision)
- **输入**：大方向子领域树 + 三档接触度 + 已读历史 + 冲击历史 + 当前难度等级
- **输出**：Top 3 待拓展子领域（方向内拓展度引擎）
- **实现**：`recommender.ts → decideExpansionTargets()`
- **方向内拓展度**：接触空白度 × 大方向内距离 × 可接受度
- **与 v5.1 差异**：从"三维决策引擎（跨维度推荐）"改为"方向内拓展度（同方向内推荐）"

#### ④ 生成层 (Generation)
- **输入**：Top 3 待拓展子领域 + 用户已深耕子领域 + 难度等级
- **输出**：3 篇挑战内容（基于 RAG 检索的真实互联网内容）
- **实现**：
  - `recommender.ts → generateDailyChallenge()`：先调 RAG 检索真实内容
  - `ragClient.ts → retrieveFromRag()`：调用 Python RAG 后端
  - `llm.ts → generateChallenge()`：基于 RAG 真实内容生成挑战
- **抗 GEO**：内容来自实时互联网检索，不受搜索引擎排名优化污染
- **与 v5.1 差异**：检索限定在大方向内（如 AIPM 大方向只搜 AIPM 相关子领域），不跨方向

#### ⑤ 自评层 (Self-Assessment)
- **输入**：用户阅读后的冲击自评（1-5 星）+ 反思文字
- **输出**：冲击记录 + 难度等级调整建议
- **实现**：前端收集 + `recommender.ts → adjustDifficulty()`

#### ⑥ 反哺层 (Feedback)
- **输入**：冲击记录 + 反思文字 + 当前子领域树
- **输出**：更新后的认知档案（子领域接触度可能从 none → low → high）+ 难度调整
- **实现**：前端 localStorage 更新 + 接触度快照 + 里程碑检查

#### ⑦ 对话层 (Coach Chat)
- **输入**：用户消息 + 对话历史 + 完整认知档案（大方向 + 子领域树）
- **输出**：教练式回复（苏格拉底追问/类比桥接/反事实推演/长期记忆）
- **实现**：`llm.ts → chatWithCoach()` 返回结构化 `{ method, content }`
- **抗 GEO**：Prompt 层 ANTI_GEO_DIRECTIVE
- **方向约束**：教练对话严格限定在用户的大方向内，不引导跨方向

---

## 5. 前端架构

### 5.1 技术栈

React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion + Zustand + React Router + Lucide React

### 5.2 页面结构

```
src/
├── pages/
│   ├── DiagScanPage.tsx          # 诊断式扫描页（识别认知大方向，MIN_ROUNDS=3 + 用户自主结束）
│   ├── ChallengePage.tsx         # 每日挑战主页（+ 重新测试按钮）
│   ├── GrowthPage.tsx            # 成长曲线页
│   ├── MilestonePage.tsx         # 里程碑墙页
│   ├── DirectionTreePage.tsx     # 方向树视图（v6.0 替换 HeatmapPage）
│   └── ReaderPage.tsx            # 阅读详情+自评页
├── components/
│   ├── CoachChat.tsx             # 教练对话浮窗（结构化方法论标签）
│   ├── growth/                   # 成长可视化组件
│   ├── challenge/                # 挑战组件
│   ├── ErrorBoundary.tsx         # 错误边界
│   ├── ProtectedRoute.tsx        # 路由守卫
│   └── ui/                       # 基础UI组件
├── lib/
│   ├── apiClient.ts              # API 请求封装
│   ├── profileManager.ts         # 认知档案管理器（v6.0 schema: 大方向+子领域树+三档接触度）
│   └── utils.ts
└── store/
    └── useAppStore.ts            # Zustand 状态管理
```

### 5.3 路由

| 路径 | 页面 | 守卫 | 说明 |
|------|------|------|------|
| `/scan` | DiagScanPage | 无 | 诊断式扫描（识别大方向），首次访问跳转 |
| `/` | ChallengePage | 需档案 | 每日认知挑战（+ 重新测试按钮） |
| `/growth` | GrowthPage | 需档案 | 成长曲线 |
| `/milestones` | MilestonePage | 需档案 | 里程碑墙 |
| `/directions` | DirectionTreePage | 需档案 | 方向树视图（v6.0 替换 /heatmap） |
| `/read/:id` | ReaderPage | 需档案 | 阅读+冲击自评 |

### 5.4 方向树视图 v6.0 设计

**重构原因**：v5.1 的 24 维色块热力图基于固定维度，不符合"方向内拓展"的语义。用户看不到自己在大方向内的子领域覆盖情况。

**v6.0 改进**：
- 以**认知大方向**为根节点，展开为**子领域树**
- 每个子领域节点显示：子领域名称 + 接触度标签（high/low/none）+ 接触次数
- 三档接触度用三种视觉强度区分：
  - `high`：实心填充（已深耕）
  - `low`：半透明（浅接触）
  - `none`：虚线边框（完全空白，最有拓展价值）
- 点击子领域节点：展开子主题列表 + 历史接触记录
- 底部统计：大方向数 / 已深耕子领域数 / 浅接触数 / 空白子领域数
- 支持多个大方向并列展示（用户可有多个认知大方向）

**v6.0 视觉示意**：

```
方向树视图
├── 📌 Python（大方向）
│   ├── 语法基础         [high]  接触 12 次
│   ├── Web 框架         [high]  接触 8 次
│   ├── 数据库           [low]   接触 2 次
│   ├── 并发编程         [none]  ← 推荐起点
│   ├── 函数式范式       [none]
│   └── 编译原理         [none]  ← L3 远端
│
├── 📌 AIPM（大方向）
│   ├── 产品策略         [high]  接触 15 次
│   ├── 用户研究         [low]   接触 3 次
│   ├── 增长方法论       [none]  ← 推荐起点
│   └── 商业模型         [none]
│
└── + 添加新大方向
```

### 5.5 重新测试功能

**需求**：用户完成诊断后应能重新选择/重新测试。

**实现**：
- ChallengePage 右上角添加"重新测试"按钮
- 点击后弹出二次确认弹窗（避免误操作）
- 确认后清除 localStorage 档案并跳转到 `/scan`

### 5.6 认知档案管理器 (profileManager.ts) — v6.0 schema

```typescript
// v6.0: 大方向 + 子领域树 + 三档接触度
type ContactLevel = 'high' | 'low' | 'none';

interface SubDomain {
  id: string;
  name: string;                       // 子领域名称
  contactLevel: ContactLevel;         // 三档接触度
  contactCount: number;               // 接触次数（用于细节展示）
  parentDirection: string;            // 所属大方向 ID
  topics: string[];                   // 子主题列表
}

interface CognitiveDirection {
  id: string;
  name: string;                       // 大方向名称（如 "Python"、"古诗"）
  createdAt: string;
  subDomains: SubDomain[];            // 方向内子领域树
}

interface CognitiveProfile {
  profileVersion: number;             // schema 版本，支持迁移
  userId: string;
  nickname: string;
  createdAt: string;
  directions: CognitiveDirection[];   // 认知大方向列表（1~N 个）
  difficultyLevel: 'L1' | 'L2' | 'L3';
  contactHistory: ContactSnapshot[];  // 接触度变化快照
  impactHistory: ImpactRecord[];      // 上限 100 条
  impactAggregate: { totalReads; totalSubDomains; avgImpact };
  milestones: Milestone[];
  readHistory: string[];
  coachMemory: { lastReviewedAt; keyInsights };
}
```

**schema 迁移**：v5.1 的 24 维数值档案在 v6.0 加载时自动迁移——将原维度数据归档为 `legacy_24dim` 字段，并触发用户重新诊断识别大方向（因为维度无法直接映射到大方向）。

---

## 6. 后端架构

### 6.1 Node 中间层目录结构

```
api/
├── index.ts                     # Vercel 入口
├── server.ts                    # 本地开发服务器（:3001）
├── _core/
│   └── app.ts                   # Express 应用配置
├── _routes/
│   └── agent.ts                 # Agent API 路由（7个端点）
├── _agent/
│   ├── llm.ts                   # DeepSeek 教练客户端（运行时读取 API key）
│   ├── analyzer.ts              # ②分析层（识别大方向 + 构建子领域树）
│   ├── recommender.ts           # ③决策层（方向内拓展度 + RAG 检索）
│   ├── ragClient.ts             # RAG 后端客户端
│   ├── assessor.ts              # ⑤自评层
│   └── coach.ts                 # ⑦对话层（结构化方法论返回）
└── _knowledge/
    └── directions.ts            # v6.0: 大方向元数据模板（非固定维度，仅辅助识别）
```

### 6.2 Python RAG 后端目录结构

```
backend/
├── main.py                      # FastAPI 入口（:8000）
├── config.py                    # 配置（模型参数、Bing API key）
├── content_sources.py           # 内容采集层（Bing Web Search API）
├── embedding.py                 # Embedding 服务（sentence-transformers, Windows 兼容）
├── qdrant_client.py             # Qdrant 向量库客户端（内存模式, 384维余弦距离, TTL 24h）
├── bm25_retriever.py            # BM25 关键词检索（BM25Okapi, 中文字符级分词）
├── hybrid_retriever.py          # 混合检索（RRF 融合, k=60）
├── ingest.py                    # 内容入库（Bing 检索结果 → embedding → Qdrant + BM25）
├── requirements.txt             # Python 依赖
└── models/                      # 本地模型权重（.gitignore）
    └── all-MiniLM-L6-v2/
```

### 6.3 API 端点

#### Node 中间层（:3001）

| Method | Route | 阶段 | 用途 |
|--------|-------|------|------|
| POST | `/api/agent/diagnose` | ① | 诊断式扫描（识别认知大方向） |
| POST | `/api/agent/analyze` | ② | 分析大方向 + 构建子领域树 + 三档接触度 |
| POST | `/api/agent/challenge` | ③④ | 每日挑战（方向内拓展度+RAG检索+生成） |
| POST | `/api/agent/assess` | ⑤⑥ | 提交冲击自评+反哺 |
| POST | `/api/agent/map` | - | 方向树数据（纯数据） |
| POST | `/api/agent/growth` | - | 成长曲线数据 |
| POST | `/api/agent/coach` | ⑦ | 教练对话（方法论引导，方向内） |

#### Python RAG 后端（:8000）

| Method | Route | 用途 |
|--------|-------|------|
| GET | `/health` | 健康检查 |
| POST | `/retrieve` | 混合检索（BM25+Vector+RRF），限定在大方向内 |
| POST | `/ingest` | 内容入库（Bing检索→embedding→Qdrant+BM25） |
| GET | `/collections` | Qdrant collection 信息 |

### 6.4 RAG 检索实现

```python
# backend/hybrid_retriever.py 核心逻辑
# v6.0: 检索限定在用户的大方向 + 子领域内

def hybrid_search(query: str, direction: str, sub_domain: str, limit: int = 5):
    # query 已包含大方向 + 子领域增强关键词
    # 1. BM25 关键词检索
    bm25_results = bm25_retriever.search(query, limit=limit * 2)

    # 2. Vector 语义检索
    query_vec = embedding.embed(query)
    vec_results = qdrant_client.search(query_vec, limit=limit * 2)

    # 3. RRF 融合排序
    rrf_scores = {}
    for rank, doc in enumerate(bm25_results):
        rrf_scores[doc['id']] = rrf_scores.get(doc['id'], 0) + 1 / (60 + rank + 1)
    for rank, doc in enumerate(vec_results):
        rrf_scores[doc['id']] = rrf_scores.get(doc['id'], 0) + 1 / (60 + rank + 1)

    # 4. 按 RRF 分数排序，返回 top-N
    sorted_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)
    return sorted_ids[:limit]
```

### 6.5 实时互联网内容采集

```python
# backend/content_sources.py
# v6.0: Bing Web Search API（替代 v5.0 的 arXiv）

BING_API_ENDPOINT = "https://api.bing.microsoft.com/v7.0/search"

async def fetch_bing(query: str, direction: str, max_results: int = 10):
    """
    query: 已增强的查询（大方向 + 子领域 + 认知类关键词）
    direction: 用户认知大方向（用于结果过滤，防止跨方向）
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            BING_API_ENDPOINT,
            headers={"Ocp-Apim-Subscription-Key": BING_API_KEY},
            params={"q": query, "count": max_results, "mkt": "zh-CN"}
        )
        # 返回 [{title, description, url, source_type: "bing", direction}]
```

### 6.6 Windows 兼容性

| 问题 | 解决方案 |
|------|---------|
| HuggingFace.co 被墙 | `HF_ENDPOINT=https://hf-mirror.com` 镜像站 |
| Windows symlink 权限 | `snapshot_download(local_dir=..., local_dir_use_symlinks=False)` |
| Bing API 中文搜索 | 直接支持中文查询，无需英文关键词映射 |
| pip install Rust 编译失败 | conda 环境 `--system-site-packages` 创建 venv |

---

## 7. 认知大方向 + 子领域树模型

> v6.0 移除 v5.1 的「24 个固定认知维度」章节。本节描述新的维度模型。

### 7.1 模型概述

v6.0 不再使用固定的 24 个认知维度（entertainment / humor / beauty / auto / sports 等）。取而代之的是**动态的、用户驱动的「认知大方向 + 方向内子领域树」模型**：

- **认知大方向**：由用户在诊断阶段自述，DeepSeek 识别确认。如 "Python 编程"、"古诗"、"股市"、"AIPM"、"思考方法论"。一个用户可有 1~N 个大方向。
- **方向内子领域树**：每个大方向下，由 DeepSeek 动态生成子领域树。子领域树是开放的、可扩展的，不预设固定列表。
- **三档接触度**：每个子领域标注 `high` / `low` / `none`，定性而非定量。

### 7.2 与 v5.1 24 维度模型的对比

| 维度 | v5.1（24 固定维度） | v6.0（大方向 + 子领域树） |
|------|------|------|
| 维度来源 | 预设的 24 个固定维度（硬编码） | **用户驱动，动态识别** |
| 维度数量 | 固定 24 个 | **开放，按用户大方向动态生成** |
| 维度内容 | entertainment / humor / beauty / auto / sports 等功能性维度 | **认知性子领域**（如 Python 下的并发编程、编译原理） |
| 推荐范围 | 跨维度（AIPM → 美妆） | **方向内**（Python → 并发编程） |
| 接触度 | 数值（0-847） | **三档（high/low/none）** |
| 适应性 | 所有用户套同一套维度 | **每个用户的子领域树不同** |

### 7.3 大方向识别规则

DeepSeek 在诊断阶段通过对话识别用户的认知大方向，判定标准：
1. **持续性**：用户在该方向上有持续投入（学习/实践/阅读）
2. **认知性**：该方向是认知性的（能拓展视野、深化理解），而非纯功能消遣
3. **自述性**：由用户主动提及，而非教练引导套用

**反例（不应识别为大方向）**：
- "我喜欢看搞笑视频" → 这是功能消遣，不是认知大方向
- "我偶尔刷美妆" → 这是消费行为，不是认知提升

**正例（应识别为大方向）**：
- "我在学 Python" → 编程认知大方向
- "我读《思考，快与慢》" → 行为经济学/认知心理学大方向
- "我研究唐诗" → 古诗/文学大方向
- "我关注股市" → 投资认知大方向

---

## 8. UI 设计规范

### 8.1 设计参考

- **shadcn/ui** — 组件设计语言
- **Magic UI** — 动画组件
- **Linear.app** — 极简暗色 + 成长曲线设计
- **Obsidian Graph View** — 方向树视图的节点关系视觉参考

### 8.2 配色

| 用途 | 色值 | 说明 |
|------|------|------|
| 主色 | `#ff4d4d` | 爆破/突破 |
| 辅色 | `#00d4ff` | 待拓展/空白子领域 |
| L1 难度 | `#4ade80` | 绿色（同方向相邻，容易接受） |
| L2 难度 | `#ffd23d` | 黄色（同方向中距，中等冲击） |
| L3 难度 | `#ff4d4d` | 红色（同方向远端，高冲击） |
| 背景 | `#0a0a0f` | 极深灰 |
| 成长曲线 | `#00d4ff` | 蓝色（方向内覆盖度） |
| 冲击曲线 | `#ff4d4d` | 红色（冲击分） |
| 接触度 high | 实心填充 | 已深耕子领域 |
| 接触度 low | 半透明 | 浅接触子领域 |
| 接触度 none | 虚线边框 | 空白子领域，最有拓展价值 |

### 8.3 方向树视图 v6.0 设计要点

- **以大方向为根**：每个大方向独立一棵树
- **子领域节点**：名称 + 接触度标签（high/low/none）+ 接触次数
- **三档视觉强度**：实心 / 半透明 / 虚线，一眼可识别
- **点击交互**：展开子主题列表 + 历史接触记录
- **多方向并列**：支持用户有多个大方向，并列展示
- **底部统计**：大方向数 / 已深耕数 / 浅接触数 / 空白数
- **添加大方向入口**：底部"+"按钮，可手动添加新大方向

---

## 9. 部署

### 9.1 本地开发

```bash
# 1. 启动 Python RAG 后端（:8000）
cd backend
$env:HF_ENDPOINT="https://hf-mirror.com"
$env:BING_API_KEY="your_bing_api_key"
.venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 2. 启动 Node 中间层 + 前端
npm run dev
# 前端 :5173，Node 中间层 :3001
```

### 9.2 生产部署（Vercel）

- 前端 + Node 中间层：Vercel
- Python RAG 后端：Vercel Python Serverless 或独立部署
- 环境变量：`DEEPSEEK_API_KEY`、`RAG_BASE_URL`、`BING_API_KEY`

---

## 10. 错误处理

- 不静默降级，失败时报错
- RAG 检索失败时降级到纯 DeepSeek 生成（前端透明显示 `sourceType: "deepseek_fallback"`）
- ErrorBoundary 包裹整个应用
- 大方向识别失败时，引导用户重新描述而非套用固定方向

---

## 11. 实现路线图

### Phase 1：PRD v6.0 评审（当前）
- [x] 重写 PRD v6.0（移除 24 维，新增大方向 + 子领域树模型）
- [ ] 用户评审确认

### Phase 2：模型层重构
- [ ] 移除 `_knowledge/domains.ts` 中的 24 维元数据
- [ ] 新增 `_knowledge/directions.ts` 大方向识别辅助模板
- [ ] 重写 `analyzer.ts`：从 `analyzeAllDimensions()` → `analyzeDirections()`
- [ ] 重写 `recommender.ts`：从 `decideBlindSpots()` → `decideExpansionTargets()`

### Phase 3：前端重构
- [ ] 新增 `DirectionTreePage.tsx`（替换 `HeatmapPage.tsx`）
- [ ] 更新路由 `/heatmap` → `/directions`
- [ ] 重构 `profileManager.ts`：v6.0 schema（大方向 + 子领域树 + 三档接触度）
- [ ] schema 迁移：v5.1 旧档案 → v6.0（归档 legacy + 触发重诊断）
- [ ] 更新 `DiagScanPage`：诊断目标从"24 维扫描"改为"大方向识别"

### Phase 4：RAG 后端适配
- [ ] `content_sources.py`：arXiv → Bing Web Search API（如未完成）
- [ ] `hybrid_retriever.py`：增加 `direction` + `sub_domain` 参数，限定检索范围
- [ ] `ingest.py`：移除 24 维英文关键词映射

### Phase 5：教练 Prompt 更新
- [ ] `llm.ts`：更新 system prompt，强调方向内拓展
- [ ] `coach.ts`：4 种方法论示例改为方向内场景
- [ ] ANTI_GEO_DIRECTIVE 增加"不跨方向"约束

### Phase 6：测试部署
- [ ] 构建测试（npm run build exit 0）
- [ ] 端到端验证：AIPM 用户诊断 → 大方向识别 → 子领域树 → 方向内推荐（不跨到美妆/体育）
- [ ] schema 迁移测试：v5.1 旧档案加载不崩溃
- [ ] 推送 GitHub
- [ ] Vercel 部署

---

## 12. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0 | 2026-07-04 | 初始MVP：热力图+硬编码内容 |
| v2.0 | 2026-07-05 | 部署Vercel，接入DeepSeek API |
| v3.0 | 2026-07-06 | 架构重构：移除知识库，纯生成式Agent（**错误决策**） |
| v4.0 | 2026-07-07 | 护城河升级：认知成长教练 + 三维决策 + 成长可视化 |
| v4.1 | 2026-07-08 | DeepSeek三维决策引擎实现 + 数据资产 + 抗GEO Prompt |
| v5.0 | 2026-07-08 | 恢复 RAG + Transformer + Agent 混合架构：Python FastAPI + Qdrant + BM25 hybrid + arXiv 抗 GEO |
| v5.1 | 2026-07-08 | 纠正 v5.0：arXiv 固定知识库 → Bing 实时互联网检索 + Qdrant 缓存层（TTL 24h） |
| **v6.0** | **2026-07-09** | **核心纠正：移除 24 个固定认知维度 → 认知大方向 + 方向内子领域树；推荐逻辑从跨领域盲区突破改为方向内拓展；接触度从数值改为三档（high/low/none）；热力图改为方向树视图；定位纠正为"服务持续提升认知的人"** |
