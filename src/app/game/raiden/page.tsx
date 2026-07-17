"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import { useGameAudio } from "@/hooks/useGameAudio";

// ═══════════════════════════════════════════════════════════════════
// PIXEL FONT
// ═══════════════════════════════════════════════════════════════════

const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

// ═══════════════════════════════════════════════════════════════════
// RAIDEN DESIGN DOC COLOR SYSTEM
// ═══════════════════════════════════════════════════════════════════
const COLORS = {
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
};

// ═══════════════════════════════════════════════════════════════════
// PIXEL SPRITE DRAWING
// ═══════════════════════════════════════════════════════════════════

function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: string[],
  colors: Record<string, string>,
  x: number,
  y: number,
  s: number,
) {
  const h = map.length, w = map[0].length;
  // Pass 1: black contour outline (only edge-adjacent cells)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (map[py][px] === ".") continue;
      const edge = py === 0 || py === h - 1 || px === 0 || px === w - 1 ||
        map[py - 1][px] === "." || map[py + 1][px] === "." ||
        map[py][px - 1] === "." || map[py][px + 1] === ".";
      if (edge) {
        ctx.fillStyle = "#000";
        ctx.fillRect(x + px * s, y + py * s, s, s);
      }
    }
  }
  // Pass 2: color fill (inset by 1 on edge cells for border visibility)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const ch = map[py][px];
      if (ch === ".") continue;
      const edge = py === 0 || py === h - 1 || px === 0 || px === w - 1 ||
        map[py - 1][px] === "." || map[py + 1][px] === "." ||
        map[py][px - 1] === "." || map[py][px + 1] === ".";
      ctx.fillStyle = colors[ch] ?? "#fff";
      if (edge) {
        ctx.fillRect(x + px * s + 1, y + py * s + 1, s - 2, s - 2);
      } else {
        ctx.fillRect(x + px * s, y + py * s, s, s);
      }
    }
  }
}

const P = 4;

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color: string, size = 10,
  align: CanvasTextAlign = "center",
  strokeW = 2,
) {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = strokeW;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

const PLAYER = [
  "..b.b..",
  ".bhhhb.",
  "bhhhhhb",
  "hhhhhhh",
  "bbbbbbb",
  ".bbbbs.",
  "..sss..",
];
const PLAYER_WING = ["b.", "bb"];
const WINGMAN_CRAFT = [
  ".b..",
  "bhhb",
  "bbbb",
  ".ss.",
];
const FIGHTER = ["..bb..", ".bhhb.", "bhhhhb", "..bb..", "..ss.."];
const BOMBER = [".hhhhh.", "hhhhhhh", "hbbbbbh", "bbbbbbb", ".sssss."];
const INTERCEPTOR = [
  "..hhh..",
  ".hhhhh.",
  "hhhhhhh",
  "hhh.hhh",
  "..h.h..",
  "..s.s..",
];
const ELITE_SPRITE = [
  "..bbbbb..",
  ".bhhhhhb.",
  "bhhhhhhhb",
  "bbhhhhhbb",
  "bbbbbbbbb",
  ".bbbbbbb.",
  "..bbbbb..",
  "..b.b.b..",
];
const MINIBOSS_SPRITE = [
  "...bbbbb...",
  "..bbbbbbb..",
  ".bhhhhhhhb.",
  "bhhhhhhhhhb",
  "hhh.hhh.hhh",
  "hhh.hhh.hhh",
  "bhhhhhhhhhb",
  ".bhhhhhhhb.",
  "..bbbbbbb..",
  "...bbbbb...",
];

const BOSS_TYPES = ["fortress", "carrier", "eye"] as const;
type BossType = (typeof BOSS_TYPES)[number];

const BOSS_FORTRESS = [
  "..hhhhhhhhhh..",
  ".hhhhhhhhhhhh.",
  "hhhhhhhhhhhhhh",
  "hhhhhhhhhhhhhh",
  "hhhbbbhhbbbhhh",
  "hhhbbbhhbbbhhh",
  "hhhhhhhhhhhhhh",
  ".hhhhhhhhhhhh.",
  "..hhhhhhhhhh..",
  "..ssssssssss..",
];
const BOSS_CARRIER = [
  "...hhhhhh...",
  "..hhhhhhhh..",
  ".hhhhhhhhhh.",
  "hhhhhhhhhhhh",
  "hhhhhhhhhhhh",
  "hhhhhhhhhhhh",
  "hhhhhhhhhhhh",
  "h.hhhhhhhh.h",
  ".h.hhhhhh.h.",
  "..s.sssss.s.",
];
const BOSS_EYE_SPRITE = [
  "..hhhhhhhh..",
  ".hhhhhhhhhh.",
  "hhhhhhhhhhhh",
  "hhhhhhhhhhhh",
  "hhhhhhhhhhhh",
  "hhhhh..hhhhh",
  "hhhhhhhhhhhh",
  ".hhhhhhhhhh.",
  "..hhhhhhhh..",
  "..ssssssss..",
];
const BOSS_EYE_CORE = ["hh", "hh"];



const PURPLE_WING = [
  "..p..p..",
  ".ppp.ppp.",
  "ppppppppp",
  "ppppppppp",
  ".ppppppp.",
  "..ppppp..",
  "...ppp...",
  "...s.s...",
];
const GREEN_ORB_R = 7; // radius for green orb option

// ═══════════════════════════════════════════════════════════════════
// CARD / GACHA
// ═══════════════════════════════════════════════════════════════════

interface CardDef {
  id: string;
  name: string;
  icon: string;
  rarity: "SR" | "SSR";
  desc: string;
}
const SR_CARDS: CardDef[] = [
  { id: "power_up", name: "火力升级", icon: "⚡", rarity: "SR", desc: "武器等级 +1" },
  { id: "bomb_give", name: "炸弹补给", icon: "💣", rarity: "SR", desc: "炸弹 +1" },
  { id: "life_give", name: "生命之心", icon: "❤️", rarity: "SR", desc: "生命 +1" },
  { id: "shield_s", name: "护盾", icon: "🛡️", rarity: "SR", desc: "3 秒无敌" },
  { id: "wingmanUp", name: "僚机升级", icon: "✈️", rarity: "SR", desc: "僚机等级 +1" },
];
const SSR_CARDS: CardDef[] = [
  { id: "shield_l", name: "能量护盾", icon: "🔮", rarity: "SSR", desc: "5 秒无敌" },
  { id: "fire_storm", name: "火力风暴", icon: "🔥", rarity: "SSR", desc: "MAX 火力5秒" },
  { id: "life_pack", name: "生命补给", icon: "💖", rarity: "SSR", desc: "额外 +2 命" },
  { id: "nuke", name: "核弹", icon: "☢️", rarity: "SSR", desc: "全屏清怪 +2 炸弹" },
];
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function generateGachaOptions(): CardDef[] {
  return Array.from({ length: 3 }, () =>
    Math.random() < 0.2 ? { ...pickRandom(SSR_CARDS) } : { ...pickRandom(SR_CARDS) },
  );
}

// ═══════════════════════════════════════════════════════════════════
// WEAPON TYPES
// ═══════════════════════════════════════════════════════════════════

type WeaponType = "spread" | "laser" | "wave";

type OptionForm = "greenLaser" | "purpleWing";

interface OptionState {
  x: number; y: number;
  targetX: number; targetY: number;
  form: OptionForm;
  transformProgress: number;
  slashCooldown: number;
}

interface SlashEffect {
  x: number; y: number;
  alpha: number; radius: number;
  timer: number; maxTimer: number;
  alive: boolean;
}

const WEAPON_NAMES: Record<WeaponType, string> = {
  spread: "散弹",
  laser: "激光",
  wave: "波纹",
};
const WEAPON_ICONS: Record<WeaponType, string> = {
  spread: "💥",
  laser: "🔫",
  wave: "〰️",
};

// Ship types — each determines starting weapon and style
const SHIP_TYPES = ["ion", "nova", "pulse"] as const;
type ShipType = (typeof SHIP_TYPES)[number];
const SHIP_CONFIG: Record<ShipType, { weapon: WeaponType; label: string; desc: string; icon: string }> = {
  ion: { weapon: "laser", label: "离子炮", desc: "贯穿激光", icon: "🔫" },
  nova: { weapon: "spread", label: "新星", desc: "散射火力", icon: "💥" },
  pulse: { weapon: "wave", label: "脉冲", desc: "波纹冲击", icon: "〰️" },
};

interface Bullet {
  x: number; y: number; vx: number; vy: number;
  type: "player" | "enemy";
  wtype?: WeaponType;
  wingman?: boolean;
  lightning?: boolean;
  damage: number;
  alive: boolean;
}
interface Monster {
  x: number; y: number; hp: number; maxHp: number;
  speed: number;
  type: "fighter" | "bomber" | "interceptor" | "elite";
  alive: boolean;
  formation: boolean;
  vx: number; vy: number;
  formationGroup: number;
  flashTimer: number;
}
interface PowerUp {
  x: number; y: number; alive: boolean;
  type: "weapon" | "wingman" | "optionForm";
}
interface Boss {
  x: number; y: number; hp: number; maxHp: number;
  speed: number; alive: boolean;
  type: BossType;
  attackTimer: number;
  phase: number;
}
interface Miniboss {
  x: number; y: number; hp: number; maxHp: number;
  speed: number; alive: boolean;
  type: BossType;
  attackTimer: number;
  enterAnim: number; // animation timer, counts down; >0 means in entrance animation
}

interface EnergyFragment {
  x: number; y: number; value: number; alive: boolean;
  vx: number; vy: number;
}
interface Particle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; color: string; size: number;
  life: number; maxLife: number; gravity: number;
  alive: boolean;
}
interface Missile {
  x: number; y: number; vx: number; vy: number;
  targetX: number; targetY: number;
  alive: boolean;
}
interface Star {
  x: number; y: number; speed: number; size: number; brightness: number; layer: number;
}
interface ExhaustParticle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; size: number; life: number; maxLife: number;
  alive: boolean;
}

const CW = 360, CH = 540;

// ═══════════════════════════════════════════════════════════════════
// WAVE TABLE
// ═══════════════════════════════════════════════════════════════════

interface WaveEntry {
  score: number;
  boss: BossType;
  bossHp: number;
  name: string;
  subtitle: string;
}
const WAVE_TABLE: WaveEntry[] = [
  { score: 5000, boss: "fortress", bossHp: 40, name: "钢铁堡垒", subtitle: "重型火力堡垒出现了" },
  { score: 12000, boss: "carrier", bossHp: 55, name: "星际航母", subtitle: "航母正在释放舰载机" },
  { score: 20000, boss: "eye", bossHp: 70, name: "魔眼", subtitle: "巨型魔眼正在注视你" },
  { score: 30000, boss: "fortress", bossHp: 90, name: "堡垒·改", subtitle: "强化堡垒，火力翻倍" },
  { score: 42000, boss: "carrier", bossHp: 110, name: "航母·改", subtitle: "精英航母编队" },
  { score: 55000, boss: "eye", bossHp: 130, name: "魔眼·改", subtitle: "终极魔眼" },
];

// ═══════════════════════════════════════════════════════════════════
// LOCALSTORAGE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════

interface SaveData {
  highScore: number;
  totalGames: number;
  upgrades: {
    extraBomb: number;
    weaponBoost: boolean;
    startShield: boolean;
    startWingman: boolean;
  };
}
const SAVE_KEY = "raiden_save";
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // ensure upgrades field exists (old save data might not have it)
      if (!parsed.upgrades) {
        parsed.upgrades = { extraBomb: 0, weaponBoost: false, startShield: false, startWingman: false };
      }
      return parsed;
    }
  } catch {}
  return { highScore: 0, totalGames: 0, upgrades: { extraBomb: 0, weaponBoost: false, startShield: false, startWingman: false } };
}
function writeSave(data: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// OBJECT POOL
// ═══════════════════════════════════════════════════════════════════

class Pool<T extends { alive: boolean }> {
  items: T[] = [];
  private factory: () => T;
  private freeList: number[] = [];
  private indexMap = new Map<T, number>();

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get(): T {
    if (this.freeList.length > 0) {
      const idx = this.freeList.pop()!;
      const item = this.items[idx];
      item.alive = true;
      return item;
    }
    const n = this.factory();
    n.alive = true;
    const idx = this.items.length;
    this.items.push(n);
    this.indexMap.set(n, idx);
    return n;
  }

  release(item: T) {
    if (item.alive) {
      item.alive = false;
      const idx = this.indexMap.get(item);
      if (idx !== undefined) {
        this.freeList.push(idx);
        this.indexMap.delete(item);
      }
    }
  }

  forEachActive(callback: (item: T) => void) {
    for (const item of this.items) {
      if (item.alive) callback(item);
    }
  }

  releaseAll() {
    for (const item of this.items) item.alive = false;
  }
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function RaidenGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audio = useGameAudio();

  const [gameStarted, setGameStarted] = useState(false);
  const [startFadeOut, setStartFadeOut] = useState(false);
  const [score, setScore] = useState(0);
  const [weaponType, setWeaponType] = useState<WeaponType>("spread");
  const [weaponLevel, setWeaponLevel] = useState(1);
  const [shipType, setShipType] = useState<ShipType>("nova");
  const [bombCount, setBombCount] = useState(3);
  const [lives, setLives] = useState(3);
  const [isGameOver, setIsGameOver] = useState(false);
  const [invincible, setInvincible] = useState(false);
  const [bossHp, setBossHp] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showGacha, setShowGacha] = useState(false);
  const [gachaClosing, setGachaClosing] = useState(false);
  const [gachaCards, setGachaCards] = useState<CardDef[]>([]);
  const [hasHoming, setHasHoming] = useState(false);
  const [gachaCost, setGachaCost] = useState(10);
  const [overdriveTimer, setOverdriveTimer] = useState(0);
  const [waveAnnounce, setWaveAnnounce] = useState("");
  const [bossWarning, setBossWarning] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [wingmanLevel, setWingmanLevel] = useState(0);
  const [readyCountdown, setReadyCountdown] = useState(0); // 0=no countdown, >0=counting
  const [respawnTimer, setRespawnTimer] = useState(0); // death respawn invincibility + blink

  // ── mutable game state ref (avoids useEffect dep explosion) ──
  const gameRef = useRef({
    weaponLevel: 1, weaponType: "spread" as WeaponType,
    bombCount: 3, lives: 3, isPaused: false,
    isGameOver: false, gameStarted: false,
    hasHoming: false, wingmanLevel: 0, shipType: "nova" as ShipType,
    showGacha: false,
  });
  // sync from React state
  gameRef.current.weaponLevel = weaponLevel;
  gameRef.current.weaponType = weaponType;
  gameRef.current.bombCount = bombCount;
  gameRef.current.lives = lives;
  gameRef.current.isPaused = isPaused;
  gameRef.current.isGameOver = isGameOver;
  gameRef.current.gameStarted = gameStarted;
  gameRef.current.hasHoming = hasHoming;
  gameRef.current.wingmanLevel = wingmanLevel;
  gameRef.current.shipType = shipType;
  gameRef.current.showGacha = showGacha;

  // ── timeout refs for cleanup ──
  const gachaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeGachaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchAnchorRef = useRef<{ x: number; y: number; shipX: number; shipY: number } | null>(null);

  // ── 5-layer parallax star field (deep depth) ──
  const starsRef = useRef<Star[]>([]);
  if (starsRef.current.length === 0) {
    for (let i = 0; i < 120; i++) {
      const layer = i < 30 ? 0 : i < 60 ? 1 : i < 85 ? 2 : i < 105 ? 3 : 4;
      const speeds = [0.08, 0.25, 0.7, 1.8, 3.5];
      const sizes = [1, 1.2, 1.8, 2.5, 3.2];
      const brights = [0.06, 0.15, 0.28, 0.45, 0.55];
      starsRef.current.push({
        x: Math.random() * CW, y: Math.random() * CH,
        speed: speeds[layer] + (Math.random() - 0.5) * speeds[layer] * 0.4,
        size: sizes[layer],
        brightness: brights[layer] + (Math.random() - 0.5) * 0.2,
        layer,
      });
    }
  }

  // ── exhaust particles (pooled) ──
  const exhaustPool = useRef<Pool<ExhaustParticle>>(
    new Pool<ExhaustParticle>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      alpha: 0, size: 0, life: 0, maxLife: 0,
      alive: false,
    }))
  );

  const bgGradientRef = useRef<CanvasGradient | null>(null);
  const bgOffsetRef = useRef(0);
  const saveRef = useRef(loadSave());

  // ── state ref ──
  const stateRef = useRef({
    player: { x: 180, y: 460, vx: 0, vy: 0, speed: 5 },
    bullets: new Pool<Bullet>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      type: "player", wtype: "spread", wingman: false, lightning: false, alive: false,
    })),
    enemyBullets: new Pool<Bullet>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      type: "enemy", alive: false,
    })),
    monsters: new Pool<Monster>(() => ({
      x: 0, y: 0, hp: 2, maxHp: 2,
      speed: 1, type: "fighter", alive: false,
      formation: false, vx: 0, vy: 0, formationGroup: 0,
      flashTimer: 0,
    })),
    boss: null as Boss | null,
    miniboss: null as Miniboss | null,
    particles: new Pool<Particle>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      alpha: 1, color: "#fff", size: 2,
      life: 1, maxLife: 1, gravity: 0, alive: false,
    })),
    missiles: new Pool<Missile>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      targetX: 0, targetY: 0, alive: false,
    })),
    powerUps: new Pool<PowerUp>(() => ({ x: 0, y: 0, type: "weapon", alive: false })),
    energyFrags: new Pool<EnergyFragment>(() => ({ x: 0, y: 0, value: 1, alive: false, vx: 0, vy: 0 })),
    weaponEnergy: 0,
    energyNeeded: 100,
    comboKills: 0,
    magnetModeTimer: 0,
    levelUpFreezeTimer: 0,
    stars: starsRef.current,
    shakeX: 0, shakeY: 0,
    keys: {
      ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false,
      a: false, d: false, w: false, s: false,
    },
    weaponLevel: 1,
    weaponType: "spread" as WeaponType,
    frameCount: 0,
    invincible: false, invincibleTimer: 0,
    respawnTimer: 0,
    score: 0,
    hasHoming: false,
    formationTimer: 0, gachaLocked: false, gachaCost: 10,
    formationGroupCounter: 0, overdriveTimer: 0,
    lastWaveSpawned: -1,
    bossWarningTimer: 0,
    preGameCountdown: 0, // 0 = no countdown; >0 = frames of countdown
    _carrierSpawnTimer: 0,
    bossCooldown: 0,
    minibossCooldown: 0,
    wingmanLevel: 0,
    wingmanOrbitAngle: 0,
    optionForm: "greenLaser" as OptionForm,
    options: [
      { x: 156, y: 478, targetX: 156, targetY: 478, form: "greenLaser" as OptionForm, transformProgress: 0, slashCooldown: 0 },
      { x: 204, y: 478, targetX: 204, targetY: 478, form: "greenLaser" as OptionForm, transformProgress: 0, slashCooldown: 0 },
    ] as [OptionState, OptionState],
    slashEffects: new Pool<SlashEffect>(() => ({
      x: 0, y: 0, alpha: 1, radius: 0,
      timer: 0, maxTimer: 15, alive: false,
    })),
    gameStarted: false,
    isPaused: false,
    isGameOver: false,
    showGacha: false,
  });
  // sync stateRef from React state (game loop reads stateRef)
  // NOTE: isGameOver/gameStarted are set imperatively in the game loop,
  // do NOT sync them from React state here — they'd overwrite immediate updates.
  stateRef.current.isPaused = isPaused;
  stateRef.current.showGacha = showGacha;

  // init high score from save
  useEffect(() => {
    setHighScore(saveRef.current.highScore);
  }, []);

  // ─── helpers ───

  function spawnBullet(
    x: number, y: number, vx: number, vy: number, wtype?: WeaponType,
  ) {
    const b = stateRef.current.bullets.get();
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.type = "player"; b.wtype = wtype; b.wingman = false; b.lightning = false;
    b.damage = wtype === "laser" ? 3 : wtype === "wave" ? 2 : 1;
  }
  function spawnEnemyBullet(x: number, y: number, vx: number, vy: number) {
    const b = stateRef.current.enemyBullets.get();
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.type = "enemy";
  }
  function spawnMonster(
    x: number, y: number, type: Monster["type"],
    hp: number, speed: number, formation = false,
  ) {
    const m = stateRef.current.monsters.get();
    m.x = x; m.y = y; m.type = type;
    m.hp = hp; m.maxHp = hp; m.speed = speed;
    m.formation = formation; m.vx = 0; m.vy = 0; m.formationGroup = 0;
    m.flashTimer = 0;
    return m;
  }
  function spawnParticle(
    x: number, y: number, vx: number, vy: number,
    color: string, size: number, life = 60, gravity = 0, alpha = 1,
  ) {
    const p = stateRef.current.particles.get();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.color = color; p.size = size;
    p.life = life; p.maxLife = life; p.gravity = gravity; p.alpha = alpha;
  }
  function spawnMissile(x: number, y: number, tx: number, ty: number) {
    const m = stateRef.current.missiles.get();
    m.x = x; m.y = y; m.targetX = tx; m.targetY = ty; m.vx = 0; m.vy = -6;
  }
  function spawnEnergyFragment(x: number, y: number, value: number) {
    const e = stateRef.current.energyFrags.get();
    e.x = x; e.y = y; e.value = value;
    e.vx = (Math.random() - 0.5) * 3;
    e.vy = -1 - Math.random() * 2;
  }

  function emitExplosion(
    x: number, y: number, count: number,
    colors: string[], speed = 6, life = 40, gravity = 0.03, size = 3,
  ) {
    for (let k = 0; k < count; k++) {
      const angle = Math.random() * Math.PI * 2;
      const sp = (0.2 + Math.random()) * speed;
      spawnParticle(
        x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8,
        Math.cos(angle) * sp, Math.sin(angle) * sp - Math.random() * 2,
        colors[Math.floor(Math.random() * colors.length)],
        size + Math.random() * 3, life + Math.random() * 20, gravity,
      );
    }
  }

  function checkFormationClear(x: number, y: number, group: number) {
    if (group <= 0) return;
    const state = stateRef.current;
    let alive = false;
    state.monsters.forEachActive((m) => { if (m.formationGroup === group) alive = true; });
    if (!alive) {
      // Formation clear always drops W or S (never P), plus bonus energy
      const pu = state.powerUps.get();
      pu.x = x; pu.y = y;
      pu.type = Math.random() < 0.25 ? "optionForm" : "wingman";
      for (let i = 0; i < 3; i++) spawnEnergyFragment(x + (Math.random() - 0.5) * 20, y + (Math.random() - 0.5) * 10, 5);
      emitExplosion(x, y, 15, ["#38bdf8", "#7dd3fc", "#fff"], 5, 35);
    }
  }

  const closeGacha = useCallback(() => {
    setGachaClosing(true);
    if (closeGachaTimeoutRef.current) clearTimeout(closeGachaTimeoutRef.current);
    closeGachaTimeoutRef.current = setTimeout(() => {
      closeGachaTimeoutRef.current = null;
      setShowGacha(false);
      setGachaClosing(false);
    }, 200);
  }, []);

  const applyCardEffect = (card: CardDef) => {
    const state = stateRef.current;
    switch (card.id) {
      case "power_up":
        if (state.overdriveTimer > 0) {
          state.overdriveTimer = Math.min(600, state.overdriveTimer + 180);
          setOverdriveTimer(state.overdriveTimer);
        } else if (state.weaponLevel >= 3) {
          state.weaponLevel = 4; state.overdriveTimer = 300;
          setWeaponLevel(4); setOverdriveTimer(300);
        } else {
          const n = Math.min(3, state.weaponLevel + 1);
          state.weaponLevel = n; setWeaponLevel(n);
        }
        break;
      case "bomb_give": setBombCount((p) => p + 1); break;
      case "life_give": setLives((p) => p + 1); break;
      case "shield_s":
        state.invincible = true; state.invincibleTimer = 180;
        setInvincible(true); break;
      case "shield_l":
        state.invincible = true; state.invincibleTimer = 300;
        setInvincible(true); break;
      case "fire_storm":
        state.weaponLevel = 4; state.overdriveTimer = 300;
        setWeaponLevel(4); setOverdriveTimer(300); break;
      case "life_pack": setLives((p) => p + 2); break;
      case "nuke": {
        state.monsters.releaseAll(); state.enemyBullets.releaseAll();
        if (state.boss) state.boss.hp -= 30;
        if (state.miniboss) state.miniboss.hp -= 20;
        setBombCount((p) => p + 2);
        emitExplosion(CW / 2, CH / 2, 60, ["#fef08a", "#f97316", "#fff"], 10);
        state.shakeX = 12; state.shakeY = 12; break;
      }
      case "wingman": case "wingmanUp":
        if (state.wingmanLevel < 4) {
          state.wingmanLevel++;
          setWingmanLevel(state.wingmanLevel);
        }
        break;
    }
    emitExplosion(
      CW / 2, CH / 2, 20,
      card.rarity === "SSR" ? ["#facc15", "#fef08a"] : ["#93c5fd", "#bfdbfe"], 8,
    );
    audio.gachaCard();
    state.gachaLocked = false; state.gachaCost += 5;
    setGachaCost(state.gachaCost); closeGacha();
    // Give player brief breather after gacha — clear leftover carrier spawns
    state.monsters.releaseAll();
    if (state.bossCooldown <= 0) state.bossCooldown = 90;
    if (state.minibossCooldown <= 0) state.minibossCooldown = 90;
  };

  const emitBombEffect = (cx: number, cy: number) => {
    const state = stateRef.current;
    // huge expanding ring (3 layers with color shift)
    const ringColors = ["#ef4444", "#f97316", "#fef08a", "#fff"];
    for (let ring = 0; ring < 4; ring++) {
      const r = 10 + ring * 20;
      for (let a = 0; a < 360; a += 10) {
        const rad = (a * Math.PI) / 180;
        const dist = r + (Math.random() - 0.5) * 15;
        spawnParticle(
          cx + Math.cos(rad) * dist, cy + Math.sin(rad) * dist,
          Math.cos(rad) * (2 + Math.random() * 1.5),
          Math.sin(rad) * (2 + Math.random() * 1.5),
          ringColors[ring % ringColors.length],
          2 + Math.random() * 3 + ring * 0.5,
          25 + ring * 15,
          0.01,
        );
      }
    }
    // fire streaks (random direction, long trail)
    for (let i = 0; i < 40; i++) {
      const angle = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 4;
      spawnParticle(
        cx + (Math.random() - 0.5) * 20, cy + (Math.random() - 0.5) * 20,
        Math.cos(angle) * sp, Math.sin(angle) * sp,
        ["#ef4444", "#f97316", "#fef08a"][Math.floor(Math.random() * 3)],
        1.5 + Math.random() * 2,
        20 + Math.random() * 20,
        0.005,
      );
    }
    // white flash core (burst)
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      spawnParticle(
        cx + (Math.random() - 0.5) * 8, cy + (Math.random() - 0.5) * 8,
        Math.cos(angle) * sp, Math.sin(angle) * sp,
        "#fff", 4 + Math.random() * 5, 12 + Math.random() * 10, 0.04,
      );
    }
    // lingering smoke rings
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 5 + Math.random() * 30;
      spawnParticle(
        cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist,
        Math.cos(angle) * 0.3, Math.sin(angle) * 0.3,
        "#475569", 3 + Math.random() * 4, 35 + Math.random() * 20, -0.002,
      );
    }
  };

  const triggerBomb = () => {
    if (gameRef.current.bombCount <= 0 || gameRef.current.isGameOver || gameRef.current.isPaused) return;
    audio.bomb();
    setBombCount((prev) => { gameRef.current.bombCount = prev - 1; return prev - 1; });
    const state = stateRef.current;
    state.shakeX = 15; state.shakeY = 15;
    state.enemyBullets.releaseAll();
    // Check formation groups before clearing — drop power-ups for each complete formation
    const groups = new Set<number>();
    state.monsters.forEachActive((m) => {
      if (m.formationGroup > 0) groups.add(m.formationGroup);
    });
    groups.forEach((gid) => {
      let first: Monster | undefined;
      state.monsters.forEachActive((m) => {
        if (m.formationGroup === gid && !first) first = m;
      });
      if (first) {
        const pu2 = state.powerUps.get();
        pu2.x = first.x; pu2.y = first.y;
        pu2.type = Math.random() < 0.2 ? "optionForm" : Math.random() < 0.6 ? "weapon" : "wingman";
      }
    });
    state.monsters.releaseAll();
    if (state.boss) state.boss.hp -= 30;
    if (state.miniboss) state.miniboss.hp -= 20;
    emitBombEffect(CW / 2, CH / 2);
  };

  const togglePause = () => {
    if (!gameRef.current.isGameOver && !showGacha) {
      audio.buttonClick();
      setIsPaused((p) => { gameRef.current.isPaused = !p; return !p; });
    }
  };

  const checkSpawnBoss = (currentScore: number) => {
    const state = stateRef.current;
    if (state.boss) return;
    if (state.bossCooldown > 0) return;
    if (state.bossWarningTimer > 0) return;

    let idx = -1;
    for (let i = WAVE_TABLE.length - 1; i >= 0; i--) {
      if (currentScore >= WAVE_TABLE[i].score) { idx = i; break; }
    }
    if (idx < 0) return;
    const wave = WAVE_TABLE[idx];
    if (idx <= state.lastWaveSpawned) return;

    state.lastWaveSpawned = idx;
    state.bossWarningTimer = 180; // 3 seconds warning phase
    setBossWarning(true);
    setWaveAnnounce("⚠ WARNING ⚠");
    audio.bossWarning();
    // No early clear — WARNING stays until boss name replaces it below
  };

  // ─── START GAME ───

  const handleStart = useCallback(() => {
    if (!gameStarted) {
      audio.initAudio();
      // apply ship weapon
      const ship = SHIP_CONFIG[shipType];
      stateRef.current.weaponType = ship.weapon;
      setWeaponType(ship.weapon);
      // apply shop upgrades (one-time per game — consume after use)
      const upgrades = saveRef.current.upgrades;
      let saveChanged = false;
      if (upgrades.extraBomb > 0) {
        setBombCount((prev) => prev + upgrades.extraBomb);
        upgrades.extraBomb = 0; saveChanged = true;
      }
      if (upgrades.weaponBoost) {
        stateRef.current.weaponLevel = 2;
        setWeaponLevel(2);
        upgrades.weaponBoost = false; saveChanged = true;
      }
      if (upgrades.startShield) {
        stateRef.current.invincible = true;
        stateRef.current.invincibleTimer = 180;
        setInvincible(true);
        upgrades.startShield = false; saveChanged = true;
      }
      if (upgrades.startWingman) {
        stateRef.current.wingmanLevel = 1;
        setWingmanLevel(1);
        upgrades.startWingman = false; saveChanged = true;
      }
      if (saveChanged) writeSave(saveRef.current);
      // 3-2-1-GO countdown driven by game loop (180 frames = 3s at 60fps)
      setStartFadeOut(true);
      stateRef.current.preGameCountdown = 180;
      setReadyCountdown(3);
    }
  }, [gameStarted, audio, shipType]);

  // ─—— DRAWING ────

  const playerTiltRef = { current: 0 };

  function drawPlayerShip(
    ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number,
  ) {
    const cx = x + 14, cy = y + 12;
    const f = stateRef.current.frameCount;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(-cx, -cy);

    // Pass 0: strong aura glow behind entire ship
    ctx.save();
    ctx.shadowColor = "#0d9488";
    ctx.shadowBlur = 24;
    const aura = ctx.createRadialGradient(cx, cy, 6, cx, cy, 34);
    aura.addColorStop(0, "rgba(94,234,212,0.25)");
    aura.addColorStop(0.5, "rgba(13,148,136,0.1)");
    aura.addColorStop(1, "rgba(13,148,136,0)");
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // thrust flame (3D glow cone + bright core)
    const flameLen = 4 + Math.sin(f * 0.2) * 1.5;
    // outer bloom
    ctx.save();
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 20;
    ctx.globalAlpha = 0.4;
    const fg = ctx.createRadialGradient(cx, y + 9*P, 0, cx, y + 9*P, 16);
    fg.addColorStop(0, "rgba(255,237,160,0.5)");
    fg.addColorStop(0.4, "rgba(251,146,60,0.3)");
    fg.addColorStop(1, "rgba(251,146,60,0)");
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, y + 9*P, 16, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // flame core
    ctx.save();
    ctx.shadowColor = "#fef08a";
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.7 + Math.sin(f * 0.2) * 0.3;
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x + P + 2, y + 8*P, P, (flameLen-2) * P);
    ctx.fillRect(x + 3*P + 2, y + 8*P, P, (flameLen-2) * P);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x + P, y + 6*P, 2*P, flameLen * P);
    ctx.fillRect(x + 3*P, y + 6*P, 2*P, flameLen * P);
    ctx.restore();

    // main hull — sprite + strong edge glow
    ctx.save();
    ctx.shadowColor = "#0d9488";
    ctx.shadowBlur = 14;
    drawSprite(ctx, PLAYER, { h: "#5eead4", b: "#0d9488", s: "#0f766e" }, x, y, P);
    ctx.restore();

    // edge highlight — bright rim light on top and sides
    ctx.save();
    ctx.shadowColor = "#99f6e4";
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.25 + Math.sin(f * 0.06) * 0.1;
    const hg = ctx.createLinearGradient(x, y, x, y + 7 * P);
    hg.addColorStop(0, "rgba(255,255,255,0.5)");
    hg.addColorStop(0.3, "rgba(153,246,228,0.1)");
    hg.addColorStop(1, "rgba(15,118,110,0.4)");
    ctx.fillStyle = hg;
    ctx.fillRect(x, y, 7 * P, 7 * P);
    ctx.restore();

    // cockpit specular — bright glint
    ctx.save();
    ctx.globalAlpha = 0.5 + Math.sin(f * 0.07) * 0.2;
    const cg = ctx.createRadialGradient(cx - 2*P, y + P, 0, cx - 2*P, y + P, 5);
    cg.addColorStop(0, "#fff");
    cg.addColorStop(0.4, "rgba(153,246,228,0.6)");
    cg.addColorStop(1, "rgba(153,246,228,0)");
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx - 2*P, y + P, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // wings
    drawSprite(ctx, PLAYER_WING, { b: "#d97706" }, x - 2 * P, y + P, P);
    drawSprite(ctx, PLAYER_WING, { b: "#d97706" }, x + 7 * P, y + P, P);
    // wing tips — bright energy glow beams
    ctx.save();
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.5 + Math.sin(f * 0.12) * 0.3;
    const wg = ctx.createRadialGradient(x - P, y + 2*P, 0, x - P, y + 2*P, 6);
    wg.addColorStop(0, "rgba(255,251,235,0.7)");
    wg.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.arc(x - P, y + 2*P, 6, 0, Math.PI * 2); ctx.fill();
    const wg2 = ctx.createRadialGradient(x + 8*P, y + 2*P, 0, x + 8*P, y + 2*P, 6);
    wg2.addColorStop(0, "rgba(255,251,235,0.7)");
    wg2.addColorStop(1, "rgba(251,191,36,0)");
    ctx.fillStyle = wg2;
    ctx.beginPath(); ctx.arc(x + 8*P, y + 2*P, 6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  function drawMonsterShip(ctx: CanvasRenderingContext2D, m: Monster, x: number, y: number) {
    const hitFlash = m.flashTimer > 0;
    const flash = stateRef.current.frameCount % 8 < 4;
    const f = stateRef.current.frameCount;
    ctx.save();

    // ── formation marker (pulsing purple aura ring + "POW" indicator) ──
    if (m.formation) {
      const auraPulse = Math.sin(f * 0.08) * 0.3 + 0.7;
      // floating indicator text
      ctx.save();
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.6 + Math.sin(f * 0.1) * 0.3;
      drawText(ctx, "POW", x + 12, y - 4, "#c084fc", 6, "center", 1.5);
      ctx.restore();
      // outer glow ring
      ctx.save();
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 15;
      ctx.globalAlpha = 0.3 * auraPulse;
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 12, y + 10, 16 + Math.sin(f * 0.06) * 3, 0, Math.PI * 2); ctx.stroke();
      // rotating dash arc
      ctx.globalAlpha = 0.5 * auraPulse;
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 2;
      const aStart = f * 0.04;
      const aEnd = aStart + 1.5;
      ctx.beginPath(); ctx.arc(x + 12, y + 10, 19 + Math.sin(f * 0.05) * 2, aStart, aEnd); ctx.stroke();
      ctx.restore();
    }

    const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
    const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;

    switch (m.type) {
      case "fighter":
        ctx.shadowColor = "#dc2626";
        ctx.shadowBlur = 10;
        drawSprite(ctx, FIGHTER, {
          h: flash ? "#fca5a5" : "#f87171",
          b: flash ? "#ef4444" : "#dc2626",
          s: flash ? "#b91c1c" : "#991b1b",
        }, x, y, P);
        // 3D highlight
        ctx.globalAlpha = 0.2;
        const fg = ctx.createLinearGradient(x, y, x, y + mh);
        fg.addColorStop(0, "rgba(255,255,255,0.3)");
        fg.addColorStop(0.5, "rgba(255,255,255,0)");
        fg.addColorStop(1, "rgba(0,0,0,0.2)");
        ctx.fillStyle = fg;
        ctx.fillRect(x, y, mw, mh);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
      case "bomber":
        ctx.shadowColor = "#7c3aed";
        ctx.shadowBlur = 12;
        drawSprite(ctx, BOMBER, {
          h: flash ? "#e9d5ff" : "#c084fc",
          b: flash ? "#a855f7" : "#7c3aed",
          s: flash ? "#6b21a8" : "#581c87",
        }, x, y, P);
        ctx.globalAlpha = 0.2;
        const bg = ctx.createLinearGradient(x, y, x, y + mh);
        bg.addColorStop(0, "rgba(255,255,255,0.25)");
        bg.addColorStop(0.4, "rgba(255,255,255,0)");
        bg.addColorStop(1, "rgba(0,0,0,0.2)");
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, mw, mh);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
      case "interceptor":
        ctx.shadowColor = "#ec4899";
        ctx.shadowBlur = 10;
        drawSprite(ctx, INTERCEPTOR, {
          h: flash ? "#fbcfe8" : "#f472b6",
          b: flash ? "#ec4899" : "#db2777",
          s: flash ? "#a21caf" : "#86198f",
        }, x, y, P);
        ctx.globalAlpha = 0.2;
        const ig = ctx.createLinearGradient(x, y, x, y + mh);
        ig.addColorStop(0, "rgba(255,255,255,0.25)");
        ig.addColorStop(0.4, "rgba(255,255,255,0)");
        ig.addColorStop(1, "rgba(0,0,0,0.2)");
        ctx.fillStyle = ig;
        ctx.fillRect(x, y, mw, mh);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
      case "elite":
        ctx.shadowColor = "#eab308";
        ctx.shadowBlur = 16;
        ctx.globalAlpha = 0.85 + Math.sin(stateRef.current.frameCount * 0.15) * 0.15;
        drawSprite(ctx, ELITE_SPRITE, {
          h: flash ? "#fef08a" : "#facc15",
          b: flash ? "#eab308" : "#ca8a04",
          s: flash ? "#a16207" : "#854d0e",
        }, x, y, P);
        ctx.globalAlpha = 1;
        // 3D overlay
        ctx.globalAlpha = 0.15;
        const eg = ctx.createLinearGradient(x, y, x, y + mh);
        eg.addColorStop(0, "rgba(255,255,255,0.3)");
        eg.addColorStop(0.3, "rgba(255,255,255,0)");
        eg.addColorStop(1, "rgba(0,0,0,0.25)");
        ctx.fillStyle = eg;
        ctx.fillRect(x, y, mw, mh);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
    }
    ctx.restore();
    // hit flash overlay (pure white when hit)
    if (hitFlash) {
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#fff";
      const mw2 = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
      const mh2 = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
      ctx.fillRect(x, y, mw2, mh2);
      ctx.restore();
    }
  }

  function drawBossShip(
    ctx: CanvasRenderingContext2D, x: number, y: number,
    hp: number, maxHp: number, type: BossType,
  ) {
    const flash = stateRef.current.frameCount % 10 < 5;
    const f = stateRef.current.frameCount;

    // boss aura with bloom
    ctx.save();
    ctx.globalAlpha = 0.1;
    const auraColor = type === "fortress" ? "#ef4444" : type === "carrier" ? "#a855f7" : "#22d3ee";
    ctx.shadowColor = auraColor;
    ctx.shadowBlur = 30;
    ctx.fillStyle = auraColor;
    ctx.beginPath(); ctx.arc(x + 22, y + 18, 38 + Math.sin(f * 0.04) * 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    ctx.save();
    ctx.shadowBlur = 8;
    if (type === "fortress") {
      ctx.shadowColor = "#ef4444";
      drawSprite(ctx, BOSS_FORTRESS, {
        h: flash ? "#fca5a5" : "#ef4444",
        b: flash ? "#dc2626" : "#b91c1c",
        s: flash ? "#991b1b" : "#7f1d1d",
      }, x, y, P);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.6 + Math.sin(f * 0.1) * 0.4;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(x + 6 * P, y + 2 * P, P, P);
      ctx.fillRect(x + 15 * P, y + 2 * P, P, P);
      ctx.fillRect(x + 6 * P, y + 6 * P, P, P);
      ctx.fillRect(x + 15 * P, y + 6 * P, P, P);
      ctx.globalAlpha = 1;
    } else if (type === "carrier") {
      ctx.shadowColor = "#a855f7";
      drawSprite(ctx, BOSS_CARRIER, {
        h: flash ? "#e9d5ff" : "#a855f7",
        b: flash ? "#8b5cf6" : "#6b21a8",
        s: flash ? "#6b21a8" : "#581c87",
      }, x, y, P);
      ctx.shadowBlur = 0;
      ctx.fillStyle = flash ? "#fef08a" : "#eab308";
      ctx.fillRect(x + 5 * P, y + 4 * P, P, P);
      ctx.fillRect(x + 7 * P, y + 4 * P, P, P);
      ctx.fillRect(x + 9 * P, y + 4 * P, P, P);
    } else {
      ctx.shadowColor = "#22d3ee";
      drawSprite(ctx, BOSS_EYE_SPRITE, {
        h: flash ? "#cffafe" : "#22d3ee",
        b: flash ? "#06b6d4" : "#0891b2",
        s: flash ? "#0e7490" : "#155e75",
      }, x, y, P);
      ctx.shadowBlur = 0;
      const pulse = Math.sin(f * 0.08) * 0.3 + 0.7;
      ctx.globalAlpha = pulse;
      drawSprite(ctx, BOSS_EYE_CORE, { h: "#fef08a" }, x + 4 * P, y + 4 * P, P);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ef4444";
      const pupilOff = Math.sin(f * 0.06) * 2;
      ctx.fillRect(x + 6 * P, y + 5 * P + pupilOff, 2 * P, P);
      ctx.fillRect(x + 6 * P, y + 2 * P + pupilOff, 2 * P, P);
    }
    ctx.restore();

    const barW = type === "fortress" ? 22 * P : 12 * P;
    const bp = type === "fortress" ? x : x + 2 * P;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(bp, y - P, barW, 4);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(bp, y - P, barW * (hp / maxHp), 4);
    ctx.fillStyle = "#86efac";
    ctx.fillRect(bp, y - P, barW * (hp / maxHp), 2);
  }

  function drawMinibossShip(ctx: CanvasRenderingContext2D, mb: Miniboss, x: number, y: number) {
    const flash = stateRef.current.frameCount % 8 < 4;
    const f = stateRef.current.frameCount;

    // entrance animation: alpha ramp and vertical bounce
    const animProgress = mb.enterAnim > 0 ? Math.max(0, 1 - mb.enterAnim / 60) : 1;
    const enterBounce = mb.enterAnim > 0 ? -Math.sin((60 - mb.enterAnim) * 0.12) * 10 : 0;

    ctx.save();
    ctx.globalAlpha = animProgress;
    // 3D glow aura
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 20;
    const ma = ctx.createRadialGradient(x + 26, y + 20, 0, x + 26, y + 20, 36);
    ma.addColorStop(0, "rgba(249,115,22,0.15)");
    ma.addColorStop(1, "rgba(249,115,22,0)");
    ctx.fillStyle = ma;
    ctx.beginPath(); ctx.arc(x + 26, y + 20, 36, 0, Math.PI * 2); ctx.fill();

    drawSprite(ctx, MINIBOSS_SPRITE, {
      h: flash ? "#fdba74" : "#f97316",
      b: flash ? "#f97316" : "#ea580c",
      s: flash ? "#ea580c" : "#c2410c",
    }, x, y + enterBounce, P);

    // 3D top highlight
    ctx.globalAlpha = 0.2 * animProgress;
    const mg = ctx.createLinearGradient(x, y + enterBounce, x, y + enterBounce + 40);
    mg.addColorStop(0, "rgba(255,255,255,0.3)");
    mg.addColorStop(0.3, "rgba(255,255,255,0)");
    mg.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = mg;
    ctx.fillRect(x, y + enterBounce, 52, 40);
    ctx.globalAlpha = animProgress;

    ctx.shadowBlur = 0;
    ctx.globalAlpha = animProgress;
    ctx.fillStyle = flash ? "#fef08a" : "#fbbf24";
    ctx.fillRect(x + 3 * P, y + 2 * P + enterBounce, P, P);
    ctx.fillRect(x + 8 * P, y + 2 * P + enterBounce, P, P);
    ctx.fillRect(x + 3 * P, y + 6 * P + enterBounce, P, P);
    ctx.fillRect(x + 8 * P, y + 6 * P + enterBounce, P, P);
    ctx.globalAlpha = 1;
    ctx.restore();

    // HP bar below
    const barW = 14 * P;
    const bp = x + P;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(bp, y + 10 * P, barW, 3);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(bp, y + 10 * P, barW * (mb.hp / mb.maxHp), 3);
  }

  function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const f = stateRef.current.frameCount;
    const cx = x + 14, cy = y + 12;
    const pulse = 0.7 + Math.sin(f * 0.06) * 0.3;

    ctx.save();
    ctx.shadowColor = "#38bdf8";
    ctx.shadowBlur = 15;
    ctx.globalAlpha = 0.15 * pulse;
    const og = ctx.createRadialGradient(cx, cy, 20, cx, cy, 38);
    og.addColorStop(0, "rgba(56,189,248,0)");
    og.addColorStop(0.5, "rgba(56,189,248,0.3)");
    og.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.globalAlpha = 0.35 * pulse;
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 22 + Math.sin(f * 0.05) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.2 * pulse;
    ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 30 + Math.sin(f * 0.05 + 1) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawMissileSprite(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x, y, 3, 8);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x, y, 3, 3);
    ctx.shadowBlur = 0;
    if (stateRef.current.frameCount % 4 < 2) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x, y + 8, 3, 4);
    }
    ctx.restore();
  }

  // ── Wingman Satellite Drawing ──
  function drawWingmanSatellite(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, color: string, isLightning: boolean) {
    ctx.save();
    const pulse = 0.85 + Math.sin(f * 0.15 + x) * 0.15;
    // outer glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.3 * pulse;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 6, y + 6, 9, 0, Math.PI * 2); ctx.fill();
    // main body — small diamond drone
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + 6, y);
    ctx.lineTo(x + 12, y + 6);
    ctx.lineTo(x + 6, y + 12);
    ctx.lineTo(x, y + 6);
    ctx.closePath();
    ctx.fill();
    // inner core
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x + 6, y + 6, 2.5, 0, Math.PI * 2); ctx.fill();
    // engine trail for lightning variants
    if (isLightning) {
      ctx.globalAlpha = 0.4 + Math.sin(f * 0.3 + x) * 0.2;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(x + 6, y + 10, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Option / Slash Drawing ──

  function drawGreenOption(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const f = stateRef.current.frameCount;
    const cx = x + 8, cy = y + 8;
    ctx.save();
    // outer glow
    ctx.shadowColor = "#4ade80";
    ctx.shadowBlur = 24;
    ctx.globalAlpha = 0.3 + Math.sin(f * 0.1) * 0.1;
    const og = ctx.createRadialGradient(cx, cy, 2, cx, cy, GREEN_ORB_R + 6);
    og.addColorStop(0, "rgba(74,222,128,0.4)");
    og.addColorStop(1, "rgba(74,222,128,0)");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, cy, GREEN_ORB_R + 6, 0, Math.PI * 2); ctx.fill();
    // main orb (radial gradient)
    ctx.shadowBlur = 18;
    ctx.globalAlpha = 0.95;
    const g = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, GREEN_ORB_R);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.2, "#86efac");
    g.addColorStop(0.5, "#4ade80");
    g.addColorStop(0.8, "#22c55e");
    g.addColorStop(1, "#166534");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, GREEN_ORB_R, 0, Math.PI * 2); ctx.fill();
    // specular highlight
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx - 2, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
    // inner energy ring
    ctx.globalAlpha = 0.4 + Math.sin(f * 0.12) * 0.2;
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(cx, cy, 4 + Math.sin(f * 0.08) * 1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawPurpleWingOption(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number) {
    const f = stateRef.current.frameCount;
    const alpha = progress; // 0→1 during transformation
    const pulse = 0.85 + Math.sin(f * 0.12) * 0.15;
    ctx.save();
    ctx.globalAlpha = alpha;
    // wing aura glow
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 20;
    ctx.globalAlpha = 0.2 * pulse * alpha;
    const ag = ctx.createRadialGradient(x + 8, y + 8, 0, x + 8, y + 8, 18);
    ag.addColorStop(0, "rgba(168,85,247,0.4)");
    ag.addColorStop(1, "rgba(168,85,247,0)");
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(x + 8, y + 8, 18, 0, Math.PI * 2); ctx.fill();
    // main wing sprite
    ctx.shadowBlur = 14;
    ctx.globalAlpha = 0.9 * pulse * alpha;
    drawSprite(ctx, PURPLE_WING, { p: "#c084fc", s: "#581c87" }, x, y, 2);
    // purple energy sparkles
    ctx.shadowBlur = 0;
    ctx.globalAlpha = (0.5 + Math.sin(f * 0.15 + x) * 0.3) * alpha;
    ctx.fillStyle = "#d8b4fe";
    ctx.beginPath(); ctx.arc(x + 4 + Math.sin(f * 0.09) * 2, y + 4 + Math.cos(f * 0.11) * 2, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9d5ff";
    ctx.beginPath(); ctx.arc(x + 10 + Math.sin(f * 0.13 + 1) * 2, y + 2 + Math.cos(f * 0.07 + 1) * 2, 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#a855f7";
    ctx.beginPath(); ctx.arc(x + 7 + Math.sin(f * 0.1 + 2) * 2.5, y + 12 + Math.cos(f * 0.09 + 2) * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawSlashEffect(ctx: CanvasRenderingContext2D, se: SlashEffect) {
    const progress = 1 - se.timer / se.maxTimer; // 0→1
    const r = se.radius * progress;
    const a = se.alpha * (1 - progress);
    ctx.save();
    // outer glow
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 30;
    ctx.globalAlpha = a * 0.4;
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    ctx.arc(se.x, se.y, r + 10, -Math.PI * 0.85, Math.PI * 0.85);
    ctx.fill();
    // main crescent
    ctx.shadowBlur = 20;
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(se.x, se.y, r, -Math.PI * 0.8, Math.PI * 0.8);
    ctx.fill();
    // bright inner arc
    ctx.shadowBlur = 14;
    ctx.globalAlpha = a;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(se.x, se.y, r * 0.6, -Math.PI * 0.7, Math.PI * 0.7);
    ctx.stroke();
    // white line slash
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = "#e0f2fe";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(se.x, se.y, r * 0.4, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // ─── GAME LOOP ───

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stateRef.current.weaponLevel = weaponLevel;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!stateRef.current.gameStarted && !startFadeOut) {
        // Arrow keys for ship selection on start screen
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          const idx = SHIP_TYPES.indexOf(shipType);
          const next = e.key === "ArrowLeft"
            ? SHIP_TYPES[(idx - 1 + SHIP_TYPES.length) % SHIP_TYPES.length]
            : SHIP_TYPES[(idx + 1) % SHIP_TYPES.length];
          setShipType(next);
        }
        return;
      }
      audio.initAudio();
      if (e.key === "Escape") { togglePause(); return; }
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","a","d","w","s"].includes(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
      }
      if (e.key === " " || e.key === "b" || e.key === "B") {
        e.preventDefault();
        triggerBomb();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown","a","d","w","s"].includes(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // ── touch controls (relative drag) ──
    const handleTouchStart = (e: TouchEvent) => {
      if (!stateRef.current.gameStarted) return;
      audio.initAudio();
       if (stateRef.current.isGameOver || stateRef.current.isPaused || stateRef.current.showGacha) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const touchGameX = ((touch.clientX - rect.left) / rect.width) * CW;
      const touchGameY = ((touch.clientY - rect.top) / rect.height) * CH;
      touchAnchorRef.current = {
        x: touchGameX,
        y: touchGameY,
        shipX: stateRef.current.player.x,
        shipY: stateRef.current.player.y,
      };
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!stateRef.current.gameStarted) return;
      audio.initAudio();
       if (stateRef.current.isGameOver || stateRef.current.isPaused || stateRef.current.showGacha) return;
      const anchor = touchAnchorRef.current;
      if (!anchor) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const touchGameX = ((touch.clientX - rect.left) / rect.width) * CW;
      const touchGameY = ((touch.clientY - rect.top) / rect.height) * CH;
      const dx = touchGameX - anchor.x;
      const dy = touchGameY - anchor.y;
      const newX = anchor.shipX + dx;
      const newY = anchor.shipY + dy;
      stateRef.current.player.x = Math.max(0, Math.min(CW - 24, newX));
      stateRef.current.player.y = Math.max(0, Math.min(CH - 32, newY));
      // reset velocity on touch so acceleration doesn't fight drag
      stateRef.current.player.vx = 0;
      stateRef.current.player.vy = 0;
    };
    const handleTouchEnd = (_e: TouchEvent) => {
      touchAnchorRef.current = null;
    };
    canvas.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: true });

    let animId: number;

    const loop = () => {
      const state = stateRef.current;
      state.frameCount++;
      const f = state.frameCount;

      // ── pre-game countdown (game loop driven, reliable) ──
      if (state.preGameCountdown > 0) {
        state.preGameCountdown--;
        const prevVal = Math.ceil((state.preGameCountdown + 1) / 60);
        const curVal = Math.ceil(state.preGameCountdown / 60);
        if (prevVal !== curVal || state.preGameCountdown === 179) {
          setReadyCountdown(curVal);
        }
        // Show "GO" for 30 frames (0.5s) before starting game
        if (state.preGameCountdown <= 0) {
          state.preGameCountdown = -30;
          setReadyCountdown(0);
        }
      }
      if (state.preGameCountdown < 0) {
        state.preGameCountdown++;
        if (state.preGameCountdown >= 0) {
          setGameStarted(true);
          setReadyCountdown(0);
          state.gameStarted = true;
        }
      }

      // ── screen shake decay ──
      state.shakeX *= 0.85; state.shakeY *= 0.85;
      if (Math.abs(state.shakeX) < 0.3) state.shakeX = 0;
      if (Math.abs(state.shakeY) < 0.3) state.shakeY = 0;

      if (state.invincible) {
        state.invincibleTimer--;
        if (state.invincibleTimer <= 0) { state.invincible = false; setInvincible(false); }
      }
      // respawn blink decay
      if (state.respawnTimer > 0) {
        state.respawnTimer--;
        if (state.respawnTimer <= 0) setRespawnTimer(0);
      }
      if (state.overdriveTimer > 0) {
        state.overdriveTimer--;
        if (state.overdriveTimer % 30 === 0) setOverdriveTimer(state.overdriveTimer);
        if (state.overdriveTimer <= 0) {
          state.weaponLevel = Math.min(3, state.weaponLevel);
          setWeaponLevel(state.weaponLevel);
        }
      }

      // ── boss warning phase (runs always, even during gacha) ──
      if (state.bossWarningTimer > 0) {
        state.bossWarningTimer--;
        if (state.bossWarningTimer <= 0) {
          setBossWarning(false);
          const wave = WAVE_TABLE[state.lastWaveSpawned];
          state.boss = {
            x: state.player.x < CW / 2 ? 180 : 60, y: -80,
            hp: wave.bossHp, maxHp: wave.bossHp,
            speed: 1, alive: true, type: wave.boss,
            attackTimer: 0, phase: 0,
          };
          setBossHp(wave.bossHp);
          setWaveAnnounce(wave.name);
          // auto-clear boss name after 2.5s — keeps it readable but not stuck
          if (waveTimeoutRef.current) clearTimeout(waveTimeoutRef.current);
          waveTimeoutRef.current = setTimeout(() => {
            waveTimeoutRef.current = null;
            setWaveAnnounce("");
          }, 2500);
        }
      }
      // ── boss/miniboss cooldown (also runs during gacha to prevent stale state) ──
      if (state.bossCooldown > 0) {
        state.bossCooldown--;
      }
      if (state.minibossCooldown > 0) {
        state.minibossCooldown--;
      }

      bgOffsetRef.current = (bgOffsetRef.current + 1) % 40;

      // ── 5-layer parallax stars ──
      state.stars.forEach((s) => {
        s.y += s.speed;
        if (s.y > CH) { s.y = -2; s.x = Math.random() * CW; }
      });

      // ── engine exhaust particles (pooled) ──
       if (stateRef.current.gameStarted && !stateRef.current.isPaused && !stateRef.current.isGameOver && !stateRef.current.showGacha) {
        const pp = state.player;
        for (let i = 0; i < 2; i++) {
          const e = exhaustPool.current.get();
          e.x = pp.x + 12 + (Math.random() - 0.5) * 6;
          e.y = pp.y + 26;
          e.vx = (Math.random() - 0.5) * 0.5;
          e.vy = 1 + Math.random() * 1.5;
          e.alpha = 0.6 + Math.random() * 0.4;
          e.size = 2 + Math.random() * 3;
          e.life = 20 + Math.random() * 15;
          e.maxLife = 35;
        }
      }
      // update exhaust
      for (const e of exhaustPool.current.items) {
        if (!e.alive) continue;
        e.x += e.vx;
        e.y += e.vy;
        e.vy *= 0.97;
        e.life--;
        e.alpha = Math.max(0, e.life / e.maxLife);
        e.size *= 0.96;
        if (e.life <= 0) {
          exhaustPool.current.release(e);
        }
      }

      if (stateRef.current.gameStarted && !stateRef.current.isPaused && !stateRef.current.isGameOver && !stateRef.current.showGacha) {
        // ── level up visual timer ──
        if (state.levelUpFreezeTimer > 0) state.levelUpFreezeTimer--;

        const p = state.player;
        // ── player movement with acceleration & deceleration ──
        const accel = 0.45;
        const friction = 0.88;
        const maxSpeed = p.speed;
        if (state.keys.ArrowLeft || state.keys.a) p.vx -= accel;
        if (state.keys.ArrowRight || state.keys.d) p.vx += accel;
        if (state.keys.ArrowUp || state.keys.w) p.vy -= accel;
        if (state.keys.ArrowDown || state.keys.s) p.vy += accel;
        // apply friction when no input
        if (!(state.keys.ArrowLeft || state.keys.a) && !(state.keys.ArrowRight || state.keys.d)) p.vx *= friction;
        if (!(state.keys.ArrowUp || state.keys.w) && !(state.keys.ArrowDown || state.keys.s)) p.vy *= friction;
        // clamp speed
        p.vx = Math.max(-maxSpeed, Math.min(maxSpeed, p.vx));
        p.vy = Math.max(-maxSpeed, Math.min(maxSpeed, p.vy));
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(0, Math.min(CW - 24, p.x));
        p.y = Math.max(0, Math.min(CH - 32, p.y));

        // ── Option (僚机) physics update ──
        const optionOffX = 24;
        const optionOffY = 18;
        state.options[0].targetX = p.x - optionOffX;
        state.options[0].targetY = p.y + optionOffY;
        state.options[1].targetX = p.x + optionOffX + 16;
        state.options[1].targetY = p.y + optionOffY;
        for (const opt of state.options) {
          opt.x += (opt.targetX - opt.x) * 0.08;
          opt.y += (opt.targetY - opt.y) * 0.08;
          opt.form = state.optionForm;
          // transform progress
          if (opt.form === "purpleWing" && opt.transformProgress < 1) {
            opt.transformProgress = Math.min(1, opt.transformProgress + 0.04);
          } else if (opt.form === "greenLaser" && opt.transformProgress > 0) {
            opt.transformProgress = Math.max(0, opt.transformProgress - 0.04);
          }
          if (opt.slashCooldown > 0) opt.slashCooldown--;
        }

        // ── option thruster particles (arc-based) ──
        if (f % 2 === 0) {
          for (const opt of state.options) {
            for (let i = 0; i < 2; i++) {
              const e = exhaustPool.current.get();
              e.x = opt.x + 7 + (Math.random() - 0.5) * 5;
              e.y = opt.y + 13;
              e.vx = (Math.random() - 0.5) * 0.4;
              e.vy = 0.8 + Math.random() * 1.2;
              e.alpha = 0.5 + Math.random() * 0.4;
              e.size = 1.5 + Math.random() * 2;
              e.life = 18 + Math.random() * 12;
              e.maxLife = 30;
            }
          }
        }

        // ── auto fire ──
        if (f % 8 === 0) {
          const lvl = state.weaponLevel;
          const wt = state.weaponType;
          const od = state.overdriveTimer > 0;

          // play shoot sound based on weapon type
          if (wt === "laser") audio.shootLaser();
          else if (wt === "wave") audio.shootWave();
          else audio.shoot();

          if (wt === "spread") {
            if (lvl >= 1) spawnBullet(p.x + 10, p.y, 0, od ? -12 : -9, "spread");
            if (lvl >= 2) {
              spawnBullet(p.x + 4, p.y + 4, od ? -5 : -3, od ? -10 : -8, "spread");
              spawnBullet(p.x + 16, p.y + 4, od ? 5 : 3, od ? -10 : -8, "spread");
            }
            if (lvl >= 3) {
              spawnBullet(p.x, p.y + 6, od ? -7 : -4, od ? -9 : -7, "spread");
              spawnBullet(p.x + 20, p.y + 6, od ? 7 : 4, od ? -9 : -7, "spread");
            }
            if (od && lvl >= 1) {
              spawnBullet(p.x + 10, p.y - 2, 0, -14, "spread");
              spawnBullet(p.x, p.y + 8, -8, -8, "spread");
              spawnBullet(p.x + 20, p.y + 8, 8, -8, "spread");
            }
          } else if (wt === "laser") {
            if (lvl >= 1) spawnBullet(p.x + 10, p.y, 0, od ? -18 : -14, "laser");
            if (lvl >= 2) {
              spawnBullet(p.x + 6, p.y + 2, 0, od ? -17 : -13, "laser");
              spawnBullet(p.x + 14, p.y + 2, 0, od ? -17 : -13, "laser");
            }
            if (lvl >= 3) {
              spawnBullet(p.x + 2, p.y + 4, 0, od ? -16 : -12, "laser");
              spawnBullet(p.x + 18, p.y + 4, 0, od ? -16 : -12, "laser");
            }
            if (od) {
              spawnBullet(p.x, p.y + 6, -2, -16, "laser");
              spawnBullet(p.x + 20, p.y + 6, 2, -16, "laser");
            }
          } else if (wt === "wave") {
            const waveOff = Math.sin(f * 0.15) * 2;
            if (lvl >= 1) spawnBullet(p.x + 10 + waveOff, p.y, 0, od ? -12 : -9, "wave");
            if (lvl >= 2) {
              spawnBullet(p.x + 4 + waveOff, p.y, od ? -4 : -3, od ? -11 : -9, "wave");
              spawnBullet(p.x + 16 + waveOff, p.y, od ? 4 : 3, od ? -11 : -9, "wave");
            }
            if (lvl >= 3) {
              spawnBullet(p.x - 2 + waveOff, p.y + 2, od ? -7 : -6, od ? -10 : -8, "wave");
              spawnBullet(p.x + 22 + waveOff, p.y + 2, od ? 7 : 6, od ? -10 : -8, "wave");
            }
            if (od) {
              spawnBullet(p.x + 10 + waveOff, p.y - 2, 0, -14, "wave");
              spawnBullet(p.x + 4 + waveOff, p.y + 4, -5, -10, "wave");
              spawnBullet(p.x + 16 + waveOff, p.y + 4, 5, -10, "wave");
            }
          }
        }

        // ── wingman satellites (4-level system update.md) ──
        const wmLvl = state.wingmanLevel;
        if (wmLvl > 0) {
          // Update orbit angle
          state.wingmanOrbitAngle += wmLvl >= 3 ? 0.035 : 0.02;
          const baseAngle = state.wingmanOrbitAngle;
          const orbR = 38;
          const cx = p.x + 12, cy = p.y + 12;

          // L1: single satellite flank-left
          if (wmLvl === 1) {
            const sx = p.x - 22, sy = p.y + 18;
            if (f % 14 === 0) {
              const b = state.bullets.get();
              b.x = sx + 4; b.y = sy; b.vx = 0; b.vy = -6;
              b.type = "player"; b.wtype = state.weaponType; b.wingman = true; b.lightning = false;
              b.damage = 1;
            }
          }
          // L2: dual satellites flank left+right
          if (wmLvl === 2) {
            if (f % 14 === 0) {
              const bL = state.bullets.get();
              bL.x = p.x - 18; bL.y = p.y + 18; bL.vx = 0; bL.vy = -6;
              bL.type = "player"; bL.wtype = state.weaponType; bL.wingman = true; bL.lightning = false; bL.damage = 1;
              const bR = state.bullets.get();
              bR.x = p.x + 34; bR.y = p.y + 18; bR.vx = 0; bR.vy = -6;
              bR.type = "player"; bR.wtype = state.weaponType; bR.wingman = true; bR.lightning = false; bR.damage = 1;
            }
          }
          // L3: 4 satellites in circular orbit, each fires lightning
          if (wmLvl === 3) {
            for (let i = 0; i < 4; i++) {
              const ang = baseAngle + (Math.PI / 2) * i;
              const sx = cx + Math.cos(ang) * orbR;
              const sy = cy + Math.sin(ang) * orbR;
              // Stagger fire: each satellite fires every 20 frames, offset by 5
              if (f % 20 === i * 5) {
                const b = state.bullets.get();
                b.x = sx; b.y = sy;
                b.vx = Math.cos(ang) * 1.5; b.vy = Math.sin(ang) * 1.5 - 3;
                b.type = "player"; b.wtype = state.weaponType; b.wingman = true; b.lightning = true;
                b.damage = 3;
              }
            }
          }
          // L4: awakening — satellites detach, sweep across screen, fire rapid lightning
          if (wmLvl >= 4) {
            for (let i = 0; i < 4; i++) {
              const ang = baseAngle + (Math.PI / 2) * i;
              // L4: satellites sweep outward then back (radius oscillates)
              const sweepR = orbR + Math.sin(f * 0.06 + i * 1.57) * 20;
              const sx = cx + Math.cos(ang) * sweepR;
              const sy = cy + Math.sin(ang) * sweepR;
              // Rapid fire every 12 frames, staggered
              if (f % 12 === i * 3) {
                const b = state.bullets.get();
                b.x = sx; b.y = sy;
                b.vx = Math.cos(ang) * 2; b.vy = Math.sin(ang) * 2 - 4;
                b.type = "player"; b.wtype = state.weaponType; b.wingman = true; b.lightning = true;
                b.damage = 4;
              }
            }
          }
        }

        // ── Option (僚机) auto-fire ──
        const optForm = state.optionForm;
        if (optForm === "greenLaser") {
          // Form A: green penetrating laser from each option
          if (f % 14 === 0) {
            for (const opt of state.options) {
              if (opt.transformProgress > 0.3) continue;
              const b = state.bullets.get();
              b.x = opt.x + 7; b.y = opt.y - 2;
              b.vx = 0; b.vy = -10;
              b.type = "player"; b.wtype = undefined; b.wingman = false; b.lightning = true;
              b.damage = 3;
            }
          }
        } else {
          // Form B: white crescent spread from each option
          if (f % 18 === 0) {
            for (const opt of state.options) {
              if (opt.transformProgress < 0.7) continue;
              const cx = opt.x + 7;
              const cy = opt.y;
              for (let ang = -0.5; ang <= 0.5; ang += 0.25) {
                const b = state.bullets.get();
                b.x = cx; b.y = cy;
                b.vx = Math.sin(ang) * 2;
                b.vy = -7 - Math.abs(ang) * 2;
                b.type = "player"; b.wtype = "wave"; b.wingman = false; b.lightning = false;
                b.damage = 2;
              }
            }
          }
        }

        // ── homing missile ──
        if (state.hasHoming && f % 30 === 0) {
          const targets: Monster[] = [];
          state.monsters.forEachActive((t) => targets.push(t));
          if (targets.length > 0) {
            const t = targets[Math.floor(Math.random() * targets.length)];
            spawnMissile(p.x + 10, p.y, t.x + 12, t.y + 10);
          }
        }

        // ── formations (fighters, more frequent but tight and slow) ──
        state.formationTimer++;
        const formInterval = Math.max(180, 350 - Math.floor(state.score / 120));
        if (state.formationTimer >= formInterval && !state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0) {
          state.formationTimer = 0;
          const pattern = Math.floor(Math.random() * 5);
          state.formationGroupCounter++;
          const gid = state.formationGroupCounter;
          const rspd = () => 0.3 + Math.random() * 0.4;

          if (pattern === 0) {
            // Flanking pincer — 3+3
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(-30 - i * 18, -5 + Math.random() * 15, "fighter", 1, 0);
              m.formation = true; m.vx = rspd() + i * 0.08; m.vy = 0.3 + Math.random() * 0.3; m.formationGroup = gid;
            }
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(CW + 30 + i * 18, -5 + Math.random() * 15, "fighter", 1, 0);
              m.formation = true; m.vx = -(rspd() + i * 0.08); m.vy = 0.3 + Math.random() * 0.3; m.formationGroup = gid;
            }
          } else if (pattern === 1) {
            // Side sweep — 4 tight from one side
            const fromLeft = Math.random() > 0.5;
            const sideX = fromLeft ? -30 : CW + 10;
            const dir = fromLeft ? 1 : -1;
            for (let i = 0; i < 4; i++) {
              const m = spawnMonster(sideX, 15 + i * 16 + Math.random() * 8, "fighter", 1, 0);
              m.formation = true; m.vx = dir * (rspd() + 0.2); m.vy = 0.2 + Math.random() * 0.2; m.formationGroup = gid;
            }
          } else if (pattern === 2) {
            // Arrow formation — 5 ships spread
            const anchorX = 60 + Math.random() * (CW - 160);
            const spread = 22 + Math.random() * 20;
            for (let i = 0; i < 5; i++) {
              const m = spawnMonster(anchorX + (i - 2) * spread, -8 - i * 10, "fighter", 1, 0);
              m.formation = true; m.vx = (i - 2) * (0.05 + Math.random() * 0.1); m.vy = 0.4 + Math.random() * 0.3; m.formationGroup = gid;
            }
          } else if (pattern === 3) {
            // Diagonal intercept — 3 ships
            const fromRight = Math.random() > 0.5;
            const startX = fromRight ? CW + 20 : -30;
            const startY = 15 + Math.random() * 30;
            const dirX = fromRight ? -1 : 1;
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(startX, startY + i * 18, "fighter", 1, 0);
              m.formation = true; m.vx = dirX * (0.8 + Math.random() * 0.4); m.vy = 0.25 + Math.random() * 0.3; m.formationGroup = gid;
            }
          } else if (pattern === 4) {
            // Zigzag wave — 4 ships from top
            const baseVy = 0.4 + Math.random() * 0.3;
            for (let i = 0; i < 4; i++) {
              const m = spawnMonster(Math.random() * (CW - 60), -12 - i * 14, "fighter", 1, 0);
              m.formation = true; m.vx = (Math.random() - 0.5) * 1.2; m.vy = baseVy; m.formationGroup = gid;
            }
          }
        }

        // ── solo elite/interceptor/bomber spawns (individual, not in groups) ──
        if (f % 180 === 0 && !state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0 && state.score > 400) {
          const r2 = Math.random();
          let soloType: Monster["type"] = "bomber";
          if (state.score > 800 && r2 < 0.25) soloType = "elite";
          else if (state.score > 500 && r2 < 0.5) soloType = "interceptor";
          const soloHp = soloType === "elite" ? 15 : soloType === "interceptor" ? 5 : 4;
          const fromSide = Math.random() > 0.5;
          const soloX = fromSide ? (Math.random() > 0.5 ? -20 : CW + 10) : Math.random() * (CW - 40);
          const soloY = fromSide ? 30 + Math.random() * 80 : -16;
          const soloVx = fromSide ? (soloX < 0 ? 1.5 : -1.5) : (Math.random() - 0.5) * 0.5;
          const m = spawnMonster(soloX, soloY, soloType, soloHp, 0);
          m.formation = false;
          m.vx = soloVx; m.vy = 1 + Math.random() * 0.5;
        }

        // ── miniboss spawn ──
        if (!state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.score > 800 && state.bossWarningTimer <= 0) {
          const mbInterval = Math.max(800, 2000 - Math.floor(state.score / 20));
          if (state.score % mbInterval < 3 && state.score > state.lastWaveSpawned * 1000 + 500) {
            const mbTypes: BossType[] = ["fortress", "carrier"];
            const mbType = mbTypes[Math.floor(Math.random() * mbTypes.length)];
            const mbHp = 15 + Math.floor(state.score / 200);
            state.miniboss = {
              x: Math.random() * (CW - 80) + 20, y: -40,
              hp: mbHp, maxHp: mbHp, speed: 1,
              alive: true, type: mbType,
              attackTimer: 0, enterAnim: 60,
            };
            audio.bossWarning();
          }
        }

        // ── miniboss logic ──
        if (state.miniboss) {
          const mb = state.miniboss;
          if (!mb.alive) {
            state.miniboss = null;
          } else {
            if (mb.enterAnim > 0) {
              mb.enterAnim--;
              mb.y += 0.5;
            } else {
              if (mb.y < 30) mb.y += mb.speed;
              else {
                mb.x += Math.sin(f * 0.03) * 1.5;
                mb.x = Math.max(0, Math.min(CW - 60, mb.x));
              }
              mb.attackTimer++;
              if (mb.type === "fortress" && mb.attackTimer % 50 === 0) {
                spawnEnemyBullet(mb.x + 8, mb.y + 36, 0, 3.5);
                spawnEnemyBullet(mb.x + 40, mb.y + 36, 0, 3.5);
              } else if (mb.type === "carrier" && mb.attackTimer % 80 === 0) {
                for (let i = 0; i < 2; i++) {
                  const m = spawnMonster(mb.x + 10 + i * 24, mb.y + 28, "fighter", 1, 0);
                  m.vy = 1.5 + Math.random(); m.vx = (Math.random() - 0.5) * 0.5;
                }
              }
            }
          }
        }

        // ── formation movement ──
        state.monsters.forEachActive((m) => {
          if (m.formation) {
            m.vx *= 0.98; m.vy += 0.02; m.x += m.vx; m.y += m.vy;
            const breakY = m.type === "elite" ? 60 : 80;
            if (m.y > breakY && m.x > 20 && m.x < CW - 20) {
              m.formation = false; m.speed = 1 + Math.random();
              if (m.type === "elite") m.speed = 0.8;
            }
          } else {
            if (m.vy === 0 && m.vx === 0) m.vy = m.speed;
            m.x += m.vx; m.y += m.vy;
          }
        });

        // ── wave spawn (small waves of fighters only, more random positions) ──
        const waveGap = Math.max(200, 350 - Math.floor(state.score / 100));
        if (f % waveGap === 0 && !state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0) {
          const waveSize = Math.min(4, 2 + Math.floor(state.score / 1500));
          const spread = 120 + Math.random() * 80;
          // Random entry: sometimes from top, sometimes from sides
          const entryStyle = Math.random();
          const hp = 1; // always 1 hp for regular fighters
          if (entryStyle < 0.4) {
            // from top
            for (let i = 0; i < waveSize; i++) {
              const offset = waveSize > 1 ? (i / (waveSize - 1) - 0.5) * spread : 0;
              const m = spawnMonster(
                Math.max(4, Math.min(CW - 36, CW / 2 - 12 + offset + (Math.random() - 0.5) * 30)),
                -16 - i * 10, "fighter", hp, 0,
              );
              m.vy = 0.6 + Math.random() * 0.4; m.vx = (Math.random() - 0.5) * 0.8;
            }
          } else if (entryStyle < 0.7) {
            // from left
            for (let i = 0; i < waveSize; i++) {
              const m = spawnMonster(-20 - i * 15, 20 + Math.random() * 80, "fighter", hp, 0);
              m.vy = 0.3 + Math.random() * 0.3; m.vx = 1 + Math.random() * 0.5;
            }
          } else {
            // from right
            for (let i = 0; i < waveSize; i++) {
              const m = spawnMonster(CW + 20 + i * 15, 20 + Math.random() * 80, "fighter", hp, 0);
              m.vy = 0.3 + Math.random() * 0.3; m.vx = -(1 + Math.random() * 0.5);
            }
          }
        }

        // ── boss logic ──
        if (state.boss) {
          const b = state.boss;
          if (!b.alive) {
            state.boss = null; setBossHp(0);
          } else {
            b.attackTimer++;

            if (b.type === "fortress") {
              if (b.y < 40) { b.y += b.speed; }
              else { b.x += Math.sin(f * 0.02) * 1.5; b.x = Math.max(0, Math.min(CW - 52, b.x)); }
              if (f % 40 === 0) {
                for (let a = -1; a <= 1; a++) {
                  spawnEnemyBullet(b.x + 22, b.y + 36, a * 1.5, 3.5);
                }
              }
              if (f % 65 === 0) {
                spawnEnemyBullet(b.x + 4, b.y + 36, -2, 4);
                spawnEnemyBullet(b.x + 40, b.y + 36, 2, 4);
              }
            } else if (b.type === "carrier") {
              if (b.y < 30) { b.y += b.speed; }
              else { b.x += Math.sin(f * 0.03) * 2.5; b.x = Math.max(0, Math.min(CW - 48, b.x)); }
              if (f % 120 === 0 && state.monsters.items.filter((m) => m.alive).length < 12) {
                for (let i = 0; i < 2; i++) {
                  const m = spawnMonster(b.x + 10 + i * 20, b.y + 28, "fighter", 1, 0);
                  m.vy = 1.5 + Math.random(); m.vx = (Math.random() - 0.5) * 0.5;
                }
              }
              if (f % 50 === 0) {
                spawnEnemyBullet(b.x + 8, b.y + 36, 0, 3);
                spawnEnemyBullet(b.x + 32, b.y + 36, 0, 3);
              }
            } else {
              if (b.y < 50) { b.y += b.speed; }
              else { b.x += Math.sin(f * 0.04) * 3; b.x = Math.max(0, Math.min(CW - 48, b.x)); }
              if (f % 60 === 0) {
                const targetX = state.player.x + 10;
                const dx = (targetX - b.x - 20) / 60;
                spawnEnemyBullet(b.x + 20, b.y + 36, dx, 4);
              }
              if (f % 80 === 0) {
                for (let a = -1; a <= 1; a++) {
                  spawnEnemyBullet(b.x + 20, b.y + 36, a * 2.5, 3);
                }
              }
              if (b.hp < b.maxHp * 0.5 && f % 45 === 0) {
                spawnEnemyBullet(b.x + 4, b.y + 36, -1.5, 4);
                spawnEnemyBullet(b.x + 36, b.y + 36, 1.5, 4);
              }
            }
          }
        }

        // ── monster fire ──
        state.monsters.forEachActive((m) => {
          if (!m.formation && f % 90 === 0 && Math.random() > 0.7) {
            spawnEnemyBullet(m.x + 12, m.y + 16, 0, 3.5);
          }
        });

        // ── move bullets ──
        state.bullets.forEachActive((b) => { b.x += b.vx; b.y += b.vy; });
        state.enemyBullets.forEachActive((b) => { b.x += b.vx; b.y += b.vy; });
        state.particles.forEachActive((pt) => {
          pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.gravity;
          pt.vx *= 0.97; pt.vy *= 0.97;
          pt.life--; pt.alpha = Math.max(0, pt.life / pt.maxLife);
        });

        // missiles
        state.missiles.forEachActive((ms) => {
          if (ms.targetX && ms.targetY) {
            const dx = ms.targetX - ms.x; const dy = ms.targetY - ms.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
              ms.vx += (dx / dist) * 0.3; ms.vy += (dy / dist) * 0.3;
              const sp = Math.sqrt(ms.vx * ms.vx + ms.vy * ms.vy);
              if (sp > 7) { ms.vx = (ms.vx / sp) * 7; ms.vy = (ms.vy / sp) * 7; }
            }
          }
          ms.x += ms.vx; ms.y += ms.vy;
        });

        // cull
        state.bullets.forEachActive((b) => {
          if (b.y < -20 || b.x < -10 || b.x > CW + 10) state.bullets.release(b);
        });
        state.enemyBullets.forEachActive((b) => {
          if (b.y > CH + 10) state.enemyBullets.release(b);
        });
        state.monsters.forEachActive((m) => {
          if (m.y > CH + 20) state.monsters.release(m);
        });
        state.missiles.forEachActive((ms) => {
          if (ms.y < -20 || ms.y > CH + 20) state.missiles.release(ms);
        });
        state.particles.forEachActive((pt) => {
          if (pt.life <= 0) state.particles.release(pt);
        });

        // ── monster flash timer decay ──
        state.monsters.forEachActive((m) => {
          if (m.flashTimer > 0) m.flashTimer--;
        });

        // ── bullet vs monster ──
        state.bullets.forEachActive((b) => {
          let hit = false;
          state.monsters.forEachActive((m) => {
            if (hit) return;
            const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
            const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
            if (b.x > m.x && b.x < m.x + mw && b.y > m.y && b.y < m.y + mh) {
              m.hp -= b.damage;
              m.flashTimer = 3;
              state.bullets.release(b);
              emitExplosion(b.x, b.y, 3, ["#fbbf24"], 3);
              if (m.hp <= 0) {
                // energy fragments on death
                const energyVal = m.type === "elite" ? 15 : m.type === "bomber" ? 8 : 5;
                for (let ef = 0; ef < (m.type === "elite" ? 3 : 1); ef++) {
                  spawnEnergyFragment(m.x + 4 + Math.random() * 12, m.y + 4 + Math.random() * 8, energyVal);
                }
                emitExplosion(m.x + 8, m.y + 8, 6, ["#FFD83D", "#FF6050"], 5, 25);
                audio.explosion();
                state.monsters.release(m);
                setScore((prev) => { const n = prev + (m.type === "elite" ? 300 : 100); state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
                state.comboKills++;
                if (state.comboKills >= 30 && state.magnetModeTimer <= 0) {
                  state.magnetModeTimer = 300;
                }
              }
              hit = true;
            }
          });
        });

        // ── missile vs monster ──
        state.missiles.forEachActive((ms) => {
          let hit = false;
          state.monsters.forEachActive((m) => {
            if (hit) return;
            const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
            const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
            if (ms.x > m.x && ms.x < m.x + mw && ms.y > m.y && ms.y < m.y + mh) {
              m.hp -= 3;
              m.flashTimer = 3;
              state.missiles.release(ms);
              emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
              if (m.hp <= 0) {
                // energy fragments on death
                const energyVal = m.type === "elite" ? 15 : m.type === "bomber" ? 8 : 5;
                for (let ef = 0; ef < (m.type === "elite" ? 3 : 1); ef++) {
                  spawnEnergyFragment(m.x + 4 + Math.random() * 12, m.y + 4 + Math.random() * 8, energyVal);
                }
                emitExplosion(m.x + 8, m.y + 8, 6, ["#FFD83D", "#FF6050"], 5, 25);
                audio.explosion();
                state.monsters.release(m);
                setScore((prev) => { const n = prev + (m.type === "elite" ? 300 : 100); state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
                state.comboKills++;
                if (state.comboKills >= 30 && state.magnetModeTimer <= 0) {
                  state.magnetModeTimer = 300;
                }
              }
              hit = true;
            }
          });
        });

        // ── power-ups ──
        state.powerUps.forEachActive((pu) => {
          pu.y += 0.8;
          const px = state.player.x;
          const py = state.player.y;
          if (pu.x > px - 4 && pu.x < px + 32 && pu.y > py - 4 && pu.y < py + 32) {
            state.powerUps.release(pu);
            if (pu.type === "optionForm") {
              // S-item: switch Option form
              state.optionForm = state.optionForm === "greenLaser" ? "purpleWing" : "greenLaser";
              emitExplosion(pu.x, pu.y, 20, ["#a855f7", "#c084fc", "#fff"], 8, 35, 0.02, 5);
              audio.powerUp();
            } else if (pu.type === "wingman") {
              // Wingman power-up
              if (state.wingmanLevel < 4) {
                state.wingmanLevel++;
                setWingmanLevel(state.wingmanLevel);
              }
              emitExplosion(pu.x, pu.y, 15, ["#c084fc", "#a855f7", "#fff"], 6, 30, 0.02, 4);
              audio.powerUp();
            } else {
              // Weapon power-up
              if (state.overdriveTimer > 0) {
                state.overdriveTimer = Math.min(600, state.overdriveTimer + 180);
                setOverdriveTimer(state.overdriveTimer);
              } else if (state.weaponLevel >= 3) {
                state.weaponLevel = 4; state.overdriveTimer = 300;
                setWeaponLevel(4); setOverdriveTimer(300);
              } else {
                const n = Math.min(3, state.weaponLevel + 1);
                state.weaponLevel = n; setWeaponLevel(n);
              }
              emitExplosion(pu.x, pu.y, 15, ["#38bdf8", "#7dd3fc", "#fff"], 6, 30, 0.02, 4);
              audio.powerUp();
            }
          }
        });
        state.powerUps.forEachActive((pu) => {
          if (pu.y > CH + 10) state.powerUps.release(pu);
        });

        // ── bullet/missile vs boss ──
        if (state.boss) {
          const b = state.boss;
          state.bullets.forEachActive((bullet) => {
            const bw = b.type === "fortress" ? 52 : 48;
            const bh = b.type === "fortress" ? 36 : 36;
            if (bullet.x > b.x && bullet.x < b.x + bw && bullet.y > b.y && bullet.y < b.y + bh) {
              b.hp--;
              state.bullets.release(bullet);
              emitExplosion(bullet.x, bullet.y, 3, ["#fbbf24"], 3);
              if (b.hp <= 0) {
                emitExplosion(b.x + 22, b.y + 16, 50, ["#f97316", "#ef4444", "#fef08a", "#fff"], 8);
                setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0);
                b.alive = false;
                state.boss = null;
                state.bossCooldown = 180;
                state.shakeX = 14; state.shakeY = 14;
                audio.bossExplosion();
                // trigger gacha on boss kill
                if (gachaTimeoutRef.current) clearTimeout(gachaTimeoutRef.current);
                gachaTimeoutRef.current = setTimeout(() => {
                  gachaTimeoutRef.current = null;
                  const cards = generateGachaOptions();
                  setGachaCards(cards);
                  setShowGacha(true);
                }, 800);
              } else setBossHp(b.hp);
            }
          });
          // IMPORTANT: boss may have been nulled by bullet loop — check before missile loop
          if (state.boss) {
            const b2 = state.boss;
            state.missiles.forEachActive((ms) => {
              if (!state.boss) return;
              const bw = b2.type === "fortress" ? 52 : 48;
              const bh = b2.type === "fortress" ? 36 : 36;
              if (ms.x > b2.x && ms.x < b2.x + bw && ms.y > b2.y && ms.y < b2.y + bh) {
                b2.hp -= 3;
                state.missiles.release(ms);
                emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
                if (b2.hp <= 0) {
                  emitExplosion(b2.x + 22, b2.y + 16, 50, ["#f97316", "#ef4444", "#fef08a", "#fff"], 8);
                  setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                  setBossHp(0); b2.alive = false; state.boss = null;
                  state.bossCooldown = 180;
                  state.shakeX = 14; state.shakeY = 14;
                  audio.bossExplosion();
                  if (gachaTimeoutRef.current) clearTimeout(gachaTimeoutRef.current);
                  gachaTimeoutRef.current = setTimeout(() => {
                    gachaTimeoutRef.current = null;
                    const cards = generateGachaOptions();
                    setGachaCards(cards);
                    setShowGacha(true);
                  }, 800);
                } else setBossHp(b2.hp);
              }
            });
          }
        }

        // ── bullet/missile vs miniboss ──
        if (state.miniboss) {
          const mb = state.miniboss;
          if (mb.enterAnim <= 0) {
            const mbw = 52, mbh = 40;
            state.bullets.forEachActive((bullet) => {
              if (!state.miniboss) return;
              if (bullet.x > mb.x && bullet.x < mb.x + mbw && bullet.y > mb.y && bullet.y < mb.y + mbh) {
                mb.hp--;
                state.bullets.release(bullet);
                emitExplosion(bullet.x, bullet.y, 3, ["#fbbf24"], 3);
                if (mb.hp <= 0) {
                  emitExplosion(mb.x + 26, mb.y + 20, 40, ["#f97316", "#ef4444", "#fef08a"], 7);
                  setScore((prev) => { const n = prev + 500; state.score = n; return n; });
                  mb.alive = false; state.miniboss = null;
                  state.minibossCooldown = 200;
                  state.shakeX = 10; state.shakeY = 10;
                  audio.bossExplosion();
                }
              }
            });
            // IMPORTANT: miniboss may have been nulled by bullet loop
            if (state.miniboss) {
              const mb2 = state.miniboss;
              state.missiles.forEachActive((ms) => {
                if (!state.miniboss) return;
                if (ms.x > mb2.x && ms.x < mb2.x + mbw && ms.y > mb2.y && ms.y < mb2.y + mbh) {
                  mb2.hp -= 3;
                  state.missiles.release(ms);
                  emitExplosion(ms.x, ms.y, 6, ["#f97316", "#fef08a", "#ef4444"], 5);
                  if (mb2.hp <= 0) {
                    emitExplosion(mb2.x + 26, mb2.y + 20, 40, ["#f97316", "#ef4444", "#fef08a"], 7);
                    setScore((prev) => { const n = prev + 500; state.score = n; return n; });
                    mb2.alive = false; state.miniboss = null;
                    state.minibossCooldown = 200;
                    state.shakeX = 10; state.shakeY = 10;
                    audio.bossExplosion();
                  }
                }
              });
            }
          }
        }

        const ENERGY_MAGNET = state.magnetModeTimer > 0 ? 200 : 100;
        state.energyFrags.forEachActive((ef) => {
          // drift and slow down
          ef.x += ef.vx; ef.y += ef.vy;
          ef.vx *= 0.97; ef.vy *= 0.97;
          // magnet pull toward player
          const edx = (p.x + 14) - ef.x;
          const edy = (p.y + 12) - ef.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist < ENERGY_MAGNET && edist > 2) {
            const epull = (1 - edist / ENERGY_MAGNET) * 2.5 + 0.3;
            ef.x += (edx / edist) * epull;
            ef.y += (edy / edist) * epull;
          }
          // collection
          if (ef.x > p.x - 4 && ef.x < p.x + 32 && ef.y > p.y - 4 && ef.y < p.y + 32) {
            state.weaponEnergy += ef.value;
            state.energyNeeded = 60 + state.weaponLevel * 20;
            emitExplosion(ef.x, ef.y, 3, [COLORS.playerBullet, "#fff"], 3);
            state.energyFrags.release(ef);
            // level up check
            if (state.weaponEnergy >= state.energyNeeded && state.weaponLevel < 4) {
              state.weaponEnergy = 0;
              if (state.overdriveTimer > 0) {
                state.overdriveTimer += 120;
                setOverdriveTimer(state.overdriveTimer);
              } else if (state.weaponLevel >= 3) {
                state.weaponLevel = 4; state.overdriveTimer = 300;
                setWeaponLevel(4); setOverdriveTimer(300);
              } else {
                state.weaponLevel++;
                setWeaponLevel(state.weaponLevel);
              }
              state.energyNeeded = state.weaponLevel < 4 ? 60 + state.weaponLevel * 20 : Infinity;
              emitExplosion(p.x + 12, p.y + 12, 30, [COLORS.player, COLORS.playerBullet, "#fff"], 8, 45, 0.02, 5);
              state.shakeX = Math.max(state.shakeX, 6);
              state.shakeY = Math.max(state.shakeY, 6);
              state.levelUpFreezeTimer = 48;
              audio.powerUp();
            }
          }
        });
        // cull stray energy fragments
        state.energyFrags.forEachActive((ef) => {
          if (ef.y > CH + 10 || ef.y < -40 || ef.x < -40 || ef.x > CW + 40) {
            state.energyFrags.release(ef);
          }
        });

        // ── magnet mode countdown ──
        if (state.magnetModeTimer > 0) {
          state.magnetModeTimer--;
        }

        // ── player hit ──
        if (!state.invincible) {
          const px = p.x + 10;
          const py = p.y + 10;
          let hitMonster = false;
          state.monsters.forEachActive((m) => {
            if (hitMonster) return;
            const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
            const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
            if (m.x < px + 8 && m.x + mw > px && m.y < py + 10 && m.y + mh > py) {
              hitMonster = true;
            }
          });

          let hitBullet = false;
          state.enemyBullets.forEachActive((b) => {
            if (hitBullet) return;
            if (b.x > p.x - 2 && b.x < p.x + 26 && b.y > p.y - 2 && b.y < p.y + 28) {
              hitBullet = true;
            }
          });
          const hitBoss = state.boss &&
            state.boss.x < p.x + 24 && state.boss.x + 44 > p.x &&
            state.boss.y < p.y + 28 && state.boss.y + 32 > p.y + 4;
          const hitMiniboss = state.miniboss && state.miniboss.enterAnim <= 0 &&
            state.miniboss.x < p.x + 24 && state.miniboss.x + 52 > p.x &&
            state.miniboss.y < p.y + 28 && state.miniboss.y + 40 > p.y + 4;
          if (hitMonster || hitBullet || hitBoss || hitMiniboss) {
            emitExplosion(p.x + 12, p.y + 14, 20, ["#60a5fa", "#93c5fd", "#fff"], 10);
            audio.playerHit();
            // No weapon downgrade on hit — keep player power intact
            setLives((prev) => {
              if (prev <= 1) { stateRef.current.isGameOver = true; setIsGameOver(true); return 0; }
              state.invincible = true; state.invincibleTimer = 120;
              setInvincible(true); state.shakeX = 8; state.shakeY = 8;
              state.respawnTimer = 60;
              setRespawnTimer(60);
              return prev - 1;
            });
          }
        }

        // ── Crisis Slash Detection (only in Form B: purpleWing) ──
        const SLASH_RANGE = 70;
        if (state.optionForm === "purpleWing") {
          for (const opt of state.options) {
            if (opt.transformProgress < 0.5) continue;
            if (opt.slashCooldown > 0) continue;
            let shouldSlash = false;
            state.enemyBullets.forEachActive((eb) => {
              if (shouldSlash) return;
              const dx = eb.x - opt.x;
              const dy = eb.y - opt.y;
              if (dy < 0 && dx * dx + dy * dy < SLASH_RANGE * SLASH_RANGE) {
                shouldSlash = true;
              }
            });
            if (!shouldSlash) {
              state.monsters.forEachActive((m) => {
                if (shouldSlash) return;
                const mcx = m.x + 12;
                const mcy = m.y + 10;
                const dx = mcx - opt.x;
                const dy = mcy - opt.y;
                if (dy < 0 && dx * dx + dy * dy < SLASH_RANGE * SLASH_RANGE) {
                  shouldSlash = true;
                }
              });
            }
            if (shouldSlash) {
              opt.slashCooldown = 120;
              const toRelease: Bullet[] = [];
              state.enemyBullets.forEachActive((eb) => {
                const dx = eb.x - opt.x;
                const dy = eb.y - opt.y;
                if (dy < 0 && dx * dx + dy * dy < SLASH_RANGE * SLASH_RANGE) {
                  toRelease.push(eb);
                }
              });
              for (const eb of toRelease) state.enemyBullets.release(eb);
              state.monsters.forEachActive((m) => {
                const mcx = m.x + 12;
                const mcy = m.y + 10;
                const dx = mcx - opt.x;
                const dy = mcy - opt.y;
                if (dy < 0 && dx * dx + dy * dy < SLASH_RANGE * SLASH_RANGE) {
                  m.hp -= 3;
                  m.flashTimer = 3;
                  emitExplosion(mcx, mcy, 4, ["#fff", "#e0f2fe"], 4, 15, 0.02, 3);
                }
              });
              state.shakeX = Math.max(state.shakeX, 4);
              state.shakeY = Math.max(state.shakeY, 4);
              const se = state.slashEffects.get();
              se.x = opt.x + 7; se.y = opt.y;
              se.alpha = 1; se.radius = SLASH_RANGE;
              se.timer = 0; se.maxTimer = 15;
              for (let i = 0; i < 12; i++) {
                const ang = -Math.PI * 0.5 + (Math.random() - 0.5) * 1.2;
                const sp = 2 + Math.random() * 4;
                spawnParticle(opt.x + 7, opt.y, Math.cos(ang) * sp, Math.sin(ang) * sp - 2, "#fff", 2 + Math.random() * 2, 12 + Math.random() * 8, 0.03);
              }
            }
          }
        }

        // ── Update slash effects ──
        state.slashEffects.forEachActive((se) => {
          se.timer++;
          se.alpha = 1 - se.timer / se.maxTimer;
          if (se.timer >= se.maxTimer) state.slashEffects.release(se);
        });

        // ── Check for monsters killed by slash (hp <= 0 without normal hit logic) ──
        const slashKilled: Monster[] = [];
        state.monsters.forEachActive((m) => {
          if (m.hp <= 0) {
            slashKilled.push(m);
          }
        });
        for (const m of slashKilled) {
          const eVal = m.type === "elite" ? 15 : m.type === "bomber" ? 8 : 5;
          for (let ef = 0; ef < (m.type === "elite" ? 3 : 1); ef++) {
            spawnEnergyFragment(m.x + 4 + Math.random() * 12, m.y + 4 + Math.random() * 8, eVal);
          }
          emitExplosion(m.x + 8, m.y + 8, 10, ["#ef4444", "#f97316", "#fff"], 6);
          audio.explosion();
          state.monsters.release(m);
          setScore((prev) => { const n = prev + (m.type === "elite" ? 300 : 100); state.score = n; return n; });
          checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
          state.comboKills++;
          if (state.comboKills >= 30 && state.magnetModeTimer <= 0) {
            state.magnetModeTimer = 300;
          }
        }
      }

      // ═══════════ RENDER ═══════════
      ctx.save();

      // ── Screen shake via coordinate offset ──
      ctx.translate(
        Math.round((Math.random() - 0.5) * state.shakeX),
        Math.round((Math.random() - 0.5) * state.shakeY),
      );

      // background gradient (Raiden: #060A18 → #101C30)
      if (!bgGradientRef.current) {
        bgGradientRef.current = ctx.createLinearGradient(0, 0, 0, CH);
        bgGradientRef.current.addColorStop(0, COLORS.bgDark);
        bgGradientRef.current.addColorStop(0.5, "#0A1024");
        bgGradientRef.current.addColorStop(1, COLORS.bgMid);
      }
      ctx.fillStyle = bgGradientRef.current;
      ctx.fillRect(0, 0, CW, CH);

      // nebula clouds (subtle, 12% opacity)
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#1a1040";
      ctx.beginPath(); ctx.arc(200, 150 + Math.sin(f * 0.005) * 30, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#102840";
      ctx.beginPath(); ctx.arc(100, 400 + Math.sin(f * 0.007 + 1) * 40, 100, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // animated grid (subtle)
      const go = bgOffsetRef.current;
      ctx.strokeStyle = "rgba(56,189,248,0.03)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < CW; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
      }
      for (let gy = -go; gy < CH; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
      }

      // ── 5-layer parallax stars (deep parallax depth, subtle) ──
      state.stars.forEach((s) => {
        ctx.globalAlpha = Math.min(0.15, s.layer < 3 ? s.brightness * 0.5 : s.brightness * 0.15);
        if (s.layer === 4) {
          ctx.fillStyle = "#e2e8f0";
          ctx.beginPath(); ctx.arc(s.x + s.size / 2, s.y + s.size / 2, s.size * 0.8, 0, Math.PI * 2); ctx.fill();
        } else if (s.layer === 3) {
          ctx.fillStyle = "#94a3b8";
          ctx.beginPath(); ctx.arc(s.x + s.size / 2, s.y + s.size / 2, s.size * 0.6, 0, Math.PI * 2); ctx.fill();
        } else if (s.layer === 2) {
          ctx.fillStyle = "#4a5568";
          ctx.beginPath(); ctx.arc(s.x + s.size / 2, s.y + s.size / 2, s.size * 0.8, 0, Math.PI * 2); ctx.fill();
        } else if (s.layer === 1) {
          ctx.fillStyle = "#3b4a6b";
          ctx.fillRect(s.x, s.y, s.size, s.size);
        } else {
          ctx.fillStyle = "#1e293b";
          ctx.fillRect(s.x, s.y, s.size, s.size);
        }
      });
      ctx.globalAlpha = 1;

      // ── engine exhaust (arc-based glow particles) ──
      for (const e of exhaustPool.current.items) {
        if (!e.alive) continue;
        // outer glow
        ctx.globalAlpha = e.alpha * 0.25;
        ctx.fillStyle = "#f97316";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size + 2, 0, Math.PI * 2); ctx.fill();
        // main core
        ctx.globalAlpha = e.alpha * 0.6;
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size * 0.7, 0, Math.PI * 2); ctx.fill();
        // white hot center
        ctx.globalAlpha = e.alpha * 0.4;
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(e.x, e.y, e.size * 0.3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // ── START SCREEN: simple ship preview removed ──
      // We'll show ship selection in UI instead of canvas

      // enemy bullets — simple red/orange pixel bullet (Raiden arcade)
      state.enemyBullets.forEachActive((b) => {
        ctx.save();
        ctx.translate(b.x, b.y);
        // outer red glow (minimal)
        ctx.shadowColor = COLORS.enemy;
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = COLORS.enemyBullet;
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        // dark outline ring
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = "#8B0000";
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.stroke();
        // light pink core
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = "#FFB6C1";
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
        // bright center dot
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });

      // player bullets with bloom
      state.bullets.forEachActive((b) => {
        // ── Option green laser (no wtype, lightning flag) ──
        if (!b.wingman && b.lightning && !b.wtype) {
          const len = 22;
          ctx.save();
          // outer bloom
          ctx.shadowColor = "#4ade80";
          ctx.shadowBlur = 30;
          ctx.globalAlpha = 0.25;
          const lg = ctx.createRadialGradient(b.x, b.y - len / 2, 0, b.x, b.y - len / 2, 12);
          lg.addColorStop(0, "rgba(255,255,255,0.3)");
          lg.addColorStop(0.3, "rgba(74,222,128,0.3)");
          lg.addColorStop(1, "rgba(74,222,128,0)");
          ctx.fillStyle = lg;
          ctx.fillRect(b.x - 8, b.y - len - 2, 16, len + 4);
          // beam core
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.9;
          const cg = ctx.createLinearGradient(b.x - 3, 0, b.x + 3, 0);
          cg.addColorStop(0, "rgba(255,255,255,0)");
          cg.addColorStop(0.3, "#bbf7d0");
          cg.addColorStop(0.5, "#4ade80");
          cg.addColorStop(0.7, "#bbf7d0");
          cg.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = cg;
          ctx.fillRect(b.x - 3, b.y - len + 1, 6, len - 2);
          // white core
          ctx.fillStyle = "#fff";
          ctx.shadowColor = "#4ade80";
          ctx.shadowBlur = 12;
          ctx.fillRect(b.x - 1, b.y - len + 2, 2, len - 3);
          ctx.beginPath(); ctx.arc(b.x, b.y - len, 3, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
          return;
        }

        if (b.wingman) {
          if (b.lightning) {
            // L3/L4 lightning bullet (cyan electric bolt)
            ctx.save();
            ctx.shadowColor = "#22d3ee";
            ctx.shadowBlur = 18;
            ctx.strokeStyle = "#22d3ee";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            const lx = b.x, ly = b.y;
            const zigzag = Math.sin(f * 0.3 + lx * 0.5) * 3;
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 2 + zigzag, ly - 4);
            ctx.lineTo(lx + 1 - zigzag, ly - 8);
            ctx.lineTo(lx - 3 + zigzag, ly - 12);
            ctx.stroke();
            // inner bright bolt
            ctx.strokeStyle = "#e0f2fe";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx, ly);
            ctx.lineTo(lx - 2 + zigzag, ly - 4);
            ctx.lineTo(lx + 1 - zigzag, ly - 8);
            ctx.lineTo(lx - 3 + zigzag, ly - 12);
            ctx.stroke();
            // glow core
            ctx.shadowBlur = 30;
            ctx.shadowColor = "#67e8f9";
            ctx.fillStyle = "#fff";
            ctx.beginPath(); ctx.arc(lx, ly - 6, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
          } else {
            // wingman normal bullet — amber diamond (distinct from main gun blue)
            ctx.save();
            ctx.shadowColor = "#fbbf24";
            ctx.shadowBlur = 12;
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = "#f59e0b";
            ctx.beginPath();
            ctx.moveTo(b.x, b.y - 5);
            ctx.lineTo(b.x + 4, b.y);
            ctx.lineTo(b.x, b.y + 5);
            ctx.lineTo(b.x - 4, b.y);
            ctx.closePath();
            ctx.fill();
            // inner bright core
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 0.95;
            ctx.fillStyle = "#fef3c7";
            ctx.beginPath();
            ctx.moveTo(b.x, b.y - 2.5);
            ctx.lineTo(b.x + 2, b.y);
            ctx.lineTo(b.x, b.y + 2.5);
            ctx.lineTo(b.x - 2, b.y);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        } else if (b.wtype === "laser") {
          // ── LASER: white+cyan beam, Raiden arcade style ──
          ctx.save();
          const od = stateRef.current.overdriveTimer > 0;
          const w = od ? 7 : 5;
          const len = od ? 22 : 14;
          // outer cyan edge glow (thin)
          ctx.shadowColor = COLORS.playerBullet;
          ctx.shadowBlur = 14;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = COLORS.playerBullet;
          ctx.fillRect(b.x - w/2 - 1, b.y - len, w + 2, len);
          // solid white center beam
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(b.x - w/2 + 1, b.y - len, w - 2, len);
          // sharp pixel tip
          ctx.shadowColor = COLORS.playerBullet;
          ctx.shadowBlur = 8;
          ctx.fillRect(b.x - 1, b.y - len - 1, 2, 3);
          ctx.restore();
        } else if (b.wtype === "wave") {
          // ── WAVE: blue plasma ring, Raiden arcade style ──
          const od = stateRef.current.overdriveTimer > 0;
          const pulseR = od ? 7 + Math.sin(f * 0.2) * 3 : 5 + Math.sin(f * 0.15) * 2;
          ctx.save();
          // Pass 1: outer cyan glow
          ctx.shadowColor = COLORS.playerBullet;
          ctx.shadowBlur = 20;
          ctx.globalAlpha = 0.25;
          const wg3 = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, pulseR + 8);
          wg3.addColorStop(0, "rgba(255,255,255,0.15)");
          wg3.addColorStop(0.5, "rgba(90,217,255,0.1)");
          wg3.addColorStop(1, "rgba(90,217,255,0)");
          ctx.fillStyle = wg3;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR + 8, 0, Math.PI * 2); ctx.fill();
          // Pass 2: cyan edge ring
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.8;
          ctx.strokeStyle = COLORS.playerBullet;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR, 0, Math.PI * 2); ctx.stroke();
          // Pass 3: transparent center with faint inner
          ctx.globalAlpha = 0.25;
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR * 0.5, 0, Math.PI * 2); ctx.stroke();
          // Pass 4: white core dot
          ctx.globalAlpha = 0.9;
          ctx.shadowColor = COLORS.playerBullet;
          ctx.shadowBlur = 6;
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          // ── SPREAD: blue-white oval bullet (Raiden arcade style) ──
          ctx.save();
          const od = stateRef.current.overdriveTimer > 0;
          const r = od ? 5 : 3.5;
          // white solid core (slightly offset upward for motion feel)
          ctx.fillStyle = "#FFFFFF";
          ctx.shadowColor = COLORS.playerBullet;
          ctx.shadowBlur = 10;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y - 1, r * 0.8, r, 0, 0, Math.PI * 2);
          ctx.fill();
          // cyan outline
          ctx.shadowBlur = 0;
          ctx.globalAlpha = 0.7;
          ctx.strokeStyle = COLORS.playerBullet;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y - 1, r * 0.8, r, 0, 0, Math.PI * 2);
          ctx.stroke();
          // tiny afterimage trail
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = COLORS.playerBullet;
          ctx.beginPath();
          ctx.ellipse(b.x, b.y, r * 0.5, r * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      // missiles
      state.missiles.forEachActive((ms) => {
        drawMissileSprite(ctx, ms.x, ms.y);
      });

      // player
      if (stateRef.current.gameStarted && !stateRef.current.isGameOver) {
        const sp = state.player;
        const visible = !state.invincible || f % 5 < 3;
        if (visible) {
          if (state.overdriveTimer > 0) {
            ctx.globalAlpha = 0.08 + Math.sin(f * 0.12) * 0.04;
            const odg = ctx.createRadialGradient(sp.x + 12, sp.y + 12, 0, sp.x + 12, sp.y + 12, 36);
            odg.addColorStop(0, "rgba(251,146,60,0.4)");
            odg.addColorStop(1, "rgba(251,146,60,0)");
            ctx.fillStyle = odg;
            ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 12, 36, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
          }
          const targetTilt = ((sp.x - 180) / 180) * -0.18;
          playerTiltRef.current += (targetTilt - playerTiltRef.current) * 0.12;

          if (state.invincible) drawShield(ctx, sp.x, sp.y);
          drawPlayerShip(ctx, sp.x, sp.y, playerTiltRef.current);



          if (state.overdriveTimer > 0) {
            // engine overcharge glow
            ctx.globalAlpha = 0.4 + Math.sin(f * 0.15) * 0.2;
            const eg = ctx.createRadialGradient(sp.x + 12, sp.y + 24, 0, sp.x + 12, sp.y + 24, 18);
            eg.addColorStop(0, "#f97316");
            eg.addColorStop(1, "rgba(249,115,22,0)");
            ctx.fillStyle = eg;
            ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 24, 18, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // level indicator text floating above ship
            ctx.save();
            ctx.shadowColor = "#fbbf24";
            ctx.shadowBlur = 12;
            ctx.globalAlpha = 0.5 + Math.sin(f * 0.1) * 0.3;
            drawText(ctx, "★ MAX ★", sp.x + 12, sp.y - 6, "#ff6a00", 10, "center", 2);
            ctx.restore();
          }
          ctx.globalAlpha = 0.08;
          const pg = ctx.createRadialGradient(sp.x + 12, sp.y + 12, 0, sp.x + 12, sp.y + 12, 30);
          pg.addColorStop(0, "#38bdf8");
          pg.addColorStop(1, "rgba(56,189,248,0)");
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 12, 30, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }

        // ── level-up glow + text during freeze ──
        if (state.levelUpFreezeTimer > 0) {
          const lpT = state.levelUpFreezeTimer / 48;
          ctx.save();
          // expanding ring
          const ringR = 20 + (1 - lpT) * 60;
          ctx.globalAlpha = Math.min(1, lpT * 2);
          ctx.strokeStyle = COLORS.playerBullet;
          ctx.lineWidth = 3;
          ctx.shadowColor = COLORS.playerBullet;
          ctx.shadowBlur = 20;
          ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 12, ringR, 0, Math.PI * 2); ctx.stroke();
          ctx.shadowBlur = 0;
          // player glow burst
          ctx.globalAlpha = Math.min(0.5, lpT * 1.2);
          const glowGrad = ctx.createRadialGradient(sp.x + 12, sp.y + 12, 5, sp.x + 12, sp.y + 12, 60);
          glowGrad.addColorStop(0, "rgba(90,217,255,0.6)");
          glowGrad.addColorStop(1, "rgba(90,217,255,0)");
          ctx.fillStyle = glowGrad;
          ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 12, 60, 0, Math.PI * 2); ctx.fill();
          // LEVEL UP text
          ctx.globalAlpha = Math.min(1, lpT * 2.5);
          const textY = sp.y - 18 - (1 - lpT) * 30;
          drawText(ctx, "LEVEL UP!", sp.x + 12, textY, COLORS.powerUp, 14, "center", 3);
          ctx.restore();
        }
      }

      // ── Wingman satellites rendering (L1-L4) ──
      if (stateRef.current.gameStarted && !stateRef.current.isGameOver) {
        const wmLvl = stateRef.current.wingmanLevel;
        if (wmLvl > 0) {
          const f = stateRef.current.frameCount;
          const p = stateRef.current.player;
          const baseAngle = stateRef.current.wingmanOrbitAngle;
          const orbR = 38;
          const cx = p.x + 12, cy = p.y + 12;

          if (wmLvl === 1) {
            const sx = p.x - 22, sy = p.y + 18;
            drawWingmanSatellite(ctx, sx, sy, f, "#c084fc", false);
          } else if (wmLvl === 2) {
            drawWingmanSatellite(ctx, p.x - 18, p.y + 18, f, "#c084fc", false);
            drawWingmanSatellite(ctx, p.x + 34, p.y + 18, f, "#c084fc", false);
          } else if (wmLvl === 3) {
            for (let i = 0; i < 4; i++) {
              const ang = baseAngle + (Math.PI / 2) * i;
              const sx = cx + Math.cos(ang) * orbR;
              const sy = cy + Math.sin(ang) * orbR;
              drawWingmanSatellite(ctx, sx, sy, f, "#22d3ee", true);
            }
          } else if (wmLvl >= 4) {
            const sweepBase = 38;
            for (let i = 0; i < 4; i++) {
              const ang = baseAngle + (Math.PI / 2) * i;
              const sweepR = sweepBase + Math.sin(f * 0.06 + i * 1.57) * 20;
              const sx = cx + Math.cos(ang) * sweepR;
              const sy = cy + Math.sin(ang) * sweepR;
              drawWingmanSatellite(ctx, sx, sy, f, "#facc15", true);
            }
          }
        }
      }

      // ── Option / Slash rendering ──
      if (stateRef.current.gameStarted && !stateRef.current.isGameOver) {
        for (const opt of state.options) {
          if (opt.transformProgress > 0.1) {
            drawPurpleWingOption(ctx, opt.x, opt.y, opt.transformProgress);
          }
          if (opt.transformProgress < 0.9) {
            drawGreenOption(ctx, opt.x, opt.y);
          }
        }
        // slash effects
        state.slashEffects.forEachActive((se) => {
          drawSlashEffect(ctx, se);
        });
      }

      // monsters
      state.monsters.forEachActive((m) => drawMonsterShip(ctx, m, m.x, m.y));

      // boss
      if (state.boss) {
        drawBossShip(ctx, state.boss.x, state.boss.y, state.boss.hp, state.boss.maxHp, state.boss.type);
      }
      // miniboss
      if (state.miniboss) {
        drawMinibossShip(ctx, state.miniboss, state.miniboss.x, state.miniboss.y);
      }


      state.powerUps.forEachActive((pu) => {
        const pcx = pu.x + 6, pcy = pu.y + 6;
        const pulse = Math.sin(f * 0.1) * 0.3 + 0.7;
        const isOptionForm = pu.type === "optionForm";
        const isWingman = pu.type === "wingman";
        const col1 = isOptionForm ? "#f97316" : isWingman ? "#a855f7" : "#38bdf8";
        const col2 = isOptionForm ? "#fbbf24" : isWingman ? "#c084fc" : "#7dd3fc";
        ctx.save();
        // outer glow ring (rotating)
        ctx.shadowColor = col1;
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.35 * pulse;
        ctx.strokeStyle = col1; ctx.lineWidth = 2;
        const ringR = 16 + Math.sin(f * 0.08) * 4;
        ctx.beginPath(); ctx.arc(pcx, pcy, ringR, 0, Math.PI * 2); ctx.stroke();
        // rotating arc
        ctx.globalAlpha = 0.5 * pulse;
        ctx.strokeStyle = col2; ctx.lineWidth = 2.5;
        const arcStart = f * 0.05;
        const arcEnd = arcStart + 1.2;
        ctx.beginPath(); ctx.arc(pcx, pcy, ringR + 2, arcStart, arcEnd); ctx.stroke();
        // main gradient sphere
        const pg = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 14);
        pg.addColorStop(0, "rgba(255,255,255,0.95)");
        pg.addColorStop(0.3, isOptionForm ? "rgba(251,191,36,0.9)" : isWingman ? "rgba(192,132,252,0.9)" : "rgba(125,211,252,0.9)");
        pg.addColorStop(0.6, isOptionForm ? "rgba(249,115,22,0.6)" : isWingman ? "rgba(168,85,247,0.6)" : "rgba(56,189,248,0.6)");
        pg.addColorStop(1, isWingman ? "rgba(168,85,247,0)" : "rgba(56,189,248,0)");
        ctx.globalAlpha = 0.9 * pulse;
        ctx.shadowColor = col1;
        ctx.shadowBlur = 25;
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(pcx, pcy, 14, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // bright core
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(pcx, pcy, 3.5 + Math.sin(f * 0.12) * 1, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        // orbiting particles
        for (let i = 0; i < 3; i++) {
          const da = f * 0.06 + (Math.PI * 2 * i) / 3;
          ctx.globalAlpha = (0.5 + Math.sin(f * 0.08 + i) * 0.3) * pulse;
          ctx.fillStyle = i === 0 ? "#fff" : i === 1 ? col2 : col1;
          ctx.beginPath(); ctx.arc(
            pcx + Math.cos(da) * (10 + Math.sin(f * 0.05 + i) * 2),
            pcy + Math.sin(da) * (10 + Math.sin(f * 0.05 + i) * 2),
            1.5 + Math.sin(f * 0.1 + i) * 0.5, 0, Math.PI * 2,
          ); ctx.fill();
        }
        // hint letter
        ctx.globalAlpha = 0.7 * pulse;
        drawText(ctx, isOptionForm ? "S" : isWingman ? "W" : "P", pcx, pcy + 0.5, "#fff", 8, "center", 1.5);
        ctx.restore();
      });

      // ── energy fragments (blue floating diamonds) ──
      state.energyFrags.forEachActive((ef) => {
        const pulse = Math.sin(f * 0.1 + ef.x) * 0.2 + 0.8;
        const floatY = Math.sin(f * 0.08 + ef.x * 0.05) * 2;
        ctx.save();
        ctx.globalAlpha = 0.7 * pulse;
        ctx.translate(ef.x + 5, ef.y + 5 + floatY);
        // diamond shape
        ctx.fillStyle = COLORS.playerBullet;
        ctx.shadowColor = COLORS.playerBullet;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(4, 0);
        ctx.lineTo(0, 5);
        ctx.lineTo(-4, 0);
        ctx.closePath();
        ctx.fill();
        // bright core
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // particles (batch-rendered 2-pass: glow first, then core, to minimize ctx state changes)
      // pass 1: glow (larger particles with shadow)
      ctx.save();
      state.particles.forEachActive((pt) => {
        if (pt.size <= 4) return;
        ctx.globalAlpha = Math.max(0, pt.alpha * 0.4);
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = pt.size > 6 ? 10 : 5;
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.8, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      // pass 2: all particles, no shadow (fast)
      state.particles.forEachActive((pt) => {
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.6, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalAlpha = 1;

      // ── weapon energy bar (bottom-left) ──
      const barX = 6, barY = CH - 20, barW = 100, barH = 6;
      const energyPct = Math.min(1, state.weaponEnergy / state.energyNeeded);
      ctx.globalAlpha = 0.8;
      // border
      ctx.strokeStyle = COLORS.uiBorder;
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barW, barH);
      // fill
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      barGrad.addColorStop(0, COLORS.playerBullet);
      barGrad.addColorStop(1, "#ffffff");
      ctx.fillStyle = barGrad;
      ctx.fillRect(barX + 1, barY + 1, (barW - 2) * energyPct, barH - 2);
      // label
      drawText(ctx, `POW LV${state.weaponLevel}`, barX + 2, barY - 6, COLORS.textDim, 6, "left", 1);
      ctx.globalAlpha = 1;

      // ── magnet mode indicator ──
      if (state.magnetModeTimer > 0) {
        const magPulse = Math.sin(f * 0.08) * 0.3 + 0.7;
        ctx.globalAlpha = 0.6 * magPulse;
        ctx.strokeStyle = COLORS.playerBullet;
        ctx.lineWidth = 1;
        ctx.shadowColor = COLORS.playerBullet;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(state.player.x + 12, state.player.y + 12, 40 + Math.sin(f * 0.06) * 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.9 * magPulse;
        drawText(ctx, "MAGNET", state.player.x + 12, state.player.y - 14, COLORS.playerBullet, 7, "center", 2);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    // Start animation loop regardless of gameStarted — renders empty space
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("touchend", handleTouchEnd);
      if (gachaTimeoutRef.current) { clearTimeout(gachaTimeoutRef.current); gachaTimeoutRef.current = null; }
      if (waveTimeoutRef.current) { clearTimeout(waveTimeoutRef.current); waveTimeoutRef.current = null; }
      if (closeGachaTimeoutRef.current) { clearTimeout(closeGachaTimeoutRef.current); closeGachaTimeoutRef.current = null; }

    };
  }, [gameStarted, isGameOver, audio]);

  // Check boss spawn
  useEffect(() => {
    if (!isGameOver && gameStarted) checkSpawnBoss(score);
  }, [score, isGameOver, gameStarted]);

  // BGM control
  useEffect(() => {
    if (gameRef.current.gameStarted && !gameRef.current.isPaused && !gameRef.current.isGameOver && !gameRef.current.showGacha) {
      audio.startBGM();
    } else {
      audio.stopBGM();
    }
    return () => audio.stopBGM();
  }, [gameStarted, isPaused, isGameOver, showGacha, audio]);

  // save on game over
  useEffect(() => {
    if (isGameOver) {
      const save = saveRef.current;
      const finalScore = scoreRef.current;
      save.totalGames++;
      if (finalScore > save.highScore) save.highScore = finalScore;
      writeSave(save);
      setHighScore(save.highScore);
    }
  }, [isGameOver]);

  const scoreRef = useRef(0);
  scoreRef.current = score;

  const restartGame = () => {
    audio.buttonClick();
    if (gachaTimeoutRef.current) { clearTimeout(gachaTimeoutRef.current); gachaTimeoutRef.current = null; }
    if (waveTimeoutRef.current) { clearTimeout(waveTimeoutRef.current); waveTimeoutRef.current = null; }
    if (closeGachaTimeoutRef.current) { clearTimeout(closeGachaTimeoutRef.current); closeGachaTimeoutRef.current = null; }
    const state = stateRef.current;
    state.monsters.releaseAll();
    state.bullets.releaseAll();
    state.enemyBullets.releaseAll();
    state.particles.releaseAll();
    state.missiles.releaseAll();
    state.powerUps.releaseAll();
    state.energyFrags.releaseAll();
    state.weaponEnergy = 0;
    state.energyNeeded = 100;
    state.comboKills = 0;
    state.magnetModeTimer = 0;
    state.levelUpFreezeTimer = 0;
    state.boss = null;
    state.miniboss = null;
    state.player = { x: 180, y: 460, vx: 0, vy: 0, speed: 5 };
    state.invincible = false; state.invincibleTimer = 0;
    state.respawnTimer = 0;
    state.shakeX = 0; state.shakeY = 0;
    state.score = 0;
    state.hasHoming = false;
    state.formationTimer = 0; state.gachaLocked = false;
    state.gachaCost = 10; state.formationGroupCounter = 0;
    state.overdriveTimer = 0; state.lastWaveSpawned = -1;
    state.bossCooldown = 0; state.minibossCooldown = 0; state.wingmanLevel = 0; state.wingmanOrbitAngle = 0; state.bossWarningTimer = 0; state.preGameCountdown = 0;
    state.optionForm = "greenLaser";
    state.options[0].x = 156; state.options[0].y = 478; state.options[0].targetX = 156; state.options[0].targetY = 478;
    state.options[0].form = "greenLaser"; state.options[0].transformProgress = 0; state.options[0].slashCooldown = 0;
    state.options[1].x = 204; state.options[1].y = 478; state.options[1].targetX = 204; state.options[1].targetY = 478;
    state.options[1].form = "greenLaser"; state.options[1].transformProgress = 0; state.options[1].slashCooldown = 0;
    state.slashEffects.releaseAll();
    bgOffsetRef.current = 0;
    exhaustPool.current.releaseAll();
    setIsPaused(false); setShowGacha(false);
    setScore(0); setWeaponLevel(1);
    setBombCount(3); setLives(3); setIsGameOver(false);
    setInvincible(false); setBossHp(0);
    setHasHoming(false);
    setGachaCost(10); setOverdriveTimer(0); setWaveAnnounce("");
    setWingmanLevel(0); setBossWarning(false); setGameStarted(false); setStartFadeOut(false);
    setReadyCountdown(0); setRespawnTimer(0);
    state.isPaused = false; state.isGameOver = false; state.gameStarted = false;
  };

  const formatScore = (n: number) => n.toString().padStart(6, "0");

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');

        .pixel-font {
          font-family: "Press Start 2P", "Courier New", monospace !important;
          font-smooth: never;
          -webkit-font-smoothing: none;
          -moz-osx-font-smoothing: unset;
        }
        .pixel-hud {
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          border: 1px solid rgba(56, 189, 248, 0.3);
          border-radius: 0;
        }
        .pixel-glow-sr {
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.6), 0 0 20px rgba(168, 85, 247, 0.3);
        }
        .pixel-glow-ssr {
          box-shadow: 0 0 8px rgba(250, 204, 21, 0.6), 0 0 20px rgba(250, 204, 21, 0.3);
        }
        .pixel-glow-cyan {
          box-shadow: 0 0 6px rgba(56, 189, 248, 0.5), 0 0 14px rgba(56, 189, 248, 0.2);
        }
        .pixel-border {
          border: 1px solid rgba(56, 189, 248, 0.2);
          border-radius: 0;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-blink {
          animation: blink 1.2s steps(1) infinite;
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .float-on-hover:hover {
          animation: float-up 1.5s ease-in-out infinite;
        }
        @keyframes gradient-shift {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
        @keyframes bullet-spread-up {
          0% { transform: translateY(20px); opacity: 0; }
          20% { opacity: 1; }
          80% { opacity: 0.6; }
          100% { transform: translateY(-20px); opacity: 0; }
        }
        @keyframes bullet-laser-up {
          0% { transform: translateY(25px); opacity: 0; }
          30% { opacity: 1; }
          70% { opacity: 0.8; }
          100% { transform: translateY(-25px); opacity: 0; }
        }
        @keyframes bullet-wave-up {
          0% { transform: translateY(20px) scale(0.5); opacity: 0; }
          25% { opacity: 0.9; }
          75% { opacity: 0.5; }
          100% { transform: translateY(-25px) scale(1.3); opacity: 0; }
        }
        @keyframes gacha-fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes gacha-bg-in {
          0% { background: rgba(0,0,0,0); }
          100% { background: rgba(0,0,0,0.85); }
        }
        @keyframes gacha-slide-down {
          0% { opacity: 0; transform: translateY(-12px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes gacha-card-pop {
          0% { opacity: 0; transform: scale(0.6) translateY(16px); }
          70% { transform: scale(1.06) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes gacha-fade-out {
          0% { opacity: 1; }
          100% { opacity: 0; transform: translateY(6px); }
        }
        @keyframes bomb-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.4), 0 0 20px rgba(234,88,12,0.25), inset 0 0 10px rgba(251,146,60,0.15); }
          50% { box-shadow: 0 0 14px rgba(249,115,22,0.7), 0 0 32px rgba(234,88,12,0.45), inset 0 0 16px rgba(251,146,60,0.3); }
        }
        @keyframes bomb-flicker {
          0%, 100% { filter: drop-shadow(0 0 4px rgba(251,146,60,0.8)); }
          50% { filter: drop-shadow(0 0 8px rgba(251,146,60,1)) drop-shadow(0 0 2px rgba(255,237,160,0.6)); }
        }
      `}</style>

      <main className="min-h-screen bg-[#020617]" style={{ fontFamily: PIXEL_FONT }}>
        <div className="max-w-[400px] mx-auto px-3 py-4">

          {/* Minimal back button — pixel style */}
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/discover"
              className="pixel-font text-[10px] hover:text-[#7dd3fc] transition-colors tracking-wider"
              style={{ color: COLORS.player }}
            >
              &lt; RET
            </Link>
            {(gameStarted || startFadeOut) && (
              <div
                className="pixel-font text-[12px] text-[#475569] tracking-wider"
                style={{ textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}
              >
                {formatScore(score)}
              </div>
            )}
          </div>

          {/* Game canvas container */}
          <div ref={containerRef} className="relative" style={{ imageRendering: "pixelated" }}>
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className="block touch-none cursor-crosshair w-full"
              style={{ imageRendering: "pixelated" }}
            />

            {/* ═══ START SCREEN ═══ */}
            {!gameStarted && (
              <div
                className={`absolute inset-0 flex flex-col z-20 transition-opacity duration-500 ${startFadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStart(); } }}
                tabIndex={0}
                style={{ background: "rgba(6,10,24,0.65)" }}
              >
                {/* Neon title: THUNDER FIGHTER */}
                <div className="text-center px-4 pt-5 flex-shrink-0">
                  <h1
                    className="pixel-font leading-tight"
                    style={{
                      fontFamily: PIXEL_FONT,
                      fontSize: "20px",
                      letterSpacing: "6px",
                      background: "linear-gradient(90deg, #5AD9FF, #FFFFFF, #5AD9FF)",
                      backgroundSize: "200% auto",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      filter: "drop-shadow(0 0 10px rgba(90,217,255,0.6)) drop-shadow(0 0 20px rgba(90,217,255,0.3))",
                      animation: "gradient-shift 3s linear infinite",
                    }}
                  >
                    THUNDER
                  </h1>
                  <h1
                    className="pixel-font leading-tight -mt-0.5"
                    style={{
                      fontFamily: PIXEL_FONT,
                      fontSize: "15px",
                      letterSpacing: "12px",
                      background: "linear-gradient(90deg, #FFFFFF, #5AD9FF, #FFFFFF)",
                      backgroundSize: "200% auto",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      filter: "drop-shadow(0 0 10px rgba(90,217,255,0.6)) drop-shadow(0 0 20px rgba(90,217,255,0.3))",
                      animation: "gradient-shift 3s linear infinite",
                    }}
                  >
                    FIGHTER
                  </h1>
                </div>

                {/* ─── Ship Selector ─── */}
                {(() => {
                  const shipIdx = SHIP_TYPES.indexOf(shipType);
                  const ship = SHIP_CONFIG[shipType];
                  return (
                    <div className="flex items-center justify-center gap-2 mt-4 flex-shrink-0">
                      {/* Left arrow */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const prev = SHIP_TYPES[(shipIdx - 1 + SHIP_TYPES.length) % SHIP_TYPES.length];
                          setShipType(prev);
                          audio.buttonClick?.();
                        }}
                        className="pixel-font text-white/60 hover:text-white transition-colors px-1 py-3 active:scale-90"
                        style={{ textShadow: "0 0 6px rgba(56,189,248,0.5)" }}
                      >
                        &#9664;
                      </button>

                      {/* Ship card */}
                      <div
                        className="flex flex-col items-center gap-1 px-4 py-3 rounded-none transition-all"
                        style={{
                          minWidth: "140px",
                          border: "1px solid rgba(56,189,248,0.3)",
                          background: "rgba(0,0,0,0.4)",
                          boxShadow: "0 0 12px rgba(56,189,248,0.15), inset 0 0 12px rgba(56,189,248,0.05)",
                        }}
                      >
                        <span className="text-3xl" style={{ filter: "drop-shadow(0 0 8px rgba(56,189,248,0.5))" }}>
                          {ship.icon}
                        </span>
                        <span
                          className="pixel-font text-[12px] tracking-wider"
                          style={{ color: COLORS.player, textShadow: `0 0 8px ${COLORS.player}50` }}
                        >
                          {ship.label}
                        </span>
                        <span
                          className="pixel-font text-[7px] tracking-[1px]"
                          style={{ color: "rgba(148,163,184,0.6)" }}
                        >
                          {ship.desc}
                        </span>
                        <span
                          className="pixel-font text-[7px] tracking-[1px] mt-1"
                          style={{ color: "rgba(56,189,248,0.5)" }}
                        >
                          {WEAPON_ICONS[ship.weapon]} {WEAPON_NAMES[ship.weapon]}
                        </span>
                      </div>

                      {/* Right arrow */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = SHIP_TYPES[(shipIdx + 1) % SHIP_TYPES.length];
                          setShipType(next);
                          audio.buttonClick?.();
                        }}
                        className="pixel-font text-white/60 hover:text-white transition-colors px-1 py-3 active:scale-90"
                        style={{ textShadow: "0 0 6px rgba(56,189,248,0.5)" }}
                      >
                        &#9654;
                      </button>
                    </div>
                  );
                })()}

                {/* ─── Bullet Preview ─── */}
                <div className="flex justify-center gap-4 mt-3 flex-shrink-0">
                  <div className="flex flex-col items-center gap-1">
                    <p className="pixel-font text-[6px] tracking-[2px]" style={{ color: "rgba(148,163,184,0.5)" }}>
                      主机
                    </p>
                    <div
                      className="relative overflow-hidden"
                      style={{
                        width: "120px",
                        height: "60px",
                        border: "1px solid rgba(56,189,248,0.15)",
                        background: "rgba(0,0,0,0.5)",
                      }}
                    >
                      {/* Bullet animation based on weapon type — colors match in-game */}
                      {SHIP_CONFIG[shipType].weapon === "spread" && (
                        <div className="absolute inset-0 flex items-center justify-center gap-3">
                          {[0, 1, 2].map((i) => (
                            <div
                              key={i}
                              className="rounded-full"
                              style={{
                                width: "10px",
                                height: "10px",
                                background: "radial-gradient(circle at 40% 40%, #fff, #5AD9FF, #0e7490)",
                                boxShadow: "0 0 8px rgba(90,217,255,0.7), 0 0 16px rgba(90,217,255,0.3)",
                                animation: `bullet-spread-up ${1.2 + i * 0.15}s ease-in infinite`,
                                animationDelay: `${i * 0.2}s`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {SHIP_CONFIG[shipType].weapon === "laser" && (
                        <div className="absolute inset-0 flex items-center justify-center gap-2">
                          {[0, 1].map((i) => (
                            <div
                              key={i}
                              style={{
                                width: "5px",
                                height: "26px",
                                background: "linear-gradient(to top, transparent, #5AD9FF, #fff, #5AD9FF)",
                                boxShadow: "0 0 10px rgba(90,217,255,0.6), 0 0 20px rgba(90,217,255,0.2)",
                                animation: `bullet-laser-up ${1.5}s ease-in infinite`,
                                animationDelay: `${i * 0.3}s`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                      {SHIP_CONFIG[shipType].weapon === "wave" && (
                        <div className="absolute inset-0 flex items-center justify-center gap-4">
                          {[0, 1].map((i) => (
                            <div
                              key={i}
                              className="rounded-full flex items-center justify-center"
                              style={{
                                width: "16px",
                                height: "16px",
                                border: "2px solid rgba(90,217,255,0.7)",
                                boxShadow: "0 0 8px rgba(90,217,255,0.4), 0 0 16px rgba(90,217,255,0.2), inset 0 0 4px rgba(255,255,255,0.2)",
                                animation: `bullet-wave-up ${1.8}s ease-in infinite`,
                                animationDelay: `${i * 0.4}s`,
                              }}
                            >
                              <div
                                className="rounded-full"
                                style={{
                                  width: "4px",
                                  height: "4px",
                                  background: "#fff",
                                  boxShadow: "0 0 4px rgba(90,217,255,0.6)",
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <p className="pixel-font text-[6px] tracking-[2px]" style={{ color: "rgba(148,163,184,0.5)" }}>
                      僚机
                    </p>
                    <div
                      className="relative overflow-hidden"
                      style={{
                        width: "60px",
                        height: "60px",
                        border: "1px solid rgba(251,191,36,0.15)",
                        background: "rgba(0,0,0,0.5)",
                      }}
                    >
                      {/* Wingman bullet — amber diamond */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div
                          style={{
                            width: 0,
                            height: 0,
                            borderLeft: "5px solid transparent",
                            borderRight: "5px solid transparent",
                            borderBottom: "9px solid #f59e0b",
                            filter: "drop-shadow(0 0 4px rgba(251,191,36,0.7))",
                            animation: "bullet-spread-up 1.2s ease-in infinite",
                            transform: "rotate(180deg)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1" />

                {/* Bottom section */}
                <div className="flex flex-col items-center pb-5 gap-2 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center">
                      <p className="pixel-font text-[7px] tracking-[2px]" style={{ color: COLORS.textDim }}>HIGH SCORE</p>
                      <p className="pixel-font text-[11px]" style={{ color: COLORS.powerUp, textShadow: `0 0 8px ${COLORS.powerUp}60` }}>{formatScore(highScore)}</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); handleStart(); }}
                    className="float-on-hover px-8 py-2.5 transition-all active:scale-95"
                    style={{
                      background: "transparent",
                      border: `1px solid ${COLORS.uiBorder}`,
                      boxShadow: `0 0 8px ${COLORS.player}30, 0 0 20px ${COLORS.player}15, inset 0 0 8px ${COLORS.player}10`,
                    }}
                  >
                    <span className="pixel-font text-[12px] tracking-[6px]" style={{ color: COLORS.player, textShadow: `0 0 8px ${COLORS.player}60` }}>START GAME</span>
                  </button>

                  <p className="pixel-font text-[6px] tracking-[2px]" style={{ color: "rgba(71,85,105,0.5)", textShadow: "0 0 4px rgba(71,85,105,0.2)" }}>WASD/ARROWS · SPACE BOMB · ESC PAUSE</p>
                </div>
              </div>
            )}

              {/* ═══ IN-GAME HUD ═══ */}
            {(gameStarted || startFadeOut) && (
              <>
                {/* Top gradient mask */}
                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none z-0"
                  style={{
                    height: "48px",
                    background: "linear-gradient(to bottom, rgba(6,10,24,0.85) 0%, rgba(6,10,24,0.3) 60%, transparent 100%)",
                  }}
                />

                {/* Arcade-style HUD: SCORE top center */}
                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 flex flex-col items-center" style={{ zIndex: 1 }}>
                  <p className="pixel-font text-[6px] tracking-[3px]" style={{ color: COLORS.textDim }}>SCORE</p>
                  <p className="pixel-font text-[14px] leading-tight" style={{ color: COLORS.explosion, textShadow: `0 0 10px ${COLORS.explosion}60` }}>
                    {formatScore(score)}
                  </p>
                </div>

                {/* Top-left: LIFE */}
                <div className="absolute top-1.5 left-1.5 flex flex-col" style={{ zIndex: 1 }}>
                  <p className="pixel-font text-[5px] tracking-[2px]" style={{ color: COLORS.textDim }}>LIFE</p>
                  <p className="pixel-font text-[12px] leading-tight" style={{ color: COLORS.player, textShadow: `0 0 6px ${COLORS.player}60` }}>
                    {Array.from({ length: Math.max(1, lives) }).map((_, i) => (
                      <span key={i} className={i === lives - 1 && respawnTimer > 0 ? "animate-blink" : ""} style={{ marginRight: "2px" }}>&#9829;</span>
                    ))}
                    {lives <= 0 && <span style={{ color: COLORS.warning }}>x</span>}
                  </p>
                </div>

                {/* Top-right: BOMB + POW + WINGMAN */}
                <div className="absolute top-1.5 right-1.5 flex items-start gap-2" style={{ zIndex: 1 }}>
                  <div className="flex flex-col items-end">
                    <p className="pixel-font text-[5px] tracking-[2px]" style={{ color: COLORS.textDim }}>BOMB</p>
                    <p className="pixel-font text-[10px] leading-tight" style={{ color: COLORS.missile, textShadow: `0 0 6px ${COLORS.missile}60` }}>
                      {"B".repeat(Math.max(0, bombCount))}
                      {bombCount <= 0 && <span style={{ color: COLORS.textDim }}>-</span>}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="pixel-font text-[5px] tracking-[2px]" style={{ color: COLORS.textDim }}>POW</p>
                    <p className="pixel-font text-[10px] leading-tight" style={{ color: overdriveTimer > 0 ? "#f97316" : COLORS.playerBullet, textShadow: `0 0 6px ${COLORS.playerBullet}60` }}>
                      {overdriveTimer > 0 ? "MAX" : "Lv" + Math.min(stateRef.current.weaponLevel, 4)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <p className="pixel-font text-[5px] tracking-[2px]" style={{ color: COLORS.textDim }}>WING</p>
                    <p className="pixel-font text-[9px] leading-tight" style={{ color: wingmanLevel > 0 ? (wingmanLevel >= 4 ? "#facc15" : wingmanLevel >= 3 ? "#22d3ee" : "#c084fc") : COLORS.textDim, textShadow: `0 0 4px ${wingmanLevel >= 4 ? "#facc15" : wingmanLevel >= 3 ? "#22d3ee" : "#c084fc"}40` }}>
                      {wingmanLevel > 0 ? (wingmanLevel === 1 ? "●" : wingmanLevel === 2 ? "●●" : wingmanLevel === 3 ? "●●●●" : "觉醒") : "-"}
                    </p>
                  </div>
                </div>

                {/* Pause button — minimal pixel */}
                <button
                  onClick={togglePause}
                  className="absolute top-[38px] right-1.5 flex items-center justify-center"
                  style={{ zIndex: 1, width: "20px", height: "14px", border: `1px solid ${COLORS.uiBorder}`, background: COLORS.uiBg }}
                >
                  <span className="pixel-font text-[7px]" style={{ color: COLORS.textDim }}>II</span>
                </button>

                {/* Invincible indicator */}
                <div className="absolute top-[38px] left-1.5 flex items-center gap-1" style={{ zIndex: 1 }}>
                  {invincible && <p className="pixel-font text-[6px] leading-tight animate-blink" style={{ color: COLORS.player }}>S</p>}
                </div>

                {/* Weapon type indicator */}
                <div className="absolute top-[38px] left-1/2 -translate-x-1/2" style={{ zIndex: 1 }}>
                  <p className="pixel-font text-[6px] tracking-[2px]" style={{ color: COLORS.textDim }}>{WEAPON_NAMES[weaponType]}</p>
                </div>

                {/* Boss HP bar */}
                {stateRef.current.boss && bossHp > 0 && (
                  <div className="absolute top-[36px] left-1/2 -translate-x-1/2 flex items-center gap-1.5" style={{ zIndex: 2, background: COLORS.uiBg, border: `1px solid ${COLORS.boss}40`, padding: "1px 6px" }}>
                    <p className="pixel-font text-[6px]" style={{ color: COLORS.boss }}>&#9829;</p>
                    <div className="w-16 h-1.5 bg-black/80 overflow-hidden" style={{ borderRadius: 0 }}>
                      <div
                        className="h-full transition-all duration-200"
                        style={{ width: `${(bossHp / 50) * 100}%`, background: COLORS.explosion }}
                      />
                    </div>
                  </div>
                )}

                {/* Bomb button — pixel arcade style */}
                <button
                  onClick={triggerBomb}
                  disabled={bombCount <= 0 || isGameOver || isPaused}
                  className="absolute bottom-14 right-1.5 flex items-center gap-1 transition-all active:scale-95"
                  style={{
                    zIndex: 1,
                    padding: "3px 8px",
                    border: bombCount > 0 ? `1px solid ${COLORS.missile}80` : `1px solid rgba(100,100,100,0.3)`,
                    background: bombCount > 0 ? "rgba(194,65,12,0.6)" : "rgba(30,30,30,0.5)",
                    boxShadow: bombCount > 0 ? "0 0 6px rgba(255,216,61,0.3)" : "none",
                    borderRadius: 0,
                    opacity: bombCount <= 0 || isGameOver || isPaused ? 0.3 : 1,
                  }}
                >
                  <span
                    className="pixel-font text-[9px]"
                    style={{
                      color: bombCount > 0 ? COLORS.missile : "#666",
                      textShadow: bombCount > 0 ? `0 0 6px ${COLORS.missile}60` : "none",
                    }}
                  >
                    B{bombCount}
                  </span>
                </button>

                {/* Bottom-left: WAVE */}
                <div className="absolute bottom-1.5 left-1.5" style={{ zIndex: 1 }}>
                  <p className="pixel-font text-[6px]" style={{ color: COLORS.textDim }}>
                    WAVE {Math.max(0, stateRef.current.lastWaveSpawned + 1)}
                  </p>
                </div>
              </>
            )}

            {/* READY Countdown overlay */}
            {(startFadeOut && !gameStarted) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10" style={{ background: "rgba(6,10,24,0.55)" }}>
                <p
                  className="text-[48px] font-black tracking-[8px]"
                  style={{
                    fontFamily: PIXEL_FONT,
                    color: readyCountdown > 0 ? COLORS.player : COLORS.powerUp,
                    textShadow: `-3px -3px 0 #000, 3px -3px 0 #000, -3px 3px 0 #000, 3px 3px 0 #000, 0 0 24px ${readyCountdown > 0 ? COLORS.player : COLORS.powerUp}`,
                    animation: "gacha-card-pop 0.3s ease-out",
                  }}
                >
                  {readyCountdown > 0 ? String(readyCountdown) : "GO!"}
                </p>
              </div>
            )}

            {/* Boss Warning overlay */}
            {bossWarning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
                {/* Red flashing background */}
                <div
                  className="absolute inset-0 transition-opacity"
                  style={{
                    background: `radial-gradient(ellipse at center, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.1) 40%, transparent 70%)`,
                    opacity: stateRef.current.bossWarningTimer % 20 < 10 ? 1 : 0.3,
                    transition: "opacity 0.15s",
                  }}
                />
                {/* WARNING text */}
                <div
                  className="relative z-10"
                  style={{
                    opacity: stateRef.current.bossWarningTimer % 30 < 15 ? 1 : 0.2,
                    transition: "opacity 0.15s",
                  }}
                >
                  <p
                    className="text-[28px] font-black text-red-500 tracking-[6px]"
                    style={{
                      fontFamily: PIXEL_FONT,
                      textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)",
                    }}
                  >
                    WARNING
                  </p>
                  <p
                    className="text-[16px] font-black text-yellow-400 tracking-[2px] mt-1 text-center"
                    style={{
                      fontFamily: PIXEL_FONT,
                      textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0 0 10px rgba(250,204,21,0.5)",
                    }}
                  >
                    BOSS APPROACHING
                  </p>
                </div>
              </div>
            )}

            {/* Wave announcement */}
            {waveAnnounce && !bossWarning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="bg-black/80 pixel-border px-6 py-3 animate-blink">
                  <p
                    className="text-lg font-black text-yellow-400 tracking-[4px]"
                    style={{ fontFamily: PIXEL_FONT }}
                  >
                    {waveAnnounce}
                  </p>
                </div>
              </div>
            )}

            {/* Pause overlay */}
            {isPaused && !showGacha && gameStarted && (
              <div
                className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center cursor-pointer z-10"
                onClick={togglePause}
              >
                <p className="pixel-font text-[20px] text-[#38bdf8] tracking-[4px] mb-3" style={{ textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000" }}>PAUSED</p>
                <p className="pixel-font text-[9px] text-[#64748b]">PRESS ESC OR TAP</p>
              </div>
            )}

            {/* Game over */}
              {isGameOver && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-6 z-10">
                <p className="pixel-font text-[16px] text-red-500 tracking-[3px] mb-3" style={{ textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000" }}>GAME OVER</p>
                <div className="pixel-hud px-4 py-2 mb-2">
                  <p className="pixel-font text-[7px] mb-1" style={{ color: COLORS.textDim }}>SCORE</p>
                  <p className="pixel-font text-[12px]" style={{ color: COLORS.powerUp, textShadow: "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000" }}>{formatScore(score)}</p>
                </div>
                <div className="pixel-hud px-3 py-1 mb-5">
                  <p className="pixel-font text-[6px]" style={{ color: COLORS.textDim }}>BEST {formatScore(highScore)}</p>
                </div>
                <button
                  onClick={restartGame}
                  className="pixel-hud px-4 py-2 bg-[rgba(90,217,255,0.15)] hover:bg-[rgba(90,217,255,0.25)] active:scale-95 transition-all"
                >
                  <span className="pixel-font text-[8px] tracking-[2px]" style={{ color: COLORS.player }}>CONTINUE</span>
                </button>
              </div>
            )}

            {/* ═══ GACHA OVERLAY ═══ */}
            {showGacha && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center p-4 z-20"
                style={{
                  background: "rgba(0,0,0,0.85)",
                  animation: gachaClosing ? "gacha-fade-out 0.2s ease-in forwards" : "gacha-fade-in 0.25s ease-out, gacha-bg-in 0.3s ease-out",
                }}
              >
                <div className="pixel-hud px-4 py-2 mb-4" style={{ animation: "gacha-slide-down 0.35s ease-out 0.1s both" }}>
                  <p className="pixel-font text-[10px] text-[#facc15] tracking-[4px]">DRAW CARD</p>
                </div>
                <p className="pixel-font text-[6px] text-[#64748b] mb-4" style={{ animation: "gacha-slide-down 0.35s ease-out 0.15s both" }}>CHOOSE YOUR BOOST</p>
                <div className="flex gap-3 max-w-full mb-4">
                  {gachaCards.map((card, i) => (
                    <button
                      key={i}
                      onClick={() => applyCardEffect(card)}
                      className={`group relative flex flex-col items-center gap-1.5 p-3 w-24 transition-all hover:scale-105 active:scale-95 ${
                        card.rarity === "SSR"
                          ? "pixel-glow-ssr bg-[rgba(250,204,21,0.05)]"
                          : "pixel-glow-sr bg-[rgba(168,85,247,0.05)]"
                      }`}
                      style={{
                        backgroundImage: [
                          "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
                          "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                        ].join(","),
                        backgroundSize: "8px 8px",
                        border: card.rarity === "SSR"
                          ? '1px solid rgba(250,204,21,0.3)'
                          : '1px solid rgba(168,85,247,0.3)',
                        borderRadius: 0,
                        animation: `gacha-card-pop 0.4s ease-out ${0.2 + i * 0.08}s both`,
                      }}
                    >
                      <span className={`text-2xl ${card.rarity === "SSR" ? "group-hover:scale-110 transition-transform" : ""}`}>
                        {card.icon}
                      </span>
                      <span className="pixel-font text-[7px] text-white leading-tight text-center">
                        {card.name}
                      </span>
                      <span
                        className={`pixel-font text-[6px] px-1 py-0.5 ${
                          card.rarity === "SSR"
                            ? "text-yellow-400 bg-[rgba(250,204,21,0.15)]"
                            : "text-purple-400 bg-[rgba(168,85,247,0.15)]"
                        }`}
                      >
                        {card.rarity}
                      </span>
                      <span className="pixel-font text-[5px] text-[#475569] text-center leading-[7px]">
                        {card.desc}
                      </span>
                    </button>
                  ))}
                </div>
                {/* Reroll */}
                <button
                  onClick={() => {
                    const cards = generateGachaOptions();
                    setGachaCards(cards);
                  }}
                  className="pixel-hud px-3 py-1.5 transition-all active:scale-90 flex items-center gap-1 hover:bg-[rgba(56,189,248,0.15)]"
                  style={{ animation: "gacha-slide-down 0.35s ease-out 0.35s both" }}
                >
                  <span className="pixel-font text-[6px] text-[#38bdf8] tracking-[1px]">刷新</span>
                </button>
              </div>
            )}



          </div>

          {/* Controls help */}
          {gameStarted && !isGameOver && (
            <p className="pixel-font text-[6px] text-[#334155] text-center mt-3 tracking-[1px]">
              WASD/ARROWS MOVE · SPACE BOMB · ESC PAUSE
            </p>
          )}
        </div>
      </main>
    </>
  );
}
