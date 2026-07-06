// ===== Agent API — 无状态版 =====
// 所有数据存在前端 localStorage，每次请求带上 exposure

import { Router, Request, Response } from "express";
import { analyzeExposure } from "../_agent/analyzer.js";
import { generateDailyFeed, getContentDetailForUser } from "../_agent/recommender.js";
import { COGNITIVE_DIMENSIONS, getDimensionById } from "../_knowledge/domains.js";
import { BLIND_SPOT_CONTENT, getBlindSpotContentById } from "../_knowledge/content.js";
import { chatWithAssistant } from "../_agent/llm.js";

const router = Router();

// 扫描：分析用户输入 → 返回 exposure map
router.post("/scan", async (req: Request, res: Response) => {
  const { nickname, input } = req.body;
  try {
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
    res.status(500).json({ success: false, error: err.message });
  }
});

// 每日推送：exposure 放 body
router.post("/daily", async (req: Request, res: Response) => {
  const { exposure, readContentIds } = req.body;
  try {
    const expMap = new Map<string, number>(Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0]));
    const result = await generateDailyFeed(expMap, readContentIds || [], 3);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 内容详情
router.post("/content", async (req: Request, res: Response) => {
  const { contentId, exposure } = req.body;
  try {
    const expMap = new Map<string, number>(Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0]));
    const result = await getContentDetailForUser(contentId, expMap);
    if (!result) { res.status(404).json({ success: false, error: "内容不存在" }); return; }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 认知地图
router.post("/map", (req: Request, res: Response) => {
  const { exposure } = req.body;
  const expMap = new Map<string, number>(Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0]));
  const map = COGNITIVE_DIMENSIONS.map((d) => ({
    ...d,
    userCount: expMap.get(d.id) ?? d.count,
    isBlindSpot: (expMap.get(d.id) ?? d.count) < 30,
  }));
  res.json({ success: true, data: map });
});

// 智能聊天
router.post("/chat", async (req: Request, res: Response) => {
  const { message, history, exposure } = req.body;
  try {
    const expMap = new Map<string, number>(Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0]));
    const availableContent = BLIND_SPOT_CONTENT.map((c) => {
      const dim = getDimensionById(c.id);
      return {
        id: c.id,
        title: c.title,
        dimensionName: dim?.name || c.id,
        description: c.description,
      };
    });
    const reply = await chatWithAssistant(
      message || "",
      history || [],
      expMap,
      availableContent
    );
    res.json({ success: true, data: { reply } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
