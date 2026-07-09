// ===== 方向树视图 v6.0 =====
// PRD v6.0 要求：以认知大方向为根节点，展开为子领域树
// 三档接触度视觉区分：已接触(实心绿) / 偶尔接触(半透明黄) / 未接触(虚线蓝)
// 底部"+"按钮可手动添加新大方向（PRD 5.4 / 8.3）

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Compass, CheckCircle2, Circle, CircleDashed, Plus, X } from "lucide-react";
import { getCognitiveMap } from "../lib/apiClient";
import { useAppStore } from "../store/useAppStore";
import { profileManager } from "../lib/profileManager";
import type { CognitiveDirection, SubfieldNode } from "../lib/profileManager";
import { cn } from "@/lib/utils";

// 接触程度配置：图标 + 文案 + 颜色
type ExposureKey = "high" | "low" | "none";

const EXPOSURE_META: Record<ExposureKey, {
  label: string;
  dotClass: string;   // 圆点样式
  textClass: string;  // 文字颜色
  rowClass: string;   // 行背景
}> = {
  high: {
    label: "已接触",
    dotClass: "bg-emerald-400",
    textClass: "text-emerald-300",
    rowClass: "border-emerald-400/15 bg-emerald-400/[0.04]",
  },
  low: {
    label: "偶尔接触",
    dotClass: "bg-amber-400",
    textClass: "text-amber-300",
    rowClass: "border-amber-400/15 bg-amber-400/[0.04]",
  },
  none: {
    label: "未接触",
    dotClass: "bg-blue-400/0 border-2 border-dashed border-blue-400/60",
    textClass: "text-blue-300",
    rowClass: "border-blue-400/15 bg-blue-400/[0.03]",
  },
};

// 图例
const LEGEND: Array<{ key: ExposureKey; label: string }> = [
  { key: "high", label: "已接触" },
  { key: "low", label: "偶尔接触" },
  { key: "none", label: "未接触" },
];

export function DirectionTreePage() {
  const [directions, setDirections] = useState<CognitiveDirection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<{ direction: CognitiveDirection; subfield: SubfieldNode } | null>(null);
  // 添加大方向弹窗状态（PRD 5.4：底部"+"按钮）
  const [showAddDirection, setShowAddDirection] = useState(false);
  const [newDirectionName, setNewDirectionName] = useState("");

  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await getCognitiveMap();
        if (alive) setDirections(Array.isArray(res) ? res : []);
      } catch (e: any) {
        if (alive) setError(e.message || "加载方向树失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // PRD 5.4：添加新大方向
  const handleAddDirection = () => {
    const name = newDirectionName.trim();
    if (!name || !profile) return;

    // 创建新大方向（空子领域树，待后续诊断/教练填充）
    const newDir: CognitiveDirection = {
      id: `dir_${Date.now()}`,
      name,
      subfields: [],
    };

    const updated = [...directions, newDir];
    setDirections(updated);

    // 同步到 localStorage 档案
    const updatedProfile = profileManager.updateDirections(updated);
    if (updatedProfile) {
      setProfile(updatedProfile);
    }

    setNewDirectionName("");
    setShowAddDirection(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center pt-16 text-white/40">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="mt-3 text-sm">正在绘制你的方向树…</p>
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

  // 统计：已接触 / 未接触 / 总方向数
  let touchedCount = 0;
  let untouchedCount = 0;
  let totalSubfields = 0;
  for (const dir of directions) {
    for (const sub of dir.subfields) {
      totalSubfields++;
      if (sub.exposure === "high" || sub.exposure === "low") {
        touchedCount++;
      } else {
        untouchedCount++;
      }
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-24 pt-24 sm:px-8">
      {/* 页头 */}
      <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/40">
          <span className="h-1 w-6 bg-white/30" />
          方向树
        </div>
        <h1 className="font-serif-cn mt-3 text-3xl font-semibold tracking-wide sm:text-4xl">
          你的认知大方向与子领域
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/45">
          在你既定的认知方向内，子领域分为已接触、偶尔接触、未接触三档——教练会优先从未接触的子领域开始拓展。
        </p>
      </motion.header>

      {/* 图例 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3"
      >
        <span className="text-[11px] uppercase tracking-wider text-white/35">接触程度</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND.map((l) => {
            const meta = EXPOSURE_META[l.key];
            return (
              <div key={l.key} className="flex items-center gap-1.5">
                <span className={cn("h-3 w-3 rounded-full", meta.dotClass)} />
                <span className="text-[11px] text-white/55">{l.label}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* 空状态：方向树为空（旧档案迁移后或诊断失败） */}
      {directions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.01] py-16 text-center"
        >
          <Compass className="mx-auto h-10 w-10 text-white/25" strokeWidth={1.25} />
          <h3 className="font-serif-cn mt-4 text-xl text-white/70">尚未识别认知方向</h3>
          <p className="mt-2 text-sm text-white/40">完成诊断对话以生成你的方向树</p>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {/* 按方向分组渲染 */}
          {directions.map((dir, di) => {
            const dirTouched = dir.subfields.filter((s) => s.exposure === "high" || s.exposure === "low").length;
            const dirTotal = dir.subfields.length;
            return (
              <motion.section
                key={dir.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + di * 0.08 }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <Compass className="h-4 w-4 text-white/55" strokeWidth={1.5} />
                  <h2 className="font-serif-cn text-lg font-medium text-white/90">{dir.name}</h2>
                  <span className="text-[11px] text-white/35">认知大方向</span>
                  <span className="ml-auto rounded-full border border-white/[0.08] bg-white/[0.02] px-2 py-0.5 text-[11px] text-white/45">
                    {dirTouched} / {dirTotal} 子领域
                  </span>
                </div>

                {dir.subfields.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01] py-6 text-center text-[12px] text-white/30">
                    尚无子领域——下次诊断或教练对话将为此方向生成子领域树
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {dir.subfields.map((sub, si) => {
                      const meta = EXPOSURE_META[sub.exposure];
                      const isSel = selected?.direction.id === dir.id && selected?.subfield.id === sub.id;
                      return (
                        <motion.button
                          key={sub.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 + di * 0.05 + si * 0.015 }}
                          onClick={() => setSelected(isSel ? null : { direction: dir, subfield: sub })}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 hover:ring-2",
                            meta.rowClass,
                            isSel ? "ring-2 ring-white/30" : "ring-0"
                          )}
                        >
                          {/* 状态图标 */}
                          {sub.exposure === "high" ? (
                            <CheckCircle2 className={cn("h-5 w-5 shrink-0", meta.textClass)} strokeWidth={1.5} />
                          ) : sub.exposure === "low" ? (
                            <Circle className={cn("h-5 w-5 shrink-0 fill-amber-400/30 text-amber-400", meta.textClass)} strokeWidth={1.5} />
                          ) : (
                            <CircleDashed className={cn("h-5 w-5 shrink-0", meta.textClass)} strokeWidth={1.5} />
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[13px] font-medium text-white/90">{sub.name}</div>
                            <div className={cn("mt-0.5 text-[11px]", meta.textClass)}>{meta.label}</div>
                          </div>

                          {sub.exposure === "none" && (
                            <span className="rounded bg-blue-500/20 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-blue-200">
                              待拓展
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                )}
              </motion.section>
            );
          })}
        </div>
      )}

      {/* PRD 5.4 / 8.3：添加新大方向按钮 */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        onClick={() => setShowAddDirection(true)}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.12] bg-white/[0.01] py-4 text-sm text-white/50 transition-colors duration-200 hover:border-white/[0.2] hover:bg-white/[0.03] hover:text-white/70"
      >
        <Plus className="h-4 w-4" strokeWidth={1.75} />
        添加新大方向
      </motion.button>

      {/* 添加大方向弹窗 */}
      <AnimatePresence>
        {showAddDirection && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowAddDirection(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="mx-4 w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#13131a] p-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-serif-cn text-lg font-medium text-white/90">添加新大方向</h3>
                <button onClick={() => setShowAddDirection(false)} className="text-white/40 hover:text-white/70">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-white/45">
                输入你想拓展的认知大方向名称（如"机器学习"、"宋词"、"投资心理学"）。添加后，下次诊断或教练对话会为它生成子领域树。
              </p>
              <input
                type="text"
                value={newDirectionName}
                onChange={(e) => setNewDirectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddDirection()}
                placeholder="如：机器学习"
                autoFocus
                className="mt-4 w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 text-sm text-white/90 outline-none transition-colors placeholder:text-white/25 focus:border-white/[0.25]"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => { setShowAddDirection(false); setNewDirectionName(""); }}
                  className="rounded-lg px-4 py-2 text-[13px] text-white/50 transition-colors hover:text-white/80"
                >
                  取消
                </button>
                <button
                  onClick={handleAddDirection}
                  disabled={!newDirectionName.trim()}
                  className="rounded-lg bg-white/10 px-4 py-2 text-[13px] font-medium text-white/90 transition-colors hover:bg-white/15 disabled:opacity-40"
                >
                  添加
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 选中详情 */}
      {selected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-white/35">已选中</div>
              <div className="font-serif-cn mt-0.5 text-lg font-medium text-white/90">{selected.subfield.name}</div>
              <div className="mt-0.5 text-[11px] text-white/40">方向 · {selected.direction.name}</div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-white/35">接触程度</div>
              <div className={cn("mt-0.5 text-sm font-medium", EXPOSURE_META[selected.subfield.exposure].textClass)}>
                {EXPOSURE_META[selected.subfield.exposure].label}
              </div>
            </div>
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-white/50">
            {selected.subfield.exposure === "high"
              ? "已深入接触——这是你认知版图的稳定部分，教练会用它作为类比桥接的起点。"
              : selected.subfield.exposure === "low"
              ? "偶尔接触——尚未成茧房，仍有较大探索空间。"
              : "未触及——教练会优先从这里推荐挑战，作为你方向内的下一步拓展。"}
          </p>
        </motion.div>
      )}

      {/* 底部统计 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
      >
        <StatBox label="已接触子领域" value={touchedCount} accent="text-emerald-300" />
        <StatBox label="未接触子领域" value={untouchedCount} accent="text-blue-300" />
        <StatBox label="认知方向数" value={directions.length} accent="text-white/80" />
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
