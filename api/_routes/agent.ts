// ===== Agent API v6.0 — 认知成长教练 7 阶段 Pipeline =====
// 无状态：所有数据存在前端 localStorage，每次请求带上完整档案
// v6.0：从"24 维暴露扫描"改为"认知大方向 + 方向内子领域树"动态模型
// 核心逻辑：服务持续提升认知的人，在既定方向内（如 AIPM/Python/古诗/股市）拓展视野

import { Router, Request, Response } from "express";
import { analyzeDirections } from "../_agent/analyzer.js";
import { generateDailyChallenge, getChallengeDetail, ImpactRecord, DecisionInput } from "../_agent/recommender.js";
import { diagnoseConversation, isApiKeyConfigured, generateMergedFeedback, buildCoachContext, buildMergedCoachReply } from "../_agent/llm.js";
import { chatWithCoach, buildProfileFromDirections } from "../_agent/coach.js";
import { adjustDifficulty, checkMilestones } from "../_agent/assessor.js";
import type { CognitiveDirection } from "../_knowledge/domains.js";

const router = Router();

// ① 诊断：识别用户的 1-3 个认知大方向（多轮对话式）
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

// ② 分析：识别认知大方向 + 方向内子领域树 + 初始难度等级
router.post("/analyze", async (req: Request, res: Response) => {
  const { input } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }
    const result = await analyzeDirections(input || "");
    res.json({
      success: true,
      data: {
        // v6.0：返回方向树（替代旧的 exposure Map + highExposureFields + blindSpotFields）
        directions: result.directions,
        difficultyLevel: result.initialDifficulty,
      },
    });
  } catch (err: any) {
    console.error("[Agent] analyze error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ③④ 每日挑战：方向内拓展决策 + DeepSeek 生成
router.post("/challenge", async (req: Request, res: Response) => {
  const { directions, readHistory, impactHistory, difficultyLevel } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const input: DecisionInput = {
      directions: (directions || []) as CognitiveDirection[],
      readHistory: readHistory || [],
      impactHistory: (impactHistory || []) as ImpactRecord[],
      difficultyLevel: difficultyLevel || "L1",
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
  const {
    contentId,
    directionId,
    directionName,
    subfieldId,
    subfieldName,
    title,
    impactScore,
    reflection,
    directions,
    profile,
  } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const directionList = (directions || (profile?.directions) || []) as CognitiveDirection[];

    // 难度调整
    const impactHistory = (profile?.impactHistory || []) as ImpactRecord[];
    const newRecord: ImpactRecord = {
      contentId,
      directionId,
      directionName,
      subfieldId,
      subfieldName,
      title,
      impactScore,
      reflection,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...impactHistory, newRecord];

    const assessment = adjustDifficulty(profile?.difficultyLevel || "L1", updatedHistory);

    // 里程碑检查（v6.0：基于方向树而非 exposure Map）
    const existingMilestoneIds = (profile?.milestones || []).map((m: any) =>
      typeof m === "string" ? m : m.type
    );
    const newMilestones = checkMilestones(
      updatedHistory,
      profile?.readHistory || [],
      directionList,
      existingMilestoneIds
    );

    // 教练反馈 + 关键洞察 + 实践脚手架（合并为单次 API 调用，节省 60% token）
    const coachProfile = buildProfileFromDirections(
      directionList,
      assessment.newDifficulty,
      updatedHistory,
      profile?.totalReads || 0
    );
    const mergedResult = await generateMergedFeedback(
      directionName || "",
      subfieldName || "",
      title,
      impactScore,
      reflection,
      coachProfile
    );

    res.json({
      success: true,
      data: {
        newDifficulty: assessment.newDifficulty,
        difficultyChanged: assessment.difficultyChanged,
        newMilestones,
        coachFeedback: mergedResult.feedback,
        keyInsight: mergedResult.keyInsight,
        practiceScaffold: mergedResult.practiceScaffold,
        updatedImpactHistory: updatedHistory,
      },
    });
  } catch (err: any) {
    console.error("[Agent] assess error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 认知地图（v6.0：方向树视图，替代旧的 24 维热力图）
router.post("/map", (req: Request, res: Response) => {
  const { directions } = req.body;
  const directionList = (directions || []) as CognitiveDirection[];
  // 直接返回方向树，前端按方向分组渲染子领域
  res.json({ success: true, data: directionList });
});

// 成长曲线数据：基于历史记录计算
router.post("/growth", (req: Request, res: Response) => {
  const { profile } = req.body;
  const impactHistory = profile?.impactHistory || [];
  const milestones = profile?.milestones || [];

  // 按时间分组统计
  const weeklyData: Array<{ week: string; reads: number; avgImpact: number; subfields: string[] }> = [];
  const subfieldSet = new Set<string>();

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
          subfields: Array.from(subfieldSet),
        });
      }
      currentWeek = weekKey;
      weekReads = [];
      subfieldSet.clear();
    }
    weekReads.push(record);
    subfieldSet.add(record.subfieldId || record.dimensionId);
  });

  // 最后一周
  if (weekReads.length > 0) {
    weeklyData.push({
      week: currentWeek,
      reads: weekReads.length,
      avgImpact: weekReads.reduce((s, r) => s + r.impactScore, 0) / weekReads.length,
      subfields: Array.from(subfieldSet),
    });
  }

  const totalReads = impactHistory.length;
  const totalSubfields = new Set(impactHistory.map((r: any) => r.subfieldId || r.dimensionId)).size;
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
        totalSubfields,
        avgImpact: Number(avgImpact.toFixed(2)),
        difficultyLevel: profile?.difficultyLevel || "L1",
      },
    },
  });
});

// ⑦ 教练对话：方法论引导（合并为单次 API 调用）
router.post("/coach", async (req: Request, res: Response) => {
  const { message, history, profile } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const directionList = (profile?.directions || []) as CognitiveDirection[];
    const coachProfile = buildProfileFromDirections(
      directionList,
      profile?.difficultyLevel || "L1",
      profile?.impactHistory || [],
      profile?.totalReads || 0
    );
    const context = buildCoachContext(coachProfile);

    // 合并：教练回复 + 关键洞察（单次 API 调用，节省 40%+ token）
    const mergedReply = await buildMergedCoachReply(message || "", history || [], context);

    res.json({
      success: true,
      data: {
        method: mergedReply.method,
        content: mergedReply.content,
        keyInsight: mergedReply.keyInsight,
      },
    });
  } catch (err: any) {
    console.error("[Agent] coach error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 兼容旧路由：内容详情（v6.0：基于 directionId + subfieldId + 方向树）
router.post("/content", async (req: Request, res: Response) => {
  const { directionId, subfieldId, directions, difficultyLevel } = req.body;
  try {
    if (!isApiKeyConfigured()) {
      res.status(500).json({ success: false, error: "DEEPSEEK_API_KEY not configured" });
      return;
    }

    const directionList = (directions || []) as CognitiveDirection[];
    const result = await getChallengeDetail(
      directionId || "",
      subfieldId || "",
      directionList,
      difficultyLevel || "L1"
    );
    if (!result) {
      res.status(404).json({ success: false, error: "方向或子领域不存在" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error("[Agent] content error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
