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
  /**
   * 哑铃弹（魂斗罗 F 弹那种"两颗火球绕轴转"）：`arm` 是两瓣到中心的距离，
   * `spin` 是自转角速度，剩下三个是**每发随机的弹道扰动**——
   * `drift` 恒定横漂、`amp`/`freq` 蛇形摆动。位置由引擎积分，
   * 所以"打空"是真实结果（判定和视觉永远一致），而不是假动画。
   */
  chaotic?: { arm: number; spin: number; drift: number; amp: number; freq: number };
}

const DEFS: Record<PlayerBulletKind, BulletDef> = {
  // radius 在 BULLET_VIS.scale=1.5 之后同步放宽了 1.2 倍：
  // 弹体看起来更大，判定也要跟上，否则会出现"看着打中了却没伤害"。
  // 三把枪的**速度**也拉开：离子中速贯穿、新星低速重炮、脉冲高速细弹。
  bolt: { speed: 62, dmgMul: 1.25, pierce: 1, life: 0, radius: 0.54 },
  spread: { speed: 44, dmgMul: 0.8, pierce: 0, life: 0, radius: 0.68 },
  // 脉冲（三号机）：哑铃火球 —— 两瓣绕轴自转 + 每发随机的弹道漂移，
  // 打空是设计的一部分（所以单发伤害给得高）。
  wave: {
    speed: 32,
    dmgMul: 1.2,
    pierce: 0,
    life: 0,
    radius: 0.45,
    chaotic: { arm: 1.15, spin: 7, drift: 1.1, amp: 0.9, freq: 3.6 },
  },
  homing: { speed: 34, dmgMul: 0.7, pierce: 0, life: 3.0, radius: 0.42 },
  mini: { speed: 38, dmgMul: 0.35, pierce: 0, life: 1.2, radius: 0.26 },
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
