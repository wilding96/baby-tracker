import type { MonsterVisual } from "./types";

export const MONSTER_VISUALS: MonsterVisual[] = [
  { emoji: "👾", name: "紫晶怪", color: "#a855f7", accent: "#e9d5ff" },
  { emoji: "👻", name: "幽灵", color: "#94a3b8", accent: "#e2e8f0" },
  { emoji: "😈", name: "小恶魔", color: "#f43f5e", accent: "#fecdd3" },
  { emoji: "👽", name: "外星人", color: "#22c55e", accent: "#bbf7d0" },
  { emoji: "🐉", name: "幼龙", color: "#0ea5e9", accent: "#bae6fd" },
  { emoji: "🐙", name: "章鱼怪", color: "#ec4899", accent: "#fbcfe8" },
  { emoji: "🦖", name: "小恐龙", color: "#84cc16", accent: "#d9f99d" },
  { emoji: "🐲", name: "神龙", color: "#f59e0b", accent: "#fde68a" },
];

export const MAX_MONSTERS = 8;
export const GRID_COLS = 4;
export const STORAGE_KEY = "todo-monsters-v1";
export const TEXT_MAX_LENGTH = 20;
