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
 *
 * v2：`prismatic` 为 true 时，**必带一张炫彩卡**（每局只出一次，见 §卡牌 v2 设计），
 * 其余位用普通卡补齐；普通卡不够就少发（沿用原来的规则）。
 */
export function rollOffer(
  cards: Record<string, number>,
  n = 3,
  pool: readonly CardDef[] = CARDS,
  opts: { prismatic?: boolean; guaranteeWpn?: boolean; exclude?: readonly string[] } = {},
): CardDef[] {
  const fresh = pool.filter(
    (c) => (cards[c.id] ?? 0) < c.max && !opts.exclude?.includes(c.id),
  );
  const out: CardDef[] = [];
  // 第一次三选一必带主武器强化：主炮升级只能靠这张卡，不能让玩家错过
  if (opts.guaranteeWpn) {
    const wpn = fresh.find((c) => c.id === "wpn");
    if (wpn) out.push(wpn);
  }
  if (opts.prismatic) {
    const prismatics = fresh.filter((c) => c.tier === "prismatic");
    if (prismatics.length > 0) {
      out.push(prismatics[Math.floor(Math.random() * prismatics.length)]);
    }
  }
  const commons = fresh.filter((c) => c.tier === "common" && !out.includes(c));
  out.push(...pickOffer(commons, {}, Math.max(0, n - out.length), Math.random));
  return out;
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
