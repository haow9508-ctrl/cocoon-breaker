import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { scanCocoon } from "../lib/apiClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sparkles, ScanLine, Upload, ArrowRight, ArrowLeft, FileJson } from "lucide-react";

type ScanMode = "menu" | "text" | "import";

export function CocoonScanPage() {
  const navigate = useNavigate();

  // 模式
  const [mode, setMode] = useState<ScanMode>("menu");
  const [nickname, setNickname] = useState("探索者");

  // 文本模式
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const questions = [
    { q: "你每天花最多时间在哪些 App 或平台上？（抖音/B站/知乎/微信...）", hint: "例如：每天刷抖音2小时，B站1小时，偶尔看知乎" },
    { q: "你最近一周看过的内容属于什么类型？（娱乐八卦/科技/美食/游戏...）", hint: "例如：最近在看美食探店、搞笑段子、数码评测" },
    { q: "有什么是你从来不看、完全不感兴趣的领域？（可多提）", hint: "例如：我从不看财经、政治、哲学、体育类内容" },
  ];

  // 导入模式
  const [importText, setImportText] = useState("");
  const [importFormat, setImportFormat] = useState<"free" | "json">("free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buildInput = (): string => {
    if (mode === "text") {
      return answers.filter(Boolean).join("。\n");
    }
    if (mode === "import") {
      return importText.trim();
    }
    return "";
  };

  const handleScan = async () => {
    setLoading(true);
    setError("");
    try {
      await scanCocoon(nickname.trim(), buildInput());
      navigate("/");
    } catch (e: any) {
      setError(e.message || "扫描失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-radial-fade pointer-events-none" />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg relative z-10">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-xs text-primary mb-3">
            <Sparkles className="w-3 h-3" /> 茧房爆破器
          </div>
          <h1 className="text-2xl font-bold mb-2">扫描你的认知茧房</h1>
        </div>

        <AnimatePresence mode="wait">
          {mode === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-card/80 backdrop-blur-xl space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">昵称</label>
                  <Input value={nickname} onChange={(e) => setNickname(e.target.value)} className="bg-background/50" />
                </div>

                <div className="space-y-3">
                  <button onClick={() => setMode("text")} className="w-full p-4 rounded-xl border border-border/50 bg-background/30 text-left hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <ScanLine className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">多轮对话扫描（推荐）</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">回答3个问题，AI构建你的暴露地图</p>
                  </button>

                  <button onClick={() => setMode("import")} className="w-full p-4 rounded-xl border border-border/50 bg-background/30 text-left hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Upload className="w-4 h-4 text-blue-400" />
                      <span className="font-medium text-sm">导入浏览数据</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">粘贴你从各平台导出的数据，或自由描述</p>
                  </button>

                  <button onClick={async () => { setLoading(true); try { await scanCocoon(nickname.trim(), ""); navigate("/"); } catch { setLoading(false); } }} className="w-full p-4 rounded-xl border border-border/50 bg-background/30 text-left hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-4 h-4 text-yellow-400" />
                      <span className="font-medium text-sm">直接开始（使用默认模拟数据）</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">跳过扫描，用demo数据看效果</p>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {mode === "text" && (
            <motion.div key="text" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-card/80 backdrop-blur-xl">
                <AnimatePresence mode="wait">
                  <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{step + 1}/3</span>
                      <span className="text-sm text-muted-foreground">{questions[step].q}</span>
                    </div>

                    <Textarea
                      value={answers[step]}
                      onChange={(e) => {
                        const a = [...answers];
                        a[step] = e.target.value;
                        setAnswers(a);
                      }}
                      placeholder={questions[step].hint}
                      rows={4}
                      className="bg-background/50 text-sm resize-none mb-4"
                    />

                    <div className="flex justify-between">
                      <Button variant="ghost" size="sm" onClick={() => { if (step > 0) setStep(step - 1); else setMode("menu"); }}>
                        <ArrowLeft className="w-4 h-4" /> 上一步
                      </Button>
                      {step < 2 ? (
                        <Button size="sm" onClick={() => setStep(step + 1)} disabled={!answers[step].trim()}>
                          下一题 <ArrowRight className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button size="sm" onClick={handleScan} disabled={loading}>
                          {loading ? "扫描中..." : <>开始分析 <Sparkles className="w-3 h-3" /></>}
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          )}

          {mode === "import" && (
            <motion.div key="import" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-card/80 backdrop-blur-xl">
                <div className="flex gap-2 mb-4">
                  <button onClick={() => setImportFormat("free")} className={`px-3 py-1.5 rounded-full text-xs ${importFormat === "free" ? "bg-primary/10 text-primary border border-primary/30" : "border border-border/50 text-muted-foreground"}`}>
                    自由描述
                  </button>
                  <button onClick={() => setImportFormat("json")} className={`px-3 py-1.5 rounded-full text-xs ${importFormat === "json" ? "bg-primary/10 text-primary border border-primary/30" : "border border-border/50 text-muted-foreground"}`}>
                    <FileJson className="w-3 h-3 inline mr-1" />
                    JSON 导入
                  </button>
                </div>

                {importFormat === "json" && (
                  <p className="text-xs text-muted-foreground mb-2">
                    粘贴你在各平台导出的数据。支持JSON或纯文本格式。
                  </p>
                )}

                <Textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={importFormat === "free"
                    ? "详细描述你的内容消费习惯...\n例如：我每天刷抖音2小时，主要看美食探店（约50%）和搞笑段子（30%），偶尔看科技评测（20%）。B站花1小时，全在看游戏实况和历史纪录片。从不看财经、政治、美妆类内容。"
                    : '{"bilibili": ["游戏实况", "历史纪录片"], "douyin": ["美食探店", "搞笑段子"], "zhihu": ["科技", "心理学"]}'}
                  rows={8}
                  className="bg-background/50 text-sm resize-none mb-4 font-mono"
                />

                <div className="flex justify-between">
                  <Button variant="ghost" size="sm" onClick={() => setMode("menu")}>
                    <ArrowLeft className="w-4 h-4" /> 返回
                  </Button>
                  <Button size="sm" onClick={handleScan} disabled={loading || !importText.trim()}>
                    {loading ? "扫描中..." : "导入并分析"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</div>
        )}

        <p className="text-xs text-center text-muted-foreground/60 mt-4">基于 24 个认知维度 · 由 DeepSeek 分析 · 数据仅存在你的浏览器中</p>
      </motion.div>
    </div>
  );
}
