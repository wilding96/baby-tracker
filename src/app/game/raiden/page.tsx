"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Bomb,
  Heart,
  Coins,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useGameAudio } from "@/hooks/useGameAudio";

// ═══════════════════════════════════════════════════════════════════
// PIXEL FONT
// ═══════════════════════════════════════════════════════════════════

const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';

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
  map.forEach((row, py) => {
    for (let px = 0; px < row.length; px++) {
      const ch = row[px];
      if (ch !== ".") {
        ctx.fillStyle = colors[ch] ?? "#fff";
        ctx.fillRect(x + px * s, y + py * s, s, s);
      }
    }
  });
}

const P = 4;

const PLAYER = [
  "..x.x..",
  ".xxxxx.",
  "xxxxxxx",
  "xaaaaax",
  "xaaaaax",
  ".xxxxx.",
  "..xxx..",
];
const PLAYER_WING = ["x.", "xx"];
const WINGMAN_DOT = ["x."];
const FIGHTER = ["..xx..", ".xxxx.", "xxxxxx", "..xx..", "..xx.."];
const BOMBER = [".xxxxx.", "xxxxxxx", "xaaaaax", "xxxxxxx", ".xxxxx."];
const INTERCEPTOR = [
  "..xxx..",
  ".xxxxx.",
  "xxxxxxx",
  "xxx.xxx",
  "..x.x..",
  "..x.x..",
];
const ELITE_SPRITE = [
  "..xxxxx..",
  ".xxxxxxx.",
  "xxxxxxxxx",
  "xxaa.aaax",
  "xxxxxxxxx",
  ".xxxxxxx.",
  "..xaaax..",
  "..x.x.x..",
];
const MINIBOSS_SPRITE = [
  "...xxxxx...",
  "..xxxxxxx..",
  ".xxxxxxxxx.",
  "xxxxxxxxxxx",
  "xxx.xxx.xxx",
  "xxx.xxx.xxx",
  "xxxxxxxxxxx",
  ".xxxxxxxxx.",
  "..xxxxxxx..",
  "...xxxxx...",
];

const BOSS_TYPES = ["fortress", "carrier", "eye"] as const;
type BossType = (typeof BOSS_TYPES)[number];

const BOSS_FORTRESS = [
  "..xxxxxxxxxx..",
  ".xxxxxxxxxxxx.",
  "xxxxxxxxxxxxxx",
  "xxxaaaxxaaaxxx",
  "xxxaaaxxaaaxxx",
  "xxxxxxxxxxxxxx",
  "xxxxxxxxxxxxxx",
  ".xxxxxxxxxxxx.",
  "..xxxxxxxxxx..",
];
const BOSS_CARRIER = [
  "...xxxxxx...",
  "..xxxxxxxx..",
  ".xxxxxxxxxx.",
  "xxxxxxxxxxxx",
  "xxaaaaaaaaxx",
  "xxaaaaaaaaxx",
  "xxxxxxxxxxxx",
  "x.xxxxxxxx.x",
  ".x.xxxxxx.x.",
];
const BOSS_EYE_SPRITE = [
  "..xxxxxxxx..",
  ".xxxxxxxxxx.",
  "xxxxxxxxxxxx",
  "xxxxaaaaaxxxx",
  "xxxxaaaaaxxxx",
  "xxxxx..xxxxx",
  "xxxxxxxxxxxx",
  ".xxxxxxxxxx.",
  "..xxxxxxxx..",
];
const BOSS_EYE_CORE = ["xxxx", "xxxx"];

const COIN_SPRITE = [".xx.", "xxxx", "x..x", ".xx."];

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
// ═══════════════════════════════════════════════════════════════════
// SHOP ITEMS
// ═══════════════════════════════════════════════════════════════════

interface ShopItemDef {
  id: keyof SaveData["upgrades"];
  icon: string;
  name: string;
  desc: string;
  price: number;
  owned: (upgrades: SaveData["upgrades"]) => boolean;
}
const SHOP_ITEMS: ShopItemDef[] = [
  { id: "extraBomb", icon: "💣", name: "初始炸弹+1", desc: "开局多一枚炸弹", price: 5, owned: (u) => u.extraBomb > 0 },
  { id: "weaponBoost", icon: "⚡", name: "初始火力+1", desc: "开局Lv2武器", price: 8, owned: (u) => u.weaponBoost },
  { id: "startShield", icon: "🛡️", name: "开局护盾", desc: "开局3秒无敌", price: 6, owned: (u) => u.startShield },
  { id: "startWingman", icon: "✈️", name: "僚机开局", desc: "开局携带僚机", price: 12, owned: (u) => u.startWingman },
  { id: "permaDouble", icon: "🪙", name: "双倍金币卡", desc: "本局金币翻倍", price: 10, owned: (u) => u.permaDouble },
];

const SR_CARDS: CardDef[] = [
  { id: "power_up", name: "火力升级", icon: "⚡", rarity: "SR", desc: "武器等级 +1" },
  { id: "bomb_give", name: "炸弹补给", icon: "💣", rarity: "SR", desc: "炸弹 +1" },
  { id: "life_give", name: "生命之心", icon: "❤️", rarity: "SR", desc: "生命 +1" },
  { id: "shield_s", name: "护盾", icon: "🛡️", rarity: "SR", desc: "3 秒无敌" },
  { id: "double_coin", name: "双倍金币", icon: "🪙", rarity: "SR", desc: "30s 金币翻倍" },
  { id: "wingman", name: "僚机", icon: "✈️", rarity: "SR", desc: "召唤僚机协助射击" },
];
const SSR_CARDS: CardDef[] = [
  { id: "shield_l", name: "能量护盾", icon: "🔮", rarity: "SSR", desc: "5 秒无敌" },
  { id: "fire_storm", name: "火力风暴", icon: "🔥", rarity: "SSR", desc: "MAX 火力5秒" },
  { id: "life_pack", name: "生命补给", icon: "💖", rarity: "SSR", desc: "额外 +2 命" },
  { id: "nuke", name: "核弹", icon: "☢️", rarity: "SSR", desc: "全屏清怪 +2 炸弹" },
  { id: "coin_burst", name: "金币爆裂", icon: "💰", rarity: "SSR", desc: "获得 15 金币" },
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
}
interface PowerUp {
  x: number; y: number; alive: boolean;
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
  dropCoins: number; // how many coins to drop on death
}
interface CoinItem {
  x: number; y: number; value: number; alive: boolean;
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
  totalCoins: number;
  highScore: number;
  totalGames: number;
  upgrades: {
    extraBomb: number;
    weaponBoost: boolean;
    startShield: boolean;
    startWingman: boolean;
    permaDouble: boolean;
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
        parsed.upgrades = { extraBomb: 0, weaponBoost: false, startShield: false, startWingman: false, permaDouble: false };
      }
      return parsed;
    }
  } catch {}
  return { totalCoins: 0, highScore: 0, totalGames: 0, upgrades: { extraBomb: 0, weaponBoost: false, startShield: false, startWingman: false, permaDouble: false } };
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

  constructor(factory: () => T) {
    this.factory = factory;
  }

  get(): T {
    for (const item of this.items) {
      if (!item.alive) {
        item.alive = true;
        return item;
      }
    }
    const n = this.factory();
    n.alive = true;
    this.items.push(n);
    return n;
  }

  release(item: T) {
    item.alive = false;
  }

  getActive(): T[] {
    const result: T[] = [];
    for (const item of this.items) {
      if (item.alive) result.push(item);
    }
    return result;
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
  const [coins, setCoins] = useState(0);
  const [showGacha, setShowGacha] = useState(false);
  const [gachaCards, setGachaCards] = useState<CardDef[]>([]);
  const [doubleCoinTimer, setDoubleCoinTimer] = useState(0);
  const [hasHoming, setHasHoming] = useState(false);
  const [gachaCost, setGachaCost] = useState(10);
  const [overdriveTimer, setOverdriveTimer] = useState(0);
  const [waveAnnounce, setWaveAnnounce] = useState("");
  const [bossWarning, setBossWarning] = useState(false);
  const [highScore, setHighScore] = useState(0);
  const [wingmanCount, setWingmanCount] = useState(0);
  const [showShop, setShowShop] = useState(false);
  const [shopRefreshKey, setShopRefreshKey] = useState(0);

  const gachaTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchAnchorRef = useRef<{ x: number; y: number; shipX: number; shipY: number } | null>(null);

  // ── 3-layer parallax star field ──
  const starsRef = useRef<Star[]>([]);
  if (starsRef.current.length === 0) {
    for (let i = 0; i < 100; i++) {
      const layer = i < 40 ? 0 : i < 70 ? 1 : 2;
      const speeds = [0.2, 0.8, 2];
      const sizes = [1, 1.5, 2.5];
      const brights = [0.2, 0.5, 0.9];
      starsRef.current.push({
        x: Math.random() * CW, y: Math.random() * CH,
        speed: speeds[layer] + (Math.random() - 0.5) * speeds[layer] * 0.5,
        size: sizes[layer],
        brightness: brights[layer] + (Math.random() - 0.5) * 0.3,
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

  const bgOffsetRef = useRef(0);
  const saveRef = useRef(loadSave());

  // ── state ref ──
  const stateRef = useRef({
    player: { x: 180, y: 460, speed: 5 },
    bullets: new Pool<Bullet>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      type: "player", wtype: "spread", wingman: false, alive: false,
    })),
    enemyBullets: new Pool<Bullet>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      type: "enemy", alive: false,
    })),
    monsters: new Pool<Monster>(() => ({
      x: 0, y: 0, hp: 2, maxHp: 2,
      speed: 1, type: "fighter", alive: false,
      formation: false, vx: 0, vy: 0, formationGroup: 0,
    })),
    boss: null as Boss | null,
    miniboss: null as Miniboss | null,
    coins: new Pool<CoinItem>(() => ({ x: 0, y: 0, value: 1, alive: false })),
    particles: new Pool<Particle>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      alpha: 1, color: "#fff", size: 2,
      life: 1, maxLife: 1, gravity: 0, alive: false,
    })),
    missiles: new Pool<Missile>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      targetX: 0, targetY: 0, alive: false,
    })),
    powerUps: new Pool<PowerUp>(() => ({ x: 0, y: 0, alive: false })),
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
    score: 0, wallet: 0,
    doubleCoinTimer: 0, hasHoming: false,
    formationTimer: 0, gachaLocked: false, gachaCost: 10,
    formationGroupCounter: 0, overdriveTimer: 0,
    lastWaveSpawned: -1,
    bossWarningTimer: 0,
    _carrierSpawnTimer: 0,
    bossCooldown: 0,
    minibossCooldown: 0,
    wingmanCount: 0,
    gameStarted: false,
  });

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
    b.type = "player"; b.wtype = wtype; b.wingman = false;
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
    return m;
  }
  function spawnCoin(x: number, y: number, value: number) {
    const c = stateRef.current.coins.get();
    c.x = x; c.y = y; c.value = value;
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
    const alive = state.monsters
      .getActive()
      .some((m) => m.formationGroup === group);
    if (!alive) {
      const pu = state.powerUps.get();
      pu.x = x; pu.y = y;
      emitExplosion(x, y, 15, ["#38bdf8", "#7dd3fc", "#fff"], 5, 35);
    }
  }

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
      case "coin_burst": state.wallet += 15; setCoins((prev) => prev + 15); break;
      case "double_coin": state.doubleCoinTimer = 1800; setDoubleCoinTimer(1800); break;
      case "wingman":
        state.wingmanCount = Math.min(2, state.wingmanCount + 1);
        setWingmanCount(state.wingmanCount);
        break;
    }
    emitExplosion(
      CW / 2, CH / 2, 20,
      card.rarity === "SSR" ? ["#facc15", "#fef08a"] : ["#93c5fd", "#bfdbfe"], 8,
    );
    audio.gachaCard();
    state.gachaLocked = false; state.gachaCost += 5;
    setGachaCost(state.gachaCost); setShowGacha(false);
    // Give player brief breather after gacha — clear leftover carrier spawns
    state.monsters.releaseAll();
    if (state.bossCooldown <= 0) state.bossCooldown = 90;
    if (state.minibossCooldown <= 0) state.minibossCooldown = 90;
  };

  const emitBombEffect = (cx: number, cy: number) => {
    const state = stateRef.current;
    // huge expanding ring
    for (let ring = 0; ring < 3; ring++) {
      const rDelay = ring * 4;
      const r = 20 + ring * 25;
      for (let a = 0; a < 360; a += 15) {
        const rad = (a * Math.PI) / 180;
        const dist = r + (Math.random() - 0.5) * 20;
        spawnParticle(
          cx + Math.cos(rad) * dist, cy + Math.sin(rad) * dist,
          Math.cos(rad) * (3 + Math.random() * 2),
          Math.sin(rad) * (3 + Math.random() * 2),
          ["#fef08a", "#f97316", "#ef4444", "#fff"][Math.floor(Math.random() * 4)],
          2 + Math.random() * 4,
          30 + ring * 10,
          0.02,
        );
      }
    }
    // white flash core
    for (let i = 0; i < 20; i++) {
      spawnParticle(
        cx + (Math.random() - 0.5) * 10, cy + (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8,
        "#fff", 5 + Math.random() * 6, 15, 0.03,
      );
    }
    // shockwave trail (horizontal strip)
    for (let i = 0; i < 15; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      spawnParticle(
        cx + side * Math.random() * 40, cy + (Math.random() - 0.5) * 20,
        0, 0, "#fef08a", 1.5, 20 + Math.random() * 10, 0,
      );
    }
  };

  const triggerBomb = () => {
    if (bombCount <= 0 || isGameOver || isPaused) return;
    audio.bomb();
    setBombCount((prev) => prev - 1);
    const state = stateRef.current;
    state.shakeX = 15; state.shakeY = 15;
    state.enemyBullets.releaseAll();
    state.monsters.releaseAll(); // 全屏清小怪
    if (state.boss) state.boss.hp -= 30;
    if (state.miniboss) state.miniboss.hp -= 20;
    emitBombEffect(CW / 2, CH / 2);
  };

  const togglePause = () => {
    if (!isGameOver && !showGacha && !showShop) {
      audio.buttonClick();
      setIsPaused((p) => !p);
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
    setTimeout(() => setWaveAnnounce(""), 1500);
    audio.bossWarning();
  };

  // ─── SHOP BUY ───

  const handleShopBuy = useCallback((itemId: keyof SaveData["upgrades"]) => {
    const save = saveRef.current;
    const upgrades = save.upgrades;
    const shopItem = SHOP_ITEMS.find((si) => si.id === itemId);
    if (!shopItem) return;
    if (shopItem.owned(upgrades)) return;
    if (save.totalCoins < shopItem.price) return;

    save.totalCoins -= shopItem.price;
    if (itemId === "extraBomb") {
      upgrades.extraBomb += 1;
    } else {
      (upgrades as unknown as Record<string, boolean>)[itemId] = true;
    }
    writeSave(save);
    setShopRefreshKey((k) => k + 1);
    audio.buttonClick();
  }, [audio]);

  // ─── START GAME ───

  const handleStart = useCallback(() => {
    if (!gameStarted) {
      setShowShop(false);
      audio.initAudio();
      // apply ship weapon
      const ship = SHIP_CONFIG[shipType];
      stateRef.current.weaponType = ship.weapon;
      setWeaponType(ship.weapon);
      // apply shop upgrades
      const upgrades = saveRef.current.upgrades;
      if (upgrades.extraBomb > 0) {
        setBombCount((prev) => prev + upgrades.extraBomb);
      }
      if (upgrades.weaponBoost) {
        stateRef.current.weaponLevel = 2;
        setWeaponLevel(2);
      }
      if (upgrades.startShield) {
        stateRef.current.invincible = true;
        stateRef.current.invincibleTimer = 180;
        setInvincible(true);
      }
      if (upgrades.startWingman) {
        stateRef.current.wingmanCount = 1;
        setWingmanCount(1);
      }
      setStartFadeOut(true);
      stateRef.current.gameStarted = true;
      setTimeout(() => {
        setGameStarted(true);
      }, 500);
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

    // thrust flame (enhanced with dynamic glow)
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.7 + Math.sin(f * 0.2) * 0.3;
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x + P, y + 6 * P, 2 * P, 3 * P + Math.sin(f * 0.15) * 2);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x + P + 2, y + 8 * P, P, P + Math.sin(f * 0.15) * 1);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x + 3 * P, y + 6 * P, 2 * P, 3 * P + Math.sin(f * 0.15 + 1) * 2);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x + 3 * P + 2, y + 8 * P, P, P + Math.sin(f * 0.15 + 1) * 1);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // main hull
    ctx.shadowColor = "#0d9488";
    ctx.shadowBlur = 6;
    drawSprite(ctx, PLAYER, { x: "#0d9488", a: "#14b8a6" }, x, y, P);
    ctx.shadowBlur = 0;
    // inner glow
    ctx.globalAlpha = 0.15;
    drawSprite(ctx, PLAYER, { x: "#99f6e4", a: "#5eead4" }, x - 1, y - 1, P);
    ctx.globalAlpha = 1;
    // wings
    drawSprite(ctx, PLAYER_WING, { x: "#d97706", a: "#f59e0b" }, x - 2 * P, y + P, P);
    drawSprite(ctx, PLAYER_WING, { x: "#d97706", a: "#f59e0b" }, x + 7 * P, y + P, P);
    // wing tips glow
    ctx.globalAlpha = 0.3 + Math.sin(f * 0.1) * 0.15;
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x - 2 * P, y + P, P, P);
    ctx.fillRect(x + 7 * P, y + P, P, P);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawMonsterShip(ctx: CanvasRenderingContext2D, m: Monster, x: number, y: number) {
    const flash = stateRef.current.frameCount % 8 < 4;
    const f = stateRef.current.frameCount;
    ctx.save();

    // ── formation marker (pulsing purple aura ring + "POW" indicator) ──
    if (m.formation) {
      const auraPulse = Math.sin(f * 0.08) * 0.3 + 0.7;
      // floating indicator text
      ctx.save();
      ctx.globalAlpha = 0.6 + Math.sin(f * 0.1) * 0.3;
      ctx.fillStyle = "#c084fc";
      ctx.font = "bold 6px monospace";
      ctx.textAlign = "center";
      ctx.shadowColor = "#a855f7";
      ctx.shadowBlur = 8;
      ctx.fillText("POW", x + 12, y - 4);
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

    switch (m.type) {
      case "fighter":
        ctx.shadowColor = "#dc2626";
        ctx.shadowBlur = 4;
        drawSprite(ctx, FIGHTER, {
          x: flash ? "#f97316" : "#dc2626",
          a: flash ? "#fdba74" : "#ef4444",
        }, x, y, P);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#450a0a";
        ctx.fillRect(x + P, y + 2 * P, P, 2 * P);
        ctx.fillRect(x + 4 * P, y + 2 * P, P, 2 * P);
        break;
      case "bomber":
        ctx.shadowColor = "#7c3aed";
        ctx.shadowBlur = 5;
        drawSprite(ctx, BOMBER, {
          x: flash ? "#c084fc" : "#7c3aed",
          a: flash ? "#e9d5ff" : "#a855f7",
        }, x, y, P);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#2e1065";
        ctx.fillRect(x + 2 * P, y + 2 * P, P, P);
        ctx.fillRect(x + 4 * P, y + 2 * P, P, P);
        break;
      case "interceptor":
        ctx.shadowColor = "#ec4899";
        ctx.shadowBlur = 4;
        drawSprite(ctx, INTERCEPTOR, {
          x: flash ? "#fb923c" : "#ec4899",
          a: flash ? "#fed7aa" : "#f472b6",
        }, x, y, P);
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#500724";
        ctx.fillRect(x + 2 * P, y + P, P, P);
        ctx.fillRect(x + 3 * P, y + P, P, P);
        break;
      case "elite":
        ctx.shadowColor = "#eab308";
        ctx.shadowBlur = 8;
        ctx.globalAlpha = 0.85 + Math.sin(stateRef.current.frameCount * 0.15) * 0.15;
        drawSprite(ctx, ELITE_SPRITE, {
          x: flash ? "#facc15" : "#ca8a04",
          a: flash ? "#fef08a" : "#facc15",
        }, x, y, P);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#422006";
        ctx.fillRect(x + 2 * P, y + 2 * P, P, 2 * P);
        ctx.fillRect(x + 6 * P, y + 2 * P, P, 2 * P);
        break;
    }
    ctx.restore();
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
      drawSprite(ctx, BOSS_FORTRESS,
        { x: flash ? "#ef4444" : "#b91c1c", a: flash ? "#fca5a5" : "#7f1d1d" }, x, y, P);
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
      drawSprite(ctx, BOSS_CARRIER,
        { x: flash ? "#c084fc" : "#6b21a8", a: flash ? "#e9d5ff" : "#581c87" }, x, y, P);
      ctx.shadowBlur = 0;
      ctx.fillStyle = flash ? "#fef08a" : "#eab308";
      ctx.fillRect(x + 5 * P, y + 4 * P, P, P);
      ctx.fillRect(x + 7 * P, y + 4 * P, P, P);
      ctx.fillRect(x + 9 * P, y + 4 * P, P, P);
    } else {
      ctx.shadowColor = "#22d3ee";
      drawSprite(ctx, BOSS_EYE_SPRITE,
        { x: flash ? "#67e8f9" : "#0891b2", a: flash ? "#cffafe" : "#0e7490" }, x, y, P);
      ctx.shadowBlur = 0;
      const pulse = Math.sin(f * 0.08) * 0.3 + 0.7;
      ctx.globalAlpha = pulse;
      drawSprite(ctx, BOSS_EYE_CORE,
        { x: "#fef08a", a: "#facc15" }, x + 4 * P, y + 4 * P, P);
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
    ctx.shadowColor = "#f97316";
    ctx.shadowBlur = 12;

    drawSprite(ctx, MINIBOSS_SPRITE, {
      x: flash ? "#f97316" : "#ea580c",
      a: flash ? "#fdba74" : "#c2410c",
    }, x, y + enterBounce, P);

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

  function drawCoinItem(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const f = stateRef.current.frameCount;
    const pulse = Math.sin(f * 0.08) * 0.2 + 1;
    ctx.translate(x + 2 * P, y + 2 * P);
    ctx.scale(pulse, 1);
    drawSprite(ctx, COIN_SPRITE, { x: "#eab308", a: "#fef08a" }, -2 * P, -2 * P, P);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(-1, -4, 2, 2);
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

  // ─── GAME LOOP ───

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stateRef.current.weaponLevel = weaponLevel;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted && !startFadeOut) {
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
      if (!gameStarted) return;
      audio.initAudio();
      if (isGameOver || isPaused || showGacha || showShop) return;
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
      if (!gameStarted) return;
      audio.initAudio();
      if (isGameOver || isPaused || showGacha || showShop) return;
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

      // ── screen shake decay ──
      state.shakeX *= 0.85; state.shakeY *= 0.85;
      if (Math.abs(state.shakeX) < 0.3) state.shakeX = 0;
      if (Math.abs(state.shakeY) < 0.3) state.shakeY = 0;

      if (state.invincible) {
        state.invincibleTimer--;
        if (state.invincibleTimer <= 0) { state.invincible = false; setInvincible(false); }
      }
      if (state.doubleCoinTimer > 0) {
        state.doubleCoinTimer--;
        if (state.doubleCoinTimer % 60 === 0) setDoubleCoinTimer(state.doubleCoinTimer);
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
          setTimeout(() => setWaveAnnounce(""), 2000);
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

      // ── 3-layer parallax stars ──
      state.stars.forEach((s) => {
        s.y += s.speed;
        if (s.y > CH) { s.y = -2; s.x = Math.random() * CW; }
      });

      // ── engine exhaust particles (pooled) ──
      if (gameStarted && !isPaused && !isGameOver && !showGacha && !showShop) {
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

      if (gameStarted && !isPaused && !isGameOver && !showGacha && !showShop) {
        const p = state.player;
        if (state.keys.ArrowLeft || state.keys.a) p.x -= p.speed;
        if (state.keys.ArrowRight || state.keys.d) p.x += p.speed;
        if (state.keys.ArrowUp || state.keys.w) p.y -= p.speed;
        if (state.keys.ArrowDown || state.keys.s) p.y += p.speed;
        p.x = Math.max(0, Math.min(CW - 24, p.x));
        p.y = Math.max(0, Math.min(CH - 32, p.y));

        // ── auto fire ──
        if (f % 8 === 0) {
          const lvl = state.weaponLevel;
          const wt = state.weaponType;
          const od = state.overdriveTimer > 0;

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

        // ── wingman auto-fire ──
        if (state.wingmanCount > 0 && f % 10 === 0) {
          const wt = state.weaponType;
          const wm1x = p.x - 6, wm1y = p.y + 20;
          const b1 = state.bullets.get();
          b1.x = wm1x; b1.y = wm1y; b1.vx = 0; b1.vy = -7; b1.type = "player"; b1.wtype = wt; b1.wingman = true;
          const b2 = state.bullets.get();
          b2.x = wm1x + 4; b2.y = wm1y; b2.vx = 0; b2.vy = -7; b2.type = "player"; b2.wtype = wt; b2.wingman = true;
          const wm2x = p.x + 30, wm2y = p.y + 20;
          const b3 = state.bullets.get();
          b3.x = wm2x; b3.y = wm2y; b3.vx = 0; b3.vy = -7; b3.type = "player"; b3.wtype = wt; b3.wingman = true;
          const b4 = state.bullets.get();
          b4.x = wm2x + 4; b4.y = wm2y; b4.vx = 0; b4.vy = -7; b4.type = "player"; b4.wtype = wt; b4.wingman = true;
          if (state.wingmanCount >= 2) {
            const wm3x = p.x, wm3y = p.y + 24;
            const b5 = state.bullets.get();
            b5.x = wm3x; b5.y = wm3y; b5.vx = -0.5; b5.vy = -6; b5.type = "player"; b5.wtype = wt; b5.wingman = true;
            const b6 = state.bullets.get();
            b6.x = wm3x + 6; b6.y = wm3y; b6.vx = 0.5; b6.vy = -6; b6.type = "player"; b6.wtype = wt; b6.wingman = true;
            const wm4x = p.x + 28, wm4y = p.y + 24;
            const b7 = state.bullets.get();
            b7.x = wm4x; b7.y = wm4y; b7.vx = -0.5; b7.vy = -6; b7.type = "player"; b7.wtype = wt; b7.wingman = true;
            const b8 = state.bullets.get();
            b8.x = wm4x + 6; b8.y = wm4y; b8.vx = 0.5; b8.vy = -6; b8.type = "player"; b8.wtype = wt; b8.wingman = true;
          }
        }

        // ── homing missile ──
        if (state.hasHoming && f % 30 === 0) {
          const targets = state.monsters.getActive();
          if (targets.length > 0) {
            const t = targets[Math.floor(Math.random() * targets.length)];
            spawnMissile(p.x + 10, p.y, t.x + 12, t.y + 10);
          }
        }

        // ── formations (only fighters, more random) ──
        state.formationTimer++;
        const formInterval = Math.max(250, 480 - Math.floor(state.score / 100));
        if (state.formationTimer >= formInterval && !state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0) {
          state.formationTimer = 0;
          const pattern = Math.floor(Math.random() * 5);
          state.formationGroupCounter++;
          const gid = state.formationGroupCounter;
          const midScore = state.score;
          const rspd = () => 0.8 + Math.random() * 1.2; // random speed helper

          if (pattern === 0) {
            // Flanking pincer — random entry angle
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(-40 - i * 25, -10 + Math.random() * 40, "fighter", 1 + Math.floor(Math.random() * 2), 0);
              m.formation = true; m.vx = rspd() + i * 0.15; m.vy = 0.6 + Math.random() * 0.8; m.formationGroup = gid;
            }
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(CW + 40 + i * 25, -10 + Math.random() * 40, "fighter", 1 + Math.floor(Math.random() * 2), 0);
              m.formation = true; m.vx = -(rspd() + i * 0.15); m.vy = 0.6 + Math.random() * 0.8; m.formationGroup = gid;
            }
          } else if (pattern === 1) {
            // Side sweep — all from one side (random left or right)
            const fromLeft = Math.random() > 0.5;
            const sideX = fromLeft ? -30 : CW + 10;
            const dir = fromLeft ? 1 : -1;
            for (let i = 0; i < 4; i++) {
              const m = spawnMonster(sideX, 30 + i * 35 + Math.random() * 15, "fighter", 1 + Math.floor(Math.random() * 2), 0);
              m.formation = true; m.vx = dir * (rspd() + i * 0.2); m.vy = 0.3 + Math.random() * 0.5; m.formationGroup = gid;
            }
          } else if (pattern === 2) {
            // Arrow formation — random spawn X, random timing offset
            const anchorX = 40 + Math.random() * (CW - 120);
            const spread = 40 + Math.random() * 50;
            for (let i = 0; i < 5; i++) {
              const m = spawnMonster(anchorX + (i - 2) * spread, -20 - i * 15, "fighter", 1 + Math.floor(Math.random() * 2), 0);
              m.formation = true; m.vx = (i - 2) * (0.1 + Math.random() * 0.3); m.vy = 1.2 + Math.random() * 0.8; m.formationGroup = gid;
            }
          } else if (pattern === 3) {
            // Diagonal intercept — fly across screen at random angle
            const fromRight = Math.random() > 0.5;
            const startX = fromRight ? CW + 20 : -30;
            const startY = 10 + Math.random() * 60;
            const dirX = fromRight ? -1 : 1;
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(startX, startY + i * 20, "fighter", 1 + Math.floor(Math.random() * 2), 0);
              m.formation = true; m.vx = dirX * (2 + Math.random()); m.vy = 0.5 + Math.random(); m.formationGroup = gid;
            }
          } else if (pattern === 4) {
            // Zigzag wave — random top spawn with sine movement
            const baseVy = 0.8 + Math.random() * 0.6;
            for (let i = 0; i < 4; i++) {
              const m = spawnMonster(Math.random() * (CW - 40), -20 - i * 18, "fighter", 1 + Math.floor(Math.random() * 2), 0);
              m.formation = true; m.vx = (Math.random() - 0.5) * 3; m.vy = baseVy; m.formationGroup = gid;
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
            const dropCoins = Math.min(20, 8 + Math.floor(state.score / 150));
            state.miniboss = {
              x: Math.random() * (CW - 80) + 20, y: -40,
              hp: mbHp, maxHp: mbHp, speed: 1,
              alive: true, type: mbType,
              attackTimer: 0, enterAnim: 60,
              dropCoins,
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
        for (const m of state.monsters.getActive()) {
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
        }

        // ── wave spawn (small waves of fighters only, more random positions) ──
        const waveGap = Math.max(200, 350 - Math.floor(state.score / 100));
        if (f % waveGap === 0 && !state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0) {
          const waveSize = Math.min(4, 2 + Math.floor(state.score / 1500));
          const spread = 120 + Math.random() * 80;
          // Random entry: sometimes from top, sometimes from sides
          const entryStyle = Math.random();
          const hp = 1 + Math.floor(Math.random() * 2);
          if (entryStyle < 0.4) {
            // from top
            for (let i = 0; i < waveSize; i++) {
              const offset = waveSize > 1 ? (i / (waveSize - 1) - 0.5) * spread : 0;
              const m = spawnMonster(
                Math.max(4, Math.min(CW - 36, CW / 2 - 12 + offset + (Math.random() - 0.5) * 30)),
                -16 - i * 10, "fighter", hp, 0,
              );
              m.vy = 1 + Math.random(); m.vx = (Math.random() - 0.5) * 1.5;
            }
          } else if (entryStyle < 0.7) {
            // from left
            for (let i = 0; i < waveSize; i++) {
              const m = spawnMonster(-20 - i * 15, 20 + Math.random() * 80, "fighter", hp, 0);
              m.vy = 0.5 + Math.random(); m.vx = 1.5 + Math.random();
            }
          } else {
            // from right
            for (let i = 0; i < waveSize; i++) {
              const m = spawnMonster(CW + 20 + i * 15, 20 + Math.random() * 80, "fighter", hp, 0);
              m.vy = 0.5 + Math.random(); m.vx = -(1.5 + Math.random());
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
              if (f % 120 === 0 && state.monsters.getActive().length < 12) {
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
        for (const m of state.monsters.getActive()) {
          if (!m.formation && f % 90 === 0 && Math.random() > 0.7) {
            spawnEnemyBullet(m.x + 12, m.y + 16, 0, 3.5);
          }
        }

        // ── move bullets ──
        for (const b of state.bullets.getActive()) { b.x += b.vx; b.y += b.vy; }
        for (const b of state.enemyBullets.getActive()) { b.x += b.vx; b.y += b.vy; }
        for (const c of state.coins.getActive()) c.y += 1.2;

        // particles
        for (const pt of state.particles.getActive()) {
          pt.x += pt.vx; pt.y += pt.vy; pt.vy += pt.gravity;
          pt.vx *= 0.97; pt.vy *= 0.97;
          pt.life--; pt.alpha = Math.max(0, pt.life / pt.maxLife);
        }

        // missiles
        for (const ms of state.missiles.getActive()) {
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
        }

        // cull
        for (const b of state.bullets.getActive()) {
          if (b.y < -20 || b.x < -10 || b.x > CW + 10) state.bullets.release(b);
        }
        for (const b of state.enemyBullets.getActive()) {
          if (b.y > CH + 10) state.enemyBullets.release(b);
        }
        for (const m of state.monsters.getActive()) {
          if (m.y > CH + 20) state.monsters.release(m);
        }
        for (const c of state.coins.getActive()) {
          if (c.y > CH + 10) state.coins.release(c);
        }
        for (const ms of state.missiles.getActive()) {
          if (ms.y < -20 || ms.y > CH + 20) state.missiles.release(ms);
        }
        for (const pt of state.particles.getActive()) {
          if (pt.life <= 0) state.particles.release(pt);
        }

        // ── bullet vs monster ──
        for (const b of state.bullets.getActive()) {
          for (const m of state.monsters.getActive()) {
            const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
            const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
            if (b.x > m.x && b.x < m.x + mw && b.y > m.y && b.y < m.y + mh) {
              m.hp--;
              state.bullets.release(b);
              emitExplosion(b.x, b.y, 3, ["#fbbf24"], 3);
              if (m.hp <= 0) {
                const isDouble = state.doubleCoinTimer > 0 || saveRef.current.upgrades.permaDouble;
                const base = m.type === "elite" ? 10 : m.type === "interceptor" ? 3 : m.type === "bomber" ? 2 : 1;
                spawnCoin(m.x + 8, m.y + 4, isDouble ? base * 2 : base);
                emitExplosion(m.x + 8, m.y + 8, 10, ["#ef4444", "#f97316"], 6);
                audio.explosion();
                state.monsters.release(m);
                setScore((prev) => { const n = prev + (m.type === "elite" ? 300 : 100); state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
              }
              break;
            }
          }
        }

        // ── missile vs monster ──
        for (const ms of state.missiles.getActive()) {
          for (const m of state.monsters.getActive()) {
            const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
            const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
            if (ms.x > m.x && ms.x < m.x + mw && ms.y > m.y && ms.y < m.y + mh) {
              m.hp -= 3;
              state.missiles.release(ms);
              emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
              if (m.hp <= 0) {
                const isDouble = state.doubleCoinTimer > 0 || saveRef.current.upgrades.permaDouble;
                const base = m.type === "elite" ? 10 : m.type === "interceptor" ? 3 : m.type === "bomber" ? 2 : 1;
                spawnCoin(m.x + 8, m.y + 4, isDouble ? base * 2 : base);
                emitExplosion(m.x + 8, m.y + 8, 10, ["#ef4444", "#f97316"], 6);
                audio.explosion();
                state.monsters.release(m);
                setScore((prev) => { const n = prev + (m.type === "elite" ? 300 : 100); state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
              }
              break;
            }
          }
        }

        // ── power-ups ──
        for (const pu of state.powerUps.getActive()) {
          pu.y += 0.8;
          const px = state.player.x;
          const py = state.player.y;
          if (pu.x > px - 4 && pu.x < px + 32 && pu.y > py - 4 && pu.y < py + 32) {
            state.powerUps.release(pu);
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
        for (const pu of state.powerUps.getActive()) {
          if (pu.y > CH + 10) state.powerUps.release(pu);
        }

        // ── bullet/missile vs boss ──
        if (state.boss) {
          const b = state.boss;
          for (const bullet of state.bullets.getActive()) {
            const bw = b.type === "fortress" ? 52 : 48;
            const bh = b.type === "fortress" ? 36 : 36;
            if (bullet.x > b.x && bullet.x < b.x + bw && bullet.y > b.y && bullet.y < b.y + bh) {
              b.hp--;
              state.bullets.release(bullet);
              emitExplosion(bullet.x, bullet.y, 3, ["#fbbf24"], 3);
              if (b.hp <= 0) {
                emitExplosion(b.x + 22, b.y + 16, 50, ["#f97316", "#ef4444", "#fef08a", "#fff"], 8);
                const isDouble = state.doubleCoinTimer > 0 || saveRef.current.upgrades.permaDouble;
                spawnCoin(b.x + 18, b.y + 10, isDouble ? 20 : 10);
                setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0);
                b.alive = false;
                state.boss = null;
                state.bossCooldown = 180;
                state.shakeX = 14; state.shakeY = 14;
                audio.bossExplosion();
                // trigger gacha on boss kill
                if (gachaTimerRef.current) clearTimeout(gachaTimerRef.current);
                gachaTimerRef.current = setTimeout(() => {
                  gachaTimerRef.current = null;
                  const cards = generateGachaOptions();
                  setGachaCards(cards);
                  setShowGacha(true);
                }, 800);
              } else setBossHp(b.hp);
              break;
            }
          }
          // IMPORTANT: boss may have been nulled by bullet loop — check before missile loop
          if (state.boss) {
            const b2 = state.boss;
            for (const ms of state.missiles.getActive()) {
              const bw = b2.type === "fortress" ? 52 : 48;
              const bh = b2.type === "fortress" ? 36 : 36;
              if (ms.x > b2.x && ms.x < b2.x + bw && ms.y > b2.y && ms.y < b2.y + bh) {
                b2.hp -= 3;
                state.missiles.release(ms);
                emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
                if (b2.hp <= 0) {
                  emitExplosion(b2.x + 22, b2.y + 16, 50, ["#f97316", "#ef4444", "#fef08a", "#fff"], 8);
                  const isDouble = state.doubleCoinTimer > 0 || saveRef.current.upgrades.permaDouble;
                  spawnCoin(b2.x + 18, b2.y + 10, isDouble ? 20 : 10);
                  setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                  setBossHp(0); b2.alive = false; state.boss = null;
                  state.bossCooldown = 180;
                  state.shakeX = 14; state.shakeY = 14;
                  audio.bossExplosion();
                  if (gachaTimerRef.current) clearTimeout(gachaTimerRef.current);
                  gachaTimerRef.current = setTimeout(() => {
                    gachaTimerRef.current = null;
                    const cards = generateGachaOptions();
                    setGachaCards(cards);
                    setShowGacha(true);
                  }, 800);
                } else setBossHp(b2.hp);
              break;
            }
          }
        }
        }

        // ── bullet/missile vs miniboss ──
        if (state.miniboss) {
          const mb = state.miniboss;
          if (mb.enterAnim <= 0) {
            const mbw = 52, mbh = 40;
            for (const bullet of state.bullets.getActive()) {
              if (bullet.x > mb.x && bullet.x < mb.x + mbw && bullet.y > mb.y && bullet.y < mb.y + mbh) {
                mb.hp--;
                state.bullets.release(bullet);
                emitExplosion(bullet.x, bullet.y, 3, ["#fbbf24"], 3);
                if (mb.hp <= 0) {
                  emitExplosion(mb.x + 26, mb.y + 20, 40, ["#f97316", "#ef4444", "#fef08a"], 7);
                  const isDouble = state.doubleCoinTimer > 0 || saveRef.current.upgrades.permaDouble;
                  const dropCount = mb.dropCoins;
                  for (let dc = 0; dc < dropCount; dc++) {
                    const angle = (Math.PI * 2 * dc) / dropCount + Math.random() * 0.3;
                    const dist = 20 + Math.random() * 30;
                    spawnCoin(mb.x + 26 + Math.cos(angle) * dist, mb.y + 20 + Math.sin(angle) * dist, isDouble ? 2 : 1);
                  }
                  setScore((prev) => { const n = prev + 500; state.score = n; return n; });
                  mb.alive = false; state.miniboss = null;
                  state.minibossCooldown = 200;
                  state.shakeX = 10; state.shakeY = 10;
                  audio.bossExplosion();
                }
                break;
              }
            }
            // IMPORTANT: miniboss may have been nulled by bullet loop
            if (state.miniboss) {
              const mb2 = state.miniboss;
              for (const ms of state.missiles.getActive()) {
                if (ms.x > mb2.x && ms.x < mb2.x + mbw && ms.y > mb2.y && ms.y < mb2.y + mbh) {
                  mb2.hp -= 3;
                  state.missiles.release(ms);
                  emitExplosion(ms.x, ms.y, 6, ["#f97316", "#fef08a", "#ef4444"], 5);
                  if (mb2.hp <= 0) {
                    emitExplosion(mb2.x + 26, mb2.y + 20, 40, ["#f97316", "#ef4444", "#fef08a"], 7);
                    const isDouble = state.doubleCoinTimer > 0 || saveRef.current.upgrades.permaDouble;
                    const dropCount = mb2.dropCoins;
                    for (let dc = 0; dc < dropCount; dc++) {
                      const angle = (Math.PI * 2 * dc) / dropCount + Math.random() * 0.3;
                      const dist = 20 + Math.random() * 30;
                      spawnCoin(mb2.x + 26 + Math.cos(angle) * dist, mb2.y + 20 + Math.sin(angle) * dist, isDouble ? 2 : 1);
                    }
                    setScore((prev) => { const n = prev + 500; state.score = n; return n; });
                    mb2.alive = false; state.miniboss = null;
                    state.minibossCooldown = 200;
                    state.shakeX = 10; state.shakeY = 10;
                    audio.bossExplosion();
                  }
                  break;
                }
              }
            }
          }
        }

        // ── collect coins ──
        for (const c of state.coins.getActive()) {
          const px = state.player.x;
          const py = state.player.y;
          if (c.x > px - 4 && c.x < px + 32 && c.y > py - 4 && c.y < py + 32) {
            const coinMult = saveRef.current.upgrades.permaDouble ? 2 : 1;
            state.wallet += c.value * coinMult;
            state.coins.release(c);
            emitExplosion(c.x, c.y, 4, ["#eab308"], 3);
            audio.coinCollect();
            setCoins(state.wallet);
          }
        }

        // ── player hit ──
        if (!state.invincible) {
          const px = p.x + 10;
          const py = p.y + 10;
          const hitMonster = state.monsters.getActive().some((m) => {
            const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
            const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
            return m.x < px + 8 && m.x + mw > px && m.y < py + 10 && m.y + mh > py;
          });
          const hitBullet = state.enemyBullets.getActive().some(
            (b) => b.x > p.x - 2 && b.x < p.x + 26 && b.y > p.y - 2 && b.y < p.y + 28,
          );
          const hitBoss = state.boss &&
            state.boss.x < p.x + 24 && state.boss.x + 44 > p.x &&
            state.boss.y < p.y + 28 && state.boss.y + 32 > p.y + 4;
          const hitMiniboss = state.miniboss && state.miniboss.enterAnim <= 0 &&
            state.miniboss.x < p.x + 24 && state.miniboss.x + 52 > p.x &&
            state.miniboss.y < p.y + 28 && state.miniboss.y + 40 > p.y + 4;
          if (hitMonster || hitBullet || hitBoss || hitMiniboss) {
            emitExplosion(p.x + 12, p.y + 14, 15, ["#60a5fa", "#93c5fd"], 8);
            audio.playerHit();
            setLives((prev) => {
              if (prev <= 1) { setIsGameOver(true); return 0; }
              state.invincible = true; state.invincibleTimer = 90;
              setInvincible(true); state.shakeX = 6; state.shakeY = 6;
              return prev - 1;
            });
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

      // background gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CH);
      grad.addColorStop(0, "#020617");
      grad.addColorStop(0.5, "#0c0a20");
      grad.addColorStop(1, "#1a0a2e");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);

      // nebula clouds
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#3b0764";
      ctx.beginPath(); ctx.arc(200, 150 + Math.sin(f * 0.005) * 30, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1e3a5f";
      ctx.beginPath(); ctx.arc(100, 400 + Math.sin(f * 0.007 + 1) * 40, 100, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a044e";
      ctx.beginPath(); ctx.arc(300, 300 + Math.sin(f * 0.006 + 2) * 50, 90, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // animated grid
      const go = bgOffsetRef.current;
      ctx.strokeStyle = "rgba(56,189,248,0.04)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < CW; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
      }
      for (let gy = -go; gy < CH; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
      }

      // ── 3-layer parallax stars ──
      state.stars.forEach((s) => {
        ctx.globalAlpha = s.brightness;
        ctx.fillStyle = "#fff";
        if (s.layer === 2) {
          // near layer: add subtle glow
          ctx.save();
          ctx.shadowColor = "#fff";
          ctx.shadowBlur = 3;
          ctx.fillRect(s.x, s.y, s.size, s.size);
          ctx.restore();
        } else {
          ctx.fillRect(s.x, s.y, s.size, s.size);
        }
      });
      ctx.globalAlpha = 1;

      // ── engine exhaust ──
      for (const e of exhaustPool.current.items) {
        if (!e.alive) continue;
        ctx.globalAlpha = e.alpha * 0.6;
        ctx.fillStyle = "#f97316";
        ctx.fillRect(e.x, e.y, 2, 2);
        ctx.globalAlpha = e.alpha * 0.3;
        ctx.fillStyle = "#fef08a";
        ctx.fillRect(e.x - 0.5, e.y - 0.5, 3, 3);
      }
      ctx.globalAlpha = 1;

      // enemy bullets with bloom
      for (const b of state.enemyBullets.getActive()) {
        const flicker = Math.sin(f * 0.2 + b.x) * 0.3 + 0.7;
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 14);
        glow.addColorStop(0, `rgba(251,113,133,${0.5 * flicker})`);
        glow.addColorStop(0.4, `rgba(251,113,133,${0.2 * flicker})`);
        glow.addColorStop(1, "rgba(251,113,133,0)");
        ctx.save();
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 10;
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        ctx.translate(b.x, b.y);
        ctx.rotate(Math.PI / 4);
        ctx.globalAlpha = 0.9 * flicker;
        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(3.5, -2);
        ctx.lineTo(5, 0);
        ctx.lineTo(3.5, 2);
        ctx.lineTo(0, 5);
        ctx.lineTo(-3.5, 2);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-3.5, -2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 0.8 * flicker;
        ctx.fillStyle = "#fecdd3";
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // player bullets with bloom
      for (const b of state.bullets.getActive()) {
        if (b.wingman) {
          ctx.save();
          ctx.shadowColor = "#f97316";
          ctx.shadowBlur = 6;
          ctx.globalAlpha = 0.85 + Math.sin(f * 0.15 + b.x) * 0.15;
          const wg = ctx.createRadialGradient(b.x, b.y - 2, 0, b.x, b.y - 2, 6);
          wg.addColorStop(0, "rgba(251,146,60,0.4)");
          wg.addColorStop(1, "rgba(251,146,60,0)");
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.arc(b.x, b.y - 2, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#f97316";
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - 5);
          ctx.lineTo(b.x + 2.5, b.y - 1);
          ctx.lineTo(b.x, b.y + 3);
          ctx.lineTo(b.x - 2.5, b.y - 1);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#fef08a";
          ctx.beginPath(); ctx.arc(b.x, b.y - 1, 1.2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else if (b.wtype === "laser") {
          const od = stateRef.current.overdriveTimer > 0;
          const len = od ? 22 : 14;
          ctx.save();
          ctx.shadowColor = od ? "#f97316" : "#22d3ee";
          ctx.shadowBlur = od ? 16 : 8;
          const lg = ctx.createRadialGradient(b.x, b.y - len / 2, 0, b.x, b.y - len / 2, od ? 10 : 6);
          lg.addColorStop(0, od ? "rgba(251,146,60,0.5)" : "rgba(34,211,238,0.4)");
          lg.addColorStop(1, od ? "rgba(251,146,60,0)" : "rgba(34,211,238,0)");
          ctx.fillStyle = lg;
          ctx.fillRect(b.x - (od ? 6 : 4), b.y - len, (od ? 12 : 8), len + 4);
          ctx.fillStyle = od ? "#f97316" : "#22d3ee";
          ctx.fillRect(b.x - (od ? 2 : 1), b.y - len, od ? 4 : 2, len);
          ctx.fillStyle = od ? "#fef08a" : "#e0f2fe";
          ctx.fillRect(b.x - 1, b.y - len, od ? 2 : 1, len);
          ctx.fillStyle = od ? "#fff" : "#fff";
          ctx.beginPath(); ctx.arc(b.x, b.y - len, od ? 3 : 2, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else if (b.wtype === "wave") {
          const od = stateRef.current.overdriveTimer > 0;
          const pulseR = od ? 8 + Math.sin(stateRef.current.frameCount * 0.2) * 3 : 5 + Math.sin(stateRef.current.frameCount * 0.15) * 1;
          ctx.save();
          ctx.shadowColor = od ? "#f97316" : "#4ade80";
          ctx.shadowBlur = od ? 16 : 8;
          const wg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, pulseR + (od ? 6 : 3));
          wg.addColorStop(0, od ? "rgba(251,146,60,0.5)" : "rgba(74,222,128,0.5)");
          wg.addColorStop(1, od ? "rgba(251,146,60,0)" : "rgba(74,222,128,0)");
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR + (od ? 6 : 3), 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = od ? "#f97316" : "#4ade80";
          ctx.lineWidth = od ? 3 : 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#bbf7d0";
          ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        } else {
          const od = stateRef.current.overdriveTimer > 0;
          ctx.save();
          ctx.shadowColor = od ? "#f97316" : "#fbbf24";
          ctx.shadowBlur = od ? 14 : 6;
          const sg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, od ? 9 : 5);
          sg.addColorStop(0, od ? "rgba(251,146,60,0.5)" : "rgba(251,191,36,0.4)");
          sg.addColorStop(1, od ? "rgba(251,146,60,0)" : "rgba(251,191,36,0)");
          ctx.fillStyle = sg;
          ctx.fillRect(b.x - (od ? 9 : 5), b.y - (od ? 9 : 5), (od ? 18 : 10), (od ? 18 : 10));
          ctx.fillStyle = od ? "#f97316" : "#fbbf24";
          ctx.beginPath(); ctx.arc(b.x, b.y, od ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = od ? "#fef08a" : "#fef08a";
          ctx.beginPath(); ctx.arc(b.x, b.y, od ? 2 : 1, 0, Math.PI * 2); ctx.fill();
          ctx.restore();
        }
      }

      // missiles
      for (const ms of state.missiles.getActive()) {
        drawMissileSprite(ctx, ms.x, ms.y);
      }

      // player
      if (gameStarted && !isGameOver) {
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

          // wingman
          if (state.wingmanCount > 0) {
            const wmCount = state.wingmanCount;
            const flicker = 0.7 + Math.sin(f * 0.15) * 0.3;
            const lx = sp.x - 10, ly = sp.y + 6;
            ctx.globalAlpha = flicker;
            ctx.fillStyle = "#0d9488";
            ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#5eead4";
            ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI * 2); ctx.fill();
            const rx = sp.x + 32, ry = sp.y + 6;
            ctx.fillStyle = "#0d9488";
            ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#5eead4";
            ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, Math.PI * 2); ctx.fill();
            if (wmCount >= 2) {
              ctx.fillStyle = "#d97706";
              ctx.beginPath(); ctx.arc(sp.x - 16, sp.y + 10, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#fbbf24";
              ctx.beginPath(); ctx.arc(sp.x - 16, sp.y + 10, 1.2, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#d97706";
              ctx.beginPath(); ctx.arc(sp.x + 38, sp.y + 10, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = "#fbbf24";
              ctx.beginPath(); ctx.arc(sp.x + 38, sp.y + 10, 1.2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.strokeStyle = `rgba(13,148,136,${0.1 + Math.sin(f * 0.1) * 0.05})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y + 8); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sp.x + 24, sp.y + 8); ctx.lineTo(rx, ry); ctx.stroke();
            ctx.setLineDash([]);
          }

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
            ctx.globalAlpha = 0.5 + Math.sin(f * 0.1) * 0.3;
            ctx.fillStyle = "#f97316";
            ctx.font = "bold 10px monospace";
            ctx.textAlign = "center";
            ctx.shadowColor = "#fbbf24";
            ctx.shadowBlur = 12;
            ctx.fillText("★ MAX ★", sp.x + 12, sp.y - 6);
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
      }

      // monsters
      for (const m of state.monsters.getActive())
        drawMonsterShip(ctx, m, m.x, m.y);

      // boss
      if (state.boss) {
        drawBossShip(ctx, state.boss.x, state.boss.y, state.boss.hp, state.boss.maxHp, state.boss.type);
      }
      // miniboss
      if (state.miniboss) {
        drawMinibossShip(ctx, state.miniboss, state.miniboss.x, state.miniboss.y);
      }

      // coins — batch glow pass then individual
      const activeCoins = state.coins.getActive();
      ctx.save();
      ctx.shadowColor = "#eab308";
      ctx.shadowBlur = 6;
      for (const c of activeCoins) {
        const floatY = Math.sin(f * 0.06 + c.x) * 2;
        ctx.save();
        drawCoinItem(ctx, c.x, c.y + floatY);
        ctx.restore();
      }
      ctx.restore();
      // sparkles on top (no shadow)
      for (const c of activeCoins) {
        if (Math.sin(f * 0.12 + c.x) > 0.8) {
          const floatY = Math.sin(f * 0.06 + c.x) * 2;
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(c.x + 2, c.y + floatY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // power-ups (enhanced effect)
      for (const pu of state.powerUps.getActive()) {
        const pcx = pu.x + 6, pcy = pu.y + 6;
        const pulse = Math.sin(f * 0.1) * 0.3 + 0.7;
        ctx.save();
        // outer glow ring (rotating)
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 20;
        ctx.globalAlpha = 0.35 * pulse;
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
        const ringR = 16 + Math.sin(f * 0.08) * 4;
        ctx.beginPath(); ctx.arc(pcx, pcy, ringR, 0, Math.PI * 2); ctx.stroke();
        // rotating arc
        ctx.globalAlpha = 0.5 * pulse;
        ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 2.5;
        const arcStart = f * 0.05;
        const arcEnd = arcStart + 1.2;
        ctx.beginPath(); ctx.arc(pcx, pcy, ringR + 2, arcStart, arcEnd); ctx.stroke();
        // main gradient sphere
        const pg = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 14);
        pg.addColorStop(0, "rgba(255,255,255,0.95)");
        pg.addColorStop(0.3, "rgba(125,211,252,0.9)");
        pg.addColorStop(0.6, "rgba(56,189,248,0.6)");
        pg.addColorStop(1, "rgba(56,189,248,0)");
        ctx.globalAlpha = 0.9 * pulse;
        ctx.shadowColor = "#38bdf8";
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
          ctx.fillStyle = i === 0 ? "#fff" : i === 1 ? "#7dd3fc" : "#38bdf8";
          ctx.beginPath(); ctx.arc(
            pcx + Math.cos(da) * (10 + Math.sin(f * 0.05 + i) * 2),
            pcy + Math.sin(da) * (10 + Math.sin(f * 0.05 + i) * 2),
            1.5 + Math.sin(f * 0.1 + i) * 0.5, 0, Math.PI * 2,
          ); ctx.fill();
        }
        // "P" letter hint
        ctx.globalAlpha = 0.7 * pulse;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 8px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("P", pcx, pcy + 0.5);
        ctx.restore();
      }

      // particles (batch-rendered 3-pass: glow first, then core, to minimize ctx state changes)
      const pts = state.particles.getActive();
      // pass 1: glow (larger particles with shadow)
      ctx.save();
      for (const pt of pts) {
        if (pt.size <= 4) continue;
        ctx.globalAlpha = Math.max(0, pt.alpha * 0.4);
        ctx.shadowColor = pt.color;
        ctx.shadowBlur = pt.size > 6 ? 10 : 5;
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      // pass 2: all particles, no shadow (fast)
      for (const pt of pts) {
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 0.6, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctx.restore();

      if (gameStarted && !isGameOver) animId = requestAnimationFrame(loop);
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
    };
  }, [
    gameStarted, startFadeOut, isGameOver, weaponLevel, weaponType,
    bombCount, lives, isPaused, showGacha, showShop, hasHoming, wingmanCount, audio, shipType
  ]);

  // Check boss spawn
  useEffect(() => {
    if (!isGameOver && gameStarted) checkSpawnBoss(score);
  }, [score, isGameOver, gameStarted]);

  // BGM control
  useEffect(() => {
    if (gameStarted && !isPaused && !isGameOver && !showGacha && !showShop) {
      audio.startBGM();
    } else {
      audio.stopBGM();
    }
    return () => audio.stopBGM();
  }, [gameStarted, isPaused, isGameOver, showGacha, showShop, audio]);

  // save on game over
  useEffect(() => {
    if (isGameOver) {
      const save = saveRef.current;
      const finalScore = scoreRef.current;
      save.totalGames++;
      if (finalScore > save.highScore) save.highScore = finalScore;
      const currentCoins = coinsRef.current;
      save.totalCoins += currentCoins;
      writeSave(save);
      setHighScore(save.highScore);
    }
  }, [isGameOver]);

  const scoreRef = useRef(0);
  const coinsRef = useRef(0);
  scoreRef.current = score;
  coinsRef.current = coins;

  const restartGame = () => {
    audio.buttonClick();
    if (gachaTimerRef.current) { clearTimeout(gachaTimerRef.current); gachaTimerRef.current = null; }
    const state = stateRef.current;
    state.monsters.releaseAll();
    state.bullets.releaseAll();
    state.enemyBullets.releaseAll();
    state.coins.releaseAll();
    state.particles.releaseAll();
    state.missiles.releaseAll();
    state.powerUps.releaseAll();
    state.boss = null;
    state.miniboss = null;
    state.player = { x: 180, y: 460, speed: 5 };
    state.invincible = false; state.invincibleTimer = 0;
    state.shakeX = 0; state.shakeY = 0;
    state.score = 0; state.wallet = 0;
    state.doubleCoinTimer = 0; state.hasHoming = false;
    state.formationTimer = 0; state.gachaLocked = false;
    state.gachaCost = 10; state.formationGroupCounter = 0;
    state.overdriveTimer = 0; state.lastWaveSpawned = -1;
    state.bossCooldown = 0; state.minibossCooldown = 0; state.wingmanCount = 0; state.bossWarningTimer = 0;
    bgOffsetRef.current = 0;
    exhaustPool.current.releaseAll();
    setIsPaused(false); setShowGacha(false); setShowShop(false);
    setScore(0); setWeaponLevel(1);
    setBombCount(3); setLives(3); setIsGameOver(false);
    setInvincible(false); setBossHp(0); setCoins(0);
    setDoubleCoinTimer(0); setHasHoming(false);
    setGachaCost(10); setOverdriveTimer(0); setWaveAnnounce("");
    setWingmanCount(0); setBossWarning(false); setGameStarted(false); setStartFadeOut(false);
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
      `}</style>

      <main className="min-h-screen bg-[#020617]" style={{ fontFamily: PIXEL_FONT }}>
        <div className="max-w-[400px] mx-auto px-3 py-4">

          {/* Minimal back button — pixel style */}
          <div className="flex items-center justify-between mb-3">
            <Link
              href="/game"
              className="pixel-font text-[10px] text-[#38bdf8] hover:text-[#7dd3fc] transition-colors tracking-wider"
            >
              &lt; RET
            </Link>
            {gameStarted && (
              <div className="pixel-font text-[8px] text-[#475569] tracking-wider">
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
                className={`absolute inset-0 bg-[#020617] flex flex-col items-center justify-center cursor-pointer z-20 transition-opacity duration-500 ${startFadeOut ? "opacity-0 pointer-events-none" : "opacity-100"}`}
                onClick={handleStart}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStart(); } }}
                tabIndex={0}
              >
                <div className="text-center px-6">
                  {/* Title */}
                  <div className="mb-4">
                    <p className="pixel-font text-[22px] text-[#38bdf8] tracking-[4px]" style={{ fontFamily: PIXEL_FONT }}>雷电</p>
                    <p className="pixel-font text-[16px] text-[#fbbf24] tracking-[6px] -mt-1" style={{ fontFamily: PIXEL_FONT }}>战机</p>
                  </div>

                  {/* Ship selection — arrow key carousel */}
                  <div className="mb-4">
                    <p className="pixel-font text-[7px] text-[#64748b] mb-2">选择战机</p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = SHIP_TYPES.indexOf(shipType);
                          const prev = SHIP_TYPES[(idx - 1 + SHIP_TYPES.length) % SHIP_TYPES.length];
                          setShipType(prev);
                        }}
                        className="pixel-hud w-7 h-7 flex items-center justify-center hover:bg-[rgba(56,189,248,0.15)] active:scale-90 transition-all text-white text-xs"
                      >
                        ◀
                      </button>
                      <div className="pixel-hud px-4 py-2 flex flex-col items-center gap-1 min-w-[100px]">
                        <span className="text-2xl">{SHIP_CONFIG[shipType].icon}</span>
                        <span className="pixel-font text-[8px] text-white">{SHIP_CONFIG[shipType].label}</span>
                        <span className="pixel-font text-[6px] text-[#475569]">{SHIP_CONFIG[shipType].desc}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = SHIP_TYPES.indexOf(shipType);
                          const next = SHIP_TYPES[(idx + 1) % SHIP_TYPES.length];
                          setShipType(next);
                        }}
                        className="pixel-hud w-7 h-7 flex items-center justify-center hover:bg-[rgba(56,189,248,0.15)] active:scale-90 transition-all text-white text-xs"
                      >
                        ▶
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="pixel-hud px-4 py-3 mb-3 inline-block">
                    <p className="pixel-font text-[7px] text-[#64748b] mb-1">HIGH SCORE</p>
                    <p className="pixel-font text-[10px] text-[#fbbf24]">{formatScore(highScore)}</p>
                  </div>

                  {/* Shop button */}
                  <div className="mb-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowShop(true); }}
                      className="pixel-hud px-4 py-1.5 hover:bg-[rgba(56,189,248,0.15)] active:scale-90 transition-all flex items-center gap-1.5 mx-auto"
                    >
                      <Coins className="w-2.5 h-2.5 text-yellow-400" />
                      <span className="pixel-font text-[7px] text-[#facc15] tracking-[2px]">商店</span>
                    </button>
                  </div>

                  {/* Hint */}
                  <div className="animate-blink">
                    <p className="pixel-font text-[9px] text-[#38bdf8] tracking-[2px]">PRESS ANY KEY</p>
                    <p className="pixel-font text-[7px] text-[#475569] mt-2 tracking-[1px]">TO START</p>
                  </div>

                  {/* Controls */}
                  <div className="mt-6 pixel-hud px-3 py-2 inline-block">
                    <p className="pixel-font text-[6px] text-[#64748b] leading-[10px]">
                      WASD/ARROWS MOVE
                    </p>
                    <p className="pixel-font text-[6px] text-[#64748b] leading-[10px]">
                      SPACE BOMB
                    </p>
                    <p className="pixel-font text-[6px] text-[#64748b] leading-[10px]">
                      ESC PAUSE
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ IN-GAME HUD ═══ */}
            {gameStarted && (
              <>
                {/* Top-left: lives + coins */}
                <div className="absolute top-2 left-2 pixel-hud px-2 py-1 flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: lives }).map((_, i) => (
                      <Heart key={i} className="w-2.5 h-2.5 text-rose-400" fill="#e11d48" />
                    ))}
                  </div>
                  <div className="flex items-center gap-0.5">
                    <Coins className="w-2.5 h-2.5 text-yellow-400" />
                    <span className="pixel-font text-[7px] text-yellow-300">{coins}</span>
                  </div>
                  {invincible && (
                    <span className="pixel-font text-[6px] text-yellow-300 animate-blink">SHIELD</span>
                  )}
                  {overdriveTimer > 0 && (
                    <span className="pixel-font text-[6px] text-orange-400 animate-blink">MAX</span>
                  )}
                </div>

                {/* Top-right: ship + weapon info + pause */}
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <div className="pixel-hud px-1.5 py-1">
                    <span className="pixel-font text-[6px] text-[#38bdf8] leading-[8px]">
                      {WEAPON_ICONS[weaponType]} {WEAPON_NAMES[weaponType]}
                    </span>
                  </div>
                  <button
                    onClick={togglePause}
                    className="pixel-hud w-6 h-6 flex items-center justify-center hover:bg-[rgba(56,189,248,0.15)] active:scale-90 transition-all"
                  >
                    <span className="text-white text-[10px]">{isPaused ? "▶" : "⏸"}</span>
                  </button>
                </div>

                {/* Boss HP bar */}
                {stateRef.current.boss && bossHp > 0 && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 pixel-hud px-2 py-1 flex items-center gap-1.5">
                    <span className="text-red-400 text-[10px]">☠</span>
                    <div className="w-16 h-1.5 bg-black/60 overflow-hidden" style={{ borderRadius: 0 }}>
                      <div
                        className="h-full bg-[#22c55e] transition-all duration-200"
                        style={{ width: `${(bossHp / 50) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Bomb button */}
                <button
                  onClick={triggerBomb}
                  disabled={bombCount <= 0 || isGameOver || isPaused}
                  className="absolute bottom-16 right-2 pixel-hud px-2 py-1.5 flex items-center gap-1 hover:bg-[rgba(239,68,68,0.15)] active:scale-90 transition-all disabled:opacity-30 disabled:scale-100"
                >
                  <Bomb className="w-3 h-3 text-rose-400" />
                  <span className="pixel-font text-[8px] text-rose-300">×{bombCount}</span>
                </button>

                {/* Bottom HUD bar: level + fire power indicator */}
                <div className="absolute bottom-2 left-2 pixel-hud px-2 py-1">
                  <span className="pixel-font text-[6px] text-[#facc15]">
                    LV {Math.min(stateRef.current.weaponLevel, 4)}
                  </span>
                </div>
                <div className="absolute bottom-2 right-2 pixel-hud px-2 py-1">
                  <span className="pixel-font text-[6px] text-[#475569]">
                    WAVE {Math.max(0, stateRef.current.lastWaveSpawned + 1)}
                  </span>
                </div>
              </>
            )}

            {/* Boss Warning overlay */}
            {bossWarning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-15">
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
                      textShadow: "0 0 20px rgba(239,68,68,0.8), 0 0 40px rgba(239,68,68,0.4)",
                    }}
                  >
                    WARNING
                  </p>
                  <p
                    className="text-[10px] font-black text-yellow-400 tracking-[2px] mt-1 text-center"
                    style={{ fontFamily: PIXEL_FONT }}
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
                <p className="pixel-font text-[14px] text-[#38bdf8] tracking-[4px] mb-3">PAUSED</p>
                <p className="pixel-font text-[7px] text-[#64748b]">PRESS ESC OR TAP</p>
              </div>
            )}

            {/* Game over */}
            {isGameOver && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-center p-6 z-10">
                <p className="pixel-font text-[12px] text-rose-500 tracking-[3px] mb-3">GAME OVER</p>
                <div className="pixel-hud px-4 py-2 mb-2">
                  <p className="pixel-font text-[7px] text-[#64748b] mb-1">SCORE</p>
                  <p className="pixel-font text-[12px] text-[#fbbf24]">{formatScore(score)}</p>
                </div>
                <div className="pixel-hud px-3 py-1 mb-5">
                  <p className="pixel-font text-[6px] text-[#475569]">BEST {formatScore(highScore)}</p>
                </div>
                <button
                  onClick={restartGame}
                  className="pixel-hud px-4 py-2 bg-[rgba(56,189,248,0.15)] hover:bg-[rgba(56,189,248,0.25)] active:scale-95 transition-all"
                >
                  <span className="pixel-font text-[8px] text-[#38bdf8] tracking-[2px]">CONTINUE</span>
                </button>
              </div>
            )}

            {/* ═══ GACHA OVERLAY ═══ */}
            {showGacha && (
              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center p-4 z-20">
                <div className="pixel-hud px-4 py-2 mb-4">
                  <p className="pixel-font text-[10px] text-[#facc15] tracking-[4px]">DRAW CARD</p>
                </div>
                <p className="pixel-font text-[6px] text-[#64748b] mb-4">CHOOSE YOUR BOOST</p>
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
                {/* Reroll with coins */}
                <button
                  onClick={() => {
                    if (coins >= 5) {
                      setCoins((p) => p - 5);
                      stateRef.current.wallet -= 5;
                      const cards = generateGachaOptions();
                      setGachaCards(cards);
                    }
                  }}
                  className={`pixel-hud px-3 py-1.5 transition-all active:scale-90 flex items-center gap-1 ${
                    coins >= 5 ? "hover:bg-[rgba(56,189,248,0.15)]" : "opacity-40"
                  }`}
                >
                  <span className="pixel-font text-[6px] text-[#38bdf8] tracking-[1px]">
                    {coins >= 5 ? "刷新 (5金币)" : "金币不足"}
                  </span>
                </button>
                {/* Shop button in gacha */}
                <button
                  onClick={() => {
                    if (gachaTimerRef.current) { clearTimeout(gachaTimerRef.current); gachaTimerRef.current = null; }
                    setShowGacha(false);
                    setShowShop(true);
                  }}
                  className="pixel-hud px-3 py-1.5 mt-2 hover:bg-[rgba(56,189,248,0.15)] active:scale-90 transition-all"
                >
                  <span className="pixel-font text-[6px] text-[#facc15] tracking-[1px]">商店 (金币)</span>
                </button>
              </div>
            )}

            {/* ═══ SHOP OVERLAY ═══ */}
            {showShop && (
              <div
                className="absolute inset-0 bg-black/85 flex flex-col items-center p-4 z-30 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="pixel-hud px-4 py-2 mb-3">
                  <p className="pixel-font text-[10px] text-[#facc15] tracking-[4px]">商 店</p>
                </div>
                {/* Coins display */}
                <div className="flex items-center gap-1 mb-4">
                  <Coins className="w-3 h-3 text-yellow-400" />
                  <span className="pixel-font text-[8px] text-yellow-300" key={shopRefreshKey}>
                    {saveRef.current.totalCoins}
                  </span>
                </div>
                {/* Shop items grid */}
                <div className="grid grid-cols-2 gap-3 w-full max-w-[280px] mb-4">
                  {SHOP_ITEMS.map((item) => {
                    const owned = item.owned(saveRef.current.upgrades);
                    const canBuy = saveRef.current.totalCoins >= item.price;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-col items-center p-2"
                        style={{
                          background: "rgba(0,0,0,0.75)",
                          border: "1px solid rgba(56,189,248,0.2)",
                          borderRadius: 0,
                          backgroundImage: [
                            "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)",
                            "linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                          ].join(","),
                          backgroundSize: "8px 8px",
                        }}
                      >
                        <span className="text-2xl mb-1">{item.icon}</span>
                        <span className="pixel-font text-[7px] text-white text-center leading-tight mb-0.5">{item.name}</span>
                        <span className="pixel-font text-[5px] text-[#475569] text-center leading-[7px] mb-2">{item.desc}</span>
                        {owned ? (
                          <span
                            className="pixel-font text-[6px] text-green-400 px-2 py-0.5"
                            style={{ border: "1px solid rgba(74,222,128,0.3)", borderRadius: 0 }}
                          >
                            已拥有
                          </span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleShopBuy(item.id); }}
                            disabled={!canBuy}
                            className={`pixel-font text-[6px] px-2 py-0.5 transition-all active:scale-90 tracking-[1px] ${
                              canBuy
                                ? "text-[#38bdf8] hover:bg-[rgba(56,189,248,0.15)]"
                                : "text-[#475569] opacity-40 cursor-not-allowed"
                            }`}
                            style={{
                              border: canBuy
                                ? "1px solid rgba(56,189,248,0.3)"
                                : "1px solid rgba(71,85,105,0.3)",
                              background: canBuy ? "rgba(56,189,248,0.05)" : "transparent",
                              borderRadius: 0,
                            }}
                          >
                            购买 ({item.price})
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Close button */}
                <button
                  onClick={() => setShowShop(false)}
                  className="pixel-hud px-4 py-2 hover:bg-[rgba(56,189,248,0.15)] active:scale-95 transition-all"
                >
                  <span className="pixel-font text-[8px] text-[#38bdf8] tracking-[2px]">关 闭</span>
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
