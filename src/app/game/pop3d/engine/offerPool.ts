// ═══════════════════════════════════════════════════════════════════
// POP3D — 三选一的抽卡逻辑（纯函数，零依赖）
// 独立成模块的原因有二：
//   1. 它是唯一需要单测的纯逻辑，零相对导入才能被 node:test 直接 import
//   2. 满层卡绝不能再被发出（否则玩家点了没反应，三选一卡死）
// ═══════════════════════════════════════════════════════════════════

export interface OfferCandidate {
  id: string;
  /** 该卡最多叠几层 */
  max: number;
}

/**
 * 从"还没满层"的候选里无放回抽 n 张。
 * 未满层不足 n 张时就少发（绝不补发已满层的卡）；全满则返回空数组。
 * 用部分 Fisher–Yates，保证一定能抽满 want 张且不重复。
 */
export function pickOffer<T extends OfferCandidate>(
  pool: readonly T[],
  owned: Record<string, number>,
  n: number,
  rng: () => number,
): T[] {
  const fresh: T[] = [];
  for (let i = 0; i < pool.length; i += 1) {
    const c = pool[i];
    if ((owned[c.id] ?? 0) < c.max) fresh.push(c);
  }
  const want = Math.min(n, fresh.length);
  for (let i = 0; i < want; i += 1) {
    const j = i + Math.floor(rng() * (fresh.length - i));
    const tmp = fresh[i];
    fresh[i] = fresh[j];
    fresh[j] = tmp;
  }
  return fresh.slice(0, want);
}
