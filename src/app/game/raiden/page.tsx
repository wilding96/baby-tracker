"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
} from "lucide-react";
import { useGameAudio } from "@/hooks/useGameAudio";
import { COLORS, CH, CW, PIXEL_FONT, SHIP_CONFIG, SHIP_TYPES, WEAPON_ICONS, WEAPON_NAMES, WAVE_TABLE } from "./lib/config";
import type { Beam, Boss, BossType, Bullet, CardDef, EnergyFragment, ExhaustParticle, Miniboss, Missile, Monster, OptionForm, OptionState, Particle, PowerUp, ShipType, SlashEffect, Star, WeaponType } from "./lib/types";
import { Pool } from "./lib/pool";
import { loadSave, writeSave } from "./lib/save";
import { energyValue, expInterval, generateGachaOptions } from "./lib/game";
import { drawText } from "./lib/sprite-utils";
import { drawBeam, drawBossShip, drawGreenOption, drawMinibossShip, drawMissileSprite, drawMonsterShip, drawPlayerShip, drawPurpleWingOption, drawShield, drawSlashEffect, drawWingmanSatellite } from "./render/draw";

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
  const [optionForm, setOptionForm] = useState<OptionForm>("greenLaser");
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
      type: "player", wtype: "spread", wingman: false, lightning: false, damage: 0, alive: false,
    })),
    enemyBullets: new Pool<Bullet>(() => ({
      x: 0, y: 0, vx: 0, vy: 0,
      type: "enemy", damage: 0, alive: false,
    })),
    monsters: new Pool<Monster>(() => ({
      x: 0, y: 0, hp: 2, maxHp: 2,
      speed: 1, type: "fighter", alive: false,
      formation: false, vx: 0, vy: 0, formationGroup: 0,
      flashTimer: 0,
      age: 0, traj: "dive", baseX: 0, baseY: 0, amp: 0, freq: 0, phase: 0,
      bezier: false, p0x: 0, p0y: 0, p3x: 0, p3y: 0, bezT: 0, bezSpeed: 0,
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
    beams: new Pool<Beam>(() => ({ x: 0, y: 0, angle: 0, length: 520, width: 4, state: "charging", timer: 0, alive: false })),
    powerUps: new Pool<PowerUp>(() => ({ x: 0, y: 0, type: "weapon", alive: false })),
    energyFrags: new Pool<EnergyFragment>(() => ({ x: 0, y: 0, value: 1, alive: false, vx: 0, vy: 0, age: 0, phase: 0 })),
    weaponEnergy: 0,
    energyNeeded: 80,
    comboKills: 0,
    comboTimer: 0,
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
    gachaLocked: false, gachaCost: 10,
    formationGroupCounter: 0, overdriveTimer: 0,
    bossTimer: 0, bossInterval: 5400, bossLoop: 0,
    elapsedFrames: 0, levelUpFlashTimer: 0,
    nextWaveFrame: 60, nextFormationFrame: 240, nextSoloFrame: 600,
    noticeText: "", noticeTimer: 0, noticeColor: "#fff",
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
    m.age = 0; m.traj = "dive"; m.baseX = x; m.baseY = y; m.amp = 0; m.freq = 0; m.phase = 0;
    m.bezier = false; m.p0x = x; m.p0y = y; m.p3x = x; m.p3y = y; m.bezT = 0; m.bezSpeed = 0;
    return m;
  }

  // 给敌机分配数学轨迹（正弦下潜 / 横扫 / 直线俯冲）
  function assignTrajectory(m: Monster) {
    m.age = 0;
    m.baseX = m.x; m.baseY = m.y;
    m.phase = Math.random() * Math.PI * 2;
    if (m.type === "fighter") {
      m.traj = Math.random() < 0.6 ? "sine" : "dive";
      m.amp = 16 + Math.random() * 26;
      m.freq = 0.02 + Math.random() * 0.03;
    } else if (m.type === "interceptor") {
      m.traj = "sweep";
      m.amp = 8 + Math.random() * 16;
      m.freq = 0.03 + Math.random() * 0.03;
    } else if (m.type === "elite") {
      m.traj = "sine";
      m.amp = 24 + Math.random() * 26;
      m.freq = 0.014 + Math.random() * 0.018;
    } else { // bomber
      m.traj = "dive";
      m.amp = 0; m.freq = 0;
    }
  }

  // 贝塞尔入场：从 (x0,y0) 弧线飞入到 (x3,y3)
  function assignBezier(m: Monster, x0: number, y0: number, x3: number, y3: number) {
    m.bezier = true;
    m.bezT = 0;
    m.bezSpeed = 1 / (55 + Math.random() * 25);
    m.p0x = x0; m.p0y = y0;
    m.p3x = x3; m.p3y = y3;
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
  function spawnBeam(x: number, y: number, angle: number) {
    const b = stateRef.current.beams.get();
    b.x = x; b.y = y; b.angle = angle;
    b.length = CH + 40;
    b.width = 4;
    b.state = "charging";
    b.timer = 55; // 蓄力帧数
  }
  function spawnEnergyFragment(x: number, y: number, value: number) {
    const e = stateRef.current.energyFrags.get();
    e.x = x; e.y = y; e.value = value;
    // radial burst with a slight upward arc (pops out, then settles)
    const ang = Math.random() * Math.PI * 2;
    const sp = 1.5 + Math.random() * 2.5;
    e.vx = Math.cos(ang) * sp;
    e.vy = Math.sin(ang) * sp - 1.2;
    e.age = 0; e.phase = Math.random() * Math.PI * 2;
  }

  // Combo-aware kill scoring (P1: chain multiplier + magnet trigger)
  function addKillScore(type: Monster["type"]) {
    const state = stateRef.current;
    state.comboKills++;
    state.comboTimer = 120; // 2s window to keep the chain alive
    const mult = 1 + Math.min(4, Math.floor(state.comboKills / 10)); // 1x..5x
    const base = type === "elite" ? 300 : 100;
    setScore((prev) => { const n = prev + base * mult; state.score = n; return n; });
    if (state.comboKills >= 30 && state.magnetModeTimer <= 0) {
      state.magnetModeTimer = 300;
    }
  }

  // Weak text prompt (soft notification) shown near the top of the play area
  function pushNotice(text: string, color: string) {
    const state = stateRef.current;
    state.noticeText = text;
    state.noticeColor = color;
    state.noticeTimer = 100; // ~1.6s
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
      // Formation clear: 50% wingman / 25% option form / 25% energy burst
      const r = Math.random();
      if (r < 0.5) {
        const pu = state.powerUps.get();
        pu.x = x; pu.y = y;
        pu.type = "wingman";
      } else if (r < 0.75) {
        const pu = state.powerUps.get();
        pu.x = x; pu.y = y;
        pu.type = "optionForm";
      } else {
        for (let i = 0; i < 6; i++) spawnEnergyFragment(x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 14, 6);
      }
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

  // Trigger the warning phase for a given wave index (boss appears 3s later).
  const triggerBossWave = (idx: number) => {
    const state = stateRef.current;
    if (idx < 0 || idx >= WAVE_TABLE.length) return;
    if (state.boss || state.bossWarningTimer > 0 || state.bossCooldown > 0) return;
    state.lastWaveSpawned = idx;
    state.bossTimer = 0;
    state.bossInterval = 4500; // tighten cadence after the first boss
    state.bossWarningTimer = 180; // 3 seconds warning phase
    setBossWarning(true);
    setWaveAnnounce("⚠ WARNING ⚠");
    audio.bossWarning();
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

  // render-time ship tilt (kept in component; draw fns live in render/draw.ts)
  const playerTiltRef = { current: 0 };

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
    let lastTime = 0;
    let acc = 0;
    const STEP = 1000 / 60;

    const step = () => {
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
          const hpScale = 1 + (state.bossLoop || 0) * 0.5 + state.weaponLevel * 0.5 + state.wingmanLevel * 0.4;
          const bhp = Math.round(wave.bossHp * hpScale);
          state.boss = {
            x: state.player.x < CW / 2 ? 180 : 60, y: -80,
            hp: bhp, maxHp: bhp,
            speed: 1, alive: true, type: wave.boss,
            attackTimer: 0, phase: 0, rageTimer: 0,
          };
          setBossHp(bhp);
          setWaveAnnounce(`STAGE ${state.lastWaveSpawned + 1}  ${wave.name}`);
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
        // ── elapsed time + difficulty ramp (P0 pacing) ──
        state.elapsedFrames++;
        // 难度分级：跟随当前 Boss 波次（1..6），每过一个 Boss 整体变难
        const tier = Math.max(1, state.lastWaveSpawned + 1);
        const fighterHp = Math.min(4, 1 + Math.floor((tier - 1) * 0.6));

        // ── time-driven boss spawn (first ~80s, then ~60s) ──
        if (!state.boss && !state.miniboss && state.bossCooldown <= 0 && state.bossWarningTimer <= 0) {
          state.bossTimer++;
          if (state.bossTimer >= state.bossInterval) {
            let next = state.lastWaveSpawned + 1;
            if (next >= WAVE_TABLE.length) {
              next = 2; // endless loop — hp scales via bossLoop
              state.bossLoop = (state.bossLoop || 0) + 1;
            }
            triggerBossWave(next);
          }
        }

        // ── combo window decay (P1 combo) ──
        if (state.comboTimer > 0) {
          state.comboTimer--;
          if (state.comboTimer <= 0) state.comboKills = 0;
        }

        // ── level-up flash decay (P1) ──
        if (state.levelUpFlashTimer > 0) state.levelUpFlashTimer--;

        // ── weak prompt decay ──
        if (state.noticeTimer > 0) state.noticeTimer--;

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
        if (state.wingmanLevel > 0 && f % 2 === 0) {
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
        if (state.wingmanLevel > 0 && optForm === "greenLaser") {
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
        } else if (state.wingmanLevel > 0) {
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

        // ── formations (Bezier 弧线飞入, POW reward) ──
        if (!state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0 && state.elapsedFrames >= state.nextFormationFrame) {
          state.nextFormationFrame = state.elapsedFrames + expInterval(Math.max(220, 520 - tier * 40), 160);
          const pattern = Math.floor(Math.random() * 5);
          state.formationGroupCounter++;
          const gid = state.formationGroupCounter;

          if (pattern === 0) {
            // 钳形：左右各 3 架弧线切入
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(-40, -20 - i * 22, "fighter", fighterHp, 0);
              m.formation = true; m.formationGroup = gid;
              assignBezier(m, -40, -20 - i * 22, 30 + i * 26, 46 + i * 8);
            }
            for (let i = 0; i < 3; i++) {
              const m = spawnMonster(CW + 40, -20 - i * 22, "fighter", fighterHp, 0);
              m.formation = true; m.formationGroup = gid;
              assignBezier(m, CW + 40, -20 - i * 22, CW - 30 - i * 26, 46 + i * 8);
            }
          } else if (pattern === 1) {
            // 侧翼横插：4 架从一侧弧线扫入
            const fromLeft = Math.random() > 0.5;
            for (let i = 0; i < 4; i++) {
              const x0 = fromLeft ? -40 : CW + 40;
              const x3 = fromLeft ? 30 + i * 30 : CW - 30 - i * 30;
              const m = spawnMonster(x0, 24 + i * 22, "fighter", fighterHp, 0);
              m.formation = true; m.formationGroup = gid;
              assignBezier(m, x0, 24 + i * 22, x3, 50 + i * 6);
            }
          } else if (pattern === 2) {
            // 箭形：5 架 V 字弧线
            const anchorX = 60 + Math.random() * (CW - 160);
            const spread = 26 + Math.random() * 18;
            for (let i = 0; i < 5; i++) {
              const x0 = anchorX + (i - 2) * 40;
              const m = spawnMonster(x0, -60 - i * 10, "fighter", fighterHp, 0);
              m.formation = true; m.formationGroup = gid;
              assignBezier(m, x0, -60 - i * 10, anchorX + (i - 2) * spread, 48 + Math.abs(i - 2) * 12);
            }
          } else if (pattern === 3) {
            // 斜插：3 架对角线弧线
            const fromRight = Math.random() > 0.5;
            for (let i = 0; i < 3; i++) {
              const x0 = fromRight ? CW + 30 : -30;
              const x3 = fromRight ? CW - 60 - i * 30 : 60 + i * 30;
              const m = spawnMonster(x0, 20 + i * 24, "fighter", fighterHp, 0);
              m.formation = true; m.formationGroup = gid;
              assignBezier(m, x0, 20 + i * 24, x3, 44 + i * 10);
            }
          } else {
            // 蛇形：4 架从顶部错落弧线
            for (let i = 0; i < 4; i++) {
              const x0 = 60 + Math.random() * (CW - 120);
              const m = spawnMonster(x0, -70 - i * 14, "fighter", fighterHp, 0);
              m.formation = true; m.formationGroup = gid;
              assignBezier(m, x0, -70 - i * 14, x0 + (i % 2 ? 26 : -26), 50 + i * 6);
            }
          }
        }

        // ── solo elite/interceptor/bomber spawns (Poisson-spaced) ──
        if (!state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0 && state.score > 400 && state.elapsedFrames >= state.nextSoloFrame) {
          state.nextSoloFrame = state.elapsedFrames + expInterval(Math.max(320, 480 - tier * 25), 220);
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
          assignTrajectory(m);
        }

        // ── miniboss spawn ──
        if (!state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.score > 800 && state.bossWarningTimer <= 0) {
          const mbInterval = Math.max(800, 2000 - Math.floor(state.score / 20));
          if (state.score % mbInterval < 3 && state.score > state.lastWaveSpawned * 1000 + 500) {
            const mbTypes: BossType[] = ["fortress", "carrier"];
            const mbType = mbTypes[Math.floor(Math.random() * mbTypes.length)];
            const mbHp = Math.round((15 + Math.floor(state.score / 200)) * (1 + state.weaponLevel * 0.3 + state.wingmanLevel * 0.25));
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
                spawnEnemyBullet(mb.x + 8, mb.y + 36, 0, 2.4);
                spawnEnemyBullet(mb.x + 40, mb.y + 36, 0, 2.4);
              } else if (mb.type === "carrier" && mb.attackTimer % 80 === 0) {
                for (let i = 0; i < 2; i++) {
                  const m = spawnMonster(mb.x + 10 + i * 24, mb.y + 28, "fighter", fighterHp, 0);
                  m.vy = 1.5 + Math.random(); m.vx = (Math.random() - 0.5) * 0.5;
                }
              }
            }
          }
        }

        // ── formation movement ──
        state.monsters.forEachActive((m) => {
          if (m.formation) {
            if (m.bezier) {
              // 贝塞尔弧线入场：先向下、再弧线切入目标点
              m.bezT = Math.min(1, m.bezT + m.bezSpeed);
              const t = m.bezT, u = 1 - t;
              const p1x = m.p0x, p1y = m.p0y + 90;
              const p2x = m.p3x, p2y = m.p3y - 70;
              m.x = u * u * u * m.p0x + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * m.p3x;
              m.y = u * u * u * m.p0y + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * m.p3y;
              if (m.bezT >= 1) {
                m.bezier = false; m.formation = false;
                m.speed = 1 + Math.random();
                if (m.type === "elite") m.speed = 0.8;
                m.vy = m.speed; m.vx = (Math.random() - 0.5) * 0.4;
                assignTrajectory(m);
              }
            } else {
              m.vx *= 0.98; m.vy += 0.02; m.x += m.vx; m.y += m.vy;
              // 屏幕外持续向场内推进，避免卡在左右边缘
              if (m.x < 0) m.vx = Math.max(m.vx, 0.4);
              else if (m.x > CW - 24) m.vx = Math.min(m.vx, -0.4);
              const breakY = m.type === "elite" ? 60 : 80;
              if (m.y > breakY && m.x > 20 && m.x < CW - 20) {
                m.formation = false; m.speed = 1 + Math.random();
                if (m.type === "elite") m.speed = 0.8;
                m.vy = m.speed; m.vx = (Math.random() - 0.5) * 0.4;
                assignTrajectory(m);
              }
            }
          } else {
            // 数学轨迹：正弦下潜 / 横扫 / 直线俯冲
            m.age++;
            const sway = m.amp * Math.sin(m.freq * m.age + m.phase);
            if (m.traj === "sine") {
              m.x = m.baseX + sway;
              m.y = m.baseY + m.vy * m.age;
            } else if (m.traj === "sweep") {
              m.x = m.baseX + m.vx * m.age;
              m.y = m.baseY + m.vy * m.age + sway;
            } else {
              m.x = m.baseX + m.vx * m.age;
              m.y = m.baseY + m.vy * m.age;
            }
          }
        });

        // ── fighter drip（正弦下潜，从顶部进入） ──
        if (!state.boss && !state.miniboss && state.bossCooldown <= 0 && state.minibossCooldown <= 0 && state.bossWarningTimer <= 0 && state.elapsedFrames >= state.nextWaveFrame) {
          state.nextWaveFrame = state.elapsedFrames + expInterval(Math.max(45, 110 - tier * 12), 25);
          const x = 20 + Math.random() * (CW - 60);
          const m = spawnMonster(x, -16, "fighter", fighterHp, 0);
          m.vy = 0.6 + Math.random() * 0.5; m.vx = 0;
          assignTrajectory(m);
        }

        // ── boss logic (P0: fan / ring / aimed patterns + 半血狂暴) ──
        if (state.boss) {
          const b = state.boss;
          if (!b.alive) {
            state.boss = null; setBossHp(0);
          } else {
            b.attackTimer++;
            const cx = b.x + 22, cy = b.y + 36;

            // ── phase 2 (狂暴) transition — announcement + impact + brief rage shield ──
            if (b.phase === 0 && b.hp < b.maxHp * 0.6) {
              b.phase = 1;
              b.rageTimer = 90; // ~1.5s of armor while it unleashes
              state.shakeX = 22; state.shakeY = 22;
              state.enemyBullets.releaseAll();
              emitExplosion(cx, cy, 60, ["#f97316", "#ef4444", "#fef08a", "#fff"], 9, 55, 0.02, 6);
              pushNotice("BOSS 狂暴化!", "#ff6b6b");
              audio.bossWarning();
            }
            // ── phase 3 (濒死) transition — final desperation ──
            if (b.phase === 1 && b.hp < b.maxHp * 0.3) {
              b.phase = 2;
              b.rageTimer = 60; // ~1s of armor while it flails
              state.shakeX = 20; state.shakeY = 20;
              emitExplosion(cx, cy, 50, ["#ef4444", "#f97316", "#fff"], 9, 50, 0.02, 6);
              pushNotice("BOSS 濒死!", "#ff2020");
              audio.bossWarning();
            }
            if (b.rageTimer > 0) b.rageTimer--;
            const enraged = b.phase >= 1;
            const desperate = b.phase >= 2;

            if (b.type === "fortress") {
              if (b.y < 40) { b.y += b.speed; }
              else {
                b.x += Math.sin(f * 0.02) * 1.5; b.x = Math.max(0, Math.min(CW - 52, b.x));
                b.y = 40 + Math.sin(f * 0.011) * 18;
              }
              const gap = enraged ? 28 : 44;
              if (b.attackTimer > 80 && b.attackTimer % gap === 0) {
                // aimed 5-way fan
                const dx = state.player.x + 10 - cx;
                const dy = state.player.y + 12 - cy;
                const base = Math.atan2(dy, dx);
                for (let a = -2; a <= 2; a++) {
                  const ang = base + a * 0.22;
                  spawnEnemyBullet(cx, cy, Math.cos(ang) * 2.5, Math.sin(ang) * 2.5);
                }
              }
              if (enraged && b.attackTimer % 120 === 0) {
                // ring burst
                for (let a = 0; a < 14; a++) {
                  const ang = (a / 14) * Math.PI * 2;
                  spawnEnemyBullet(cx, cy, Math.cos(ang) * 1.9, Math.sin(ang) * 1.9);
                }
              }
              if (enraged && b.attackTimer % 60 === 0) {
                spawnEnemyBullet(b.x + 4, cy, -1.6, 2.6);
                spawnEnemyBullet(b.x + 40, cy, 1.6, 2.6);
              }
            } else if (b.type === "carrier") {
              if (b.y < 30) { b.y += b.speed; }
              else {
                b.x += Math.sin(f * 0.03) * 2.5; b.x = Math.max(0, Math.min(CW - 48, b.x));
                b.y = 30 + Math.sin(f * 0.013) * 22;
              }
              if (enraged && b.attackTimer % 120 === 0 && state.monsters.items.filter((m) => m.alive).length < 12) {
                for (let i = 0; i < (enraged ? 3 : 2); i++) {
                  const m = spawnMonster(b.x + 10 + i * 20, b.y + 28, "fighter", fighterHp, 0);
                  m.vy = 1.5 + Math.random(); m.vx = (Math.random() - 0.5) * 0.5;
                }
              }
              if (b.attackTimer > 80 && b.attackTimer % (enraged ? 32 : 50) === 0) {
                // aimed double shot
                const dx = state.player.x + 10 - (b.x + 20);
                const dy = state.player.y + 12 - cy;
                const dist = Math.hypot(dx, dy) || 1;
                spawnEnemyBullet(b.x + 8, cy, (dx / dist) * 2.5, (dy / dist) * 2.5);
                spawnEnemyBullet(b.x + 32, cy, (dx / dist) * 2.5, (dy / dist) * 2.5);
              }
            } else {
              if (b.y < 50) { b.y += b.speed; }
              else {
                b.x += Math.sin(f * 0.04) * 3; b.x = Math.max(0, Math.min(CW - 48, b.x));
                b.y = 50 + Math.sin(f * 0.009) * 24;
              }
              const gap = enraged ? 36 : 58;
              if (b.attackTimer > 80 && b.attackTimer % gap === 0) {
                // aimed 3-way + rotating spiral
                const dx = state.player.x + 10 - cx;
                const dy = state.player.y + 12 - cy;
                const base = Math.atan2(dy, dx);
                for (let a = -1; a <= 1; a++) {
                  const ang = base + a * 0.3;
                  spawnEnemyBullet(cx, cy, Math.cos(ang) * 2.6, Math.sin(ang) * 2.6);
                }
              }
              if (enraged && b.attackTimer % 80 === 0) {
                for (let a = 0; a < 8; a++) {
                  const ang = (a / 8) * Math.PI * 2 + f * 0.02;
                  spawnEnemyBullet(cx, cy, Math.cos(ang) * 2.1, Math.sin(ang) * 2.1);
                }
              }
              if (enraged && b.attackTimer % 24 === 0) {
                spawnEnemyBullet(b.x + 4, cy, -1.3, 2.6);
                spawnEnemyBullet(b.x + 36, cy, 1.3, 2.6);
              }
            }

            // phase 2 (狂暴) 2-arm spiral — a distinct rotating stream
            if (desperate && b.attackTimer % 10 === 0) {
              const ang = b.attackTimer * 0.1;
              spawnEnemyBullet(cx, cy, Math.cos(ang) * 1.9, Math.sin(ang) * 1.9);
              spawnEnemyBullet(cx, cy, Math.cos(ang + Math.PI) * 1.9, Math.sin(ang + Math.PI) * 1.9);
            }

            // ── boss charged laser (aimed; telegraphs via 蓄力 phase) ──
            const laserInterval = desperate ? 220 : 300;
            if (enraged && b.attackTimer % laserInterval === 0) {
              const ang = Math.atan2(state.player.y + 12 - cy, state.player.x + 12 - cx);
              spawnBeam(cx, cy, ang);
              audio.bossWarning(); // 蓄力开始提示
            }

            // phase 3 (濒死) full radial ring — applies to all boss types
            if (desperate && b.attackTimer % 40 === 0) {
              for (let a = 0; a < 20; a++) {
                const ang = (a / 20) * Math.PI * 2 + f * 0.01;
                spawnEnemyBullet(cx, cy, Math.cos(ang) * 2.3, Math.sin(ang) * 2.3);
              }
            }
          }
        }

        // ── monster fire (aimed shots + elite spread, gentle ramp with time) ──
        const fireGap = Math.max(58, 95 - tier * 7);
        const fireChance = Math.min(0.6, 0.28 + tier * 0.06);
        state.monsters.forEachActive((m) => {
          if (m.formation) return;
          if (f % fireGap !== 0) return;
          if (Math.random() > fireChance) return;
          const mx = m.x + 12, my = m.y + 16;
          const dx = (state.player.x + 10) - mx;
          const dy = (state.player.y + 12) - my;
          if (m.type === "elite") {
            const base = Math.atan2(dy, dx);
            for (let a = -1; a <= 1; a++) {
              const ang = base + a * 0.28;
              spawnEnemyBullet(mx, my, Math.cos(ang) * 2.4, Math.sin(ang) * 2.4);
            }
          } else if (Math.random() < 0.45) {
            const dist = Math.hypot(dx, dy) || 1;
            spawnEnemyBullet(mx, my, (dx / dist) * 2.3, (dy / dist) * 2.3);
          } else {
            spawnEnemyBullet(mx, my, 0, 2.4);
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

        // ── boss charged laser beams ──
        state.beams.forEachActive((beam) => {
          beam.timer--;
          const dx = Math.cos(beam.angle), dy = Math.sin(beam.angle);
          if (beam.state === "charging") {
            beam.width = Math.min(16, beam.width + 0.25);
            // 蓄力：粒子沿光束向炮口汇聚
            if (f % 2 === 0) {
              const d = 40 + Math.random() * 90;
              const spd = 2 + Math.random() * 2;
              spawnParticle(beam.x + dx * d, beam.y + dy * d, -dx * spd, -dy * spd, "#ff9090", 2, 18);
            }
            if (beam.timer <= 0) {
              beam.state = "firing";
              beam.timer = 40;
              beam.width = 16;
              state.shakeX = 12; state.shakeY = 12;
              // 炮口爆点
              emitExplosion(beam.x, beam.y, 14, ["#ff6060", "#ffa0a0", "#fff"], 4, 18, 0, 3);
            }
          } else {
            // 发射：沿线火花
            if (f % 2 === 0) {
              const d = Math.random() * beam.length;
              spawnParticle(
                beam.x + dx * d, beam.y + dy * d,
                (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3,
                ["#ff4040", "#ff8080", "#ffffff"][Math.floor(Math.random() * 3)],
                2 + Math.random() * 2, 15,
              );
            }
            if (beam.timer <= 0) state.beams.release(beam);
          }
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
                const energyVal = energyValue(m.type);
                for (let ef = 0; ef < (m.type === "elite" ? 3 : 1); ef++) {
                  spawnEnergyFragment(m.x + 4 + Math.random() * 12, m.y + 4 + Math.random() * 8, energyVal);
                }
                emitExplosion(m.x + 8, m.y + 8, 6, ["#FFD83D", "#FF6050"], 5, 25);
                audio.explosion();
                state.monsters.release(m);
                addKillScore(m.type);
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
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
                const energyVal = energyValue(m.type);
                for (let ef = 0; ef < (m.type === "elite" ? 3 : 1); ef++) {
                  spawnEnergyFragment(m.x + 4 + Math.random() * 12, m.y + 4 + Math.random() * 8, energyVal);
                }
                emitExplosion(m.x + 8, m.y + 8, 6, ["#FFD83D", "#FF6050"], 5, 25);
                audio.explosion();
                state.monsters.release(m);
                addKillScore(m.type);
                checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
              }
              hit = true;
            }
          });
        });

        // ── power-ups ──
        state.powerUps.forEachActive((pu) => {
          pu.y += 0.8;
          pu.x = Math.max(6, Math.min(CW - 6, pu.x));
          const px = state.player.x;
          const py = state.player.y;
          if (pu.x > px - 4 && pu.x < px + 32 && pu.y > py - 4 && pu.y < py + 32) {
            state.powerUps.release(pu);
            if (pu.type === "optionForm") {
              // S-item: switch Option form
              const nextForm = state.optionForm === "greenLaser" ? "purpleWing" : "greenLaser";
              state.optionForm = nextForm;
              setOptionForm(nextForm);
              pushNotice(nextForm === "purpleWing" ? "副机形态: 翼" : "副机形态: 激光", "#f97316");
              emitExplosion(pu.x, pu.y, 20, ["#a855f7", "#c084fc", "#fff"], 8, 35, 0.02, 5);
              audio.powerUp();
            } else if (pu.type === "wingman") {
              // Wingman power-up
              if (state.wingmanLevel < 4) {
                state.wingmanLevel++;
                setWingmanLevel(state.wingmanLevel);
                const wn = state.wingmanLevel;
                pushNotice(
                  wn === 1 ? "僚机加入! (1架)" : wn === 2 ? "僚机 +1! (2架)" : wn === 3 ? "僚机环绕! (4架)" : "僚机觉醒!",
                  "#c084fc",
                );
              } else {
                pushNotice("僚机已满级", "#c084fc");
              }
              emitExplosion(pu.x, pu.y, 15, ["#c084fc", "#a855f7", "#fff"], 6, 30, 0.02, 4);
              audio.powerUp();
            } else {
              // Weapon power-up
              if (state.overdriveTimer > 0) {
                state.overdriveTimer = Math.min(600, state.overdriveTimer + 180);
                setOverdriveTimer(state.overdriveTimer);
                pushNotice("MAX 火力延长!", "#f97316");
              } else if (state.weaponLevel >= 3) {
                state.weaponLevel = 4; state.overdriveTimer = 300;
                setWeaponLevel(4); setOverdriveTimer(300);
                pushNotice("MAX 火力!", "#f97316");
              } else {
                const n = Math.min(3, state.weaponLevel + 1);
                state.weaponLevel = n; setWeaponLevel(n);
                pushNotice(`主武器 Lv${n}!`, COLORS.playerBullet);
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
              if (b.rageTimer > 0) {
                state.bullets.release(bullet);
                emitExplosion(bullet.x, bullet.y, 2, ["#fef08a", "#fbbf24"], 2);
                return;
              }
              b.hp--;
              state.bullets.release(bullet);
              emitExplosion(bullet.x, bullet.y, 3, ["#fbbf24"], 3);
              if (b.hp <= 0) {
                emitExplosion(b.x + 22, b.y + 16, 70, ["#f97316", "#ef4444", "#fef08a", "#fff"], 9, 55, 0.02, 6);
                emitExplosion(b.x + 6, b.y + 24, 40, ["#fbbf24", "#f97316", "#fff"], 7, 45, 0.02, 5);
                emitExplosion(b.x + 38, b.y + 8, 40, ["#ef4444", "#f97316", "#fff"], 7, 45, 0.02, 5);
                setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                setBossHp(0);
                b.alive = false;
                state.boss = null;
                state.bossCooldown = 180;
                state.shakeX = 24; state.shakeY = 24;
                pushNotice("BOSS 击破! +1000", "#facc15");
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
                if (b2.rageTimer > 0) {
                  state.missiles.release(ms);
                  emitExplosion(ms.x, ms.y, 3, ["#fef08a", "#fbbf24"], 3);
                  return;
                }
                b2.hp -= 3;
                state.missiles.release(ms);
                emitExplosion(ms.x, ms.y, 8, ["#f97316", "#fef08a", "#ef4444"], 5);
                if (b2.hp <= 0) {
                  emitExplosion(b2.x + 22, b2.y + 16, 70, ["#f97316", "#ef4444", "#fef08a", "#fff"], 9, 55, 0.02, 6);
                  emitExplosion(b2.x + 6, b2.y + 24, 40, ["#fbbf24", "#f97316", "#fff"], 7, 45, 0.02, 5);
                  emitExplosion(b2.x + 38, b2.y + 8, 40, ["#ef4444", "#f97316", "#fff"], 7, 45, 0.02, 5);
                  setScore((prev) => { const n = prev + 1000; state.score = n; return n; });
                  setBossHp(0); b2.alive = false; state.boss = null;
                  state.bossCooldown = 180;
                  state.shakeX = 24; state.shakeY = 24;
                  pushNotice("BOSS 击破! +1000", "#facc15");
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

        const ENERGY_MAGNET = state.magnetModeTimer > 0 ? 280 : 160;
        state.energyFrags.forEachActive((ef) => {
          // drift and slow down
          ef.age++;
          // 初始爆散（衰减）
          ef.x += ef.vx; ef.y += ef.vy;
          ef.vx *= 0.97; ef.vy *= 0.97;
          // 自动滚动：缓慢下漂 + 左右摆动，不会冻在原地
          ef.y += 0.4;
          ef.x += Math.sin(ef.age * 0.05 + ef.phase) * 0.7;
          ef.x = Math.max(4, Math.min(CW - 4, ef.x));
          // magnet pull toward player
          const edx = (p.x + 14) - ef.x;
          const edy = (p.y + 12) - ef.y;
          const edist = Math.sqrt(edx * edx + edy * edy);
          if (edist < ENERGY_MAGNET && edist > 2) {
            const epull = (1 - edist / ENERGY_MAGNET) * 3 + 0.4;
            ef.x += (edx / edist) * epull;
            ef.y += (edy / edist) * epull;
          }
          // collection
          if (ef.x > p.x - 4 && ef.x < p.x + 32 && ef.y > p.y - 4 && ef.y < p.y + 32) {
            state.weaponEnergy += ef.value;
            state.energyNeeded = 80 * state.weaponLevel;
            emitExplosion(ef.x, ef.y, 3, [COLORS.playerBullet, "#fff"], 3);
            state.energyFrags.release(ef);
            // level up check
            if (state.weaponEnergy >= state.energyNeeded && state.weaponLevel < 4) {
              state.weaponEnergy = 0;
              if (state.overdriveTimer > 0) {
                state.overdriveTimer += 120;
                setOverdriveTimer(state.overdriveTimer);
                pushNotice("MAX 火力延长!", "#f97316");
              } else if (state.weaponLevel >= 3) {
                state.weaponLevel = 4; state.overdriveTimer = 300;
                setWeaponLevel(4); setOverdriveTimer(300);
                pushNotice("MAX 火力!", "#f97316");
              } else {
                state.weaponLevel++;
                setWeaponLevel(state.weaponLevel);
                pushNotice(`主武器 Lv${state.weaponLevel}!`, COLORS.playerBullet);
              }
              state.energyNeeded = state.weaponLevel < 4 ? 80 * state.weaponLevel : Infinity;
              emitExplosion(p.x + 12, p.y + 12, 50, [COLORS.player, COLORS.playerBullet, "#fff"], 9, 55, 0.02, 6);
              state.shakeX = Math.max(state.shakeX, 10);
              state.shakeY = Math.max(state.shakeY, 10);
              state.levelUpFreezeTimer = 75;
              state.levelUpFlashTimer = 18;
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
          // beam (laser) collision — only while firing
          let hitBeam = false;
          state.beams.forEachActive((beam) => {
            if (hitBeam || beam.state !== "firing") return;
            const bdx = Math.cos(beam.angle), bdy = Math.sin(beam.angle);
            const ex = p.x + 12 - beam.x, ey = p.y + 12 - beam.y;
            const proj = ex * bdx + ey * bdy;
            if (proj > 0 && proj < beam.length) {
              const perp = Math.abs(ex * bdy - ey * bdx);
              if (perp < beam.width / 2 + 5) hitBeam = true;
            }
          });
          if (hitMonster || hitBullet || hitBoss || hitMiniboss || hitBeam) {
            emitExplosion(p.x + 12, p.y + 14, 20, ["#60a5fa", "#93c5fd", "#fff"], 10);
            audio.playerHit();
            setLives((prev) => {
              if (prev <= 1) { stateRef.current.isGameOver = true; setIsGameOver(true); return 0; }
              // 折中死亡惩罚：主武器掉 1 级（下限 1），能量清零
              if (state.overdriveTimer > 0) {
                state.overdriveTimer = 0;
                setOverdriveTimer(0);
                state.weaponLevel = 3;
              } else {
                state.weaponLevel = Math.max(1, state.weaponLevel - 1);
              }
              setWeaponLevel(state.weaponLevel);
              state.weaponEnergy = 0;
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
          const eVal = energyValue(m.type);
          for (let ef = 0; ef < (m.type === "elite" ? 3 : 1); ef++) {
            spawnEnergyFragment(m.x + 4 + Math.random() * 12, m.y + 4 + Math.random() * 8, eVal);
          }
          emitExplosion(m.x + 8, m.y + 8, 10, ["#ef4444", "#f97316", "#fff"], 6);
          audio.explosion();
          state.monsters.release(m);
          addKillScore(m.type);
          checkFormationClear(m.x + 8, m.y + 8, m.formationGroup);
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
        drawMissileSprite(ctx, ms.x, ms.y, f);
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

          if (state.invincible) drawShield(ctx, sp.x, sp.y, f);
          drawPlayerShip(ctx, sp.x, sp.y, playerTiltRef.current, f);



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
          const lpT = Math.max(0, Math.min(1, state.levelUpFreezeTimer / 75));
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

      // ── Option / Slash rendering (解锁僚机后才显示) ──
      if (stateRef.current.gameStarted && !stateRef.current.isGameOver && stateRef.current.wingmanLevel > 0) {
        for (const opt of state.options) {
          if (opt.transformProgress > 0.1) {
            drawPurpleWingOption(ctx, opt.x, opt.y, opt.transformProgress, f);
          }
          if (opt.transformProgress < 0.9) {
            drawGreenOption(ctx, opt.x, opt.y, f);
          }
        }
        // slash effects
        state.slashEffects.forEachActive((se) => {
          drawSlashEffect(ctx, se);
        });
      }

      // monsters
      state.monsters.forEachActive((m) => drawMonsterShip(ctx, m, m.x, m.y, f));

      // boss
      if (state.boss) {
        drawBossShip(ctx, state.boss.x, state.boss.y, state.boss.hp, state.boss.maxHp, state.boss.type, f);
      }
      // miniboss
      if (state.miniboss) {
        drawMinibossShip(ctx, state.miniboss, state.miniboss.x, state.miniboss.y, f);
      }

      // boss charged lasers
      state.beams.forEachActive((beam) => drawBeam(ctx, beam, f));


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

      // ── energy fragments (size + color scale with value) ──
      state.energyFrags.forEachActive((ef) => {
        const pulse = Math.sin(f * 0.1 + ef.x) * 0.2 + 0.8;
        const floatY = Math.sin(f * 0.08 + ef.x * 0.05) * 2;
        const big = ef.value >= 20;   // elite
        const mid = ef.value >= 12;   // bomber
        const scale = big ? 1.5 : mid ? 1.15 : 1;
        const color = big ? COLORS.powerUp : COLORS.playerBullet; // gold = high value
        ctx.save();
        ctx.globalAlpha = 0.7 * pulse;
        ctx.translate(ef.x + 5, ef.y + 5 + floatY);
        ctx.scale(scale, scale);
        // diamond shape
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = big ? 18 : 8;
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
        ctx.arc(0, 0, big ? 2.5 : 2, 0, Math.PI * 2);
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

      // ── combo chain indicator (P1: chain multiplier HUD) ──
      if (state.comboKills >= 5 && stateRef.current.gameStarted && !stateRef.current.isGameOver) {
        const mult = 1 + Math.min(4, Math.floor(state.comboKills / 10));
        const comboColor = mult >= 4 ? "#f97316" : mult >= 2 ? "#facc15" : COLORS.playerBullet;
        const comboLabel = mult >= 2 ? `COMBO x${mult}` : `COMBO ${state.comboKills}`;
        const pp = state.player;
        ctx.save();
        ctx.globalAlpha = 0.85 + Math.sin(f * 0.15) * 0.15;
        ctx.shadowColor = comboColor;
        ctx.shadowBlur = 12;
        drawText(ctx, comboLabel, pp.x + 12, pp.y - 20, comboColor, 8, "center", 2);
        ctx.restore();
      }

      // ── weak prompt (soft notification) ──
      if (state.noticeTimer > 0) {
        const na = Math.min(1, state.noticeTimer / 40);
        ctx.save();
        ctx.globalAlpha = na;
        ctx.font = "bold 14px monospace";
        const tw = ctx.measureText(state.noticeText).width;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(CW / 2 - tw / 2 - 8, 45, tw + 16, 22);
        ctx.shadowColor = state.noticeColor;
        ctx.shadowBlur = 10;
        drawText(ctx, state.noticeText, CW / 2, 56, state.noticeColor, 14, "center", 3);
        ctx.restore();
      }

      // ── level-up full-screen flash (P1) ──
      if (state.levelUpFlashTimer > 0) {
        const fa = state.levelUpFlashTimer / 18;
        ctx.save();
        ctx.globalAlpha = fa * 0.5;
        ctx.fillStyle = "#7dd3fc";
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();
      }

      // ── boss phase 2/3 danger filter (red tint strengthens at 濒死) ──
      if (state.boss && state.boss.phase >= 1) {
        const desperate = state.boss.phase >= 2;
        const pa = desperate ? 0.14 + Math.sin(f * 0.15) * 0.04 : 0.07 + Math.sin(f * 0.12) * 0.03;
        ctx.save();
        ctx.globalAlpha = pa;
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(0, 0, CW, CH);
        ctx.restore();
      }

      ctx.restore();
    };

    // 固定 60fps 基准（累加器）：高刷屏/掉帧都保证游戏速度稳定
    const loop = (now: number) => {
      if (lastTime === 0) lastTime = now;
      acc += now - lastTime;
      lastTime = now;
      acc = Math.min(acc, 100); // 上限，避免掉帧后追帧过多
      while (acc >= STEP) {
        acc -= STEP;
        step();
      }
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
  }, [gameStarted, isGameOver]); // audio 方法均为 useCallback 稳定引用；去掉 audio 避免每次 setState 重跑游戏循环

  // Score-accelerated boss spawn (time-driven floor lives in the game loop).
  // Disabled once the wave table is exhausted (bossLoop > 0) so the endless
  // time-driven cycle isn't pulled back to the final wave by a high score.
  useEffect(() => {
    if (!isGameOver && gameStarted && stateRef.current.bossLoop === 0) {
      const state = stateRef.current;
      for (let i = WAVE_TABLE.length - 1; i > state.lastWaveSpawned; i--) {
        if (score >= WAVE_TABLE[i].score) { triggerBossWave(i); break; }
      }
    }
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
    state.beams.releaseAll();
    state.powerUps.releaseAll();
    state.energyFrags.releaseAll();
    state.weaponEnergy = 0;
    state.energyNeeded = 80;
    state.comboKills = 0;
    state.comboTimer = 0;
    state.magnetModeTimer = 0;
    state.levelUpFreezeTimer = 0;
    state.levelUpFlashTimer = 0;
    state.noticeText = ""; state.noticeTimer = 0;
    state.boss = null;
    state.miniboss = null;
    state.player = { x: 180, y: 460, vx: 0, vy: 0, speed: 5 };
    state.invincible = false; state.invincibleTimer = 0;
    state.respawnTimer = 0;
    state.shakeX = 0; state.shakeY = 0;
    state.score = 0;
    state.hasHoming = false;
    state.gachaLocked = false;
    state.gachaCost = 10; state.formationGroupCounter = 0;
    state.overdriveTimer = 0; state.lastWaveSpawned = -1;
    state.bossTimer = 0; state.bossInterval = 5400; state.bossLoop = 0; state.elapsedFrames = 0;
    state.nextWaveFrame = 60; state.nextFormationFrame = 240; state.nextSoloFrame = 600;
    state.bossCooldown = 0; state.minibossCooldown = 0; state.wingmanLevel = 0; state.wingmanOrbitAngle = 0; state.bossWarningTimer = 0; state.preGameCountdown = 0;
    state.optionForm = "greenLaser";
    setOptionForm("greenLaser");
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
              href="/games"
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
          <div ref={containerRef} className="relative">
            <canvas
              ref={canvasRef}
              width={CW}
              height={CH}
              className="block touch-none cursor-crosshair w-full"
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

                {/* Top-right: BOMB */}
                <div className="absolute top-1.5 right-1.5 flex flex-col items-end" style={{ zIndex: 1 }}>
                  <p className="pixel-font text-[5px] tracking-[2px]" style={{ color: COLORS.textDim }}>BOMB</p>
                  <p className="pixel-font text-[10px] leading-tight" style={{ color: COLORS.missile, textShadow: `0 0 6px ${COLORS.missile}60` }}>
                    {"B".repeat(Math.max(0, bombCount))}
                    {bombCount <= 0 && <span style={{ color: COLORS.textDim }}>-</span>}
                  </p>
                </div>

                {/* Right-side abilities panel (compact) */}
                <div className="absolute top-[54px] right-1.5 flex flex-col items-end gap-[3px] pointer-events-none" style={{ zIndex: 1 }}>
                  <div className="flex items-center gap-1" style={{ color: overdriveTimer > 0 ? "#f97316" : COLORS.playerBullet }}>
                    <span className="text-[9px] leading-none">{WEAPON_ICONS[weaponType]}</span>
                    <span className="pixel-font text-[7px]">{WEAPON_NAMES[weaponType]}</span>
                    <span className="pixel-font text-[7px]">{overdriveTimer > 0 ? "MAX" : "Lv" + Math.min(weaponLevel, 4)}</span>
                  </div>
                  <div className="flex items-center gap-1" style={{ color: wingmanLevel > 0 ? (wingmanLevel >= 4 ? "#facc15" : wingmanLevel >= 3 ? "#22d3ee" : "#c084fc") : COLORS.textDim }}>
                    <span className="text-[9px] leading-none">✈️</span>
                    <span className="pixel-font text-[7px]">僚机</span>
                    <span className="pixel-font text-[7px]">{wingmanLevel > 0 ? (wingmanLevel === 1 ? "●" : wingmanLevel === 2 ? "●●" : wingmanLevel === 3 ? "●●●●" : "觉醒") : "-"}</span>
                  </div>
                  <div className="flex items-center gap-1" style={{ color: optionForm === "purpleWing" ? "#c084fc" : "#4ade80" }}>
                    <span className="text-[9px] leading-none">◈</span>
                    <span className="pixel-font text-[7px]">副机</span>
                    <span className="pixel-font text-[7px]">{optionForm === "purpleWing" ? "翼" : "激光"}</span>
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
                        style={{ width: `${(bossHp / Math.max(1, stateRef.current.boss?.maxHp ?? 50)) * 100}%`, background: COLORS.explosion }}
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
