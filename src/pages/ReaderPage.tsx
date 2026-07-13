// ===== 阅读 + 冲击自评页 v6.0 =====
// v6.0：路由参数从 /read/:id（dimensionId）改为 /read/:directionId/:subfieldId
// 展示完整挑战内容 → 阅读后冲击自评（星级 + 反思）→ 教练反馈 + 里程碑

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Clock, ArrowLeft, Loader2, Send, Sparkles, TrendingUp, Trophy, Compass, Target } from "lucide-react";
import { getContentDetail, submitAssessment, type ChallengeItem } from "../lib/apiClient";
import { profileManager } from "../lib/profileManager";
import { cn } from "@/lib/utils";

interface PracticeScaffold {
  action: string;
  timeframe: string;
  successHint: string;
}

interface AssessResult {
  newDifficulty: "L1" | "L2" | "L3";
  difficultyChanged: boolean;
  newMilestones: Array<{ type: string; description: string }>;
  coachFeedback: string;
  practiceScaffold?: PracticeScaffold | null;
}

const DIFF_BADGE: Record<string, string> = {
  L1: "text-emerald-700 border-emerald-600/30 bg-emerald-50",
  L2: "text-amber-700 border-amber-600/30 bg-amber-50",
  L3: "text-red-700 border-red-600/30 bg-red-50",
};

export function ReaderPage() {
  // v6.0：路由参数改为 directionId + subfieldId（替代旧的 :id）
  const { directionId, subfieldId } = useParams<{ directionId: string; subfieldId: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<ChallengeItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 自评状态
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reflection, setReflection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AssessResult | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!directionId || !subfieldId) return;
      // v6.1：优先从今日挑战缓存中按 (directionId, subfieldId) 直接读取，避免二次 API 调用导致内容不一致或失败
      const cached = profileManager.findChallengeBySubfield(directionId, subfieldId);
      if (cached) {
        if (alive) {
          setItem(cached as ChallengeItem);
          setLoading(false);
        }
        return;
      }
      // 缓存未命中（如跨日进入、直接通过 URL 访问）：回退到 API 动态生成
      setLoading(true);
      setError("");
      try {
        const res = await getContentDetail(directionId, subfieldId);
        if (alive) setItem(res || null);
      } catch (e: any) {
        if (alive) setError(e.message || "加载内容失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [directionId, subfieldId]);

  const handleSubmit = async () => {
    if (!item || rating === 0 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      // v6.0：submitAssessment 参数从 dimensionId/dimensionName 改为 directionId/directionName/subfieldId/subfieldName
      const res = await submitAssessment(
        item.id,
        item.directionId,
        item.directionName,
        item.subfieldId,
        item.subfieldName,
        item.title,
        rating as 1 | 2 | 3 | 4 | 5,
        reflection.trim()
      );
      setResult(res);
    } catch (e: any) {
      setError(e.message || "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pt-16 text-muted-foreground/70">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">正在生成挑战内容…</p>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="mx-auto max-w-2xl px-5 pt-32">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
        <button
          onClick={() => navigate("/")}
          className="mt-4 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> 返回挑战
        </button>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-24 pt-24 sm:px-8">
      {/* 返回 */}
      <button
        onClick={() => navigate("/")}
        className="mb-8 flex items-center gap-1.5 text-[13px] text-muted-foreground/80 transition hover:text-foreground/85"
      >
        <ArrowLeft className="h-4 w-4" /> 返回挑战
      </button>

      <AnimatePresence mode="wait">
        {!result ? (
          <motion.div key="reader" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {/* 文章头部：难度 + 方向标签 + 子领域 + 阅读时间 */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", DIFF_BADGE[item.difficultyLevel])}>
                {item.difficultyLevel}
              </span>
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {item.directionName}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                <Compass className="h-3 w-3" /> 子领域 · {item.subfieldName}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                <Clock className="h-3 w-3" /> {item.readTimeMinutes} 分钟
              </span>
            </div>

            <h1 className="font-serif-cn text-3xl font-semibold leading-tight tracking-wide sm:text-4xl">
              {item.title}
            </h1>

            {/* 教练引导 */}
            <div className="mt-6 rounded-lg border border-border bg-card p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                <Sparkles className="h-3 w-3" /> 教练引导
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">{item.coachGuidance}</p>
            </div>

            {/* 正文 */}
            <div className="mt-8 space-y-5">
              <p className="text-[15px] leading-[1.85] text-foreground/85">{item.description}</p>

              {item.why && (
                <div>
                  <h3 className="font-serif-cn mb-2 text-base font-medium text-muted-foreground">为什么是这个</h3>
                  <p className="text-[15px] leading-[1.85] text-muted-foreground">{item.why}</p>
                </div>
              )}

              {item.source && (
                <p className="border-t border-border pt-4 text-[12px] text-muted-foreground/60">
                  来源 · {item.source}
                </p>
              )}
            </div>

            {/* 冲击自评 */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-12 rounded-xl border border-border bg-card p-6"
            >
              <h2 className="font-serif-cn text-lg font-medium">这次阅读对你冲击多大？</h2>
              <p className="mt-1 text-xs text-muted-foreground/70">诚实的自评会校准后续推荐的难度</p>

              {/* 星级 */}
              <div className="mt-4 flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1 transition-transform hover:scale-110"
                    aria-label={`${n} 星`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        (hoverRating || rating) >= n ? "fill-amber-500 text-amber-600" : "text-muted-foreground/30"
                      )}
                      strokeWidth={1.5}
                    />
                  </button>
                ))}
                <span className="ml-2 text-xs text-muted-foreground/70">
                  {["", "几乎没有", "略有触动", "有些冲击", "刷新认知", "重塑观念"][hoverRating || rating]}
                </span>
              </div>

              {/* 反思 */}
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="一句话反思：它刷新了你什么？"
                rows={2}
                className="mt-4 w-full resize-none rounded-lg border border-border bg-background px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/50 outline-none transition focus:border-primary/50"
              />

              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="group mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 提交中
                  </>
                ) : (
                  <>
                    提交自评 <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>

              {error && (
                <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-center text-xs text-red-700">
                  {error}
                </p>
              )}
            </motion.div>
          </motion.div>
        ) : (
          <ResultView key="result" result={result} onBack={() => navigate("/")} />
        )}
      </AnimatePresence>
    </div>
  );
}

// 提交结果视图：教练反馈 + 难度变化 + 里程碑
function ResultView({ result, onBack }: { result: AssessResult; onBack: () => void }) {
  const [showMilestones, setShowMilestones] = useState(false);

  useEffect(() => {
    if (result.newMilestones?.length > 0) {
      const t = setTimeout(() => setShowMilestones(true), 600);
      return () => clearTimeout(t);
    }
  }, [result.newMilestones]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      {/* 教练反馈 */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-3 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
          <Sparkles className="h-3 w-3" /> 教练反馈
        </div>
        <p className="font-serif-cn text-[15px] leading-[1.85] text-foreground/85">{result.coachFeedback}</p>
      </div>

      {/* 难度变化 */}
      {result.difficultyChanged && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
        >
          <TrendingUp className="h-5 w-5 text-amber-600" />
          <div className="text-[13px]">
            <span className="text-muted-foreground">难度已调整至 </span>
            <span className={cn("font-semibold", DIFF_BADGE[result.newDifficulty])}>
              {result.newDifficulty}
            </span>
            <span className="text-muted-foreground"> · 后续挑战将更具冲击力</span>
          </div>
        </motion.div>
      )}

      {/* v6.2：迷你实践落地脚手架 */}
      {result.practiceScaffold && result.practiceScaffold.action && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-primary/20 bg-primary/5 p-5"
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-4 w-4 text-primary" />
            </span>
            <h3 className="font-serif-cn text-base font-medium">今天落地一件事</h3>
          </div>
          <p className="text-[15px] font-medium leading-relaxed text-foreground">
            {result.practiceScaffold.action}
          </p>
          <div className="mt-3 flex items-center gap-4 text-[12px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {result.practiceScaffold.timeframe}
            </span>
            {result.practiceScaffold.successHint && (
              <span className="text-muted-foreground/80">
                做对的标志 · {result.practiceScaffold.successHint}
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* 里程碑解锁动画 */}
      <AnimatePresence>
        {showMilestones && result.newMilestones.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="rounded-xl border border-border bg-card p-6"
          >
            <div className="mb-3 flex items-center gap-2">
              <motion.span
                initial={{ rotate: -30, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ type: "spring" }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100"
              >
                <Trophy className="h-4 w-4 text-amber-600" />
              </motion.span>
              <h3 className="font-serif-cn text-base font-medium">解锁新里程碑</h3>
            </div>
            <div className="space-y-2">
              {result.newMilestones.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-muted-foreground"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {m.description}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onBack}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted py-3 text-sm font-medium text-foreground/85 transition hover:bg-muted/80"
      >
        <ArrowLeft className="h-4 w-4" /> 返回挑战
      </button>
    </motion.div>
  );
}
