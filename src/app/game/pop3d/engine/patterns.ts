// ═══════════════════════════════════════════════════════════════════
// POP3D — 弹幕几何（纯函数，零依赖）
// 约定：角度 0 = +X（屏幕右），π/2 = +Z（屏幕下，朝玩家）。
// 全部标量进出：调用方在循环里自己组装速度，开火路径不产生任何分配。
// ═══════════════════════════════════════════════════════════════════

const TAU = Math.PI * 2;

/** 把任意角折算到 (-π, π]，避免追踪弹绕远路 */
export function normalizeAngle(a: number): number {
  let x = a % TAU;
  if (x <= -Math.PI) x += TAU;
  else if (x > Math.PI) x -= TAU;
  return x;
}

/** 由位移向量求朝向角 */
export function aimedAngle(dx: number, dz: number): number {
  return Math.atan2(dz, dx);
}

/** 扇形第 i 发的角度（以 baseRad 为中心左右对称） */
export function fanAngle(i: number, count: number, spreadRad: number, baseRad: number): number {
  return baseRad + (i - (count - 1) / 2) * spreadRad;
}

/** 环形第 i 发的角度（均匀分布 + 整体相位） */
export function ringAngle(i: number, count: number, phaseRad: number): number {
  return phaseRad + (i * TAU) / count;
}

/** 螺旋：返回下一步相位 */
export function spiralAngle(phaseRad: number, stepRad: number): number {
  return phaseRad + stepRad;
}

/** 比例导引：朝目标角转，单步不超过 maxTurnRad（先归一化角度差） */
export function steerAngle(current: number, target: number, maxTurnRad: number): number {
  const diff = normalizeAngle(target - current);
  if (diff > maxTurnRad) return current + maxTurnRad;
  if (diff < -maxTurnRad) return current - maxTurnRad;
  return target;
}
