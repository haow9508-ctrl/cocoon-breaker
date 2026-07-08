// ===== Agent API v4.0 — 认知成长教练 7 阶段 Pipeline =====
// 无状态：所有数据存在前端 localStorage，每次请求带上完整档案
// 无知识库：所有内容由 DeepSeek 动态生成

import { Router, Request, Response } from "express";
import { analyzeExposure } from "../_agent/analyzer.js";
import { generateDailyChallenge, getChallengeDetail, ImpactRecord, DecisionInput } from "../_agent/recommender.js";
import { COGNITIVE_DIMENSIONS } from "../_knowledge/domains.js";
import { diagnoseConversation, isApiKeyConfigured, coachFeedback, buildCoachContext, extractKeyInsight } from "../_agent/llm.js";
import { chatWithCoach, buildProfileFromExposure } from "../_agent/coach.js";
import { adjustDifficulty, checkMilestones } from "../_agent/assessor.js";

const router = Router();

// ① 诊断：多轮对话式扫描
router.post("/diagnose", async (req: Request, res: Response) => {
  const { nickname, messages } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }
    const reply = await diagnoseConversation(messages || [], nickname || "探索者");
    res.json({ success: true, data: { reply } });
  } catch (err: any) {
    console.error("[Agent] diagnose error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ② 分析：生成24维暴露值 + 初始难度等级
router.post("/analyze", async (req: Request, res: Response) => {
  const { input } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }
    const result = await analyzeExposure(input || "");
    const map = COGNITIVE_DIMENSIONS.map((d) => ({
      ...d,
      userCount: result.exposure.get(d.id) ?? d.count,
      isBlindSpot: (result.exposure.get(d.id) ?? d.count) < 30,
    }));
    res.json({
      success: true,
      data: {
        exposure: Object.fromEntries(result.exposure),
        highExposureFields: result.highExposureFields,
        blindSpotFields: result.blindSpotFields,
        difficultyLevel: result.initialDifficulty,
        map,
      },
    });
  } catch (err: any) {
    console.error("[Agent] analyze error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ③④ 每日挑战：三维决策 + DeepSeek 生成
router.post("/challenge", async (req: Request, res: Response) => {
  const { exposure, readHistory, impactHistory, difficultyLevel, highExposureFields } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );

    const input: DecisionInput = {
      exposure: expMap,
      readHistory: readHistory || [],
      impactHistory: (impactHistory || []) as ImpactRecord[],
      difficultyLevel: difficultyLevel || "L1",
      highExposureFields: highExposureFields || [],
    };

    const result = await generateDailyChallenge(input);
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Agent] challenge error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ⑤⑥ 自评 + 反哺：提交冲击自评，调整难度，检查里程碑
router.post("/assess", async (req: Request, res: Response) => {
  const { contentId, dimensionId, dimensionName, title, impactScore, reflection, exposure, profile } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );

    // 更新暴露值：已读维度 +1
    const currentCount = expMap.get(dimensionId) || 0;
    expMap.set(dimensionId, currentCount + 1);

    // 难度调整
    const impactHistory = (profile?.impactHistory || []) as ImpactRecord[];
    const newRecord: ImpactRecord = {
      contentId,
      dimensionId,
      title,
      impactScore,
      reflection,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...impactHistory, newRecord];

    const assessment = adjustDifficulty(profile?.difficultyLevel || "L1", updatedHistory);

    // 里程碑检查
    const existingMilestoneIds = (profile?.milestones || []).map((m: any) =>
      typeof m === "string" ? m : m.type
    );
    const newMilestones = checkMilestones(
      updatedHistory,
      profile?.readHistory || [],
      expMap,
      existingMilestoneIds
    );

    // 教练反馈
    const coachProfile = buildProfileFromExposure(
      expMap,
      assessment.newDifficulty,
      updatedHistory,
      profile?.totalReads || 0
    );
    const feedback = await coachFeedback(
      dimensionName,
      title,
      impactScore,
      reflection,
      coachProfile
    );

    // 提取关键洞察存入教练记忆（PRD 承诺：coachMemory.keyInsights）
    let keyInsight: string | null = null;
    try {
      const context = buildCoachContext(coachProfile);
      keyInsight = await extractKeyInsight(
        `我读了《${title}》（${dimensionName}），冲击自评：${impactScore}星，反思：${reflection || "无"}`,
        feedback,
        context
      );
    } catch (e: any) {
      console.error("[Agent] extractKeyInsight failed:", e.message);
    }

    res.json({
      success: true,
      data: {
        newExposure: Object.fromEntries(expMap),
        newDifficulty: assessment.newDifficulty,
        difficultyChanged: assessment.difficultyChanged,
        newMilestones,
        coachFeedback: feedback,
        keyInsight,
        updatedImpactHistory: updatedHistory,
      },
    });
  } catch (err: any) {
    console.error("[Agent] assess error:", err.message);
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

// 成长曲线数据：基于历史记录计算
router.post("/growth", (req: Request, res: Response) => {
  const { profile } = req.body;
  const impactHistory = profile?.impactHistory || [];
  const milestones = profile?.milestones || [];

  // 按时间分组统计
  const weeklyData: Array<{ week: string; reads: number; avgImpact: number; dimensions: string[] }> = [];
  const dimSet = new Set<string>();

  // 简化：按 impactHistory 顺序分组
  const sortedHistory = [...impactHistory].sort((a: any, b: any) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let currentWeek = "";
  let weekReads: any[] = [];

  sortedHistory.forEach((record: any) => {
    const date = new Date(record.timestamp);
    const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`;

    if (currentWeek !== weekKey) {
      if (weekReads.length > 0) {
        weeklyData.push({
          week: currentWeek,
          reads: weekReads.length,
          avgImpact: weekReads.reduce((s, r) => s + r.impactScore, 0) / weekReads.length,
          dimensions: Array.from(dimSet),
        });
      }
      currentWeek = weekKey;
      weekReads = [];
      dimSet.clear();
    }
    weekReads.push(record);
    dimSet.add(record.dimensionId);
  });

  // 最后一周
  if (weekReads.length > 0) {
    weeklyData.push({
      week: currentWeek,
      reads: weekReads.length,
      avgImpact: weekReads.reduce((s, r) => s + r.impactScore, 0) / weekReads.length,
      dimensions: Array.from(dimSet),
    });
  }

  const totalReads = impactHistory.length;
  const totalDimensions = new Set(impactHistory.map((r: any) => r.dimensionId)).size;
  const avgImpact = totalReads > 0
    ? impactHistory.reduce((s: number, r: any) => s + r.impactScore, 0) / totalReads
    : 0;

  res.json({
    success: true,
    data: {
      weeklyData,
      milestones,
      stats: {
        totalReads,
        totalDimensions,
        avgImpact: Number(avgImpact.toFixed(2)),
        difficultyLevel: profile?.difficultyLevel || "L1",
      },
    },
  });
});

// ⑦ 教练对话：方法论引导
router.post("/coach", async (req: Request, res: Response) => {
  const { message, history, profile } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(profile?.exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );

    const coachProfile = buildProfileFromExposure(
      expMap,
      profile?.difficultyLevel || "L1",
      profile?.impactHistory || [],
      profile?.totalReads || 0
    );

    const { method, content } = await chatWithCoach(
      message || "",
      history || [],
      coachProfile
    );

    // 提取关键洞察存入教练记忆（PRD 承诺：coachMemory.keyInsights）
    let keyInsight: string | null = null;
    try {
      const context = buildCoachContext(coachProfile);
      keyInsight = await extractKeyInsight(message || "", content, context);
    } catch (e: any) {
      console.error("[Agent] extractKeyInsight failed:", e.message);
    }

    res.json({ success: true, data: { method, content, keyInsight } });
  } catch (err: any) {
    console.error("[Agent] coach error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 兼容旧路由：内容详情
router.post("/content", async (req: Request, res: Response) => {
  const { contentId, exposure, difficultyLevel } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const expMap = new Map<string, number>(
      Object.entries(exposure || {}).map(([k, v]) => [k, Number(v) || 0])
    );
    const result = await getChallengeDetail(contentId, expMap, difficultyLevel || "L1");
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

export default router;
