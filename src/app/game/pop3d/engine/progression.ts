// ═══════════════════════════════════════════════════════════════════
// POP3D — 局外档位与局内里程碑的纯计算
// 这里不碰世界状态，只把「档位 → 倍率」和「时间 → 抽卡进度」算清楚，
// 方便单测直接覆盖数值边界。
// ═══════════════════════════════════════════════════════════════════

import { RANK, RUN } from "./config";

export interface RankScale {
  enemyHp: number;
  spawnInterval: number;
  bulletSpeed: number;
  bossHp: number;
  stardust: number;
}

/** rank 越大越难；出怪间隔与弹速有硬上限，避免高档位不可玩 */
export function rankScale(rank: number): RankScale {
  const r = Math.max(0, Math.floor(Number.isFinite(rank) ? rank : 0));
  return {
    enemyHp: 1 + RANK.enemyHp * r,
    spawnInterval: Math.max(RANK.spawnMin, 1 - RANK.spawnRate * r),
    bulletSpeed: Math.min(RANK.bulletMax, 1 + RANK.bulletSpeed * r),
    bossHp: 1 + RANK.bossHp * r,
    stardust: 1 + RANK.stardust * r,
  };
}

/** 距离下一张卡的时间进度 0~1；过了最后一个里程碑恒为 1 */
export function cardProgress(time: number): number {
  let prev = 0;
  for (let i = 0; i < RUN.cardAt.length; i += 1) {
    const next = RUN.cardAt[i];
    if (time < next) {
      const span = next - prev;
      if (span <= 0) return 1;
      return Math.min(1, Math.max(0, (time - prev) / span));
    }
    prev = next;
  }
  return 1;
}
