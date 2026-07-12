# 重新聚焦认知拓展方向（Refocus Cognitive Expansion）Spec

## Why

当前系统用固定的 24 个"认知维度"（娱乐/搞笑/美妆/汽车/体育/物理/天文…），把推荐理解为"找用户没接触过的维度"。结果是：一个持续提升认知的 AIPM 用户，聊完天后被推荐美妆、汽车、体育——完全跑偏。

用户的核心诉求是：**服务持续提升自身认知的人，在他们既定的认知大方向内（如 AIPM / Python / 古诗 / 股市 / 思考方法论）拓展视野，而非跳到搞笑段子、美妆等功能方向。**

举例：
- 学 Python 的用户 → 推荐 C/C++/Rust/编程范式（同属编程认知，类比拓展）
- 读《思考，快与慢》的用户 → 推荐其他行为经济学/认知心理学顶级观点（同属认知方法论，拓展边界）
- 学古诗的用户 → 推荐诗论/文学批评/其他朝代诗歌/中外对比
- 关注股市的用户 → 推荐行为金融学/市场历史/量化思维/风险管理

**核心原则**：先确立用户的"大致拓展方向"，再在该方向内覆盖未接触的认知盲区——而非直接跨方向推荐。

## What Changes

### 架构级变更

- **BREAKING** 移除固定 24 维度模型（`domains.ts` 中的 entertainment/humor/beauty/auto/sports 等）
- **BREAKING** 诊断层从"24维暴露扫描"改为"认知大方向识别"
- **BREAKING** 决策层从"盲区度×冲击度×可接受度（跨维度推荐）"改为"方向内拓展度（同方向内推荐）"
- 新增"认知大方向 + 方向内子领域树"动态模型
- 分析层在每个大方向内识别"已接触子领域"和"未接触子领域"
- 搜索 API 集成：实时检索子领域内的播客/访谈/深度内容（API 由开发者添加，备选 Bing / Tavily）

### 文档级变更

- **BREAKING** 重写 PRD 文档为 v6.0：纠正产品定位为"服务持续提升认知的人"
- 移除"24个认知维度"相关描述
- 改为"认知大方向 + 方向内子领域"模型
- 推荐逻辑从"盲区突破（跨领域）"改为"方向内拓展（同大方向内）"

### 不变的部分

- 三层架构：前端 → Node 中间层 → Python RAG 后端 + DeepSeek
- Qdrant 作为实时检索缓存层（TTL 24h），非持久化知识库
- BM25 + Vector hybrid retrieval（RRF 融合）
- 7 阶段 Pipeline
- 教练角色 + 4 种方法论（苏格拉底/类比/反事实/记忆）
- 难度递进 L1/L2/L3
- 认知档案 localStorage 持久化

## Impact

- **Affected specs**: PRD v5.1 全部章节需重写为 v6.0
- **Affected code**:
  - `api/_knowledge/domains.ts` — 移除固定 24 维度，改为动态方向树
  - `api/_agent/analyzer.ts` — 从 24 维暴露扫描改为方向识别 + 子领域分析
  - `api/_agent/recommender.ts` — 从跨维度推荐改为方向内拓展
  - `api/_agent/llm.ts` — 诊断/分析/生成 prompt 全部重写
  - `backend/content_sources.py` — 搜索查询从维度关键词改为方向内子领域
  - `backend/ingest.py` — dimension_id 改为 direction + subfield
  - `backend/config.py` — 移除 COGNITIVE_DIMENSIONS，新增搜索 API 配置
  - `src/pages/DiagScanPage.tsx` — 诊断对话目标从"扫描维度"改为"识别方向"
  - `src/pages/HeatmapPage.tsx` — 从 24 维热力图改为方向树视图
  - `src/pages/ChallengePage.tsx` — 挑战卡展示从"维度名"改为"方向内子领域"
  - `.trae/documents/PRD.md` — 全面重写 v6.0

## ADDED Requirements

### Requirement: 认知大方向识别

系统 SHALL 在诊断阶段识别用户的 1-3 个"认知大方向"（如 AIPM / Python 编程 / 古诗 / 股市投资 / 思考方法论），而非扫描固定 24 维度。

#### Scenario: 识别单个大方向
- **WHEN** 用户在诊断对话中描述自己正在学 Python
- **THEN** 系统识别"Python 编程"为认知大方向，并生成该方向下的子领域树（如 Python基础/Web框架/数据科学/算法思想/编程范式/其他语言类比）

#### Scenario: 识别多个大方向
- **WHEN** 用户描述自己关注"AIPM 工作 + 思考方法论"
- **THEN** 系统识别两个大方向，各自生成子领域树

#### Scenario: 方向不明确时引导
- **WHEN** 用户描述过于模糊（如"我想提升认知"）
- **THEN** 教练用苏格拉底式追问引导用户明确大方向（"你最近在读什么书？做什么工作？在思考什么问题？"）

### Requirement: 方向内子领域树

系统 SHALL 为每个认知大方向动态生成子领域树，标注用户"已接触"和"未接触"的子领域。

#### Scenario: 生成子领域树
- **WHEN** 识别到大方向"Python 编程"
- **THEN** LLM 生成子领域树：Python基础(已接触) / Web框架(已接触) / 数据科学(未接触) / 算法思想(未接触) / 编程范式(未接触) / 类比语言:C/Rust/Haskell(未接触)

#### Scenario: 标注接触程度
- **WHEN** 用户在诊断中提到"我读了《思考，快与慢》"
- **THEN** 在"思考方法论"大方向下，标注"系统1/系统2(已接触)"，"前景理论(未接触)"，"锚定效应(未接触)"等子领域

### Requirement: 方向内拓展推荐

系统 SHALL 只在用户的认知大方向内推荐内容，不跨方向推荐。

#### Scenario: 同方向内推荐
- **WHEN** 用户大方向是"Python 编程"，已接触 Python基础和Web框架
- **THEN** 推荐子领域为"数据科学 / 算法思想 / 编程范式 / 类比语言:C/Rust"，而非"美妆/体育/娱乐"

#### Scenario: 类比拓展
- **WHEN** 用户学 Python 但未接触过 C/C++
- **THEN** 推荐内容包含"从 Python 到 C：内存管理的认知差异"等类比拓展内容

### Requirement: 实时互联网检索集成

系统 SHALL 集成搜索 API 实时检索方向内子领域的播客/访谈/深度内容。

#### Scenario: 搜索 API 可用
- **WHEN** 用户请求挑战，大方向"古诗"，子领域"诗论"
- **THEN** 系统调用搜索 API 检索"古诗 诗论 播客 访谈 深度解读"，返回实时互联网内容

#### Scenario: API 降级
- **WHEN** 搜索 API key 未配置或调用失败
- **THEN** 降级到 DeepSeek 基于训练数据生成，并透明标注 `sourceType: "deepseek_fallback"`

## MODIFIED Requirements

### Requirement: 诊断层（Diagnosis）

诊断对话目标从"扫描 24 维暴露值"改为"识别认知大方向 + 方向内已接触子领域"。

- **输入**：用户与教练的多轮对话（最低 3 轮，用户自主结束）
- **输出**：1-3 个认知大方向 + 每个方向的子领域树（已接触/未接触标注）
- **教练引导**：当用户方向不明确时，用苏格拉底式追问引导（"你最近在读什么书？做什么工作？在思考什么问题？"）

### Requirement: 分析层（Analysis）

分析层从"生成 24 维暴露值"改为"构建方向内子领域接触图"。

- **输入**：用户自然语言描述
- **输出**：`{ directions: [{ name, subfields: [{ name, exposure: "high"|"low"|"none" }] }] }`
- **不再使用**：固定 24 维度 + exposure 数值

### Requirement: 决策层（Decision）

决策层从"三维决策引擎（盲区度×冲击度×可接受度）跨维度推荐"改为"方向内拓展度推荐"。

- **输入**：方向内子领域接触图
- **输出**：Top 3 未接触子领域（在用户大方向内）
- **推荐逻辑**：找"认知相邻但未接触"的子领域，而非跨方向找盲区
- **难度递进**：L1=同方向相邻子领域 / L2=同方向中距子领域 / L3=同方向远端子领域（类比拓展）

### Requirement: 认知热力图

热力图从"24 维色块"改为"方向树视图"。

- 按认知大方向分组
- 每个方向下显示子领域列表
- 每个子领域标注：已接触（绿）/ 偶尔接触（黄）/ 未接触（蓝）
- 点击子领域查看详情

## REMOVED Requirements

### Requirement: 固定 24 个认知维度

**Reason**: 硬编码的 entertainment/humor/beauty/auto/sports 等维度导致推荐方向跑偏——AIPM 用户被推荐美妆、体育。用户的认知盲区应在其大方向内动态识别，而非用固定维度表。
**Migration**: 改为 LLM 在诊断时动态生成"认知大方向 + 子领域树"。

### Requirement: 三维决策引擎的跨维度推荐

**Reason**: "盲区度×冲击度×可接受度"计算的是跨维度认知距离，导致推荐完全不相干的领域。正确逻辑是在用户大方向内找未接触的子领域。
**Migration**: 改为"方向内拓展度"——同方向内找认知相邻但未接触的子领域。

### Requirement: 暴露值数值模型（exposure count 0-847）

**Reason**: 硬编码的暴露值（娱乐847/美妆412/体育87）是假数据，直接污染了推荐结果。真实的接触程度应由 LLM 从对话中推断（high/low/none 三档），而非编造数值。
**Migration**: 改为 `exposure: "high"|"low"|"none"` 三档标注。
