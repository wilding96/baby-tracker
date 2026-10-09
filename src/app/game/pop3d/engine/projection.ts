// ═══════════════════════════════════════════════════════════════════
// POP3D — 投影补偿（纯函数，零依赖）
// 相机有俯角时，抬高的物体会在屏幕上上移 h·sin(pitch)。
// 把绘制位置沿世界 z 推后 h·tan(pitch)，即可让"画出来的像素 = 地面判定点"，
// 保证弹幕判定绝对公平（§5 可读性红线的量化实现）。
// ═══════════════════════════════════════════════════════════════════

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 世界点 (y, z) 在屏幕纵向上的分量（相机俯角 pitchRad，屏幕上方 = -z） */
export function screenUp(y: number, z: number, pitchRad: number): number {
  return y * Math.sin(pitchRad) - z * Math.cos(pitchRad);
}

/** 绘制用的 z：让高度 y 的实体落在与地面判定点相同的像素上 */
export function compensatedZ(z: number, y: number, pitchRad: number): number {
  return z + y * Math.tan(pitchRad);
}
