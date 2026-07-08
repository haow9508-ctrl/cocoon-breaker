// ===== 每日挑战主页 =====
// 今日挑战标题 + 难度/盲区概览 + 3 张挑战卡片

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ArrowUpRight, Loader2, Eye, CheckCircle2, BookOpen } from "lucide-react";
import { getChallenge } from "../lib/apiClient";
import { useAppStore } from "../store/useAppStore";
import { cn } from "@/lib/utils";

// 挑战条目类型（与后端 ChallengeItem 对齐）
interface ChallengeItem {
  id: string;
  dimensionId: string;
  dimensionName: string;
  title: string;
  why: string;
  description: string;
  source: string;
  readTimeMinutes: number;
  difficultyLevel: "L1" | "L2" | "L3";
  coachGuidance: string;
  exposureCount: number;
}

interface ChallengeResult {
  items: ChallengeItem[];
  blindSpotCount: number;
  selectedDimensions: string[];
}

// 难度等级配色
const DIFF_BADGE: Record<string, string> = {
  L1: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  L2: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  L3: "text-red-300 border-red-400/30 bg-red-400/10",
};

export function ChallengePage() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);

  const [data, setData] = useState<ChallengeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getChallenge();
        if (alive) setData(res);
      } catch (e: any) {
        if (alive) setError(e.message || "加载挑战失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const difficultyLevel = profile?.difficultyLevel ?? "L1";

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-24 sm:px-8">
      {/* 页头 */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40">
          <span className="h-1 w-6 bg-white/30" />
          今日挑战
        </div>
        <h1 className="font-serif-cn mt-3 text-3xl font-semibold tracking-wide sm:text-4xl">
          突破你今日的认知盲区
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">
          基于你的暴露地图，教练为你挑选了三个最值得探索的相邻领域。
        </p>

        {/* 概览统计 */}
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2">
            <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", DIFF_BADGE[difficultyLevel])}>
              {difficultyLevel}
            </span>
            <span className="text-xs text-white/55">当前难度</span>
          </div>
          {!loading && data && (
            <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3.5 py-2">
              <Eye className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-xs text-white/55">
                <span className="text-white/80">{data.blindSpotCount}</span> 个盲区待探索
              </span>
            </div>
          )}
        </div>
      </motion.header>

      {/* 内容区 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="mt-3 text-sm">教练正在为你挑选挑战…</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
          {error}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {data!.items.map((item, i) => (
            <ChallengeCard key={item.id} item={item} index={i} onClick={() => navigate(`/read/${item.dimensionId}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

// 单张挑战卡片
function ChallengeCard({ item, index, onClick }: { item: ChallengeItem; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 text-left transition-colors hover:border-white/20"
    >
      {/* 顶部：难度 + 维度 */}
      <div className="mb-4 flex items-center justify-between">
        <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", DIFF_BADGE[item.difficultyLevel])}>
          {item.difficultyLevel}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
          {item.dimensionName}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="font-serif-cn text-lg font-medium leading-snug text-white/90 transition-colors group-hover:text-white">
        {item.title}
      </h3>

      {/* 教练引导 */}
      <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-white/50">
        {item.coachGuidance}
      </p>

      {/* 底部：阅读时间 + 来源 + 箭头 */}
      <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
        <div className="flex items-center gap-3 text-[11px] text-white/40">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {item.readTimeMinutes} 分钟
          </span>
          <span className="max-w-[100px] truncate">{item.source}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white/70" />
      </div>
    </motion.button>
  );
}

// 空状态
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] py-20 text-center"
    >
      <CheckCircle2 className="h-10 w-10 text-white/25" strokeWidth={1.25} />
      <h3 className="font-serif-cn mt-4 text-xl text-white/70">今日挑战已完成</h3>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-white/40">
        <BookOpen className="h-3.5 w-3.5" /> 明日再来，认知边界会继续外扩
      </p>
    </motion.div>
  );
}
