import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { getCognitiveMap, hasScanned } from "../lib/apiClient";
import { cn } from "@/lib/utils";

function getColor(count: number): string {
  if (count < 30) return "blind";
  if (count < 100) return "#4ade80";
  if (count < 300) return "#ffd23d";
  if (count < 600) return "#ff8a3d";
  return "#ff4d4d";
}

export function HeatmapPage() {
  const navigate = useNavigate();
  const [map, setMap] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBlindOnly, setShowBlindOnly] = useState(false);

  useEffect(() => {
    if (!hasScanned()) { navigate("/scan"); return; }
    loadMap();
  }, []);

  const loadMap = async () => {
    try {
      const data = await getCognitiveMap();
      setMap(data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground text-sm">加载中...</div>;

  const blindCount = map.filter((d) => d.isBlindSpot).length;
  const overCount = map.filter((d) => d.userCount >= 501).length;
  const filtered = showBlindOnly ? map.filter((d) => d.isBlindSpot) : map;

  return (
    <div className="min-h-screen bg-background relative">
      <nav className="sticky top-0 z-30 glass border-b border-border/50">
        <div className="container max-w-4xl h-14 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" /><span className="text-sm">返回</span>
          </button>
          <span className="font-semibold text-sm">认知茧房热力图</span>
          <Button variant="ghost" size="sm" onClick={() => setShowBlindOnly(!showBlindOnly)} className="text-xs">
            {showBlindOnly ? <Eye className="w-3.5 h-3.5 mr-1" /> : <EyeOff className="w-3.5 h-3.5 mr-1" />}
            {showBlindOnly ? "显示全部" : "只看盲区"}
          </Button>
        </div>
      </nav>

      <main className="container max-w-4xl py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">你的认知暴露地图</h1>
          <p className="text-sm text-muted-foreground mb-4">
            红色 = 过度暴露 · 蓝色斜纹 = 认知盲区（点击可探索）
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-card border border-border/50">
              <div className="text-xs text-muted-foreground">盲区</div>
              <div className="text-xl font-bold text-blue-400">{blindCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border/50">
              <div className="text-xs text-muted-foreground">过度暴露</div>
              <div className="text-xl font-bold text-red-400">{overCount}</div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border/50">
              <div className="text-xs text-muted-foreground">总维度</div>
              <div className="text-xl font-bold">{map.length}</div>
            </div>
          </div>
        </div>

        {/* 图例 */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: "repeating-linear-gradient(45deg,#3d7fff33,#3d7fff33 3px,#3d7fff66 3px,#3d7fff66 6px)" }} />盲区(0-5)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400/70" />低频(6-50)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400/70" />中频(51-200)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400/70" />高频(201-500)</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400/70" />过度(500+)</span>
        </div>

        {/* 热力图 */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {filtered.map((d, idx) => {
            const color = getColor(d.userCount);
            const isBlind = color === "blind";
            return (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => isBlind && navigate(`/read/${d.id}`)}
                className={cn(
                  "aspect-square rounded-xl border relative flex flex-col items-center justify-center p-2 transition-all",
                  isBlind ? "cursor-pointer hover:scale-105" : "cursor-default",
                )}
                style={{
                  background: isBlind
                    ? "repeating-linear-gradient(45deg, rgba(61,127,255,0.1), rgba(61,127,255,0.1) 4px, rgba(61,127,255,0.2) 4px, rgba(61,127,255,0.2) 8px)"
                    : `linear-gradient(135deg, ${color}33, ${color}11)`,
                  borderColor: isBlind ? "rgba(61,127,255,0.3)" : `${color}33`,
                }}
              >
                <span className="text-xs font-medium text-center" style={{ color: isBlind ? "#3d7fff" : undefined }}>
                  {d.name}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {d.userCount === 0 ? "盲区" : `${d.userCount}次`}
                </span>
              </motion.button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
