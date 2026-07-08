// ===== 诊断式扫描页 =====
// 第一印象页面：输入昵称 → 多轮对话扫描 → 分析生成认知档案 → 跳转主页

import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon, ArrowRight, Loader2 } from "lucide-react";
import { diagnose, analyze } from "../lib/apiClient";
import { profileManager } from "../lib/profileManager";
import { useAppStore } from "../store/useAppStore";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

type Stage = "nickname" | "chat" | "analyzing";

// 最低对话轮数：达到后允许生成档案，但用户可继续对话
// 认知盲区无法用固定轮数覆盖——苏格拉底式引导需要灵活深度
const MIN_ROUNDS = 3;

// 打字机效果组件
function Typewriter({ text, onDone }: { text: string; onDone?: () => void }) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    setShown("");
    setDone(false);
    let i = 0;
    // 较长文本加速，避免等待过久
    const step = Math.max(1, Math.floor(text.length / 120));
    const timer = setInterval(() => {
      i += step;
      setShown(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
        onDone?.();
      }
    }, 24);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  return (
    <span>
      {shown}
      {!done && <span className="ml-0.5 inline-block h-4 w-px animate-pulse bg-white/60 align-middle" />}
    </span>
  );
}

export function DiagScanPage() {
  const navigate = useNavigate();
  const refreshProfile = useAppStore((s) => s.refreshProfile);

  const [stage, setStage] = useState<Stage>("nickname");
  const [nickname, setNickname] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  // 已完成打字机的教练消息索引，用于决定是否显示输入框
  const [typedIndex, setTypedIndex] = useState(-1);
  const [analyzingStep, setAnalyzingStep] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing, loading]);

  // 聚焦输入框
  useEffect(() => {
    if (stage === "chat" && !typing && !loading && typedIndex >= messages.length - 1) {
      inputRef.current?.focus();
    }
  }, [stage, typing, loading, typedIndex, messages.length]);

  // 开始对话：获取教练开场白
  const startConversation = useCallback(async (name: string) => {
    setLoading(true);
    setError("");
    try {
      const reply = await diagnose(name, []);
      setMessages([{ role: "assistant", content: reply }]);
      setTypedIndex(-1);
      setStage("chat");
    } catch (e: any) {
      setError(e.message || "教练暂时无法响应，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, []);

  // 用户发送回答
  const handleSend = async () => {
    const content = input.trim();
    if (!content || loading || typing) return;

    const userMsg: Msg = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await diagnose(
        nickname,
        nextMessages.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      setTypedIndex(-1);
    } catch (e: any) {
      setError(e.message || "教练暂时无法响应，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // 判断是否已达到最低轮数（达到后可生成档案，但对话不强制结束）
  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const canFinish = userTurnCount >= MIN_ROUNDS;

  // 进入分析阶段
  const enterAnalyzing = async () => {
    setStage("analyzing");
    setAnalyzingStep(0);

    // 步骤动画
    const stepTimer = setInterval(() => {
      setAnalyzingStep((s) => Math.min(s + 1, 3));
    }, 700);

    try {
      // 汇总用户输入
      const userInput = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n");

      const result = await analyze(userInput);
      clearInterval(stepTimer);
      setAnalyzingStep(4);

      // 创建档案并刷新状态
      profileManager.createProfile(nickname, result.exposure, result.difficultyLevel);
      // 等待一瞬让用户看到完成态
      await new Promise((r) => setTimeout(r, 600));
      refreshProfile();
      navigate("/");
    } catch (e: any) {
      clearInterval(stepTimer);
      setError(e.message || "分析失败，请稍后重试");
      setStage("chat");
    }
  };

  const ANALYZING_STEPS = ["解析你的内容消费习惯", "映射 24 个认知维度", "识别盲区与高频茧房", "生成专属认知档案"];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0f] text-[#f5f5f7]">
      {/* 背景氛围 */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[480px] w-[480px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/[0.06] blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-2xl flex-col px-5 py-10 sm:py-16">
        {/* 顶部品牌 */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="relative mb-5 flex h-12 w-12 items-center justify-center">
            <Hexagon className="h-12 w-12 text-white/30" strokeWidth={1} />
            <span className="absolute h-2 w-2 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
          </span>
          <h1 className="font-serif-cn text-3xl font-semibold tracking-wide sm:text-4xl">
            茧房爆破器
          </h1>
          <p className="mt-3 text-sm text-white/45">
            一场关于你认知边界的诊断对话
          </p>
        </div>

        {/* 昵称输入阶段 */}
        <AnimatePresence mode="wait">
          {stage === "nickname" && (
            <motion.div
              key="nickname"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4 }}
              className="mx-auto w-full max-w-md"
            >
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 backdrop-blur-xl">
                <label className="mb-3 block text-xs font-medium uppercase tracking-wider text-white/40">
                  你的昵称
                </label>
                <input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nickname.trim()) startConversation(nickname.trim());
                  }}
                  placeholder="如何称呼你"
                  autoFocus
                  className="w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-[15px] text-white placeholder-white/25 outline-none transition focus:border-white/30"
                />
                <button
                  onClick={() => nickname.trim() && startConversation(nickname.trim())}
                  disabled={!nickname.trim() || loading}
                  className="group mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white py-3 text-sm font-medium text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> 教练正在准备
                    </>
                  ) : (
                    <>
                      开始诊断 <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </button>
                <p className="mt-4 text-center text-[11px] leading-relaxed text-white/30">
                  至少 3 轮对话 · 随时生成档案 · 数据仅存于你的浏览器
                </p>
              </div>
              {error && (
                <p className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-300">
                  {error}
                </p>
              )}
            </motion.div>
          )}

          {/* 对话阶段 */}
          {stage === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 flex-col"
            >
              {/* 进度指示：显示已对话轮数 + 最低轮数提示 */}
              <div className="mb-4 flex items-center justify-center gap-2 text-[11px] text-white/40">
                <span>已对话 {userTurnCount} 轮</span>
                <span className="text-white/20">·</span>
                <span>
                  {canFinish ? (
                    <span className="text-emerald-300/80">可以生成档案，或继续深入</span>
                  ) : (
                    <span>至少 {MIN_ROUNDS} 轮以生成档案</span>
                  )}
                </span>
              </div>

              {/* 消息区 */}
              <div
                ref={scrollRef}
                className="flex-1 space-y-4 overflow-y-auto py-2 pr-1"
                style={{ maxHeight: "calc(100vh - 320px)", minHeight: "200px" }}
              >
                {messages.map((msg, i) => {
                  const isLastCoach = msg.role === "assistant" && i === messages.length - 1;
                  const isTyped = i <= typedIndex || !isLastCoach;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                    >
                      <div className="max-w-[82%]">
                        {msg.role === "assistant" && (
                          <span className="mb-1.5 block text-[11px] font-medium text-white/35">
                            教练
                          </span>
                        )}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
                            msg.role === "user"
                              ? "rounded-br-sm bg-white text-black"
                              : "rounded-bl-sm border border-white/[0.08] bg-white/[0.03] text-white/90"
                          )}
                        >
                          {isLastCoach && !isTyped ? (
                            <Typewriter
                              text={msg.content}
                              onDone={() => setTypedIndex(i)}
                            />
                          ) : (
                            <span className="whitespace-pre-wrap">{msg.content}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {/* 教练思考中 */}
                {loading && (
                  <div className="flex justify-start">
                    <div>
                      <span className="mb-1.5 block text-[11px] font-medium text-white/35">教练</span>
                      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-white/50"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 达到最低轮数后：可生成档案（仍可继续对话） */}
              {canFinish && !loading && typedIndex >= messages.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 flex justify-center"
                >
                  <button
                    onClick={enterAnalyzing}
                    className="group flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-white/90"
                  >
                    生成我的认知档案
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </motion.div>
              )}

              {/* 输入区：始终可用，用户可自由继续对话 */}
              <div className="mt-4 flex items-end gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  placeholder={typing ? "教练正在说话…" : "写下你的回答"}
                  disabled={loading || typing}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-[14px] text-white placeholder-white/25 outline-none transition focus:border-white/30 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || loading || typing}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
                  aria-label="发送"
                >
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-xs text-red-300">
                  {error}
                </p>
              )}
            </motion.div>
          )}

          {/* 分析阶段 */}
          {stage === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mx-auto flex w-full max-w-md flex-col items-center py-12"
            >
              <div className="relative mb-8 flex h-20 w-20 items-center justify-center">
                <motion.span
                  className="absolute inset-0 rounded-full border border-white/15"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <motion.span
                  className="absolute inset-2 rounded-full border border-white/10"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <Hexagon className="h-8 w-8 text-white/70" strokeWidth={1.25} />
              </div>

              <h2 className="font-serif-cn mb-8 text-xl text-white/90">正在分析你的认知档案</h2>

              <div className="w-full space-y-3">
                {ANALYZING_STEPS.map((label, i) => {
                  const active = analyzingStep >= i + 1;
                  const current = analyzingStep === i;
                  return (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: active ? 1 : 0.35, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5"
                    >
                      {active ? (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-black">
                          <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2}>
                            <path d="M2 6l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      ) : current ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                      ) : (
                        <span className="h-5 w-5 rounded-full border border-white/15" />
                      )}
                      <span className="text-[13px] text-white/70">{label}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
