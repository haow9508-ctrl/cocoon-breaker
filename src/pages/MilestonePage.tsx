// ===== 里程碑墙页 =====
// 展示所有里程碑（已解锁/未解锁），卡片式 + 入场动画

import { motion } from "framer-motion";
import { Sparkles, Flame, Calendar, TrendingUp, Compass, Zap, Lock } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { cn } from "@/lib/utils";

// 里程碑完整目录（按 type 索引）
interface MilestoneDef {
  type: string;
  title: string;
  description: string;
  icon: typeof Sparkles;
}

const MILESTONE_CATALOG: MilestoneDef[] = [
  { type: "first_contact", title: "初次接触", description: "完成第一次认知挑战", icon: Sparkles },
  { type: "streak_7", title: "坚持七日", description: "连续 7 天进行阅读", icon: Flame },
  { type: "streak_30", title: "月度深耕", description: "连续 30 天保持阅读", icon: Calendar },
  { type: "level_up", title: "难度进阶", description: "挑战难度提升一个等级", icon: TrendingUp },
  { type: "dimension_unlocked", title: "维度解锁", description: "首次探索某个全新维度", icon: Compass },
  { type: "high_impact", title: "高冲击时刻", description: "给出 5 星冲击自评", icon: Zap },
];

// 获取图标
function getIcon(type: string) {
  return MILESTONE_CATALOG.find((m) => m.type === type)?.icon ?? Sparkles;
}

export function MilestonePage() {
  const profile = useAppStore((s) => s.profile);
  const unlocked = profile?.milestones ?? [];

  // 按 type 分组已解锁的（取最新的解锁时间）
  const unlockedMap = new Map<string, string>();
  for (const m of unlocked) {
    const existing = unlockedMap.get(m.type);
    if (!existing || new Date(m.unlockedAt) > new Date(existing)) {
      unlockedMap.set(m.type, m.unlockedAt);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-24 sm:px-8">
      {/* 页头 */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40">
          <span className="h-1 w-6 bg-white/30" />
          里程碑
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <h1 className="font-serif-cn text-3xl font-semibold tracking-wide sm:text-4xl">
            里程碑墙
          </h1>
          <div className="text-right text-sm text-white/45">
            <span className="font-serif-cn text-2xl font-semibold text-white/80">{unlockedMap.size}</span>
            <span className="text-white/30"> / {MILESTONE_CATALOG.length}</span>
            <div className="text-[11px] uppercase tracking-wider text-white/30">已解锁</div>
          </div>
        </div>
      </motion.header>

      {/* 卡片网格 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MILESTONE_CATALOG.map((def, i) => {
          const unlockedAt = unlockedMap.get(def.type);
          const isUnlocked = !!unlockedAt;
          const Icon = def.icon;
          return (
            <motion.div
              key={def.type}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.4 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border p-5 transition-colors",
                isUnlocked
                  ? "border-white/[0.1] bg-white/[0.03]"
                  : "border-white/[0.05] bg-white/[0.01]"
              )}
            >
              {/* 装饰光晕（仅已解锁） */}
              {isUnlocked && (
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/[0.08] blur-2xl" />
              )}

              <div className="relative flex items-start justify-between">
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border",
                    isUnlocked
                      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                      : "border-white/[0.06] bg-white/[0.02] text-white/25"
                  )}
                >
                  {isUnlocked ? <Icon className="h-5 w-5" strokeWidth={1.5} /> : <Lock className="h-4 w-4" strokeWidth={1.5} />}
                </span>
                {isUnlocked && (
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    已解锁
                  </span>
                )}
              </div>

              <h3 className={cn("font-serif-cn mt-4 text-lg font-medium", isUnlocked ? "text-white/90" : "text-white/40")}>
                {def.title}
              </h3>
              <p className={cn("mt-1 text-[13px] leading-relaxed", isUnlocked ? "text-white/50" : "text-white/25")}>
                {def.description}
              </p>

              <div className="mt-4 border-t border-white/[0.06] pt-3">
                {isUnlocked ? (
                  <span className="text-[11px] text-white/35">
                    {new Date(unlockedAt!).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                ) : (
                  <span className="text-[11px] text-white/20">尚未达成</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
