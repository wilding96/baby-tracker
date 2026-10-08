// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 局外养成（localStorage 持久化）
// ═══════════════════════════════════════════════════════════════════

import { META_UPGRADES, STARDUST_RATE } from "./config";
import type { MetaData } from "./types";
import { EMPTY_META } from "./types";

const KEY = "pop_raider_meta_v1";

export function loadMeta(): MetaData {
  if (typeof window === "undefined") return cloneEmpty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return cloneEmpty();
    const parsed = JSON.parse(raw) as Partial<MetaData>;
    return {
      stardust: num(parsed.stardust),
      highScore: num(parsed.highScore),
      runs: num(parsed.runs),
      upgrades: {
        life: num(parsed.upgrades?.life),
        bomb: num(parsed.upgrades?.bomb),
        energy: num(parsed.upgrades?.energy),
        revive: num(parsed.upgrades?.revive),
      },
    };
  } catch {
    return cloneEmpty();
  }
}

export function saveMeta(m: MetaData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* 隐私模式等场景下静默失败 */
  }
}

/** 一局打完的星尘收益 */
export function stardustFor(score: number): number {
  return Math.max(1, Math.round(score * STARDUST_RATE));
}

/** 买一级；返回新的 MetaData（不改原对象） */
export function buyUpgrade(m: MetaData, key: keyof MetaData["upgrades"]): MetaData {
  const def = META_UPGRADES.find((u) => u.key === key);
  if (!def) return m;
  const lv = m.upgrades[key];
  if (lv >= def.max) return m;
  const price = def.cost(lv);
  if (m.stardust < price) return m;
  return {
    ...m,
    stardust: m.stardust - price,
    upgrades: { ...m.upgrades, [key]: lv + 1 },
  };
}

/** 面板里展示「当前等级 / 下一级价格 / 是否买得起」 */
export function upgradeInfo(m: MetaData, key: keyof MetaData["upgrades"]) {
  const def = META_UPGRADES.find((u) => u.key === key)!;
  const lv = m.upgrades[key];
  const maxed = lv >= def.max;
  const price = maxed ? 0 : def.cost(lv);
  return {
    label: def.label,
    desc: def.desc,
    lv,
    max: def.max,
    maxed,
    price,
    affordable: !maxed && m.stardust >= price,
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
}

function cloneEmpty(): MetaData {
  return { ...EMPTY_META, upgrades: { ...EMPTY_META.upgrades } };
}
