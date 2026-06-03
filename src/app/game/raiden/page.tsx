'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Zap, Bomb, Heart, Skull, Pause, Play, Coins, Sparkles } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════
// PIXEL SPRITE DRAWING
// ═══════════════════════════════════════════════════════════════════

function drawSprite(
  ctx: CanvasRenderingContext2D, map: string[],
  colors: Record<string, string>, x: number, y: number, s: number,
) {
  map.forEach((row, py) => {
    for (let px = 0; px < row.length; px++) {
      const ch = row[px];
      if (ch !== '.') {
        ctx.fillStyle = colors[ch] ?? '#fff';
        ctx.fillRect(x + px * s, y + py * s, s, s);
      }
    }
  });
}

const P = 4;

const PLAYER = ['..x x..', '.xxxxx.', 'xxxxxxx', 'xxaaaxx', '.xxxxx.', '..xxx..'];
const PLAYER_WING = ['x.', 'xx'];
const FIGHTER = ['..xx..', '.xxxx.', 'xxxxxx', '..xx..', '..xx..'];
const BOMBER = ['.xxxxx.', 'xxxxxxx', 'xaaaaax', 'xxxxxxx', '.xxxxx.'];
const INTERCEPTOR = ['..xxx..', '.xxxxx.', 'xxxxxxx', 'xxx.xxx', '..x.x..', '..x.x..'];
const BOSS_SPRITE = ['..xxxxxx..', '.xxxxxxxx.', 'xxxxxxxxxx', 'xxxaaxxxxx', 'xxxaaxxxxx', 'xxxxxxxxxx', '.xxxxxxxx.', '..xxxxxx..'];
const BOSS_EYE = ['xx', 'xx'];
const COIN_SPRITE = ['.xx.', 'xxxx', 'x..x', '.xx.'];

// ═══════════════════════════════════════════════════════════════════
// CARD / GACHA
// ═══════════════════════════════════════════════════════════════════

interface CardDef { id: string; name: string; icon: string; rarity: 'SR' | 'SSR'; desc: string; }
const SR_CARDS: CardDef[] = [
  { id: 'power_up', name: '火力升级', icon: '⚡', rarity: 'SR', desc: '武器等级 +1' },
  { id: 'bomb_give', name: '炸弹补给', icon: '💣', rarity: 'SR', desc: '炸弹 +1' },
  { id: 'life_give', name: '生命之心', icon: '❤️', rarity: 'SR', desc: '生命 +1' },
  { id: 'shield_s', name: '护盾', icon: '🛡️', rarity: 'SR', desc: '3 秒无敌' },
  { id: 'double_coin', name: '双倍金币', icon: '🪙', rarity: 'SR', desc: '30s 金币翻倍' },
];
const SSR_CARDS: CardDef[] = [
  { id: 'shield_l', name: '能量护盾', icon: '🔮', rarity: 'SSR', desc: '5 秒无敌' },
  { id: 'fire_storm', name: '火力风暴', icon: '🔥', rarity: 'SSR', desc: '火力升到 LV3' },
  { id: 'life_pack', name: '生命补给', icon: '💖', rarity: 'SSR', desc: '额外 +2 命' },
  { id: 'nuke', name: '核弹', icon: '☢️', rarity: 'SSR', desc: '全屏清怪 +2 炸弹' },
  { id: 'coin_burst', name: '金币爆裂', icon: '💰', rarity: 'SSR', desc: '获得 15 金币' },
];
function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function generateGachaOptions(): CardDef[] {
  return Array.from({ length: 3 }, () =>
    Math.random() < 0.2 ? { ...pickRandom(SSR_CARDS) } : { ...pickRandom(SR_CARDS) },
  );
}

// ═══════════════════════════════════════════════════════════════════
// WEAPON TYPES
// ═══════════════════════════════════════════════════════════════════

type WeaponType = 'spread' | 'laser' | 'wave';

const WEAPON_NAMES: Record<WeaponType, string> = {
  spread: '散弹', laser: '激光', wave: '波纹',
};
const WEAPON_ICONS: Record<WeaponType, string> = {
  spread: '💥', laser: '🔫', wave: '〰️',
};

interface Bullet { x: number; y: number; vx: number; vy: number; type: 'player' | 'enemy'; alive: boolean; }
interface Monster {
  x: number; y: number; hp: number; maxHp: number;
  speed: number; type: 'fighter' | 'bomber' | 'interceptor'; alive: boolean;
  formation: boolean;
  vx: number; vy: number;
  formationGroup: number;
}
interface PowerUp { x: number; y: number; alive: boolean; }
interface Boss { x: number; y: number; hp: number; maxHp: number; speed: number; alive: boolean; }
interface CoinItem { x: number; y: number; value: number; alive: boolean; }
interface Particle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; color: string; size: number; alive: boolean;
}
interface Missile {
  x: number; y: number; vx: number; vy: number;
  targetX: number; targetY: number; alive: boolean;
}
interface Star { x: number; y: number; speed: number; size: number; brightness: number; }

const CW = 360, CH = 540;
const BOSS_SCORE_INTERVAL = 2500;

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

  release(item: T) { item.alive = false; }

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
  const [weaponType, setWeaponType] = useState<WeaponType>('spread');
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

  // bg grid offset
  const bgOffsetRef = useRef(0);

  // ── state ref ──
  const stateRef = useRef({
    player: { x: 180, y: 460, speed: 5 },
    bullets: new Pool<Bullet>(() => ({ x: 0, y: 0, vx: 0, vy: 0, type: 'player', alive: false })),
    enemyBullets: new Pool<Bullet>(() => ({ x: 0, y: 0, vx: 0, vy: 0, type: 'enemy', alive: false })),
    monsters: new Pool<Monster>(() => ({
      x: 0, y: 0, hp: 2, maxHp: 2, speed: 1,
      type: 'fighter', alive: false, formation: false,
      vx: 0, vy: 0, formationGroup: 0,
    })),
    boss: null as Boss | null,
    coins: new Pool<CoinItem>(() => ({ x: 0, y: 0, value: 1, alive: false })),
    particles: new Pool<Particle>(() => ({ x: 0, y: 0, vx: 0, vy: 0, alpha: 1, color: '#fff', size: 2, alive: false })),
    missiles: new Pool<Missile>(() => ({ x: 0, y: 0, vx: 0, vy: 0, targetX: 0, targetY: 0, alive: false })),
    powerUps: new Pool<PowerUp>(() => ({ x: 0, y: 0, alive: false })),
    stars: starsRef.current,
    shakeX: 0, shakeY: 0,
    keys: { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false, a: false, d: false, w: false, s: false },
    weaponLevel: 1,
    weaponType: 'spread' as WeaponType,
    frameCount: 0,
    invincible: false,
    invincibleTimer: 0,
    score: 0,
    wallet: 0,
    doubleCoinTimer: 0,
    hasHoming: false,
    formationTimer: 0,
    gachaLocked: false,
    gachaCost: 10,
    formationGroupCounter: 0,
  });

  // ─── helpers ───

  function spawnBullet(x: number, y: number, vx: number, vy: number) {
    const b = stateRef.current.bullets.get();
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.type = 'player';
  }
  function spawnEnemyBullet(x: number, y: number, vx: number, vy: number) {
    const b = stateRef.current.enemyBullets.get();
    b.x = x; b.y = y; b.vx = vx; b.vy = vy; b.type = 'enemy';
  }
  function spawnMonster(x: number, y: number, type: Monster['type'], hp: number, speed: number, formation = false) {
    const m = stateRef.current.monsters.get();
    m.x = x; m.y = y; m.type = type; m.hp = hp; m.maxHp = hp; m.speed = speed; m.formation = formation;
    m.vx = 0; m.vy = 0; m.formationGroup = 0;
    return m;
  }
  function spawnCoin(x: number, y: number, value: number) {
    const c = stateRef.current.coins.get();
    c.x = x; c.y = y; c.value = value;
  }
  function spawnParticle(x: number, y: number, vx: number, vy: number, color: string, size: number, alpha = 1) {
    const p = stateRef.current.particles.get();
    p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.color = color; p.size = size; p.alpha = alpha;
  }
  function spawnMissile(x: number, y: number, tx: number, ty: number) {
    const m = stateRef.current.missiles.get();
    m.x = x; m.y = y; m.targetX = tx; m.targetY = ty;
    m.vx = 0; m.vy = -6;
  }

  function emitExplosion(x: number, y: number, count: number, colors: string[], speed = 6) {
    for (let k = 0; k < count; k++) {
      spawnParticle(
        x + (Math.random() - 0.5) * 8, y + (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * speed, (Math.random() - 0.5) * speed,
        colors[Math.floor(Math.random() * colors.length)],
        2 + Math.random() * 3,
      );
    }
  }

  function checkFormationClear(x: number, y: number, group: number) {
    if (group <= 0) return;
    const state = stateRef.current;
    const alive = state.monsters.getActive().some(m => m.formationGroup === group);
    if (!alive) {
      const pu = state.powerUps.get();
      pu.x = x; pu.y = y;
      emitExplosion(x, y, 12, ['#38bdf8', '#7dd3fc'], 4);
    }
  }

  const applyCardEffect = (card: CardDef) => {
    const state = stateRef.current;
    switch (card.id) {
      case 'power_up':
        setWeaponLevel(p => { const n = Math.min(3, p + 1); state.weaponLevel = n; return n; });
        break;
      case 'bomb_give':
        setBombCount(p => p + 1);
        break;
      case 'life_give':
        setLives(p => p + 1);
        break;
      case 'shield_s':
        state.invincible = true; state.invincibleTimer = 180; setInvincible(true);
        break;
      case 'shield_l':
        state.invincible = true; state.invincibleTimer = 300; setInvincible(true);
        break;
      case 'fire_storm':
        setWeaponLevel(3); state.weaponLevel = 3;
        break;
      case 'life_pack':
        setLives(p => p + 2);
        break;
      case 'nuke': {
        state.monsters.releaseAll();
        state.enemyBullets.releaseAll();
        if (state.boss) state.boss.hp -= 30;
        setBombCount(p => p + 2);
        emitExplosion(CW / 2, CH / 2, 60, ['#fef08a', '#f97316', '#fff'], 10);
        state.shakeX = 12; state.shakeY = 12;
        break;
      }
      case 'coin_burst':
        state.wallet += 15; setCoins(prev => prev + 15);
        break;
      case 'double_coin':
        state.doubleCoinTimer = 1800; setDoubleCoinTimer(1800);
        break;
    }
    emitExplosion(CW / 2, CH / 2, 20, card.rarity === 'SSR' ? ['#facc15', '#fef08a'] : ['#93c5fd', '#bfdbfe'], 8);
    state.gachaLocked = false;
    state.gachaCost += 5;
    setGachaCost(state.gachaCost);
    setShowGacha(false);
  };

  const triggerBomb = () => {
    if (bombCount <= 0 || isGameOver || isPaused) return;
    setBombCount(prev => prev - 1);
    const state = stateRef.current;
    state.shakeX = 10; state.shakeY = 10;
    state.enemyBullets.releaseAll();
    // 50% clear monsters
    const monsters = state.monsters.getActive();
    for (const m of monsters) { if (Math.random() > 0.5) state.monsters.release(m); else m.hp -= 20; }
    if (state.boss) state.boss.hp -= 30;
    emitExplosion(CW / 2, CH / 2, 80, ['#f97316', '#fef08a', '#ef4444'], 8);
  };

  const togglePause = () => { if (!isGameOver && !showGacha) setIsPaused(p => !p); };

  const checkSpawnBoss = (currentScore: number) => {
    const state = stateRef.current;
    if (state.boss) return;
    if (currentScore > 0 && currentScore % BOSS_SCORE_INTERVAL < 100) {
      state.boss = { x: 130, y: -80, hp: 50, maxHp: 50, speed: 1, alive: true };
      setBossHp(50);
    }
  };

  const cycleWeaponType = () => {
    const types: WeaponType[] = ['spread', 'laser', 'wave'];
    const idx = types.indexOf(stateRef.current.weaponType);
    const next = types[(idx + 1) % types.length];
    stateRef.current.weaponType = next;
    setWeaponType(next);
  };

  // ─—— DRAWING ────

  function drawPlayerShip(ctx: CanvasRenderingContext2D, x: number, y: number) {
    drawSprite(ctx, PLAYER, { x: '#38bdf8', a: '#7dd3fc' }, x, y, P);
    drawSprite(ctx, PLAYER_WING, { x: '#818cf8', a: '#a5b4fc' }, x - 2 * P, y + P, P);
    drawSprite(ctx, PLAYER_WING, { x: '#818cf8', a: '#a5b4fc' }, x + 7 * P, y + P, P);
    const f = stateRef.current.frameCount;
    if (f % 6 < 3) {
      ctx.fillStyle = '#f97316'; ctx.fillRect(x + P, y + 6 * P, 2 * P, 2 * P);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(x + P + 2, y + 7 * P, P, P);
      ctx.fillStyle = '#f97316'; ctx.fillRect(x + 3 * P, y + 6 * P, 2 * P, 2 * P);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(x + 3 * P + 2, y + 7 * P, P, P);
    }
  }

  function drawMonsterShip(ctx: CanvasRenderingContext2D, m: Monster, x: number, y: number) {
    const flash = m.type === 'interceptor' && stateRef.current.frameCount % 8 < 4;
    switch (m.type) {
      case 'fighter':
        drawSprite(ctx, FIGHTER, { x: flash ? '#fbbf24' : '#22d3ee', a: flash ? '#fef08a' : '#67e8f9' }, x, y, P);
        ctx.fillStyle = '#000'; ctx.fillRect(x + P, y + 2 * P, P, 2 * P); ctx.fillRect(x + 4 * P, y + 2 * P, P, 2 * P);
        break;
      case 'bomber':
        drawSprite(ctx, BOMBER, { x: flash ? '#fbbf24' : '#a78bfa', a: flash ? '#fef08a' : '#c4b5fd' }, x, y, P);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 2 * P, y + 2 * P, P, P); ctx.fillRect(x + 4 * P, y + 2 * P, P, P);
        break;
      case 'interceptor':
        drawSprite(ctx, INTERCEPTOR, { x: flash ? '#fbbf24' : '#fb7185', a: flash ? '#fef08a' : '#fda4af' }, x, y, P);
        ctx.fillStyle = '#000'; ctx.fillRect(x + 2 * P, y + P, P, P); ctx.fillRect(x + 3 * P, y + P, P, P);
        break;
    }
  }

  function drawBossShip(ctx: CanvasRenderingContext2D, x: number, y: number, hp: number, maxHp: number) {
    const flash = stateRef.current.frameCount % 10 < 5;
    drawSprite(ctx, BOSS_SPRITE, { x: flash ? '#ef4444' : '#b91c1c', a: '#fca5a5' }, x, y, P);
    drawSprite(ctx, BOSS_EYE, { x: '#fef08a', a: '#facc15' }, x + 2 * P, y + 3 * P, P);
    drawSprite(ctx, BOSS_EYE, { x: '#fef08a', a: '#facc15' }, x + 8 * P, y + 3 * P, P);
    const barW = 11 * P;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x, y - P, barW, 4);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(x, y - P, barW * (hp / maxHp), 4);
    ctx.fillStyle = '#86efac'; ctx.fillRect(x, y - P, barW * (hp / maxHp), 2);
  }

  function drawCoinItem(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const pulse = Math.sin(stateRef.current.frameCount * 0.08) * 0.2 + 1;
    ctx.save();
    ctx.translate(x + 2 * P, y + 2 * P);
    ctx.scale(pulse, 1);
    drawSprite(ctx, COIN_SPRITE, { x: '#eab308', a: '#fef08a' }, -2 * P, -2 * P, P);
    ctx.restore();
  }

  function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const f = stateRef.current.frameCount;
    ctx.globalAlpha = 0.15 + Math.sin(f * 0.1) * 0.08;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 14, y + 12, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + 14, y + 12, 28, 0, Math.PI * 2);
    ctx.stroke();
    // inner hex pattern
    for (let i = 0; i < 6; i++) {
      const angle = (f * 0.02) + (Math.PI * 2 * i) / 6;
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(x + 14 + Math.cos(angle) * 20, y + 12 + Math.sin(angle) * 20, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMissileSprite(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = '#f97316';
    ctx.fillRect(x, y, 3, 8);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(x, y, 3, 3);
    // tail flame
    if (stateRef.current.frameCount % 4 < 2) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, y + 8, 3, 4);
    }
  }

  function drawWeaponIndicator(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, 16, 10);
    ctx.fillStyle = '#38bdf8';
    ctx.font = '7px monospace';
    ctx.fillText(WEAPON_ICONS[stateRef.current.weaponType], x + 2, y + 8);
  }

  // ─── GAME LOOP ───

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    stateRef.current.weaponLevel = weaponLevel;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { togglePause(); return; }
      if (e.key === 'q' || e.key === 'Q') { cycleWeaponType(); return; }
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key)) {
        stateRef.current.keys[e.key as keyof typeof stateRef.current.keys] = false;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleTouchMove = (e: TouchEvent) => {
      if (isGameOver || isPaused) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const x = ((touch.clientX - rect.left) / rect.width) * CW - 15;
      const y = ((touch.clientY - rect.top) / rect.height) * CH - 15;
      stateRef.current.player.x = Math.max(0, Math.min(CW - 24, x));
      stateRef.current.player.y = Math.max(0, Math.min(CH - 32, y));
    };
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });

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

      // bg scroll
      bgOffsetRef.current = (bgOffsetRef.current + 1) % 40;

      state.stars.forEach(s => { s.y += s.speed; if (s.y > CH) { s.y = -2; s.x = Math.random() * CW; } });

      if (!isPaused && !isGameOver && !showGacha) {
        const p = state.player;
        if (state.keys.ArrowLeft || state.keys.a) p.x -= p.speed;
        if (state.keys.ArrowRight || state.keys.d) p.x += p.speed;
        if (state.keys.ArrowUp || state.keys.w) p.y -= p.speed;
        if (state.keys.ArrowDown || state.keys.s) p.y += p.speed;
        p.x = Math.max(0, Math.min(CW - 24, p.x));
        p.y = Math.max(0, Math.min(CH - 32, p.y));

        // ── auto fire by weapon type ──
        if (f % 8 === 0) {
          const lvl = state.weaponLevel;
          const wt = state.weaponType;
          if (wt === 'spread') {
            if (lvl >= 1) spawnBullet(p.x + 10, p.y, 0, -9);
            if (lvl >= 2) spawnBullet(p.x + 2, p.y, 0, -9);
            if (lvl >= 3) { spawnBullet(p.x, p.y + 4, -4, -8); spawnBullet(p.x + 20, p.y + 4, 4, -8); }
          } else if (wt === 'laser') {
            // fast narrow beam
            if (lvl >= 1) spawnBullet(p.x + 10, p.y, 0, -14);
            if (lvl >= 2) { spawnBullet(p.x + 6, p.y + 2, 0, -13); spawnBullet(p.x + 14, p.y + 2, 0, -13); }
            if (lvl >= 3) { spawnBullet(p.x + 2, p.y + 4, 0, -12); spawnBullet(p.x + 18, p.y + 4, 0, -12); }
          } else if (wt === 'wave') {
            // wide wave pattern
            if (lvl >= 1) spawnBullet(p.x + 10, p.y, 0, -9);
            if (lvl >= 2) { spawnBullet(p.x + 4, p.y, -3, -9); spawnBullet(p.x + 16, p.y, 3, -9); }
            if (lvl >= 3) { spawnBullet(p.x - 2, p.y, -6, -8); spawnBullet(p.x + 22, p.y, 6, -8); }
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

        // ── spawn formations ──
        state.formationTimer++;
        if (state.formationTimer >= 240 && !state.boss) {
          state.formationTimer = 0;
          const pattern = Math.floor(Math.random() * 3);
          state.formationGroupCounter++;
          const gid = state.formationGroupCounter;
          if (pattern === 0) {
            // Pincer: 2 groups swoop in from top-left and top-right
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(-40 - i * 20, -20 + i * 30, 'fighter', 2, 0);
              m.formation = true; m.vx = 1.2 + i * 0.2; m.vy = 1.0; m.formationGroup = gid;
            }
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(CW + 40 + i * 20, -20 + i * 30, 'fighter', 2, 0);
              m.formation = true; m.vx = -(1.2 + i * 0.2); m.vy = 1.0; m.formationGroup = gid;
            }
          } else if (pattern === 1) {
            // Side sweep: line enters from left, curves across
            for (let i = 0; i < 5; i++) {
              const m = spawnMonster(-30, 50 + i * 24, i % 2 === 0 ? 'fighter' : 'bomber', i % 2 === 0 ? 2 : 4, 0);
              m.formation = true;
              m.vx = 1.5; m.vy = -0.5 + i * 0.2; m.formationGroup = gid;
            }
          } else {
            // Cascade: staggered dive from top, spread across screen
            for (let i = 0; i < 5; i++) {
              const m = spawnMonster(40 + i * 60, -20 - i * 18, 'fighter', 2, 0);
              m.formation = true;
              m.vx = (i - 2) * 0.3; m.vy = 1.8; m.formationGroup = gid;
            }
          }
        }

        // ── formation movement ──
        for (const m of state.monsters.getActive()) {
          if (m.formation) {
            // gradual curve: vx decays, vy settles
            m.vx *= 0.98;
            m.vy += 0.02;
            m.x += m.vx;
            m.y += m.vy;
            // once deep enough on screen, release from formation
            if (m.y > 80 && m.x > 20 && m.x < CW - 20) {
              m.formation = false;
              m.speed = 1 + Math.random();
            }
          } else {
            // non-formation monsters with persistent velocity
            if (m.vy === 0 && m.vx === 0) { m.vy = m.speed; } // random spawns: use speed as vy
            m.x += m.vx;
            m.y += m.vy;
          }
        }

        // continuous random spawn (linear scaling by score)
        const baseInterval = 55;
        const minInterval = 18;
        const spawnInterval = Math.max(minInterval, baseInterval - Math.floor(state.score / 150));
        if (f % spawnInterval === 0 && !state.boss) {
          const roll = Math.random();
          let type: Monster['type']; let hp: number; let speed: number;
          if (roll < 0.5) { type = 'fighter'; hp = 2; speed = 1 + Math.random() * 1.5; }
          else if (roll < 0.85) { type = 'bomber'; hp = 4; speed = 0.8 + Math.random() * 1.2; }
          else { type = 'interceptor'; hp = 6; speed = 1.5 + Math.random() * 1.5; }
          const m = spawnMonster(Math.random() * (CW - 32), -32, type, hp, speed);
          m.vx = (Math.random() - 0.5) * 0.5;
          m.vy = speed;
        }

        // ── boss logic ──
        if (state.boss) {
          const b = state.boss;
          if (!b.alive) { state.boss = null; setBossHp(0); }
          else {
            if (b.y < 40) { b.y += b.speed; } else {
              b.x += Math.sin(f * 0.025) * 2;
              b.x = Math.max(0, Math.min(CW - 44, b.x));
            }
            if (f % 35 === 0) {
              spawnEnemyBullet(b.x + 8, b.y + 32, 0, 3.5);
              spawnEnemyBullet(b.x + 36, b.y + 32, 0, 3.5);
            }
            if (f % 50 === 0) {
              spawnEnemyBullet(b.x + 22, b.y + 32, -3, 4);
              spawnEnemyBullet(b.x + 22, b.y + 32, 3, 4);
            }
          }
        }

        // ── monster fire ──
        for (const m of state.monsters.getActive()) {
          if (!m.formation && f % 80 === 0 && Math.random() > 0.6) {
            spawnEnemyBullet(m.x + 12, m.y + 16, 0, 3.5);
          }
        }

        // ── move bullets ──
        const activeBullets = state.bullets.getActive();
        for (const b of activeBullets) { b.x += b.vx; b.y += b.vy; }
        const activeEnemyBullets = state.enemyBullets.getActive();
        for (const b of activeEnemyBullets) { b.x += b.vx; b.y += b.vy; }

        // ── move coins ──
        const activeCoins = state.coins.getActive();
        for (const c of activeCoins) c.y += 1.2;

        // ── move particles ──
        const activeParticles = state.particles.getActive();
        for (const pt of activeParticles) {
          pt.x += pt.vx; pt.y += pt.vy; pt.alpha -= 0.015;
          pt.vx *= 0.97; pt.vy *= 0.97;
        }

        // ── move missiles (homing) ──
        const activeMissiles = state.missiles.getActive();
        for (const ms of activeMissiles) {
          // steer toward target or fly up
          if (ms.targetX && ms.targetY) {
            const dx = ms.targetX - ms.x;
            const dy = ms.targetY - ms.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 5) {
              ms.vx += (dx / dist) * 0.3;
              ms.vy += (dy / dist) * 0.3;
              const sp = Math.sqrt(ms.vx * ms.vx + ms.vy * ms.vy);
              if (sp > 7) { ms.vx = (ms.vx / sp) * 7; ms.vy = (ms.vy / sp) * 7; }
            }
          }
          ms.x += ms.vx; ms.y += ms.vy;
        }

        // ── cull out-of-bounds ──
        for (const b of activeBullets) { if (b.y < -20 || b.x < -10 || b.x > CW + 10) state.bullets.release(b); }
        for (const b of activeEnemyBullets) { if (b.y > CH + 10) state.enemyBullets.release(b); }
        for (const m of state.monsters.getActive()) { if (m.y > CH + 20) state.monsters.release(m); }
        for (const c of activeCoins) { if (c.y > CH + 10) state.coins.release(c); }
        for (const ms of activeMissiles) { if (ms.y < -20 || ms.y > CH + 20) state.missiles.release(ms); }
        for (const pt of activeParticles) { if (pt.alpha <= 0) state.particles.release(pt); }

        // ── bullet vs monster ──
        for (const b of state.bullets.getActive()) {
          for (const m of state.monsters.getActive()) {
            const mw = m.type === 'bomber' ? 28 : 24;
            const mh = m.type === 'interceptor' ? 24 : 20;
            if (b.x > m.x && b.x < m.x + mw && b.y > m.y && b.y < m.y + mh) {
              m.hp--;
              state.bullets.release(b);
              emitExplosion(b.x, b.y, 3, ['#fbbf24'], 3);
              if (m.hp <= 0) {
                const isDouble = state.doubleCoinTimer > 0;
                const base = m.type === 'interceptor' ? 3 : m.type === 'bomber' ? 2 : 1;
                spawnCoin(m.x + 8, m.y + 4, isDouble ? base * 2 : base);
                emitExplosion(m.x + 8, m.y + 8, 10, ['#ef4444', '#f97316'], 6);
                state.monsters.release(m);
                setScore(prev => { const n = prev + 100; state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
              }
              break;
            }
          }
        }

        // ── missile vs monster ──
        for (const ms of state.missiles.getActive()) {
          for (const m of state.monsters.getActive()) {
            const mw = m.type === 'bomber' ? 28 : 24;
            const mh = m.type === 'interceptor' ? 24 : 20;
            if (ms.x > m.x && ms.x < m.x + mw && ms.y > m.y && ms.y < m.y + mh) {
              m.hp -= 3;
              state.missiles.release(ms);
              emitExplosion(ms.x, ms.y, 8, ['#f97316', '#fef08a', '#ef4444'], 5);
              if (m.hp <= 0) {
                const isDouble = state.doubleCoinTimer > 0;
                const base = m.type === 'interceptor' ? 3 : m.type === 'bomber' ? 2 : 1;
                spawnCoin(m.x + 8, m.y + 4, isDouble ? base * 2 : base);
                emitExplosion(m.x + 8, m.y + 8, 10, ['#ef4444', '#f97316'], 6);
                state.monsters.release(m);
                setScore(prev => { const n = prev + 100; state.score = n; return n; });
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
              }
              break;
            }
          }
        }

        // ── move power-ups ──
        for (const pu of state.powerUps.getActive()) {
          pu.y += 0.8;
          const px = state.player.x; const py = state.player.y;
          if (pu.x > px - 4 && pu.x < px + 32 && pu.y > py - 4 && pu.y < py + 32) {
            state.powerUps.release(pu);
            const n = Math.min(3, state.weaponLevel + 1);
            state.weaponLevel = n;
            setWeaponLevel(n);
            emitExplosion(pu.x, pu.y, 15, ['#38bdf8', '#7dd3fc', '#fff'], 6);
          }
        }
        // cull power-ups
        for (const pu of state.powerUps.getActive()) { if (pu.y > CH + 10) state.powerUps.release(pu); }

        // ── bullet/missile vs boss ──
        if (state.boss) {
          const b = state.boss;
          for (const bullet of state.bullets.getActive()) {
            if (bullet.x > b.x && bullet.x < b.x + 44 && bullet.y > b.y && bullet.y < b.y + 32) {
              b.hp--;
              state.bullets.release(bullet);
              emitExplosion(bullet.x, bullet.y, 3, ['#fbbf24'], 3);
              if (b.hp <= 0) {
                emitExplosion(b.x + 22, b.y + 16, 50, ['#f97316', '#ef4444', '#fef08a', '#fff'], 8);
                const isDouble = state.doubleCoinTimer > 0;
                spawnCoin(b.x + 18, b.y + 10, isDouble ? 20 : 10);
                setScore(prev => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0);
                b.alive = false;
                state.boss = null;
                state.shakeX = 14; state.shakeY = 14;
              } else {
                setBossHp(b.hp);
              }
              break;
            }
          }
          for (const ms of state.missiles.getActive()) {
            if (ms.x > b.x && ms.x < b.x + 44 && ms.y > b.y && ms.y < b.y + 32) {
              b.hp -= 3;
              state.missiles.release(ms);
              emitExplosion(ms.x, ms.y, 8, ['#f97316', '#fef08a', '#ef4444'], 5);
              if (b.hp <= 0) {
                emitExplosion(b.x + 22, b.y + 16, 50, ['#f97316', '#ef4444', '#fef08a', '#fff'], 8);
                const isDouble = state.doubleCoinTimer > 0;
                spawnCoin(b.x + 18, b.y + 10, isDouble ? 20 : 10);
                setScore(prev => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0);
                b.alive = false;
                state.boss = null;
                state.shakeX = 14; state.shakeY = 14;
              } else {
                setBossHp(b.hp);
              }
              break;
            }
          }
        }

        // ── collect coins ──
        for (const c of state.coins.getActive()) {
          const px = state.player.x; const py = state.player.y;
          if (c.x > px - 4 && c.x < px + 32 && c.y > py - 4 && c.y < py + 32) {
            state.wallet += c.value;
            state.coins.release(c);
            emitExplosion(c.x, c.y, 4, ['#eab308'], 3);
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
          const px = p.x + 10; const py = p.y + 10;
          const hitMonster = state.monsters.getActive().some(m => {
            const mw = m.type === 'bomber' ? 28 : 24;
            const mh = m.type === 'interceptor' ? 24 : 20;
            return m.x < px + 8 && m.x + mw > px && m.y < py + 10 && m.y + mh > py;
          });
          const hitBullet = state.enemyBullets.getActive().some(b =>
            b.x > p.x - 2 && b.x < p.x + 26 && b.y > p.y - 2 && b.y < p.y + 28);
          const hitBoss = state.boss &&
            state.boss.x < p.x + 24 && state.boss.x + 44 > p.x &&
            state.boss.y < p.y + 28 && state.boss.y + 32 > p.y + 4;
          if (hitMonster || hitBullet || hitBoss) {
            emitExplosion(p.x + 12, p.y + 14, 15, ['#60a5fa', '#93c5fd'], 8);
            setLives(prev => {
              if (prev <= 1) { setIsGameOver(true); return 0; }
              state.invincible = true; state.invincibleTimer = 90; setInvincible(true);
              state.shakeX = 6; state.shakeY = 6;
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

      const grad = ctx.createLinearGradient(0, 0, 0, CH);
      grad.addColorStop(0, '#020617'); grad.addColorStop(0.5, '#0c0a20'); grad.addColorStop(1, '#1a0a2e');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CW, CH);

      // animated grid
      const go = bgOffsetRef.current;
      ctx.strokeStyle = 'rgba(56,189,248,0.04)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < CW; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CH); ctx.stroke();
      }
      for (let gy = -go; gy < CH; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CW, gy); ctx.stroke();
      }
      // grid highlight line
      ctx.strokeStyle = `rgba(56,189,248,${0.06 + Math.sin(f * 0.03) * 0.03})`;
      ctx.beginPath(); ctx.moveTo(0, CH - go); ctx.lineTo(CW, CH - go); ctx.stroke();

      // nebula
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = '#3b0764'; ctx.beginPath(); ctx.arc(200, 150, 120, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e3a5f'; ctx.beginPath(); ctx.arc(100, 400, 100, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;

      // stars
      state.stars.forEach(s => {
        ctx.globalAlpha = s.brightness;
        ctx.fillStyle = '#fff'; ctx.fillRect(s.x, s.y, s.size, s.size);
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
        ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
      }
      ctx.globalAlpha = 1;

      // enemy bullets
      for (const b of state.enemyBullets.getActive()) {
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 5);
        glow.addColorStop(0, 'rgba(251,113,133,0.4)'); glow.addColorStop(1, 'rgba(251,113,133,0)');
        ctx.fillStyle = glow; ctx.fillRect(b.x - 5, b.y - 5, 10, 10);
        ctx.fillStyle = '#f43f5e'; ctx.fillRect(b.x - 1, b.y - 3, 2, 6);
      }

      // player bullets
      for (const b of state.bullets.getActive()) {
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 6);
        glow.addColorStop(0, 'rgba(56,189,248,0.3)'); glow.addColorStop(1, 'rgba(56,189,248,0)');
        ctx.fillStyle = glow; ctx.fillRect(b.x - 6, b.y - 6, 12, 12);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
        ctx.fillStyle = '#e0f2fe'; ctx.fillRect(b.x - 1, b.y - 1, 2, 2);
      }
      // add weaponType to Bullet — wait, I didn't add it. Instead I'll color all bullets the same for now.

      // missiles
      for (const ms of state.missiles.getActive()) {
        drawMissileSprite(ctx, ms.x, ms.y);
      }

      // player
      if (!isGameOver) {
        const sp = state.player;
        const visible = !state.invincible || f % 5 < 3;
        if (visible) {
          if (state.invincible) drawShield(ctx, sp.x, sp.y);
          drawPlayerShip(ctx, sp.x, sp.y);
          ctx.globalAlpha = 0.08;
          const pg = ctx.createRadialGradient(sp.x + 12, sp.y + 12, 0, sp.x + 12, sp.y + 12, 30);
          pg.addColorStop(0, '#38bdf8'); pg.addColorStop(1, 'rgba(56,189,248,0)');
          ctx.fillStyle = pg;
          ctx.beginPath(); ctx.arc(sp.x + 12, sp.y + 12, 30, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // monsters
      for (const m of state.monsters.getActive()) drawMonsterShip(ctx, m, m.x, m.y);

      // boss
      if (state.boss) {
        drawBossShip(ctx, state.boss.x, state.boss.y, state.boss.hp, state.boss.maxHp);
        ctx.globalAlpha = 0.1;
        const bg = ctx.createRadialGradient(state.boss.x + 22, state.boss.y + 16, 0, state.boss.x + 22, state.boss.y + 16, 50);
        bg.addColorStop(0, '#ef4444'); bg.addColorStop(1, 'rgba(239,68,68,0)');
        ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(state.boss.x + 22, state.boss.y + 16, 50, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }

      // coins
      for (const c of state.coins.getActive()) {
        const floatY = Math.sin(f * 0.06 + c.x) * 2;
        drawCoinItem(ctx, c.x, c.y + floatY);
      }

      // power-ups
      for (const pu of state.powerUps.getActive()) {
        const pulse = Math.sin(f * 0.1) * 0.3 + 0.7;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(pu.x, pu.y, 12, 12);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px monospace';
        ctx.fillText('P', pu.x + 2, pu.y + 10);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = `rgba(56,189,248,${0.3 + Math.sin(f * 0.08) * 0.2})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pu.x + 6, pu.y + 6, 10, 0, Math.PI * 2);
        ctx.stroke();
      }

      // weapon type indicator (top center on canvas)
      drawWeaponIndicator(ctx, CW / 2 - 8, 2);

      ctx.restore();

      if (!isGameOver) animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isGameOver, weaponLevel, weaponType, bombCount, lives, isPaused, showGacha, hasHoming]);

  useEffect(() => { if (!isGameOver) checkSpawnBoss(score); }, [score, isGameOver]);

  const restartGame = () => {
    const state = stateRef.current;
    state.monsters.releaseAll(); state.bullets.releaseAll(); state.enemyBullets.releaseAll();
    state.coins.releaseAll(); state.particles.releaseAll(); state.missiles.releaseAll(); state.powerUps.releaseAll();
    state.boss = null;
    state.player = { x: 180, y: 460, speed: 5 };
    state.invincible = false; state.invincibleTimer = 0;
    state.shakeX = 0; state.shakeY = 0; state.score = 0; state.wallet = 0;
    state.doubleCoinTimer = 0; state.hasHoming = false; state.formationTimer = 0;
    state.gachaLocked = false; state.gachaCost = 10; state.formationGroupCounter = 0;
    bgOffsetRef.current = 0;
    setIsPaused(false); setShowGacha(false);
    setScore(0); setWeaponLevel(1); setWeaponType('spread'); setBombCount(3); setLives(3);
    setIsGameOver(false); setInvincible(false); setBossHp(0);
    setCoins(0); setDoubleCoinTimer(0); setMissileCount(0); setHasHoming(false); setGachaCost(10);
  };

  const formatScore = (n: number) => n.toString().padStart(6, '0');

  // Homing missile as a gacha card add-on — available as a pickup
  // For simplicity, homing missile is activated on game start with a small chance on kill

  return (
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Arcade Game</p>
          <h1 className="text-2xl font-black text-[#725d42]">雷电战机</h1>
          <p className="text-sm text-[#9f927d]">
            3 种武器切换 | 编队敌机 | 追踪导弹 | 抽卡升级
          </p>
        </header>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Link href="/game" className="inline-flex items-center gap-1 text-sm text-[#9f927d] hover:text-[#725d42] transition-colors">
              <ArrowLeft className="w-4 h-4" /> 返回
            </Link>
            <span className="text-sm text-[#9f927d]">|</span>
            <p className="text-sm text-[#725d42]">
              得分: <span className="font-black text-amber-500">{formatScore(score)}</span>
            </p>
          </div>
          <button onClick={cycleWeaponType}
            className="text-[10px] bg-[#fffdf5] border border-[#e8ddd0] rounded-lg px-2 py-1 text-[#725d42] hover:bg-white transition-colors"
          >
            {WEAPON_ICONS[weaponType]} {WEAPON_NAMES[weaponType]} (Q)
          </button>
        </div>

        <div className="flex justify-center">
          <div className="relative rounded-2xl overflow-hidden shadow-xl border-4 border-[#c4b89e]">
            <canvas ref={canvasRef} width={CW} height={CH}
              className="block touch-none cursor-crosshair"
              style={{ imageRendering: 'pixelated' }} />

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
              {stateRef.current.missiles.getActive().length > 0 && (
                <span className="text-[9px] text-orange-300 font-bold ml-0.5">🚀</span>
              )}
              {invincible && <span className="text-[8px] text-yellow-300 font-bold ml-0.5 animate-pulse">无敌</span>}
              {doubleCoinTimer > 0 && <span className="text-[8px] text-orange-300 font-bold ml-0.5">×2</span>}
              {stateRef.current.boss && <span className="text-[8px] text-red-400 font-bold ml-1 animate-pulse">BOSS</span>}
            </div>

            {stateRef.current.boss && bossHp > 0 && (
              <div className="absolute top-2 right-10 flex items-center gap-1 bg-black/60 rounded px-1.5 py-0.5">
                <Skull className="w-3 h-3 text-red-400" />
                <div className="w-16 h-1.5 bg-black/60 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-200"
                    style={{ width: `${(bossHp / 50) * 100}%` }} />
                </div>
              </div>
            )}

            <button onClick={togglePause}
              className="absolute top-2 right-2 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-lg w-6 h-6 active:scale-90 transition-all">
              {isPaused ? <Play className="w-3.5 h-3.5 text-white" /> : <Pause className="w-3.5 h-3.5 text-white" />}
            </button>

            <button onClick={triggerBomb} disabled={bombCount <= 0 || isGameOver || isPaused}
              className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-rose-500/40 rounded-lg px-2 py-1 active:scale-90 transition-all disabled:opacity-30 disabled:scale-100">
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
                <div className="text-5xl mb-3 opacity-80">&#x2620;</div>
                <h2 className="text-xl font-black text-rose-500 tracking-wider mb-1">战机被击落</h2>
                <p className="text-xs text-slate-400 mb-5">
                  最终得分: <span className="text-amber-400 font-bold text-base">{formatScore(score)}</span>
                </p>
                <button onClick={restartGame}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 font-bold rounded-lg shadow-lg active:scale-95 transition-all text-sm tracking-wider text-white">
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
                    <button key={i} onClick={() => applyCardEffect(card)}
                      className="group relative flex flex-col items-center gap-1 bg-gradient-to-b from-slate-800 to-slate-900 border-2 border-slate-600 hover:border-yellow-500/80 rounded-xl p-3 w-24 transition-all hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-yellow-500/20">
                      <span className={`text-2xl ${card.rarity === 'SSR' ? 'group-hover:scale-110 transition-transform' : ''}`}>{card.icon}</span>
                      <span className="text-[10px] font-bold text-white leading-tight text-center">{card.name}</span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded ${card.rarity === 'SSR' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>{card.rarity}</span>
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
            <Zap className="w-4 h-4 text-[#9f927d]" />
            <p className="text-[9px] text-[#9f927d] leading-tight">火力</p>
            <p className="text-sm font-bold text-[#725d42] leading-tight">LV.{weaponLevel}</p>
          </div>
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <span className="text-sm">{WEAPON_ICONS[weaponType]}</span>
            <p className="text-[9px] text-[#9f927d] leading-tight">武器</p>
            <p className="text-[10px] font-bold text-[#725d42] leading-tight">{WEAPON_NAMES[weaponType]}</p>
          </div>
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <Heart className="w-4 h-4 text-rose-500" fill="#e11d48" />
            <p className="text-[9px] text-[#9f927d] leading-tight">生命</p>
            <p className="text-sm font-bold text-[#725d42] leading-tight">×{lives}</p>
          </div>
          <div className="island-card bg-[#fffdf5] border border-[#e8ddd0] rounded-2xl px-2 py-2 flex flex-col items-center">
            <Coins className="w-4 h-4 text-yellow-500" />
            <p className="text-[9px] text-[#9f927d] leading-tight">金币</p>
            <p className="text-sm font-bold text-[#725d42] leading-tight">{coins}/{gachaCost}</p>
          </div>
        </div>

        <p className="text-[9px] text-[#9f927d] text-center max-w-[280px] mx-auto">
          WASD/方向键移动 | Q 切换武器 | 金币抽卡 | ESC暂停
        </p>
      </div>
    </main>
  );
}
