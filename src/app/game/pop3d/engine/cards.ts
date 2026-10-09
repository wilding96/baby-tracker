// ═══════════════════════════════════════════════════════════════════
// POP3D — 流派卡的抽取与派生查询
// 「行为」的落点在 game.ts 的 recomputeMods()，这里只负责发牌与计数。
// ═══════════════════════════════════════════════════════════════════

import { CARDS, CARD_BY_ID } from "./config";
import { pickOffer } from "./offerPool";
import type { CardDef } from "./types";

/**
 * 已满层的卡不再出现，保证「没有冷板凳」也不发废牌。
 * `pool` 可覆盖候选池（视觉调试期用来临时藏掉整条流派）。
 */
export function rollOffer(cards: Record<string, number>, n = 3, pool: readonly CardDef[] = CARDS): CardDef[] {
  return pickOffer(pool, cards, n, Math.random);
}

export function lv(cards: Record<string, number>, id: string): number {
  return cards[id] ?? 0;
}

export function hasCard(cards: Record<string, number>, id: string): boolean {
  return lv(cards, id) > 0;
}

export function cardDef(id: string): CardDef | undefined {
  return CARD_BY_ID[id];
}
