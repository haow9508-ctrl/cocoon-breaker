import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, BookOpen, CheckCircle, MessageSquare, Send, Sparkles } from "lucide-react";
import { getContentDetail, markAsRead, submitFeedback, hasScanned } from "../lib/apiClient";

export function ViewReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackDone, setFeedbackDone] = useState(false);

  useEffect(() => {
    if (!hasScanned()) { navigate("/scan"); return; }
    loadContent();
  }, [id]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const data = await getContentDetail(id || "");
      setContent(data);
    } catch {
      setContent(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sparkles className="w-8 h-8 text-primary animate-pulse" />
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">内容不存在</p>
      </div>
    );
  }

  const handleRead = async () => {
    await markAsRead(content.id, content.id);
    setShowFeedback(true);
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return;
    await submitFeedback(content.id, feedbackText.trim());
    setFeedbackDone(true);
    setTimeout(() => navigate("/"), 1500);
  };

  return (
    <div className="min-h-screen bg-background relative">
      <nav className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="container max-w-2xl h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">返回</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <BookOpen className="w-3 h-3" />
            {content.readTimeMinutes}分钟
          </div>
        </div>
      </nav>

      <main className="container max-w-2xl py-8">
        <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* 为什么推荐 */}
          <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-1.5 text-xs text-primary mb-1">
              <Sparkles className="w-3 h-3" />
              <span className="font-medium">为什么推荐这条</span>
            </div>
            <p className="text-sm text-primary/80">{content.whyGenerated}</p>
          </div>

          {/* 标题 */}
          <h1 className="text-2xl font-bold mb-3 tracking-tight">{content.title}</h1>

          {/* 正文 */}
          <div className="prose prose-sm max-w-none mb-8">
            <p className="text-foreground/90 leading-relaxed">{content.description}</p>
          </div>

          {/* 来源 */}
          <div className="mb-8 text-xs text-muted-foreground border-t border-border/30 pt-4">
            来源：{content.source}
          </div>

          {/* 完成 / 反馈 */}
          {!showFeedback ? (
            <Button className="w-full" size="lg" onClick={handleRead}>
              <CheckCircle className="w-4 h-4" />
              标记为已读
            </Button>
          ) : feedbackDone ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-6">
              <div className="text-5xl mb-3">🏅</div>
              <h3 className="text-lg font-bold mb-1">盲区已爆破！</h3>
              <p className="text-sm text-muted-foreground mb-4">你的认知边界又扩展了一点。</p>
              <Button onClick={() => navigate("/")} variant="outline">返回首页</Button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-1.5 mb-3">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-primary">这刷新了你什么认知？</span>
              </div>
              <Textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="花30秒写下你的想法..."
                rows={3}
                className="text-sm mb-3"
              />
              <div className="flex gap-2">
                <Button onClick={handleSubmitFeedback} disabled={!feedbackText.trim()} size="sm">
                  <Send className="w-3.5 h-3.5" /> 提交
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate("/")}>跳过</Button>
              </div>
            </motion.div>
          )}
        </motion.article>
      </main>
    </div>
  );
}
