// ===== Agent API — 纯生成式，无知识库 =====
// 无状态：所有数据存在前端 localStorage，每次请求带上 exposure
// 无知识库：所有内容由 DeepSeek 动态生成

import { Router, Request, Response } from "express";
import { analyzeExposure } from "../_agent/analyzer.js";
import { generateDailyFeed, getContentDetailForUser } from "../_agent/recommender.js";
import { COGNITIVE_DIMENSIONS } from "../_knowledge/domains.js";
import { chatWithAssistant, isApiKeyConfigured } from "../_agent/llm.js";

const router = Router();

// 扫描：①感知 → ②分析 → 返回 exposure map
router.post("/scan", async (req: Request, res: Response) => {
  const { nickname, input } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const exposure = input?.trim()
      ? await analyzeExposure(input.trim())
      : new Map(COGNITIVE_DIMENSIONS.map((d) => [d.id, d.count]));

    const map = COGNITIVE_DIMENSIONS.map((d) => ({
      ...d,
      userCount: exposure.get(d.id) ?? d.count,
      isBlindSpot: (exposure.get(d.id) ?? d.count) < 6,
    }));

    const blindSpotCount = map.filter((d) => d.isBlindSpot).length;
    const highExposureCount = map.filter((d) => d.userCount >= 501).length;

    res.json({
      success: true,
      data: {
        userId: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        nickname: nickname || "探索者",
        exposure: Object.fromEntries(exposure),
        blindSpotCount,
        highExposureCount,
        map,
      },
    });
  } catch (err: any) {
    console.error("[Agent] scan error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 每日推送：③决策 → ④生成 → 返回 DeepSeek 动态生成的内容
router.post("/daily", async (req: Request, res: Response) => {
  const { exposure, readContentIds } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );
    const result = await generateDailyFeed(expMap, readContentIds || [], 3);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Agent] daily error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 内容详情：④生成 → 由 DeepSeek 为单个维度动态生成
router.post("/content", async (req: Request, res: Response) => {
  const { contentId, exposure } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );
    const result = await getContentDetailForUser(contentId, expMap);
    if (!result) {
      res.status(404).json({ success: false, error: "维度不存在" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Agent] content error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 认知地图：纯数据，不需要 DeepSeek
router.post("/map", (req: Request, res: Response) => {
  const { exposure } = req.body;
  const expMap = new Map<string, number>(
    Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
  );
  const map = COGNITIVE_DIMENSIONS.map((d) => ({
    ...d,
    userCount: expMap.get(d.id) ?? d.count,
    isBlindSpot: (expMap.get(d.id) ?? d.count) < 30,
  }));
  res.json({ success: true, data: map });
});

// 智能聊天：⑤交互 → DeepSeek 多轮对话
router.post("/chat", async (req: Request, res: Response) => {
  const { message, history, exposure } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );
    const reply = await chatWithAssistant(
      message || "",
      history || [],
      expMap
    );
    res.json({ success: true, data: { reply } });
  } catch (err: any) {
    console.error("[Agent] chat error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
