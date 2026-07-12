# Checklist

## PRD 文档
- [x] PRD v6.0 已移除"24个认知维度"和固定暴露值模型
- [x] PRD v6.0 新增"认知大方向 + 方向内子领域"模型描述
- [x] PRD v6.0 推荐逻辑从"盲区突破（跨领域）"改为"方向内拓展（同大方向内）"
- [x] PRD v6.0 产品定位纠正为"服务持续提升认知的人"

## 架构变更
- [x] `api/_knowledge/domains.ts` 已移除 COGNITIVE_DIMENSIONS 硬编码数组
- [x] 新增 `CognitiveDirection` 和 `SubfieldNode` 接口定义
- [x] 接触程度从数值（0-847）改为三档标注（high/low/none）

## 诊断层
- [x] 诊断 prompt 从"扫描24维"改为"识别1-3个认知大方向"
- [x] 方向不明确时用苏格拉底式追问引导
- [x] `DiagScanPage.tsx` 对话目标已适配方向识别

## 分析层
- [x] `analyzer.ts` 的 `AnalysisResult` 从 24 维 exposure Map 改为 directions 数组
- [x] `llm.ts` 分析输出子领域树（已接触/未接触）
- [x] 不再使用固定维度 + exposure 数值

## 决策层
- [x] `recommender.ts` 从跨维度推荐改为方向内推荐
- [x] 推荐逻辑为"找方向内认知相邻但未接触的子领域"
- [x] 难度递进：L1=同方向相邻 / L2=同方向中距 / L3=同方向远端（类比拓展）
- [x] 已移除 FALLBACK_DISTANCE 矩阵和 DIMENSION_CATEGORY 映射

## 搜索 API
- [x] `backend/config.py` 新增搜索 API 配置（Bing + Tavily 双支持）
- [x] `backend/content_sources.py` 搜索查询从维度关键词改为方向内子领域
- [x] `.env` 新增搜索 API key 配置项（BING_API_KEY + TAVILY_API_KEY）

## 前端适配
- [x] `HeatmapPage.tsx` 从 24 维色块改为方向树视图
- [x] `ChallengePage.tsx` 挑战卡展示从"维度名"改为"方向 > 子领域"
- [x] `profileManager.ts` 认知档案结构已适配（schema v6 + 迁移）

## 验证
- [x] `npm run build` 零错误
- [x] 三层服务启动成功（Python :8000 / Node :3001 / 前端 :5174）
- [x] 诊断→分析→推荐链路不再出现美妆/体育/娱乐等跨方向推荐
- [x] 推荐内容在用户大方向内（如 Python 用户 → 推荐 C/Rust/算法思想，而非美妆/体育）
