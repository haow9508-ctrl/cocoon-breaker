// ===== 成长曲线页 v6.0 =====
// v6.0：从"覆盖维度数（0-24）"适配为"覆盖子领域数（无上限，动态方向树）"
// 4 个统计卡片 + SVG 双轴曲线（覆盖子领域数 + 平均冲击分）+ 最近里程碑

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BookOpen, Compass, Zap, Gauge, Loader2, Trophy } from "lucide-react";
import { getGrowthData } from "../lib/apiClient";
import { useAppStore } from "../store/useAppStore";
import { cn } from "@/lib/utils";

// v6.0：weeklyData.dimensions → weeklyData.subfields
interface WeeklyPoint {
  week: string;
  reads: number;
  avgImpact: number;
  subfields: string[];
}

interface GrowthData {
  weeklyData: WeeklyPoint[];
  milestones: Array<{ id: string; type: string; description: string; unlockedAt: string }>;
  // v6.0：stats.totalDimensions → stats.totalSubfields
  stats: {
    totalReads: number;
    totalSubfields: number;
    avgImpact: number;
    difficultyLevel: "L1" | "L2" | "L3";
  };
}

const DIFF_BADGE: Record<string, string> = {
  L1: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  L2: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  L3: "text-red-300 border-red-400/30 bg-red-400/10",
};

// 生成平滑 SVG 路径（Catmull-Rom 转 Bezier）
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function GrowthPage() {
  const profile = useAppStore((s) => s.profile);
  const [data, setData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getGrowthData();
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setError(e.message || "加载成长数据失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pt-16 text-white/40">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">正在汇总你的成长轨迹…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-5 pt-32">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { stats, weeklyData, milestones } = data;
  const recentMilestones = [...milestones].reverse().slice(0, 3);
  const hasEnoughData = weeklyData.length >= 2;

  // v6.0：覆盖子领域数（无固定上限，参考 profile.directions 总子领域数）
  const totalSubfieldsInTree = (profile?.directions || []).reduce(
    (sum, d) => sum + (d.subfields?.length || 0), 0
  );
  // 显示分母：若方向树为空（旧档案迁移后），仅显示分子
  const coverageDisplay = totalSubfieldsInTree > 0
    ? `${stats.totalSubfields}/${totalSubfieldsInTree}`
    : `${stats.totalSubfields}`;

  const statCards = [
    { label: "总阅读数", value: stats.totalReads, icon: BookOpen, accent: "text-white/80" },
    { label: "覆盖子领域", value: coverageDisplay, icon: Compass, accent: "text-blue-300" },
    { label: "平均冲击分", value: stats.avgImpact.toFixed(1), icon: Zap, accent: "text-red-300" },
    { label: "当前难度", value: stats.difficultyLevel, icon: Gauge, accent: "text-white/80", isLevel: true },
  ];

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-24 sm:px-8">
      {/* 页头 */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40">
          <span className="h-1 w-6 bg-white/30" />
          成长曲线
        </div>
        <h1 className="font-serif-cn mt-3 text-3xl font-semibold tracking-wide sm:text-4xl">
          你的方向内拓展轨迹
        </h1>
      </motion.header>

      {/* 统计卡片 */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <s.icon className={cn("h-4 w-4", s.accent)} strokeWidth={1.5} />
              <span className="text-[11px] uppercase tracking-wider text-white/30">{s.label}</span>
            </div>
            {s.isLevel ? (
              <span className={cn("inline-block rounded border px-2 py-0.5 text-sm font-semibold", DIFF_BADGE[stats.difficultyLevel])}>
                {s.value}
              </span>
            ) : (
              <div className="font-serif-cn text-2xl font-semibold">{s.value}</div>
            )}
          </motion.div>
        ))}
      </div>

      {/* 曲线图 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-serif-cn text-lg font-medium">每周成长</h2>
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-white/55">
              <span className="h-2 w-2 rounded-full bg-blue-400" /> 覆盖子领域
            </span>
            <span className="flex items-center gap-1.5 text-white/55">
              <span className="h-2 w-2 rounded-full bg-red-400" /> 冲击分
            </span>
          </div>
        </div>

        {hasEnoughData ? (
          <GrowthChart weeklyData={weeklyData} maxSubfields={Math.max(totalSubfieldsInTree, 10)} />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Compass className="h-8 w-8 text-white/20" strokeWidth={1.25} />
            <p className="mt-3 text-sm text-white/45">继续使用以解锁成长曲线</p>
            <p className="mt-1 text-xs text-white/30">至少需要 2 周数据</p>
          </div>
        )}
      </motion.div>

      {/* 最近里程碑 */}
      {recentMilestones.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <h2 className="font-serif-cn mb-4 text-lg font-medium">最近里程碑</h2>
          <div className="space-y-2">
            {recentMilestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/10">
                  <Trophy className="h-3.5 w-3.5 text-amber-300" />
                </span>
                <span className="flex-1 text-[13px] text-white/70">{m.description}</span>
                <span className="text-[11px] text-white/30">
                  {new Date(m.unlockedAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// SVG 双轴曲线图（v6.0：Y1 轴改为覆盖子领域数，无固定 24 上限）
function GrowthChart({ weeklyData, maxSubfields }: { weeklyData: WeeklyPoint[]; maxSubfields: number }) {
  const W = 720;
  const H = 280;
  const PAD = { top: 20, right: 20, bottom: 36, left: 36 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const n = weeklyData.length;
  const xFor = (i: number) => PAD.left + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);

  // v6.0：Y1 轴改为覆盖子领域数（0 ~ maxSubfields，动态上限）
  const yMax = Math.max(maxSubfields, 10);
  const y1For = (val: number) => PAD.top + innerH - (Math.min(val, yMax) / yMax) * innerH;
  // Y2：平均冲击分（1-5）
  const y2For = (val: number) => PAD.top + innerH - ((val - 1) / 4) * innerH;

  // v6.0：weeklyData.dimensions → weeklyData.subfields
  const coveragePoints = weeklyData.map((d, i) => ({ x: xFor(i), y: y1For(d.subfields.length) }));
  const impactPoints = weeklyData.map((d, i) => ({ x: xFor(i), y: y2For(d.avgImpact) }));

  const coveragePath = smoothPath(coveragePoints);
  const impactPath = smoothPath(impactPoints);
  const coverageArea = coveragePoints.length
    ? `${coveragePath} L ${coveragePoints[coveragePoints.length - 1].x} ${PAD.top + innerH} L ${coveragePoints[0].x} ${PAD.top + innerH} Z`
    : "";

  // Y1 轴刻度：根据 yMax 动态生成
  const y1Ticks: number[] = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    y1Ticks.push(Math.round((yMax * i) / tickCount));
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="coverageFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + t * innerH}
            y2={PAD.top + t * innerH}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}

        {/* Y 轴左：覆盖子领域数刻度 */}
        {y1Ticks.map((v) => (
          <text key={`y1-${v}`} x={PAD.left - 8} y={y1For(v) + 3} textAnchor="end" className="fill-white/30 text-[10px]">
            {v}
          </text>
        ))}
        {/* Y 轴右：冲击分刻度 */}
        {[1, 2, 3, 4, 5].map((v) => (
          <text key={`y2-${v}`} x={W - PAD.right + 8} y={y2For(v) + 3} textAnchor="start" className="fill-red-300/40 text-[10px]">
            {v}
          </text>
        ))}

        {/* X 轴标签 */}
        {weeklyData.map((d, i) => (
          <text key={d.week} x={xFor(i)} y={H - 12} textAnchor="middle" className="fill-white/30 text-[10px]">
            {d.week.replace(/^\d+-/, "")}
          </text>
        ))}

        {/* 覆盖子领域：面积 + 曲线 */}
        {coverageArea && <path d={coverageArea} fill="url(#coverageFill)" />}
        <path d={coveragePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinecap="round" />
        {coveragePoints.map((p, i) => (
          <circle key={`c-${i}`} cx={p.x} cy={p.y} r={3} fill="#0a0a0f" stroke="#3b82f6" strokeWidth={1.5} />
        ))}

        {/* 冲击分曲线 */}
        <path d={impactPath} fill="none" stroke="#f87171" strokeWidth={2} strokeLinecap="round" strokeDasharray="0" />
        {impactPoints.map((p, i) => (
          <circle key={`i-${i}`} cx={p.x} cy={p.y} r={3} fill="#0a0a0f" stroke="#f87171" strokeWidth={1.5} />
        ))}
      </svg>
    </div>
  );
}
