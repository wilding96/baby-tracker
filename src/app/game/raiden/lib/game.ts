// ═══════════════════════════════════════════════════════════════════
// RAIDEN — pure gameplay helpers (no React / canvas deps)
// ═══════════════════════════════════════════════════════════════════

import type { CardDef, Monster } from "./types";
import { SR_CARDS, SSR_CARDS } from "./config";

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateGachaOptions(): CardDef[] {
  return Array.from({ length: 3 }, () =>
    Math.random() < 0.2 ? { ...pickRandom(SSR_CARDS) } : { ...pickRandom(SR_CARDS) },
  );
}

// Energy value per enemy type (tuned so weapon leveling spans the whole run)
export function energyValue(type: Monster["type"]): number {
  return type === "elite" ? 20 : type === "bomber" ? 12 : 8;
}

// Exponentially-distributed inter-arrival time (Poisson process).
// Memoryless + naturally jittered, so spawns stay even instead of clumping
// into synchronized bursts the way `frame % N === 0` does.
// 上限截断到 3×mean，避免指数长尾造成长时间留空。
export function expInterval(mean: number, min = 25): number {
  const t = Math.min(3, -Math.log(1 - Math.random()));
  return min + Math.round(t * mean);
}
