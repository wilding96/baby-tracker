// ═══════════════════════════════════════════════════════════════════
// POP3D — 我方弹型表与弹道（纯函数）
// 约定：角度 0 = +X，π/2 = +Z，-π/2 = -Z（屏幕上方，即"正前方"）。
// ═══════════════════════════════════════════════════════════════════

import { normalizeAngle, steerAngle } from "./patterns";

/** 机型默认弹型 + 子母弹 */
export type PlayerBulletKind = "bolt" | "spread" | "wave" | "homing" | "mini";

export const PLAYER_BULLET_KINDS: readonly PlayerBulletKind[] = [
  "bolt",
  "spread",
  "wave",
  "homing",
  "mini",
] as const;

/** 正前方（屏幕上方）的角度 */
export const UP_ANGLE = -Math.PI / 2;

export interface BulletDef {
  speed: number;
  dmgMul: number;
  pierce: number;
  /** 存活秒数；0 = 只按出界回收 */
  life: number;
  radius: number;
}

const DEFS: Record<PlayerBulletKind, BulletDef> = {
  bolt: { speed: 62, dmgMul: 1.25, pierce: 1, life: 0, radius: 0.45 },
  spread: { speed: 46, dmgMul: 0.8, pierce: 0, life: 0, radius: 0.42 },
  wave: { speed: 40, dmgMul: 1.0, pierce: 0, life: 0, radius: 0.55 },
  homing: { speed: 34, dmgMul: 0.7, pierce: 0, life: 3.0, radius: 0.35 },
  mini: { speed: 38, dmgMul: 0.35, pierce: 0, life: 1.2, radius: 0.22 },
};

export function bulletDef(kind: PlayerBulletKind): BulletDef {
  return DEFS[kind];
}

/** 溅射 / 分裂的偏角（25°） */
export const SPLIT_SPREAD = 0.4363323129985824;

/** 每架机型的主武器弹型 */
export const SHIP_BULLET: Record<"ion" | "nova" | "pulse", PlayerBulletKind> = {
  ion: "bolt",
  nova: "spread",
  pulse: "wave",
};

/** 齐射角度：以 UP_ANGLE 为中心的扇形，写进 out，返回写入条数 */
export function fanShotAngles(count: number, spreadRad: number, out: number[]): number {
  const n = Math.max(0, Math.floor(count));
  for (let k = 0; k < n; k += 1) {
    out[k] = UP_ANGLE + (k - (n - 1) / 2) * spreadRad;
  }
  return n;
}

/**
 * 分裂 / 溅射角度：先发左半边（由外到内）、再发右半边（由内到外），
 * 于是 out[0..n) 天然是**由小到大排序**的——便于断言，也便于以后按顺序铺开。
 */
export function splitShotAngles(count: number, baseAngle: number, out: number[]): number {
  const pairs = Math.floor(Math.max(0, Math.floor(count)) / 2);
  let w = 0;
  for (let p = pairs; p >= 1; p -= 1) {
    out[w] = baseAngle - SPLIT_SPREAD * p;
    w += 1;
  }
  for (let p = 1; p <= pairs; p += 1) {
    out[w] = baseAngle + SPLIT_SPREAD * p;
    w += 1;
  }
  return w;
}

/** 追踪：朝目标角转一步（速率上限 turnRatePerSec，角度差先归一化） */
export function homingStep(
  currentAngle: number,
  targetAngle: number,
  dt: number,
  turnRatePerSec: number,
): number {
  return normalizeAngle(steerAngle(currentAngle, targetAngle, turnRatePerSec * dt));
}
