// ===== 内容 API =====
// 返回 cocoon-breaker.html 中定义的 24 维度和 12 条盲区内容

import { Router, Request, Response } from "express";
import { getAllContent, getContentByDimensionId } from "../_knowledge/content.js";

const router = Router();

// 获取所有盲区内容
router.get("/", (_req: Request, res: Response) => {
  const content = getAllContent().map((c) => ({
    id: c.id,
    title: c.title,
    why: c.why,
    description: c.description.slice(0, 100) + "...",
    source: c.source,
    readTimeMinutes: c.readTimeMinutes,
  }));
  res.json({ success: true, data: content });
});

// 按维度ID获取内容
router.get("/:id", (req: Request, res: Response) => {
  const content = getContentByDimensionId(req.params.id);
  if (!content) {
    res.status(404).json({ success: false, error: "该维度内容库准备中" });
    return;
  }
  res.json({ success: true, data: content });
});

export default router;
