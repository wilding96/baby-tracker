// ═══════════════════════════════════════════════════════════════════
// POP3D — 运镜（纯函数，零依赖）
// 规则：常规战斗恒为基准机位，只有 Boss 过场的三个窗口才偏离俯视。
// 抽成纯函数是为了能被单测钉死——2 秒的动画靠截图很难稳定验证。
// ═══════════════════════════════════════════════════════════════════

export type CineKind = "intro" | "phase" | "down";

export interface RigTarget {
  pitchDeg: number;
  distMul: number;
}

/** 平滑插值（smoothstep），让运镜起止都不生硬 */
function smoothstep(k: number): number {
  return k * k * (3 - 2 * k);
}

/**
 * 由"当前运镜类型 + 进度 k（0→1）"算出相机目标机位。
 * - intro：55° 低机位、距离 ×1.3 起手，结束时回到基准（Boss 入场）
 * - phase：推近到 ×0.85 再回位，不动俯角（阶段切换）
 * - down ：拉远到 ×1.35（击破慢动作）
 */
export function cineTarget(
  kind: CineKind | null,
  k: number,
  basePitchDeg: number,
): RigTarget {
  if (!kind) return { pitchDeg: basePitchDeg, distMul: 1 };
  const t = Math.min(1, Math.max(0, k));
  if (kind === "intro") {
    const e = smoothstep(t);
    return { pitchDeg: 55 + (basePitchDeg - 55) * e, distMul: 1.3 + (1 - 1.3) * e };
  }
  if (kind === "phase") {
    return { pitchDeg: basePitchDeg, distMul: 1 - 0.15 * Math.sin(Math.PI * t) };
  }
  return { pitchDeg: basePitchDeg, distMul: 1 + 0.35 * smoothstep(t) };
}

/** 指数逼近：约 ratePerSec 的收敛速度，dt=0 时完全不动 */
export function approach(current: number, want: number, dt: number, ratePerSec: number): number {
  const s = 1 - Math.exp(-ratePerSec * dt);
  return current + (want - current) * s;
}
