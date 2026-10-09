// ═══════════════════════════════════════════════════════════════════
// POP3D — 附着物几何（纯函数，零依赖）
// 僚机编队位与环绕弹位置：位置由"玩家在哪 + 第几个槽位"决定。
// ═══════════════════════════════════════════════════════════════════

/** 僚机编队位：左右交替，第二对更靠后 */
export function wingmanSlot(
  slot: number,
  playerX: number,
  playerZ: number,
  offsetX: number,
  offsetZ: number,
): { x: number; z: number } {
  const side = slot % 2 === 0 ? -1 : 1;
  const row = Math.floor(slot / 2);
  return { x: playerX + side * (offsetX + row * 1.4), z: playerZ + offsetZ + row * 1.0 };
}

/** 环绕弹：绕玩家画圆，角度已由调用方推进 */
export function orbitPos(
  playerX: number,
  playerZ: number,
  angle: number,
  radius: number,
): { x: number; z: number } {
  return { x: playerX + Math.cos(angle) * radius, z: playerZ + Math.sin(angle) * radius };
}
