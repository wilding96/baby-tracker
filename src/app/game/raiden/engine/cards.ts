// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 流派卡的抽取、应用与派生查询
// ═══════════════════════════════════════════════════════════════════

import { CARDS, ENERGY, PLAYER } from "./config";
import type { CardDef, RunState } from "./types";

/** 已满层的卡不再出现，保证「没有冷板凳」也不发废牌 */
export function rollOffer(cards: Record<string, number>, n = 3): CardDef[] {
  const fresh = CARDS.filter((c) => (cards[c.id] ?? 0) < c.max);
  const src = fresh.length >= n ? fresh : CARDS.slice();
  const picked: CardDef[] = [];
  const taken = new Set<number>();
  let guard = 0;
  while (picked.length < n && guard++ < 200) {
    const i = Math.floor(Math.random() * src.length);
    if (taken.has(i)) continue;
    taken.add(i);
    picked.push(src[i]);
  }
  return picked;
}

/**
 * 应用一张卡。这里是「行为」的落点：
 * 有些卡落成即时状态，有些只记层数、由运行时查询读取。
 */
export function applyCard(s: RunState, id: string): void {
  s.cards[id] = (s.cards[id] ?? 0) + 1;
  s.upgrades++;

  // 每 3 次升级，主武器提一级（上限 4）
  if (s.upgrades % ENERGY.levelsPerWeaponUp === 0 && s.weaponLv < 4) s.weaponLv++;

  switch (id) {
    case "bombup":
      s.player.maxBombs++;
      s.player.bombs++;
      break;
    case "flow":
      s.energyNeed = Math.max(40, Math.round(s.energyNeed * 0.86));
      break;
    case "leech":
      if (s.player.maxHp < 6) s.player.maxHp++;
      break;
    default:
      break;
  }
}

// ── 运行时派生值 ──

export function lv(s: RunState, id: string): number {
  return s.cards[id] ?? 0;
}

export function magnetRadius(s: RunState): number {
  return ENERGY.magnetDefault + lv(s, "magnet") * 90;
}

export function pierceCount(s: RunState): number {
  return lv(s, "pierce");
}

/** 乘在冷却帧上的系数，越小越快 */
export function fireRateMul(s: RunState): number {
  return 1 / (1 + lv(s, "rate") * 0.18);
}

/** 属性克制的额外加成 */
export function elementBonus(s: RunState): number {
  return lv(s, "mastery") * 0.5;
}

/** 背水一战 */
export function damageMul(s: RunState): number {
  return lv(s, "last") > 0 && s.player.hp <= 1 ? 2 : 1;
}

export function guardFrames(s: RunState): number {
  return lv(s, "guard") > 0 ? 90 : 0;
}

export function hasCard(s: RunState, id: string): boolean {
  return lv(s, id) > 0;
}

/** 初始生命 / 炸弹：把局外养成算进去 */
export function startingHp(metaLife: number): number {
  return Math.max(1, 3 + metaLife);
}

export function startingBombs(metaBomb: number): number {
  return 3 + metaBomb;
}

export function playerInvuln(): number {
  return PLAYER.invulnOnHit;
}
