// ===== 认知热力图页 =====
// 24 维度方块网格（6×4）+ 图例 + 统计

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { getCognitiveMap } from "../lib/apiClient";
import { cn } from "@/lib/utils";

interface MapItem {
  id: string;
  name: string;
  count: number;
  category: string;
  userCount: number;
  isBlindSpot: boolean;
}

// 根据 userCount 返回背景色与标签
function getColor(userCount: number): { bg: string; border: string; label: string } {
  if (userCount === 0) return { bg: "bg-white/[0.03]", border: "border-white/[0.06]", label: "0" };
  if (userCount < 30) return { bg: "bg-blue-950", border: "border-blue-800/40", label: "<30" };
  if (userCount < 100) return { bg: "bg-blue-600", border: "border-blue-400/40", label: "<100" };
  if (userCount < 300) return { bg: "bg-yellow-500", border: "border-yellow-300/40", label: "<300" };
  if (userCount < 600) return { bg: "bg-orange-500", border: "border-orange-300/40", label: "<600" };
  return { bg: "bg-red-500", border: "border-red-300/40", label: "≥600" };
}

const LEGEND = [
  { color: "bg-white/[0.06]", label: "0" },
  { color: "bg-blue-950 border border-blue-800/40", label: "<30" },
  { color: "bg-blue-600", label: "<100" },
  { color: "bg-yellow-500", label: "<300" },
  { color: "bg-orange-500", label: "<600" },
  { color: "bg-red-500", label: "≥600" },
];

export function HeatmapPage() {
  const [map, setMap] = useState<MapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hovered, setHovered] = useState<MapItem | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getCognitiveMap();
        if (alive) setMap(res);
      } catch (e: any) {
        if (alive) setError(e.message || "加载认知地图失败");
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
        <p className="mt-3 text-sm">正在绘制你的认知地图…</p>
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

  // 统计
  const highFreq = map.filter((d) => d.userCount >= 300).length;
  const lowFreq = map.filter((d) => d.userCount > 0 && d.userCount < 100).length;
  const blindSpot = map.filter((d) => d.isBlindSpot).length;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-24 sm:px-8">
      {/* 页头 */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40">
          <span className="h-1 w-6 bg-white/30" />
          认知热力图
        </div>
        <h1 className="font-serif-cn mt-3 text-3xl font-semibold tracking-wide sm:text-4xl">
          24 个维度的暴露全景
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">
          颜色越暖，暴露越深；颜色越冷，越是盲区。
        </p>
      </motion.header>

      {/* 图例 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
      >
        <span className="text-[11px] uppercase tracking-wider text-white/35">暴露强度</span>
        <div className="flex items-center gap-3">
          {LEGEND.map((l) => (
            <div key={l.label} className="flex items-center gap-1.5">
              <span className={cn("h-3 w-3 rounded-sm", l.color)} />
              <span className="text-[11px] text-white/45">{l.label}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 热力图网格 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6"
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 sm:gap-2.5">
          {map.map((d, i) => {
            const c = getColor(d.userCount);
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.015 }}
                onMouseEnter={() => setHovered(d)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  "group relative aspect-square cursor-default rounded-lg border transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-white/20",
                  c.bg,
                  c.border
                )}
              >
                {/* 悬浮提示 */}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#0a0a0f] px-2.5 py-1.5 text-[11px] shadow-xl group-hover:block">
                  <div className="font-medium text-white/90">{d.name}</div>
                  <div className="text-white/45">暴露值 {d.userCount}</div>
                </div>
                {/* 序号（极淡） */}
                <span className="absolute left-1 top-0.5 text-[9px] text-white/15">{i + 1}</span>
              </motion.div>
            );
          })}
        </div>

        {/* 悬停信息（移动端/底部） */}
        <div className="mt-4 flex h-6 items-center text-[12px] text-white/45">
          {hovered ? (
            <span>
              <span className="text-white/80">{hovered.name}</span>
              <span className="mx-2 text-white/20">·</span>
              暴露值 <span className="text-white/70">{hovered.userCount}</span>
              {hovered.isBlindSpot && <span className="ml-2 text-blue-300">盲区</span>}
            </span>
          ) : (
            <span className="text-white/25">悬停方块查看维度详情</span>
          )}
        </div>
      </motion.div>

      {/* 底部统计 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-6 grid grid-cols-3 gap-3"
      >
        <StatBox label="高频领域" value={highFreq} accent="text-red-300" />
        <StatBox label="低频领域" value={lowFreq} accent="text-blue-300" />
        <StatBox label="认知盲区" value={blindSpot} accent="text-white/80" />
      </motion.div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
      <div className={cn("font-serif-cn text-2xl font-semibold", accent)}>{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-white/35">{label}</div>
    </div>
  );
}
