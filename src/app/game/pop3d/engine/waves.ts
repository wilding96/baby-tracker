// ═══════════════════════════════════════════════════════════════════
// POP3D — 编队解算（纯函数）
// 只放"把一条波次解算成一组横坐标"的逻辑；波次表本身是数值，
// 按 §3「所有可调数值集中在 config」留在 engine/config.ts。
// 结果写进调用方传入的数组，避免每次生成都新建数组。
// ═══════════════════════════════════════════════════════════════════

import type { SpawnPattern } from "./types";

/** 横排两端各留出的余量 */
const LINE_INSET = 6;
/** 两翼编队离边界的距离 */
const EDGE_INSET = 4;

function rand(rng: () => number, a: number, b: number): number {
  return a + rng() * (b - a);
}

/**
 * 解算一条波次的横坐标，写进 out，返回写入条数。
 * out 由调用方复用，本函数不分配。
 */
export function resolveSpawnXs(
  pattern: SpawnPattern,
  count: number,
  halfW: number,
  rng: () => number,
  out: number[],
): number {
  const n = Math.max(0, Math.floor(count));
  if (pattern === "line") {
    const span = halfW * 2 - LINE_INSET;
    for (let k = 0; k < n; k += 1) out[k] = -span / 2 + (span * (k + 0.5)) / n;
  } else if (pattern === "sides") {
    for (let k = 0; k < n; k += 1) {
      out[k] = (k % 2 === 0 ? -1 : 1) * (halfW - EDGE_INSET);
    }
  } else if (pattern === "column") {
    const x = rand(rng, -halfW + EDGE_INSET, halfW - EDGE_INSET);
    for (let k = 0; k < n; k += 1) out[k] = x;
  } else {
    for (let k = 0; k < n; k += 1) {
      out[k] = rand(rng, -halfW + EDGE_INSET, halfW - EDGE_INSET);
    }
  }
  return n;
}
