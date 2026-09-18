// ═══════════════════════════════════════════════════════════════════
// RAIDEN — static configuration (colors, ships, weapons, cards, waves)
// ═══════════════════════════════════════════════════════════════════

import type { CardDef, ShipType, WeaponType, WaveEntry } from "./types";

// ── pixel font ──
export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

// ── design-doc color system ──
export const COLORS = {
  player: "#5AD9FF",
  playerBullet: "#5AD9FF",
  laser: "#FFFFFF",
  enemy: "#FF6050",
  enemyBullet: "#FF6050",
  boss: "#A040FF",
  bossBullet: "#A040FF",
  explosion: "#FFD83D",
  powerUp: "#FFE14A",
  warning: "#FF2020",
  dangerPulse: "#FF2020",
  missile: "#FFD83D",
  // backgrounds
  bgDark: "#060A18",
  bgMid: "#101C30",
  uiBorder: "rgba(90,217,255,0.25)",
  uiBg: "rgba(6,10,24,0.85)",
  textDim: "rgba(148,163,184,0.5)",
  textBright: "#FFFFFF",
} as const;

// ── canvas dimensions + pixel scale ──
export const CW = 360;
export const CH = 540;
export const P = 4;

// ── weapon names / icons ──
export const WEAPON_NAMES: Record<WeaponType, string> = {
  spread: "散弹",
  laser: "激光",
  wave: "波纹",
};
export const WEAPON_ICONS: Record<WeaponType, string> = {
  spread: "💥",
  laser: "🔫",
  wave: "〰️",
};

// ── ship types — each determines starting weapon and style ──
export const SHIP_TYPES: readonly ShipType[] = ["ion", "nova", "pulse"];
export const SHIP_CONFIG: Record<ShipType, { weapon: WeaponType; label: string; desc: string; icon: string }> = {
  ion: { weapon: "laser", label: "离子炮", desc: "贯穿激光", icon: "🔫" },
  nova: { weapon: "spread", label: "新星", desc: "散射火力", icon: "💥" },
  pulse: { weapon: "wave", label: "脉冲", desc: "波纹冲击", icon: "〰️" },
};

// ── gacha cards ──
export const SR_CARDS: CardDef[] = [
  { id: "power_up", name: "火力升级", icon: "⚡", rarity: "SR", desc: "武器等级 +1" },
  { id: "bomb_give", name: "炸弹补给", icon: "💣", rarity: "SR", desc: "炸弹 +1" },
  { id: "life_give", name: "生命之心", icon: "❤️", rarity: "SR", desc: "生命 +1" },
  { id: "shield_s", name: "护盾", icon: "🛡️", rarity: "SR", desc: "3 秒无敌" },
  { id: "wingmanUp", name: "僚机升级", icon: "✈️", rarity: "SR", desc: "僚机等级 +1" },
];
export const SSR_CARDS: CardDef[] = [
  { id: "shield_l", name: "能量护盾", icon: "🔮", rarity: "SSR", desc: "5 秒无敌" },
  { id: "fire_storm", name: "火力风暴", icon: "🔥", rarity: "SSR", desc: "MAX 火力5秒" },
  { id: "life_pack", name: "生命补给", icon: "💖", rarity: "SSR", desc: "额外 +2 命" },
  { id: "nuke", name: "核弹", icon: "☢️", rarity: "SSR", desc: "全屏清怪 +2 炸弹" },
];

// ── green option orb radius ──
export const GREEN_ORB_R = 7;

// ── boss wave table (score thresholds now accelerate; time drives the floor) ──
export const WAVE_TABLE: WaveEntry[] = [
  { score: 5000, boss: "fortress", bossHp: 60, name: "钢铁堡垒", subtitle: "重型火力堡垒出现了" },
  { score: 12000, boss: "carrier", bossHp: 85, name: "星际航母", subtitle: "航母正在释放舰载机" },
  { score: 20000, boss: "eye", bossHp: 110, name: "魔眼", subtitle: "巨型魔眼正在注视你" },
  { score: 30000, boss: "fortress", bossHp: 135, name: "堡垒·改", subtitle: "强化堡垒，火力翻倍" },
  { score: 42000, boss: "carrier", bossHp: 160, name: "航母·改", subtitle: "精英航母编队" },
  { score: 55000, boss: "eye", bossHp: 185, name: "魔眼·改", subtitle: "终极魔眼" },
];
