// ===== 教练对话浮窗 =====
// 右下角浮动按钮 + 可展开对话面板

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { chatWithCoach } from "../lib/apiClient";
import { cn } from "@/lib/utils";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "我今天该读什么？",
  "我最大的盲区是？",
  "怎么突破当前难度？",
];

export function CoachChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 250);
    }
  }, [isOpen]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Msg = { role: "user", content };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const reply = await chatWithCoach(
        content,
        nextMessages.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "抱歉，出了点问题：" + (e.message || "请稍后再试") },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 260, damping: 20 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#14141a] text-white/90 shadow-2xl shadow-black/40 transition-colors hover:bg-[#1c1c24]"
        aria-label="教练对话"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.span key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <X className="h-5 w-5" />
            </motion.span>
          ) : (
            <motion.span key="open" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.15 }}>
              <MessageSquare className="h-5 w-5" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* 对话面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-24 right-6 z-50 flex max-h-[70vh] w-[calc(100vw-3rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e14]/95 backdrop-blur-xl shadow-2xl shadow-black/50"
          >
            {/* 头部 */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                <MessageSquare className="h-4 w-4 text-white/70" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0e0e14] bg-emerald-400" />
              </span>
              <div className="flex-1">
                <div className="text-[13px] font-medium text-white/90">认知教练</div>
                <div className="text-[11px] text-white/40">基于你的暴露数据回应</div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-white/40 transition hover:bg-white/5 hover:text-white/80"
                aria-label="收起"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 消息区 */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.02]">
                    <MessageSquare className="h-4 w-4 text-white/40" />
                  </span>
                  <p className="mb-4 text-[13px] text-white/45">问我任何关于认知成长的问题</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {QUICK_PROMPTS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handleSend(p)}
                        disabled={loading}
                        className="rounded-full border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[12px] text-white/60 transition hover:border-white/25 hover:text-white/90 disabled:opacity-50"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap",
                      msg.role === "user"
                        ? "rounded-br-sm bg-white text-black"
                        : "rounded-bl-sm border border-white/[0.08] bg-white/[0.03] text-white/85"
                    )}
                  >
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {/* 教练思考中 */}
              {loading && (
                <div className="flex justify-start">
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
              )}
            </div>

            {/* 输入区 */}
            <div className="border-t border-white/[0.06] p-3">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSend();
                  }}
                  placeholder={loading ? "教练正在思考…" : "输入你的问题"}
                  disabled={loading}
                  className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-[13px] text-white placeholder-white/25 outline-none transition focus:border-white/30 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black transition hover:bg-white/90 disabled:opacity-30"
                  aria-label="发送"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
