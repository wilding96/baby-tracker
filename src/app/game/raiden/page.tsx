"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Bomb,
  Heart,
  Skull,
  Pause,
  Play,
  Coins,
  Sparkles,
  Trophy,
} from "lucide-react";

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

// ═══════════════════════════════════════════════════════════════════
// BOSS SPRITES (3 types)
// ═══════════════════════════════════════════════════════════════════

const BOSS_TYPES = ["fortress", "carrier", "eye"] as const;
type BossType = (typeof BOSS_TYPES)[number];

// Fortress: wide, heavy, shoots spreads
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
// Carrier: releases mini fighters
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
// Eye: agile, shoots lasers
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
const SR_CARDS: CardDef[] = [
  { id: "power_up", name: "火力升级", icon: "⚡", rarity: "SR", desc: "武器等级 +1" },
  { id: "bomb_give", name: "炸弹补给", icon: "💣", rarity: "SR", desc: "炸弹 +1" },
  { id: "life_give", name: "生命之心", icon: "❤️", rarity: "SR", desc: "生命 +1" },
  { id: "shield_s", name: "护盾", icon: "🛡️", rarity: "SR", desc: "3 秒无敌" },
  { id: "double_coin", name: "双倍金币", icon: "🪙", rarity: "SR", desc: "30s 金币翻倍" },
];
const SSR_CARDS: CardDef[] = [
  { id: "shield_l", name: "能量护盾", icon: "🔮", rarity: "SSR", desc: "5 秒无敌" },
  { id: "fire_storm", name: "火力风暴", icon: "🔥", rarity: "SSR", desc: "MAX 火力 5秒" },
  { id: "life_pack", name: "生命补给", icon: "💖", rarity: "SSR", desc: "额外 +2 命" },
  { id: "nuke", name: "核弹", icon: "☢️", rarity: "SSR", desc: "全屏清怪 +2 炸弹" },
  { id: "coin_burst", name: "金币爆裂", icon: "💰", rarity: "SSR", desc: "获得 15 金币" },
  { id: "wingman", name: "僚机", icon: "✈️", rarity: "SSR", desc: "召唤僚机协助射击" },
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
  type: "fighter" | "bomber" | "interceptor";
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
  x: number; y: number; speed: number; size: number; brightness: number;
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
  { score: 2000, boss: "fortress", bossHp: 40, name: "钢铁堡垒", subtitle: "重型火力堡垒出现了" },
  { score: 5000, boss: "carrier", bossHp: 55, name: "星际航母", subtitle: "航母正在释放舰载机" },
  { score: 9000, boss: "eye", bossHp: 70, name: "魔眼", subtitle: "巨型魔眼正在注视你" },
  { score: 14000, boss: "fortress", bossHp: 90, name: "堡垒·改", subtitle: "强化堡垒，火力翻倍" },
  { score: 20000, boss: "carrier", bossHp: 110, name: "航母·改", subtitle: "精英航母编队" },
  { score: 27000, boss: "eye", bossHp: 130, name: "魔眼·改", subtitle: "终极魔眼" },
];

// ═══════════════════════════════════════════════════════════════════
// LOCALSTORAGE PERSISTENCE
// ═══════════════════════════════════════════════════════════════════

interface SaveData {
  totalCoins: number;
  highScore: number;
  totalGames: number;
}
const SAVE_KEY = "raiden_save";
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { totalCoins: 0, highScore: 0, totalGames: 0 };
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

  const [score, setScore] = useState(0);
  const [weaponType, setWeaponType] = useState<WeaponType>("spread");
  const [weaponLevel, setWeaponLevel] = useState(1);
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
  const [missileCount, setMissileCount] = useState(0);
  const [hasHoming, setHasHoming] = useState(false);
  const [gachaCost, setGachaCost] = useState(10);
  const [overdriveTimer, setOverdriveTimer] = useState(0);
  const [waveAnnounce, setWaveAnnounce] = useState("");
  const [highScore, setHighScore] = useState(0);
  const [wingmanCount, setWingmanCount] = useState(0);

  // star field
  const starsRef = useRef<Star[]>([]);
  if (starsRef.current.length === 0) {
    for (let i = 0; i < 60; i++) {
      starsRef.current.push({
        x: Math.random() * CW, y: Math.random() * CH,
        speed: 0.3 + Math.random() * 1.8,
        size: Math.random() > 0.7 ? 2 : 1,
        brightness: 0.3 + Math.random() * 0.7,
      });
    }
  }

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
    _carrierSpawnTimer: 0,
    bossCooldown: 0,
    wingmanCount: 0,
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
    b.type = "player"; b.wtype = wtype;
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
      emitExplosion(x, y, 12, ["#38bdf8", "#7dd3fc"], 4);
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
    state.gachaLocked = false; state.gachaCost += 5;
    setGachaCost(state.gachaCost); setShowGacha(false);
  };

  const triggerBomb = () => {
    if (bombCount <= 0 || isGameOver || isPaused) return;
    setBombCount((prev) => prev - 1);
    const state = stateRef.current;
    state.shakeX = 10; state.shakeY = 10;
    state.enemyBullets.releaseAll();
    const monsters = state.monsters.getActive();
    for (const m of monsters) {
      if (Math.random() > 0.5) state.monsters.release(m);
      else m.hp -= 20;
    }
    if (state.boss) state.boss.hp -= 30;
    emitExplosion(CW / 2, CH / 2, 80, ["#f97316", "#fef08a", "#ef4444"], 8);
  };

  const togglePause = () => {
    if (!isGameOver && !showGacha) setIsPaused((p) => !p);
  };

  const checkSpawnBoss = (currentScore: number) => {
    const state = stateRef.current;
    if (state.boss) return;
    if (state.bossCooldown > 0) return;

    let idx = -1;
    for (let i = WAVE_TABLE.length - 1; i >= 0; i--) {
      if (currentScore >= WAVE_TABLE[i].score) { idx = i; break; }
    }
    if (idx < 0) return;
    const wave = WAVE_TABLE[idx];
    if (idx <= state.lastWaveSpawned) return;

    state.lastWaveSpawned = idx;
    state.boss = {
      x: 130, y: -80, hp: wave.bossHp, maxHp: wave.bossHp,
      speed: 1, alive: true, type: wave.boss,
      attackTimer: 0, phase: 0,
    };
    setBossHp(wave.bossHp);
    setWaveAnnounce(wave.name);
    setTimeout(() => setWaveAnnounce(""), 2500);
  };

  const cycleWeaponType = () => {
    const types: WeaponType[] = ["spread", "laser", "wave"];
    const idx = types.indexOf(stateRef.current.weaponType);
    const next = types[(idx + 1) % types.length];
    stateRef.current.weaponType = next;
    setWeaponType(next);
  };

  // ─—— DRAWING ────

  const playerTiltRef = { current: 0 };

  function drawPlayerShip(
    ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number,
  ) {
    const cx = x + 14, cy = y + 12;
    const f = stateRef.current.frameCount;
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(-cx, -cy);

    // thrust flame
    ctx.globalAlpha = 0.7 + Math.sin(f * 0.2) * 0.3;
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x + P, y + 6 * P, 2 * P, 3 * P + Math.sin(f * 0.15) * 2);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x + P + 2, y + 8 * P, P, P + Math.sin(f * 0.15) * 1);
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x + 3 * P, y + 6 * P, 2 * P, 3 * P + Math.sin(f * 0.15 + 1) * 2);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x + 3 * P + 2, y + 8 * P, P, P + Math.sin(f * 0.15 + 1) * 1);
    ctx.globalAlpha = 1;

    // main hull (bright cyan/teal - hero color)
    drawSprite(ctx, PLAYER, { x: "#0d9488", a: "#14b8a6" }, x, y, P);
    // inner glow
    ctx.globalAlpha = 0.15;
    drawSprite(ctx, PLAYER, { x: "#99f6e4", a: "#5eead4" }, x - 1, y - 1, P);
    ctx.globalAlpha = 1;
    // wings (gold accents - commander)
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
    switch (m.type) {
      case "fighter":
        // grunt - red/orange aggressive
        drawSprite(ctx, FIGHTER, {
          x: flash ? "#f97316" : "#dc2626",
          a: flash ? "#fdba74" : "#ef4444",
        }, x, y, P);
        ctx.fillStyle = "#450a0a";
        ctx.fillRect(x + P, y + 2 * P, P, 2 * P);
        ctx.fillRect(x + 4 * P, y + 2 * P, P, 2 * P);
        // red glow
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath(); ctx.arc(x + 12, y + 10, 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case "bomber":
        // heavy - purple/dark, menacing
        drawSprite(ctx, BOMBER, {
          x: flash ? "#c084fc" : "#7c3aed",
          a: flash ? "#e9d5ff" : "#a855f7",
        }, x, y, P);
        ctx.fillStyle = "#2e1065";
        ctx.fillRect(x + 2 * P, y + 2 * P, P, P);
        ctx.fillRect(x + 4 * P, y + 2 * P, P, P);
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = "#a855f7";
        ctx.beginPath(); ctx.arc(x + 14, y + 10, 14, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case "interceptor":
        // fast - bright pink, sharp
        drawSprite(ctx, INTERCEPTOR, {
          x: flash ? "#fb923c" : "#ec4899",
          a: flash ? "#fed7aa" : "#f472b6",
        }, x, y, P);
        ctx.fillStyle = "#500724";
        ctx.fillRect(x + 2 * P, y + P, P, P);
        ctx.fillRect(x + 3 * P, y + P, P, P);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#ec4899";
        ctx.beginPath(); ctx.arc(x + 12, y + 12, 11, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
    }
  }

  function drawBossShip(
    ctx: CanvasRenderingContext2D, x: number, y: number,
    hp: number, maxHp: number, type: BossType,
  ) {
    const flash = stateRef.current.frameCount % 10 < 5;
    const f = stateRef.current.frameCount;

    // boss aura
    ctx.globalAlpha = 0.08;
    const auraColor = type === "fortress" ? "#ef4444" : type === "carrier" ? "#a855f7" : "#22d3ee";
    ctx.fillStyle = auraColor;
    ctx.beginPath(); ctx.arc(x + 22, y + 18, 38 + Math.sin(f * 0.04) * 4, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    if (type === "fortress") {
      // fiery red/gold - heavy warm
      drawSprite(ctx, BOSS_FORTRESS,
        { x: flash ? "#ef4444" : "#b91c1c", a: flash ? "#fca5a5" : "#7f1d1d" }, x, y, P);
      // reactor glow
      ctx.globalAlpha = 0.6 + Math.sin(f * 0.1) * 0.4;
      ctx.fillStyle = "#facc15";
      ctx.fillRect(x + 6 * P, y + 2 * P, P, P);
      ctx.fillRect(x + 15 * P, y + 2 * P, P, P);
      ctx.fillRect(x + 6 * P, y + 6 * P, P, P);
      ctx.fillRect(x + 15 * P, y + 6 * P, P, P);
      ctx.globalAlpha = 1;
    } else if (type === "carrier") {
      // dark purple with bright gold highlights
      drawSprite(ctx, BOSS_CARRIER,
        { x: flash ? "#c084fc" : "#6b21a8", a: flash ? "#e9d5ff" : "#581c87" }, x, y, P);
      // hangar lights
      ctx.fillStyle = flash ? "#fef08a" : "#eab308";
      ctx.fillRect(x + 5 * P, y + 4 * P, P, P);
      ctx.fillRect(x + 7 * P, y + 4 * P, P, P);
      ctx.fillRect(x + 9 * P, y + 4 * P, P, P);
    } else {
      // eye - cold cyan/blue, alien
      drawSprite(ctx, BOSS_EYE_SPRITE,
        { x: flash ? "#67e8f9" : "#0891b2", a: flash ? "#cffafe" : "#0e7490" }, x, y, P);
      // pulsing eye core
      const pulse = Math.sin(f * 0.08) * 0.3 + 0.7;
      ctx.globalAlpha = pulse;
      drawSprite(ctx, BOSS_EYE_CORE,
        { x: "#fef08a", a: "#facc15" }, x + 4 * P, y + 4 * P, P);
      ctx.globalAlpha = 1;
      // pupil lasers
      ctx.fillStyle = "#ef4444";
      const pupilOff = Math.sin(f * 0.06) * 2;
      ctx.fillRect(x + 6 * P, y + 5 * P + pupilOff, 2 * P, P);
      ctx.fillRect(x + 6 * P, y + 2 * P + pupilOff, 2 * P, P);
    }

    const barW = type === "fortress" ? 22 * P : 12 * P;
    const bp = type === "fortress" ? x : x + 2 * P;
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(bp, y - P, barW, 4);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(bp, y - P, barW * (hp / maxHp), 4);
    ctx.fillStyle = "#86efac";
    ctx.fillRect(bp, y - P, barW * (hp / maxHp), 2);
  }

  function drawCoinItem(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const f = stateRef.current.frameCount;
    const pulse = Math.sin(f * 0.08) * 0.2 + 1;
    const sparkle = Math.sin(f * 0.12 + x) > 0.8;
    ctx.save();
    ctx.translate(x + 2 * P, y + 2 * P);
    ctx.scale(pulse, 1);
    drawSprite(ctx, COIN_SPRITE, { x: "#eab308", a: "#fef08a" }, -2 * P, -2 * P, P);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(-1, -4, 2, 2);
    ctx.restore();
    if (sparkle) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x + 2, y - 2, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const f = stateRef.current.frameCount;
    const cx = x + 14, cy = y + 12;
    const pulse = 0.7 + Math.sin(f * 0.06) * 0.3;

    ctx.globalAlpha = 0.12 * pulse;
    const og = ctx.createRadialGradient(cx, cy, 20, cx, cy, 38);
    og.addColorStop(0, "rgba(56,189,248,0)");
    og.addColorStop(0.5, "rgba(56,189,248,0.3)");
    og.addColorStop(1, "rgba(56,189,248,0)");
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = 0.35 * pulse;
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 22 + Math.sin(f * 0.05) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.2 * pulse;
    ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, 30 + Math.sin(f * 0.05 + 1) * 2, 0, Math.PI * 2); ctx.stroke();

    const hexR = 26;
    for (let i = 0; i < 8; i++) {
      const angle = f * 0.025 + (Math.PI * 2 * i) / 8 + Math.sin(f * 0.015 + i) * 0.3;
      const px = cx + Math.cos(angle) * hexR;
      const py = cy + Math.sin(angle) * hexR;
      const pa = 0.3 + Math.sin(f * 0.08 + i * 2) * 0.2;
      ctx.globalAlpha = pa * pulse;
      const dg = ctx.createRadialGradient(px, py, 0, px, py, 5);
      dg.addColorStop(0, "#e0f2fe"); dg.addColorStop(0.3, "#7dd3fc");
      dg.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = dg;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.7 * pulse;
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 0.15 * pulse;
    for (let i = 0; i < 3; i++) {
      const startA = f * 0.02 + (Math.PI * 2 * i) / 3;
      const endA = startA + Math.PI * 0.6;
      ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 16, startA, endA); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawMissileSprite(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = "#f97316";
    ctx.fillRect(x, y, 3, 8);
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(x, y, 3, 3);
    if (stateRef.current.frameCount % 4 < 2) {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x, y + 8, 3, 4);
    }
  }

  function drawWeaponIndicator(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x, y, 16, 10);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "7px monospace";
    ctx.fillText(WEAPON_ICONS[stateRef.current.weaponType], x + 2, y + 8);
  }

  function drawLevelIndicator(ctx: CanvasRenderingContext2D, waveIdx: number) {
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(2, CH - 14, 60, 12);
    ctx.fillStyle = "#facc15";
    ctx.font = "7px monospace";
    ctx.fillText(`WAVE ${waveIdx + 1}`, 4, CH - 4);
    ctx.fillStyle = "#475569";
    ctx.fillText(`${WAVE_TABLE[waveIdx]?.name ?? ""}`, 38, CH - 4);
  }

  // ─── GAME LOOP ───

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    stateRef.current.weaponLevel = weaponLevel;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { togglePause(); return; }
      if (e.key === "q" || e.key === "Q") { cycleWeaponType(); return; }
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

    const handleTouchMove = (e: TouchEvent) => {
      if (isGameOver || isPaused) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = ((touch.clientX - rect.left) / rect.width) * CW - 15;
      const y = ((touch.clientY - rect.top) / rect.height) * CH - 15;
      stateRef.current.player.x = Math.max(0, Math.min(CW - 24, x));
      stateRef.current.player.y = Math.max(0, Math.min(CH - 32, y));
    };
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });

    let animId: number;

    const loop = () => {
      const state = stateRef.current;
      state.frameCount++;
      const f = state.frameCount;

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

      if (state.bossCooldown > 0) {
        state.bossCooldown--;
        // clear all monsters during cooldown for a clean break
        if (state.bossCooldown === 60) state.monsters.releaseAll();
      }

      bgOffsetRef.current = (bgOffsetRef.current + 1) % 40;

      state.stars.forEach((s) => {
        s.y += s.speed;
        if (s.y > CH) { s.y = -2; s.x = Math.random() * CW; }
      });

      if (!isPaused && !isGameOver && !showGacha) {
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
          // 1st wingman: lower-left
          const wm1x = p.x - 6, wm1y = p.y + 20;
          const b1 = state.bullets.get();
          b1.x = wm1x; b1.y = wm1y; b1.vx = 0; b1.vy = -7; b1.type = "player"; b1.wtype = wt; b1.wingman = true;
          const b2 = state.bullets.get();
          b2.x = wm1x + 4; b2.y = wm1y; b2.vx = 0; b2.vy = -7; b2.type = "player"; b2.wtype = wt; b2.wingman = true;
          // 2nd wingman: lower-right
          const wm2x = p.x + 30, wm2y = p.y + 20;
          const b3 = state.bullets.get();
          b3.x = wm2x; b3.y = wm2y; b3.vx = 0; b3.vy = -7; b3.type = "player"; b3.wtype = wt; b3.wingman = true;
          const b4 = state.bullets.get();
          b4.x = wm2x + 4; b4.y = wm2y; b4.vx = 0; b4.vy = -7; b4.type = "player"; b4.wtype = wt; b4.wingman = true;
          if (state.wingmanCount >= 2) {
            // 2nd pair closer to center, tighter spread
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

        // ── formations ──
        state.formationTimer++;
        const formInterval = Math.max(300, 480 - Math.floor(state.score / 100));
        if (state.formationTimer >= formInterval && !state.boss && state.bossCooldown <= 0) {
          state.formationTimer = 0;
          const pattern = Math.floor(Math.random() * 3);
          state.formationGroupCounter++;
          const gid = state.formationGroupCounter;
          if (pattern === 0) {
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(-40 - i * 20, -20 + i * 30, "fighter", 2, 0);
              m.formation = true; m.vx = 1.2 + i * 0.2; m.vy = 1.0; m.formationGroup = gid;
            }
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(CW + 40 + i * 20, -20 + i * 30, "fighter", 2, 0);
              m.formation = true; m.vx = -(1.2 + i * 0.2); m.vy = 1.0; m.formationGroup = gid;
            }
          } else if (pattern === 1) {
            for (let i = 0; i < 5; i++) {
              const m = spawnMonster(-30, 50 + i * 24, i % 2 === 0 ? "fighter" : "bomber", i % 2 === 0 ? 2 : 4, 0);
              m.formation = true; m.vx = 1.5; m.vy = -0.5 + i * 0.2; m.formationGroup = gid;
            }
          } else {
            for (let i = 0; i < 5; i++) {
              const m = spawnMonster(40 + i * 60, -20 - i * 18, "fighter", 2, 0);
              m.formation = true; m.vx = (i - 2) * 0.3; m.vy = 1.8; m.formationGroup = gid;
            }
          }
        }

        // ── formation movement ──
        for (const m of state.monsters.getActive()) {
          if (m.formation) {
            m.vx *= 0.98; m.vy += 0.02; m.x += m.vx; m.y += m.vy;
            if (m.y > 80 && m.x > 20 && m.x < CW - 20) {
              m.formation = false; m.speed = 1 + Math.random();
            }
          } else {
            if (m.vy === 0 && m.vx === 0) m.vy = m.speed;
            m.x += m.vx; m.y += m.vy;
          }
        }

        // ── wave spawn ──
        const waveGap = Math.max(100, 240 - Math.floor(state.score / 80));
        if (f % waveGap === 0 && !state.boss && state.bossCooldown <= 0) {
          const waveSize = 2 + Math.floor(state.score / 600);
          let wt: Monster["type"] = "fighter";
          const r = Math.random();
          if (state.score > 400 && r < 0.35) wt = "interceptor";
          else if (state.score > 200 && r < 0.5) wt = "bomber";
          const hp = wt === "interceptor" ? 5 : wt === "bomber" ? 4 : 2;
          const sp = wt === "interceptor" ? 24 : wt === "bomber" ? 20 : 16;
          const spread = sp + waveSize * 4;
          for (let i = 0; i < waveSize; i++) {
            const offset = waveSize > 1 ? (i / (waveSize - 1) - 0.5) * spread : 0;
            const m = spawnMonster(
              Math.max(4, Math.min(CW - 36, CW / 2 - 12 + offset)),
              -16 - i * 12, wt, hp, 0.6 + Math.random() * 0.6,
            );
            m.vy = 0.8 + Math.random() * 0.8; m.vx = (Math.random() - 0.5) * 0.3;
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
              // spread shot
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
              // release fighters
              if (f % 120 === 0 && state.monsters.getActive().length < 12) {
                for (let i = 0; i < 2; i++) {
                  const m = spawnMonster(
                    b.x + 10 + i * 20, b.y + 28, "fighter", 1, 0,
                  );
                  m.vy = 1.5 + Math.random(); m.vx = (Math.random() - 0.5) * 0.5;
                }
              }
              if (f % 50 === 0) {
                spawnEnemyBullet(b.x + 8, b.y + 36, 0, 3);
                spawnEnemyBullet(b.x + 32, b.y + 36, 0, 3);
              }
            } else {
              // eye
              if (b.y < 50) { b.y += b.speed; }
              else { b.x += Math.sin(f * 0.04) * 3; b.x = Math.max(0, Math.min(CW - 48, b.x)); }
              // laser beam
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
              // phase 2 below 50% hp
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
            const mw = m.type === "bomber" ? 28 : 24;
            const mh = m.type === "interceptor" ? 24 : 20;
            if (b.x > m.x && b.x < m.x + mw && b.y > m.y && b.y < m.y + mh) {
              m.hp--;
              state.bullets.release(b);
              emitExplosion(b.x, b.y, 3, ["#fbbf24"], 3);
              if (m.hp <= 0) {
                const isDouble = state.doubleCoinTimer > 0;
                const base = m.type === "interceptor" ? 3 : m.type === "bomber" ? 2 : 1;
                spawnCoin(m.x + 8, m.y + 4, isDouble ? base * 2 : base);
                emitExplosion(m.x + 8, m.y + 8, 10, ["#ef4444", "#f97316"], 6);
                state.monsters.release(m);
                setScore((prev) => { const n = prev + 100; state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
              }
              break;
            }
          }
        }

        // ── missile vs monster ──
        for (const ms of state.missiles.getActive()) {
          for (const m of state.monsters.getActive()) {
            const mw = m.type === "bomber" ? 28 : 24;
            const mh = m.type === "interceptor" ? 24 : 20;
            if (ms.x > m.x && ms.x < m.x + mw && ms.y > m.y && ms.y < m.y + mh) {
              m.hp -= 3;
              state.missiles.release(ms);
              emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
              if (m.hp <= 0) {
                const isDouble = state.doubleCoinTimer > 0;
                const base = m.type === "interceptor" ? 3 : m.type === "bomber" ? 2 : 1;
                spawnCoin(m.x + 8, m.y + 4, isDouble ? base * 2 : base);
                emitExplosion(m.x + 8, m.y + 8, 10, ["#ef4444", "#f97316"], 6);
                state.monsters.release(m);
                setScore((prev) => { const n = prev + 100; state.score = n; return n; });
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
                const isDouble = state.doubleCoinTimer > 0;
                spawnCoin(b.x + 18, b.y + 10, isDouble ? 20 : 10);
                setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0);
                b.alive = false;
                state.boss = null;
                state.bossCooldown = 180;
                state.shakeX = 14; state.shakeY = 14;
              } else setBossHp(b.hp);
              break;
            }
          }
          for (const ms of state.missiles.getActive()) {
            const bw = b.type === "fortress" ? 52 : 48;
            const bh = b.type === "fortress" ? 36 : 36;
            if (ms.x > b.x && ms.x < b.x + bw && ms.y > b.y && ms.y < b.y + bh) {
              b.hp -= 3;
              state.missiles.release(ms);
              emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
              if (b.hp <= 0) {
                emitExplosion(b.x + 22, b.y + 16, 50, ["#f97316", "#ef4444", "#fef08a", "#fff"], 8);
                const isDouble = state.doubleCoinTimer > 0;
                spawnCoin(b.x + 18, b.y + 10, isDouble ? 20 : 10);
                setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0); b.alive = false; state.boss = null;
                state.bossCooldown = 180;
                state.shakeX = 14; state.shakeY = 14;
              } else setBossHp(b.hp);
              break;
            }
          }
        }

        // ── collect coins ──
        for (const c of state.coins.getActive()) {
          const px = state.player.x;
          const py = state.player.y;
          if (c.x > px - 4 && c.x < px + 32 && c.y > py - 4 && c.y < py + 32) {
            state.wallet += c.value;
            state.coins.release(c);
            emitExplosion(c.x, c.y, 4, ["#eab308"], 3);
            setCoins(state.wallet);
            if (!state.gachaLocked && state.wallet >= state.gachaCost) {
              state.gachaLocked = true;
              state.wallet -= state.gachaCost;
              setCoins(state.wallet);
              const cards = generateGachaOptions();
              setGachaCards(cards);
              setShowGacha(true);
            }
          }
        }

        // ── player hit ──
        if (!state.invincible) {
          const px = p.x + 10;
          const py = p.y + 10;
          const hitMonster = state.monsters.getActive().some((m) => {
            const mw = m.type === "bomber" ? 28 : 24;
            const mh = m.type === "interceptor" ? 24 : 20;
            return m.x < px + 8 && m.x + mw > px && m.y < py + 10 && m.y + mh > py;
          });
          const hitBullet = state.enemyBullets.getActive().some(
            (b) => b.x > p.x - 2 && b.x < p.x + 26 && b.y > p.y - 2 && b.y < p.y + 28,
          );
          const hitBoss = state.boss &&
            state.boss.x < p.x + 24 && state.boss.x + 44 > p.x &&
            state.boss.y < p.y + 28 && state.boss.y + 32 > p.y + 4;
          if (hitMonster || hitBullet || hitBoss) {
            emitExplosion(p.x + 12, p.y + 14, 15, ["#60a5fa", "#93c5fd"], 8);
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

      // nebula clouds (deep space feel)
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#3b0764";
      ctx.beginPath(); ctx.arc(200, 150 + Math.sin(f * 0.005) * 30, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1e3a5f";
      ctx.beginPath(); ctx.arc(100, 400 + Math.sin(f * 0.007 + 1) * 40, 100, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#4a044e";
      ctx.beginPath(); ctx.arc(300, 300 + Math.sin(f * 0.006 + 2) * 50, 90, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // animated grid (scrolling)
      const go = bgOffsetRef.current;
      ctx.strokeStyle = "rgba(56,189,248,0.04)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < CW; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
      }
      for (let gy = -go; gy < CH; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
      }
      ctx.strokeStyle = `rgba(56,189,248,${0.06 + Math.sin(f * 0.03) * 0.03})`;
      ctx.beginPath();
      ctx.moveTo(0, CH - go); ctx.lineTo(CW, CH - go);
      ctx.stroke();

      // stars
      state.stars.forEach((s) => {
        ctx.globalAlpha = s.brightness;
        ctx.fillStyle = "#fff";
        ctx.fillRect(s.x, s.y, s.size, s.size);
        if (s.size > 1 && s.brightness > 0.6) {
          ctx.globalAlpha = s.brightness * 0.2;
          ctx.fillRect(s.x - 1, s.y - 1, 4, 4);
        }
      });
      ctx.globalAlpha = 1;

      // particles
      for (const pt of state.particles.getActive()) {
        ctx.globalAlpha = Math.max(0, pt.alpha);
        ctx.fillStyle = pt.color;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size / 2, 0, Math.PI * 2); ctx.fill();
        const pg = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size * 1.5);
        const expandHex = (c: string) =>
          c.length === 4 ? "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
        pg.addColorStop(0, expandHex(pt.color) + "40");
        pg.addColorStop(1, expandHex(pt.color) + "00");
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * 1.5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // enemy bullets (glowing + irregular shapes)
      for (const b of state.enemyBullets.getActive()) {
        const flicker = Math.sin(f * 0.2 + b.x) * 0.3 + 0.7;
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 12);
        glow.addColorStop(0, `rgba(251,113,133,${0.5 * flicker})`);
        glow.addColorStop(0.4, `rgba(251,113,133,${0.2 * flicker})`);
        glow.addColorStop(1, "rgba(251,113,133,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();

        // diamond-chevron shape (irregular)
        ctx.save();
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
        // bright core
        ctx.globalAlpha = 0.8 * flicker;
        ctx.fillStyle = "#fecdd3";
        ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }

      // player bullets
      for (const b of state.bullets.getActive()) {
        if (b.wingman) {
          // wingman bullets: bright orange-gold diamond tips
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
          ctx.globalAlpha = 1;
        } else if (b.wtype === "laser") {
          const len = 14;
          const lg = ctx.createRadialGradient(b.x, b.y - len / 2, 0, b.x, b.y - len / 2, 6);
          lg.addColorStop(0, "rgba(34,211,238,0.4)");
          lg.addColorStop(1, "rgba(34,211,238,0)");
          ctx.fillStyle = lg;
          ctx.fillRect(b.x - 4, b.y - len, 8, len + 4);
          ctx.fillStyle = "#22d3ee";
          ctx.fillRect(b.x - 1, b.y - len, 2, len);
          ctx.fillStyle = "#e0f2fe";
          ctx.fillRect(b.x - 0.5, b.y - len, 1, len);
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(b.x, b.y - len, 2, 0, Math.PI * 2); ctx.fill();
        } else if (b.wtype === "wave") {
          const pulseR = 5 + Math.sin(stateRef.current.frameCount * 0.15) * 1;
          const wg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, pulseR + 3);
          wg.addColorStop(0, "rgba(74,222,128,0.5)");
          wg.addColorStop(1, "rgba(74,222,128,0)");
          ctx.fillStyle = wg;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR + 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#4ade80"; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(b.x, b.y, pulseR, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = "#bbf7d0";
          ctx.beginPath(); ctx.arc(b.x, b.y, 1.5, 0, Math.PI * 2); ctx.fill();
        } else {
          const sg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 5);
          sg.addColorStop(0, "rgba(251,191,36,0.4)");
          sg.addColorStop(1, "rgba(251,191,36,0)");
          ctx.fillStyle = sg;
          ctx.fillRect(b.x - 5, b.y - 5, 10, 10);
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = "#fef08a";
          ctx.beginPath(); ctx.arc(b.x, b.y, 1, 0, Math.PI * 2); ctx.fill();
        }
      }

      // missiles
      for (const ms of state.missiles.getActive()) {
        drawMissileSprite(ctx, ms.x, ms.y);
      }

      // player
      if (!isGameOver) {
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

          // wingman dots
          if (state.wingmanCount > 0) {
            const wmCount = state.wingmanCount;
            const flicker = 0.7 + Math.sin(f * 0.15) * 0.3;
            // left wingman
            const lx = sp.x - 10, ly = sp.y + 6;
            ctx.globalAlpha = flicker;
            ctx.fillStyle = "#0d9488";
            ctx.beginPath(); ctx.arc(lx, ly, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#5eead4";
            ctx.beginPath(); ctx.arc(lx, ly, 1.5, 0, Math.PI * 2); ctx.fill();
            // right wingman
            const rx = sp.x + 32, ry = sp.y + 6;
            ctx.fillStyle = "#0d9488";
            ctx.beginPath(); ctx.arc(rx, ry, 3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#5eead4";
            ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, Math.PI * 2); ctx.fill();
            // second pair
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

            // wingman connecting beams
            ctx.strokeStyle = `rgba(13,148,136,${0.1 + Math.sin(f * 0.1) * 0.05})`;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.beginPath(); ctx.moveTo(sp.x, sp.y + 8); ctx.lineTo(lx, ly); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sp.x + 24, sp.y + 8); ctx.lineTo(rx, ry); ctx.stroke();
            ctx.setLineDash([]);
          }

          if (state.overdriveTimer > 0) {
            ctx.globalAlpha = 0.4 + Math.sin(f * 0.15) * 0.2;
            const eg = ctx.createRadialGradient(sp.x + 12, sp.y + 24, 0, sp.x + 12, sp.y + 24, 14);
            eg.addColorStop(0, "#f97316");
            eg.addColorStop(1, "rgba(249,115,22,0)");
            ctx.fillStyle = eg;
            ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 24, 14, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
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
        ctx.globalAlpha = 0.1;
        const bg = ctx.createRadialGradient(state.boss.x + 22, state.boss.y + 16, 0, state.boss.x + 22, state.boss.y + 16, 50);
        bg.addColorStop(0, "#ef4444");
        bg.addColorStop(1, "rgba(239,68,68,0)");
        ctx.fillStyle = bg;
        ctx.beginPath(); ctx.arc(state.boss.x + 22, state.boss.y + 16, 50, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // coins
      for (const c of state.coins.getActive()) {
        const floatY = Math.sin(f * 0.06 + c.x) * 2;
        drawCoinItem(ctx, c.x, c.y + floatY);
      }

      // power-ups
      for (const pu of state.powerUps.getActive()) {
        const pcx = pu.x + 6, pcy = pu.y + 6;
        const pulse = Math.sin(f * 0.1) * 0.3 + 0.7;
        ctx.globalAlpha = 0.25 * pulse;
        ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, 14 + Math.sin(f * 0.08) * 3, 0, Math.PI * 2); ctx.stroke();
        const pg = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, 10);
        pg.addColorStop(0, "rgba(125,211,252,0.9)");
        pg.addColorStop(0.5, "rgba(56,189,248,0.6)");
        pg.addColorStop(1, "rgba(56,189,248,0)");
        ctx.globalAlpha = pulse;
        ctx.fillStyle = pg;
        ctx.beginPath(); ctx.arc(pcx, pcy, 10, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = "#e0f2fe";
        ctx.beginPath(); ctx.arc(pcx, pcy, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(pcx, pcy, 1.5, 0, Math.PI * 2); ctx.fill();
        for (let i = 0; i < 3; i++) {
          const da = f * 0.06 + (Math.PI * 2 * i) / 3;
          ctx.globalAlpha = 0.6 * pulse;
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(pcx + Math.cos(da) * 7, pcy + Math.sin(da) * 7, 1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // weapon type indicator
      drawWeaponIndicator(ctx, CW / 2 - 8, 2);

      // wave/level indicator
      const currentWave = state.lastWaveSpawned < 0 ? 0 : state.lastWaveSpawned;
      drawLevelIndicator(ctx, currentWave);

      ctx.restore();

      if (!isGameOver) animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [
    isGameOver, weaponLevel, weaponType,
    bombCount, lives, isPaused, showGacha, hasHoming, wingmanCount,
  ]);

  // check boss spawn
  useEffect(() => {
    if (!isGameOver) checkSpawnBoss(score);
  }, [score, isGameOver]);

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

  // refs for latest values in save effect
  const scoreRef = useRef(0);
  const coinsRef = useRef(0);
  scoreRef.current = score;
  coinsRef.current = coins;

  const restartGame = () => {
    const state = stateRef.current;
    state.monsters.releaseAll();
    state.bullets.releaseAll();
    state.enemyBullets.releaseAll();
    state.coins.releaseAll();
    state.particles.releaseAll();
    state.missiles.releaseAll();
    state.powerUps.releaseAll();
    state.boss = null;
    state.player = { x: 180, y: 460, speed: 5 };
    state.invincible = false; state.invincibleTimer = 0;
    state.shakeX = 0; state.shakeY = 0;
    state.score = 0; state.wallet = 0;
    state.doubleCoinTimer = 0; state.hasHoming = false;
    state.formationTimer = 0; state.gachaLocked = false;
    state.gachaCost = 10; state.formationGroupCounter = 0;
    state.overdriveTimer = 0; state.lastWaveSpawned = -1;
    state.bossCooldown = 0; state.wingmanCount = 0;
    bgOffsetRef.current = 0;
    setIsPaused(false); setShowGacha(false);
    setScore(0); setWeaponLevel(1); setWeaponType("spread");
    setBombCount(3); setLives(3); setIsGameOver(false);
    setInvincible(false); setBossHp(0); setCoins(0);
    setDoubleCoinTimer(0); setMissileCount(0); setHasHoming(false);
    setGachaCost(10); setOverdriveTimer(0); setWaveAnnounce("");
    setWingmanCount(0);
  };

  const formatScore = (n: number) => n.toString().padStart(6, "0");

  return (
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Arcade Game</p>
          <h1 className="text-2xl font-black text-[#725d42]">雷电战机</h1>
          <p className="text-sm text-[#9f927d]">
            3 种武器切换 | 编队敌机 | 追踪导弹 | 抽卡升级 | 多种Boss
          </p>
        </header>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              href="/game"
              className="inline-flex items-center gap-1 text-sm text-[#9f927d] hover:text-[#725d42] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> 返回
            </Link>
            <span className="text-sm text-[#9f927d]">|</span>
            <p className="text-sm text-[#725d42]">
              得分:{" "}
              <span className="font-black text-amber-500">
                {formatScore(score)}
              </span>
            </p>
            <Trophy className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs font-bold text-yellow-600">{formatScore(highScore)}</span>
          </div>
          <button
            onClick={cycleWeaponType}
            className="text-[10px] bg-[#fffdf5] border border-[#e8ddd0] rounded-lg px-2 py-1 text-[#725d42] hover:bg-white transition-colors"
          >
            {WEAPON_ICONS[weaponType]} {WEAPON_NAMES[weaponType]} (Q)
          </button>
        </div>

        <div className="flex justify-center">
          <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-[#c4b89e]">
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className="block touch-none cursor-crosshair"
              style={{ imageRendering: "pixelated" }}
            />

            {/* HUD */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: lives }).map((_, i) => (
                  <Heart key={i} className="w-3 h-3 text-rose-400 drop-shadow-lg" fill="#e11d48" />
                ))}
              </div>
              <div className="flex items-center gap-0.5 ml-1">
                <Coins className="w-3 h-3 text-yellow-400" />
                <span className="text-[10px] font-bold text-yellow-300">{coins}</span>
              </div>
              {invincible && (
                <span className="text-[8px] text-yellow-300 font-bold ml-0.5 animate-pulse">无敌</span>
              )}
              {doubleCoinTimer > 0 && (
                <span className="text-[8px] text-orange-300 font-bold ml-0.5">×2</span>
              )}
              {overdriveTimer > 0 && (
                <span className="text-[8px] text-orange-400 font-bold ml-0.5 animate-pulse">MAX</span>
              )}
              {stateRef.current.boss && (
                <span className="text-[8px] text-red-400 font-bold ml-1 animate-pulse">BOSS</span>
              )}
            </div>

            {/* wave announcement */}
            {waveAnnounce && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/70 rounded-2xl px-6 py-3 animate-pulse">
                  <p className="text-lg font-black text-yellow-400 tracking-wider">{waveAnnounce}</p>
                </div>
              </div>
            )}

            {stateRef.current.boss && bossHp > 0 && (
              <div className="absolute top-2 right-10 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
                <Skull className="w-3 h-3 text-red-400" />
                <div className="w-16 h-1.5 bg-black/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-200"
                    style={{ width: `${(bossHp / 50) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={togglePause}
              className="absolute top-2 right-2 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-lg w-6 h-6 active:scale-90 transition-all"
            >
              {isPaused ? <Play className="w-3.5 h-3.5 text-white" /> : <Pause className="w-3.5 h-3.5 text-white" />}
            </button>

            <button
              onClick={triggerBomb}
              disabled={bombCount <= 0 || isGameOver || isPaused}
              className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-rose-500/40 rounded-lg px-2 py-1 active:scale-90 transition-all disabled:opacity-30 disabled:scale-100"
            >
              <Bomb className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] font-bold text-rose-300">{bombCount}</span>
            </button>

            {isPaused && !showGacha && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center cursor-pointer" onClick={togglePause}>
                <Play className="w-12 h-12 text-white/80 mb-3" />
                <p className="text-white/90 text-sm font-bold tracking-wider">已暂停</p>
                <p className="text-white/50 text-[10px] mt-1">点击继续或按 ESC</p>
              </div>
            )}

            {isGameOver && (
              <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
                <div className="text-5xl mb-3 opacity-80">{String.fromCharCode(9760)}</div>
                <h2 className="text-xl font-black text-rose-500 tracking-wider mb-1">战机被击落</h2>
                <p className="text-xs text-slate-400 mb-1">
                  最终得分:{" "}
                  <span className="text-amber-400 font-bold text-base">{formatScore(score)}</span>
                </p>
                <p className="text-[10px] text-slate-500 mb-5">
                  最高纪录: {formatScore(highScore)}
                </p>
                <button
                  onClick={restartGame}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 font-bold rounded-lg shadow-lg active:scale-95 transition-all text-sm tracking-wider text-white"
                >
                  重新出动
                </button>
              </div>
            )}

            {showGacha && (
              <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-4 z-10">
                <div className="flex items-center gap-1.5 mb-3">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-black text-yellow-400 tracking-wider">抽卡</span>
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-[10px] text-slate-400 mb-3">选择一张卡牌获得效果</p>
                <div className="flex gap-2 max-w-full">
                  {gachaCards.map((card, i) => (
                    <button
                      key={i}
                      onClick={() => applyCardEffect(card)}
                      className="group relative flex flex-col items-center gap-1 bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-600 hover:border-yellow-500/80 rounded-xl p-3 w-24 transition-all hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-yellow-500/20"
                    >
                      <span className={`text-2xl ${card.rarity === "SSR" ? "group-hover:scale-110 transition-transform" : ""}`}>{card.icon}</span>
                      <span className="text-[10px] font-bold text-white leading-tight text-center">{card.name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${card.rarity === "SSR" ? "bg-yellow-500/20 text-yellow-400" : "bg-blue-500/20 text-blue-400"}`}>{card.rarity}</span>
                      <span className="text-[7px] text-slate-500 text-center">{card.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <Zap className={`w-4 h-4 ${weaponLevel >= 4 ? "text-orange-400" : "text-[#9f927d]"}`} />
            <p className="text-[9px] text-[#9f927d] leading-tight">火力</p>
            <p className={`text-sm font-bold leading-tight ${weaponLevel >= 4 ? "text-orange-500" : "text-[#725d42]"}`}>
              {weaponLevel >= 4 ? `MAX ${overdriveTimer > 0 ? Math.ceil(overdriveTimer / 60) + "s" : ""}` : `LV.${weaponLevel}`}
            </p>
          </div>
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <span className="text-sm">{WEAPON_ICONS[weaponType]}</span>
            <p className="text-[9px] text-[#9f927d] leading-tight">武器</p>
            <p className="text-[10px] font-bold text-[#725d42] leading-tight">{WEAPON_NAMES[weaponType]}</p>
          </div>
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <Heart className="w-4 h-4 text-rose-500" fill="#e11d48" />
            <p className="text-[9px] text-[#9f927d] leading-tight">生命</p>
            <p className="text-sm font-bold text-[#725d42] leading-tight">&times;{lives}</p>
          </div>
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <Coins className="w-4 h-4 text-yellow-500" />
            <p className="text-[9px] text-[#9f927d] leading-tight">金币</p>
            <p className="text-sm font-bold text-[#725d42] leading-tight">{coins}/{gachaCost}</p>
          </div>
        </div>

        <p className="text-[9px] text-[#9f927d] text-center max-w-[280px] mx-auto">
          WASD/方向键移动 | Q 切换武器 | Space/B 放炸弹 | 金币抽卡 | ESC暂停
        </p>
      </div>
    </main>
  );
}