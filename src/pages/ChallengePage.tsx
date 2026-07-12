// ===== 每日挑战主页 v6.0 =====
// v6.0：挑战卡显示方向标签 + 子领域名称（替代旧的 dimensionName）
// 今日挑战标题 + 难度/未接触子领域概览 + 3 张挑战卡片

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Clock, ArrowUpRight, Loader2, Eye, CheckCircle2, BookOpen, RotateCcw, Compass } from "lucide-react";
import { getChallenge, type ChallengeItem, type ChallengeResult } from "../lib/apiClient";
import { profileManager } from "../lib/profileManager";
import { useAppStore } from "../store/useAppStore";
import { cn } from "@/lib/utils";

// 难度等级配色
const DIFF_BADGE: Record<string, string> = {
  L1: "text-emerald-400/90 border-emerald-500/20 bg-emerald-500/5",
  L2: "text-amber-400/90 border-amber-500/20 bg-amber-500/5",
  L3: "text-red-400/90 border-red-500/20 bg-red-500/5",
};

export function ChallengePage() {
  const navigate = useNavigate();
  const profile = useAppStore((s) => s.profile);
  const clearProfile = useAppStore((s) => s.clearProfile);

  const [data, setData] = useState<ChallengeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  // 重新测试：清除档案并跳转诊断页（保留现有逻辑）
  const handleReset = () => {
    clearProfile();
    navigate("/scan");
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      // v6.1：先读今日挑战缓存，命中且日期为今天则跳过 API 调用
      const cached = profileManager.getTodayChallenge();
      if (cached && cached.items?.length > 0) {
        if (alive) {
          setData(cached as ChallengeResult);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await getChallenge();
        if (alive) {
          setData(res);
          // 缓存今日挑战，跨页面复用，保证 ReaderPage 内容一致
          if (res.items?.length > 0) {
            profileManager.setTodayChallenge({
              items: res.items,
              unexploredCount: res.unexploredCount,
              selectedSubfields: res.selectedSubfields,
            });
          }
        }
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
  // v6.0：旧档案迁移后 directions 为空——引导用户重新诊断
  const hasNoDirections = !profile?.directions || profile.directions.length === 0;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-24 sm:px-8">
      {/* 页头 */}
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-10"
      >
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          <span className="h-1 w-6 bg-muted-foreground/50" />
          今日挑战
        </div>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="font-serif-cn text-3xl font-semibold tracking-wide sm:text-4xl">
              在你的方向内拓展边界
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground/80">
              基于你的认知大方向，教练为你挑选了三个方向内未接触的子领域——同方向内拓展而非跨方向跳转。
            </p>
          </div>
          {/* 重新测试按钮 */}
          <button
            onClick={() => setConfirmReset(true)}
            className="group flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
            title="清除当前认知档案，重新开始诊断"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重新测试
          </button>
        </div>

        {/* 概览统计 */}
        <div className="mt-6 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2">
            <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", DIFF_BADGE[difficultyLevel])}>
              {difficultyLevel}
            </span>
            <span className="text-xs text-muted-foreground">当前难度</span>
          </div>
          {!loading && data && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2">
              <Eye className="h-3.5 w-3.5 text-blue-300" />
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground/85">{data.unexploredCount}</span> 个子领域待拓展
              </span>
            </div>
          )}
          {profile?.directions && profile.directions.length > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3.5 py-2">
              <Compass className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                <span className="text-foreground/85">{profile.directions.length}</span> 个认知方向
              </span>
            </div>
          )}
        </div>
      </motion.header>

      {/* 重新测试确认弹窗（保留现有逻辑） */}
      {confirmReset && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 px-5 backdrop-blur-sm"
          onClick={() => setConfirmReset(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6"
          >
            <h3 className="font-serif-cn text-lg font-medium text-foreground">重新进行诊断？</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              这将清除你当前的认知档案（包括方向树、冲击记录、里程碑）。此操作不可撤销。
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 rounded-md border border-border bg-muted py-2.5 text-sm text-muted-foreground transition hover:bg-muted/80"
              >
                取消
              </button>
              <button
                onClick={handleReset}
                className="flex-1 rounded-md bg-red-500/90 py-2.5 text-sm font-medium text-white transition hover:bg-red-500"
              >
                确认重置
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* 内容区 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground/70">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="mt-3 text-sm">教练正在为你挑选方向内挑战…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-300">
          {error}
        </div>
      ) : hasNoDirections ? (
        // 旧档案迁移后 directions 为空——引导重新诊断
        <div className="rounded-xl border border-dashed border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <Compass className="mx-auto h-10 w-10 text-amber-400/60" strokeWidth={1.25} />
          <h3 className="font-serif-cn mt-4 text-xl text-muted-foreground">需要重新识别认知方向</h3>
          <p className="mt-2 text-sm text-muted-foreground/80">系统已升级到方向+子领域模型，请重新完成诊断</p>
          <button
            onClick={handleReset}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            开始诊断 <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {data!.items.map((item, i) => (
            <ChallengeCard
              key={item.id}
              item={item}
              index={i}
              onClick={() => navigate(`/read/${item.directionId}/${item.subfieldId}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// 单张挑战卡片（v6.0：显示方向标签 + 子领域名称）
function ChallengeCard({ item, index, onClick }: { item: ChallengeItem; index: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      onClick={onClick}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/30"
    >
      {/* 顶部：难度 + 方向标签 */}
      <div className="mb-4 flex items-center justify-between gap-2">
        <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[11px] font-semibold", DIFF_BADGE[item.difficultyLevel])}>
          {item.difficultyLevel}
        </span>
        <span className="truncate rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {item.directionName}
        </span>
      </div>

      {/* 标题 */}
      <h3 className="font-serif-cn text-lg font-medium leading-snug text-foreground transition-colors group-hover:text-foreground">
        {item.title}
      </h3>

      {/* 子领域名称 */}
      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground/80">
        <Compass className="h-3 w-3" strokeWidth={1.5} />
        <span>子领域 · {item.subfieldName}</span>
      </div>

      {/* 教练引导 */}
      <p className="mt-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted-foreground">
        {item.coachGuidance}
      </p>

      {/* 底部：阅读时间 + 来源 + 箭头 */}
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> {item.readTimeMinutes} 分钟
          </span>
          <span className="max-w-[100px] truncate">{item.source}</span>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
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
      className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center"
    >
      <CheckCircle2 className="h-10 w-10 text-muted-foreground/40" strokeWidth={1.25} />
      <h3 className="font-serif-cn mt-4 text-xl text-muted-foreground">今日挑战已完成</h3>
      <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground/70">
        <BookOpen className="h-3.5 w-3.5" /> 明日再来，方向内的边界会继续外扩
      </p>
    </motion.div>
  );
}
