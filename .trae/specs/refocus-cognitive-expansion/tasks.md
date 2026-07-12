# Tasks

- [x] Task 1: 重写 PRD v6.0 — 纠正产品定位为"服务持续提升认知的人"
  - [x] SubTask 1.1: 移除"24个认知维度"和固定暴露值模型
  - [x] SubTask 1.2: 新增"认知大方向 + 方向内子领域"模型描述
  - [x] SubTask 1.3: 推荐逻辑从"盲区突破（跨领域）"改为"方向内拓展（同大方向内）"
  - [x] SubTask 1.4: 产品定位纠正：服务对象为"持续提升认知的人"，推荐方向在用户既定方向内拓展

- [x] Task 2: 移除固定 24 维度模型，改为动态方向树
  - [x] SubTask 2.1: 重构 `api/_knowledge/domains.ts`，移除 COGNITIVE_DIMENSIONS 硬编码数组
  - [x] SubTask 2.2: 新增 `CognitiveDirection` 和 `SubfieldNode` 接口定义
  - [x] SubTask 2.3: 提供方向树占位逻辑（由 LLM 在诊断时动态填充）

- [x] Task 3: 诊断层改为"认知大方向识别"
  - [x] SubTask 3.1: 重构 `api/_agent/llm.ts` 诊断 prompt，从"扫描24维"改为"识别1-3个认知大方向"
  - [x] SubTask 3.2: 方向不明确时用苏格拉底式追问引导（"你最近在读什么书？做什么工作？"）
  - [x] SubTask 3.3: `DiagScanPage.tsx` 适配：对话目标从"暴露扫描"改为"方向识别"

- [x] Task 4: 分析层改为"方向内子领域接触图"
  - [x] SubTask 4.1: 重构 `api/_agent/analyzer.ts`，`AnalysisResult` 从 24 维 exposure Map 改为 directions 数组
  - [x] SubTask 4.2: 重构 `api/_agent/llm.ts` 的 `analyzeAllDimensions`，输出子领域树（已接触/未接触）
  - [x] SubTask 4.3: 接触程度从数值（0-847）改为三档标注（high/low/none）

- [x] Task 5: 决策层改为"方向内拓展推荐"
  - [x] SubTask 5.1: 重构 `api/_agent/recommender.ts`，从跨维度推荐改为方向内推荐
  - [x] SubTask 5.2: 推荐逻辑改为"找方向内认知相邻但未接触的子领域"
  - [x] SubTask 5.3: 难度递进改为：L1=同方向相邻子领域 / L2=同方向中距 / L3=同方向远端（类比拓展）
  - [x] SubTask 5.4: 移除 FALLBACK_DISTANCE 矩阵和 DIMENSION_CATEGORY 映射

- [x] Task 6: 搜索 API 集成（API 由开发者添加）
  - [x] SubTask 6.1: `backend/config.py` 新增搜索 API 配置（BING_API_KEY / TAVILY_API_KEY 备选）
  - [x] SubTask 6.2: `backend/content_sources.py` 搜索查询从维度关键词改为方向内子领域
  - [x] SubTask 6.3: `backend/ingest.py` dimension_id 改为 direction + subfield
  - [x] SubTask 6.4: `.env` 新增搜索 API key 配置项

- [x] Task 7: 前端适配
  - [x] SubTask 7.1: `HeatmapPage.tsx` 从 24 维色块改为方向树视图（按大方向分组 → 子领域列表）
  - [x] SubTask 7.2: `ChallengePage.tsx` 挑战卡展示从"维度名"改为"方向 > 子领域"
  - [x] SubTask 7.3: `profileManager.ts` 认知档案结构从 24 维 exposure 改为 directions + subfields

- [x] Task 8: 构建验证 + 启动服务
  - [x] SubTask 8.1: `npm run build` 零错误
  - [x] SubTask 8.2: 启动三层服务（Python :8000 / Node :3001 / 前端 :5174）
  - [x] SubTask 8.3: 验证诊断→分析→推荐链路不再出现美妆/体育/娱乐等跨方向推荐

# Task Dependencies
- Task 2 → Task 3, Task 4（接口定义先行）✅
- Task 3 → Task 4（诊断识别方向后才能分析子领域）✅
- Task 4 → Task 5（分析出子领域接触图后才能做方向内推荐）✅
- Task 5 → Task 7（决策层改好后前端才能适配展示）✅
- Task 6 可与 Task 3-5 并行 ✅
- Task 1（PRD）可与所有 Task 并行 ✅
- Task 8 依赖全部完成后 ✅
