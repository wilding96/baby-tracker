// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 全部可调数值集中在这里
// ═══════════════════════════════════════════════════════════════════

import type { BossType, CardDef, Element, MetaData, ShipType } from "./types";

// ── 逻辑画布 ──
export const W = 360;
export const H = 640;

// ── 波普调色板 ──
export const PAL = {
  red: "#FF2D2D",
  magenta: "#E5007E",
  yellow: "#FFD400",
  blue: "#0057FF",
  cyan: "#00C2FF",
  ink: "#101010",
  paper: "#FFF8E7",
  green: "#00A05A",
} as const;

export const ELEMENT_COLOR: Record<Element, string> = {
  electric: PAL.cyan,
  fire: PAL.red,
  ice: PAL.blue,
};

export const ELEMENT_NAME: Record<Element, string> = {
  electric: "电",
  fire: "火",
  ice: "冰",
};

export const ELEMENT_ICON: Record<Element, string> = {
  electric: "⚡",
  fire: "🔥",
  ice: "❄",
};

// ── 机型：机型决定主武器，主武器决定攻击属性 ──
export const SHIPS: readonly ShipType[] = ["ion", "nova", "pulse"] as const;

export const SHIP_INFO: Record<
  ShipType,
  { label: string; blurb: string; element: Element; icon: string }
> = {
  ion: { label: "离子炮", blurb: "贯穿激光 · 高单体", element: "electric", icon: "🔫" },
  nova: { label: "新星", blurb: "散射火力 · 广覆盖", element: "fire", icon: "💥" },
  pulse: { label: "脉冲", blurb: "波纹冲击 · 带回旋", element: "ice", icon: "〰️" },
};

export const SHIP_ELEMENT: Record<ShipType, Element> = {
  ion: "electric",
  nova: "fire",
  pulse: "ice",
};

/** 主武器 Lv1~4 的弹数 / 单发伤害 / 冷却帧 */
export const WEAPON_TABLE: Record<ShipType, { n: number; dmg: number; cd: number }[]> = {
  ion: [
    { n: 1, dmg: 4.2, cd: 9 },
    { n: 2, dmg: 3.8, cd: 9 },
    { n: 3, dmg: 3.5, cd: 8 },
    { n: 3, dmg: 4.4, cd: 7 },
  ],
  nova: [
    { n: 3, dmg: 2.1, cd: 8 },
    { n: 5, dmg: 2.0, cd: 8 },
    { n: 5, dmg: 2.4, cd: 7 },
    { n: 7, dmg: 2.5, cd: 7 },
  ],
  pulse: [
    { n: 2, dmg: 3.0, cd: 10 },
    { n: 3, dmg: 2.8, cd: 10 },
    { n: 4, dmg: 2.8, cd: 9 },
    { n: 5, dmg: 3.0, cd: 8 },
  ],
};

// ── 玩家基础 ──
export const PLAYER = {
  speed: 4.4,
  hitR: 5,
  invulnOnHit: 96,
  invulnOnSpawn: 110,
} as const;

// ── 能量与升级 ──
export const ENERGY = {
  base: 100,
  growth: 1.16,
  /** 每几次升级提一级主武器 */
  levelsPerWeaponUp: 3,
  magnetDefault: 46,
} as const;

// ── 属性克制倍率 ──
export const ELEMENT_MOD = {
  weak: 1.9,
  resist: 0.45,
  neutral: 1,
} as const;

// ── 敌机原型 ──
export interface EnemyProto {
  kind: 0 | 1 | 2;
  hp: number;
  r: number;
  score: number;
  energy: number;
  fireCd: number;
}

export const ENEMY_PROTO: Record<0 | 1 | 2, EnemyProto> = {
  0: { kind: 0, hp: 6, r: 12, score: 100, energy: 8, fireCd: 78 },
  1: { kind: 1, hp: 26, r: 18, score: 400, energy: 15, fireCd: 54 },
  2: { kind: 2, hp: 68, r: 24, score: 900, energy: 30, fireCd: 46 },
};

export const ELEMENTS: readonly Element[] = ["electric", "fire", "ice"] as const;

// ── Boss ──
export const BOSS_TABLE: Record<
  BossType,
  { name: string; hp: number; element: Element; icon: string }
> = {
  fortress: { name: "钢铁堡垒", hp: 300, element: "fire", icon: "🏰" },
  carrier: { name: "星际航母", hp: 360, element: "electric", icon: "🛰" },
  eye: { name: "魔眼", hp: 440, element: "ice", icon: "👁" },
};

export const BOSS_ORDER: readonly BossType[] = ["fortress", "carrier", "eye"] as const;

/** 每推进一个阶段提升的强度 */
export const STAGE_SCALE = { hp: 1.35, score: 1.25 } as const;

// ── 流派卡（行为卡，不是纯数值卡） ──
export const CARDS: CardDef[] = [
  // 弹幕流
  { id: "split", name: "分裂弹", school: "barrage", icon: "⊹", desc: "击杀后 2 秒内弹数 +2", max: 2 },
  { id: "pierce", name: "贯穿", school: "barrage", icon: "↟", desc: "子弹可多穿透 1 个敌人", max: 3 },
  { id: "backfire", name: "后向炮", school: "barrage", icon: "⇅", desc: "同时向后发射 45% 伤害的弹", max: 1 },
  { id: "wings", name: "侧翼僚机", school: "barrage", icon: "✈", desc: "两侧各加一门副炮", max: 2 },
  { id: "rate", name: "超频", school: "barrage", icon: "⏩", desc: "射速提升 18%", max: 3 },

  // 元素流
  { id: "chain", name: "连锁闪电", school: "element", icon: "⚡", desc: "命中时电击最近的敌人", max: 2 },
  { id: "burn", name: "点燃", school: "element", icon: "🔥", desc: "命中叠加灼烧，满层引爆", max: 2 },
  { id: "chill", name: "冰缓", school: "element", icon: "❄", desc: "命中减速敌人 22%", max: 2 },
  { id: "mastery", name: "属性精通", school: "element", icon: "◆", desc: "属性克制倍率 +0.5", max: 2 },

  // 生存流
  { id: "leech", name: "击杀回血", school: "survival", icon: "❤", desc: "每 40 击杀回复 1 点生命", max: 2 },
  { id: "guard", name: "受击护盾", school: "survival", icon: "🛡", desc: "每次受伤附带 1.5 秒无敌", max: 1 },
  { id: "last", name: "背水一战", school: "survival", icon: "‼", desc: "仅剩 1 点生命时伤害 ×2", max: 1 },
  { id: "revive", name: "复活强化", school: "survival", icon: "↻", desc: "复活后 6 秒无敌 + 火力拉满", max: 1 },

  // 经济流
  { id: "magnet", name: "能量磁场", school: "economy", icon: "◎", desc: "碎片吸附半径 +90", max: 2 },
  { id: "flow", name: "能量回流", school: "economy", icon: "∞", desc: "升级所需能量 -14%", max: 3 },
  { id: "bombup", name: "炸弹补给", school: "economy", icon: "💣", desc: "炸弹 +1，且上限 +1", max: 3 },
];

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(
  CARDS.map((c) => [c.id, c]),
);

export const SCHOOL_NAME: Record<CardDef["school"], string> = {
  barrage: "弹幕流",
  element: "元素流",
  survival: "生存流",
  economy: "经济流",
};

export const SCHOOL_COLOR: Record<CardDef["school"], string> = {
  barrage: PAL.blue,
  element: PAL.magenta,
  survival: PAL.red,
  economy: PAL.yellow,
};

// ── 拟声词（预渲染成精灵） ──
export const WORDS = {
  kill: ["POW!", "WHAM!", "BIFF!"],
  elite: ["BOOM!", "KRUNCH!"],
  clear: ["KAPOW!"],
  hurt: ["OUCH!"],
  warn: ["WARNING!"],
  level: ["LEVEL UP!"],
} as const;

export interface WordSpec {
  text: string;
  size: number;
  color: string;
}

/** 扁平化的拟声词表；渲染层按下标预渲染，运行时只查表 */
export const WORD_SPRITES: WordSpec[] = [
  ...WORDS.kill.map((t) => ({ text: t, size: 17, color: PAL.yellow })),
  ...WORDS.elite.map((t) => ({ text: t, size: 24, color: PAL.magenta })),
  { text: "KAPOW!", size: 46, color: PAL.red },
  { text: "OUCH!", size: 20, color: PAL.red },
  { text: "WARNING!", size: 30, color: PAL.red },
  { text: "LEVEL UP!", size: 26, color: PAL.cyan },
];

export const WORD = {
  kill: 0,
  elite: 3,
  clear: 5,
  hurt: 6,
  warn: 7,
  level: 8,
} as const;

// ── 局外养成 ──
export interface MetaUpgradeDef {
  key: keyof MetaData["upgrades"];
  label: string;
  desc: string;
  max: number;
  cost: (level: number) => number;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  { key: "life", label: "强化装甲", desc: "初始生命 +1", max: 3, cost: (l) => 60 + l * 60 },
  { key: "bomb", label: "弹药储备", desc: "初始炸弹 +1", max: 2, cost: (l) => 80 + l * 80 },
  { key: "energy", label: "能量引擎", desc: "能量获取 +12%", max: 3, cost: (l) => 70 + l * 70 },
  { key: "revive", label: "备用机体", desc: "额外复活 1 次", max: 1, cost: () => 260 },
];

/** 每局得分换算星尘的比例 */
export const STARDUST_RATE = 0.06;
