import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Map, Trophy, Sparkles, BookOpen } from "lucide-react";
import { getDailyFeed, hasScanned, getNickname, markAsRead } from "../lib/apiClient";
import { ChatAssistant } from "../components/ChatAssistant";
import { cn } from "@/lib/utils";

export function HomePage() {
  const navigate = useNavigate();
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hasScanned()) {
      navigate("/scan");
      return;
    }
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getDailyFeed();
      setFeed(data);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">AI 正在从你的盲区中精选内容...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-4">{error}</p>
          <Button onClick={loadFeed} variant="outline">重试</Button>
        </div>
      </div>
    );
  }

  const nickname = getNickname();
  const blindSpotCount = feed?.blindSpotCount ?? 0;

  return (
    <div className="min-h-screen bg-background relative">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="container h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">茧</div>
            <span className="font-semibold text-sm">茧房爆破器</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/heatmap")}>
              <Map className="w-4 h-4 mr-1.5" />
              <span className="text-xs">热力图</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/scan")}>
              <span className="text-xs">重新扫描</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl py-8">
        {/* Hero */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {blindSpotCount} 个盲区待爆破
            </span>
            <span className="text-xs text-muted-foreground">{nickname}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">今日盲区推送</h1>
          <p className="text-sm text-muted-foreground">
            以下内容来自你的认知盲区 — 你几乎从未接触过的领域。
          </p>
        </motion.section>

        {/* 推荐列表 */}
        <section className="space-y-4">
          {feed?.items?.map((item: any, idx: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="border-primary/20 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors"
                onClick={() => navigate(`/read/${item.id}`)}
              >
                <CardContent className="p-5">
                  {/* 为什么推荐 */}
                  <div className="mb-3 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                    <div className="flex items-center gap-1.5 text-xs text-primary mb-0.5">
                      <Sparkles className="w-3 h-3" />
                      <span className="font-medium">为什么推荐</span>
                    </div>
                    <p className="text-xs text-primary/80">{item.whyGenerated}</p>
                  </div>

                  {/* 标题 */}
                  <h3 className="text-lg font-bold mb-2">{item.title}</h3>

                  {/* 描述 */}
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 mb-3">
                    {item.description}
                  </p>

                  {/* 来源 */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{item.source}</span>
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {item.readTimeMinutes}分钟
                    </span>
                  </div>

                  {/* 行动 */}
                  <div className="mt-3 pt-3 border-t border-border/30">
                    <Button size="sm" className="w-full">
                      爆破这个盲区
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </section>

        {feed?.items?.length === 0 && (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
            <h2 className="text-xl font-bold mb-2">所有盲区都已爆破！</h2>
            <p className="text-muted-foreground text-sm">你已经接触了所有认知维度。</p>
          </div>
        )}

        <div className="text-center mt-12 mb-4">
          <p className="text-xs text-muted-foreground">
            每天只推 1–3 条 · 来自你的认知盲区 · 由 DeepSeek AI 分析
          </p>
        </div>
      </main>

      <ChatAssistant />
    </div>
  );
}
