import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num.toString();
}

export function getExposureLevel(count: number): {
  level: "blind" | "low" | "medium" | "high" | "extreme";
  label: string;
  color: string;
  bgColor: string;
} {
  if (count < 6) {
    return {
      level: "blind",
      label: "认知盲区",
      color: "text-blue-400",
      bgColor: "bg-blue-500",
    };
  }
  if (count < 51) {
    return {
      level: "low",
      label: "低频",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500",
    };
  }
  if (count < 201) {
    return {
      level: "medium",
      label: "中频",
      color: "text-yellow-400",
      bgColor: "bg-yellow-500",
    };
  }
  if (count < 501) {
    return {
      level: "high",
      label: "高频",
      color: "text-orange-400",
      bgColor: "bg-orange-500",
    };
  }
  return {
    level: "extreme",
    label: "过度暴露",
    color: "text-red-400",
    bgColor: "bg-red-500",
  };
}

export function getDifficultyLabel(difficulty: string): {
  label: string;
  color: string;
} {
  switch (difficulty) {
    case "beginner":
      return { label: "入门", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" };
    case "intermediate":
      return { label: "进阶", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" };
    case "advanced":
      return { label: "高级", color: "text-red-400 bg-red-500/10 border-red-500/30" };
    default:
      return { label: difficulty, color: "text-gray-400" };
  }
}
