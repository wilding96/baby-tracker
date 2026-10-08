// ═══════════════════════════════════════════════════════════════════
// POP3D — 流派卡的抽取与派生查询
// 「行为」的落点在 game.ts 的 recomputeMods()，这里只负责发牌与计数。
// ═══════════════════════════════════════════════════════════════════

import { CARDS, CARD_BY_ID } from "./config";
import type { CardDef } from "./types";

/** 已满层的卡不再出现，保证「没有冷板凳」也不发废牌 */
export function rollOffer(cards: Record<string, number>, n = 3): CardDef[] {
  const fresh = CARDS.filter((c) => (cards[c.id] ?? 0) < c.max);
  const src = fresh.length >= n ? fresh : CARDS;
  const picked: CardDef[] = [];
  const taken = new Set<number>();
  let guard = 0;
  while (picked.length < n && guard < 200) {
    guard += 1;
    const i = Math.floor(Math.random() * src.length);
    if (taken.has(i)) continue;
    taken.add(i);
    picked.push(src[i]);
  }
  return picked;
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
