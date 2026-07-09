// ===== 顶部导航栏 =====
// 固定顶部，毛玻璃半透明背景；左侧 logo，右侧导航 + 难度等级徽章

import { NavLink } from "react-router-dom";
import { Flame, Target, Trophy, Network, Hexagon } from "lucide-react";
import { useAppStore } from "../store/useAppStore";
import { cn } from "@/lib/utils";

// 难度等级对应的徽章配色
const DIFF_STYLES: Record<string, string> = {
  L1: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10",
  L2: "text-amber-300 border-amber-400/30 bg-amber-400/10",
  L3: "text-red-300 border-red-400/30 bg-red-400/10",
};

const NAV_ITEMS = [
  { to: "/", label: "每日挑战", icon: Target },
  { to: "/growth", label: "成长曲线", icon: Flame },
  { to: "/milestones", label: "里程碑", icon: Trophy },
  { to: "/directions", label: "方向树", icon: Network },
];

export function NavBar() {
  const profile = useAppStore((s) => s.profile);
  const level = profile?.difficultyLevel ?? "L1";

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="glass border-b border-white/[0.06]">
        <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
          {/* 左侧 Logo */}
          <NavLink to="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-8 w-8 items-center justify-center">
              <Hexagon className="h-8 w-8 text-white/80 transition-transform duration-500 group-hover:rotate-90" strokeWidth={1.25} />
              <span className="absolute h-1.5 w-1.5 rounded-full bg-red-400" />
            </span>
            <span className="font-serif-cn text-[17px] font-semibold tracking-wide text-[#f5f5f7]">
              茧房爆破器
            </span>
          </NavLink>

          {/* 右侧导航 */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
                    isActive
                      ? "text-white"
                      : "text-white/55 hover:text-white/90"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    <span className="hidden sm:inline">{label}</span>
                    {isActive && (
                      <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {/* 难度等级徽章 */}
            <span
              className={cn(
                "ml-2 hidden sm:inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wider",
                DIFF_STYLES[level]
              )}
            >
              {level}
            </span>
          </nav>
        </div>
      </div>
    </header>
  );
}
