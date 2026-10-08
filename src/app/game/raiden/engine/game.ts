// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 游戏内核
// 纯逻辑 + 固定 60Hz 步进。除了画布本身，不接触 React。
// ═══════════════════════════════════════════════════════════════════

import {
  BOSS_ORDER,
  BOSS_TABLE,
  ELEMENT_MOD,
  ENERGY,
  ENEMY_PROTO,
  H,
  PLAYER,
  SHIP_ELEMENT,
  STAGE_SCALE,
  W,
  WEAPON_TABLE,
  WING_X,
  WING_Y,
  WORD,
} from "./config";
import {
  applyCard,
  damageMul,
  elementBonus,
  fireRateMul,
  guardFrames,
  lv,
  magnetRadius,
  pierceCount,
  rollOffer,
  startingBombs,
  startingHp,
} from "./cards";
import { makePool, type Pool } from "./pools";
import type {
  AudioAdapter,
  Blast,
  Bullet,
  CardDef,
  Element,
  EngineEvents,
  EngineHandle,
  Enemy,
  FloatText,
  Fragment,
  MetaData,
  Particle,
  Phase,
  RunState,
  RunStats,
  ShipType,
  Zap,
} from "./types";
import { stardustFor } from "./meta";
import { createSprites, type SpriteBank } from "../render/sprites";
import { drawWorld } from "../render/scene";

// ── 世界：状态 + 全部对象池 ──

export interface World {
  s: RunState;
  /** 玩家子弹 */
  pb: Pool<Bullet>;
  /** 敌弹 */
  eb: Pool<Bullet>;
  en: Pool<Enemy>;
  fr: Pool<Fragment>;
  pt: Pool<Particle>;
  ft: Pool<FloatText>;
  /** 击破爆炸 */
  bl: Pool<Blast>;
  /** 连锁闪电的电弧 */
  z: Pool<Zap>;
}

const CAP = {
  pb: 400,
  eb: 1400,
  en: 160,
  fr: 260,
  pt: 700,
  ft: 24,
  bl: 48,
  z: 40,
} as const;

function newBullet(): Bullet {
  return {
    x: 0, y: 0, vx: 0, vy: 0, dmg: 0, r: 3,
    pierce: 0, element: "fire", big: false, life: 0, wing: false, lastUid: 0,
  };
}

function newEnemy(): Enemy {
  return {
    uid: 0, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, r: 12, kind: 0,
    element: "fire", resist: null, weak: null, t: 0, fireCd: 60, flash: 0,
    slow: 0, burn: 0, amp: 0, ph: 0, score: 0, energy: 0,
  };
}

function newFragment(): Fragment {
  return { x: 0, y: 0, vx: 0, vy: 0, value: 0, t: 0 };
}

function newParticle(): Particle {
  return { x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, frame: 0 };
}

function newFloat(): FloatText {
  return { x: 0, y: 0, t: 0, life: 1, sprite: 0, scale: 1 };
}

function newBlast(): Blast {
  return { x: 0, y: 0, t: 0, size: 64 };
}

function newZap(): Zap {
  return { x1: 0, y1: 0, x2: 0, y2: 0, t: 0, seed: 0 };
}

export function createWorld(): World {
  return {
    s: createRun("ion", null),
    pb: makePool(CAP.pb, newBullet),
    eb: makePool(CAP.eb, newBullet),
    en: makePool(CAP.en, newEnemy),
    fr: makePool(CAP.fr, newFragment),
    pt: makePool(CAP.pt, newParticle),
    ft: makePool(CAP.ft, newFloat),
    bl: makePool(CAP.bl, newBlast),
    z: makePool(CAP.z, newZap),
  };
}

export function createRun(ship: ShipType, meta: MetaData | null): RunState {
  const hp = startingHp(meta?.upgrades.life ?? 0);
  const bombs = startingBombs(meta?.upgrades.bomb ?? 0);
  return {
    phase: "menu",
    t: 0,
    score: 0,
    kills: 0,
    stage: 1,
    player: {
      x: W / 2, y: H - 110, r: PLAYER.hitR,
      hp, maxHp: hp,
      bombs, maxBombs: bombs,
      invuln: PLAYER.invulnOnSpawn, fireCd: 0,
    },
    ship,
    weaponLv: 1,
    upgrades: 0,
    energy: 0,
    energyNeed: ENERGY.base,
    cards: {},
    revivesLeft: 1 + (meta?.upgrades.revive ?? 0),
    reviveCount: 0,
    offer: [],
    stageTimer: 22 * 60,
    bossCooldown: 0,
    spawnCd: 60,
    boss: null,
    bossWarn: 0,
    countdown: 0,
    reviveTimer: 0,
    announce: "",
    announceTimer: 0,
    announceMax: 0,
    shake: 0,
    bgScroll: 0,
    splitTimer: 0,
    guardTimer: 0,
    freeze: 0,
    muzzle: 0,
    flash: 0,
    flashRed: false,
  };
}

function clearWorld(w: World) {
  w.pb.clear();
  w.eb.clear();
  w.en.clear();
  w.fr.clear();
  w.pt.clear();
  w.ft.clear();
  w.bl.clear();
  w.z.clear();
}

function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}

function pickElement(): Element {
  const r = Math.random();
  return r < 0.34 ? "electric" : r < 0.67 ? "fire" : "ice";
}

function pickOther(e: Element): Element {
  const rest = (["electric", "fire", "ice"] as Element[]).filter((x) => x !== e);
  return rest[Math.floor(Math.random() * rest.length)];
}

// ═══════════════════════════════════════════════════════════════════
// 引擎
// ═══════════════════════════════════════════════════════════════════

export function createEngine(
  canvas: HTMLCanvasElement,
  audio: AudioAdapter,
  events: EngineEvents,
): EngineHandle {
  const ctx = canvas.getContext("2d", { alpha: false });
  const w = createWorld();
  let sprites: SpriteBank | null = null;
  let dpr = 1;
  let paused = false;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let destroyed = false;
  let meta: MetaData | null = null;
  let msAvg = 16.7;
  let shootToggle = 0;
  let enemyUid = 0;

  const keys: Record<string, boolean> = Object.create(null);
  let drag: { x: number; y: number; ax: number; ay: number } | null = null;

  // ── 像素密度适配 ──
  // 缩放必须由「CSS 宽度 × devicePixelRatio ÷ 逻辑宽度」算出，
  // 只乘 devicePixelRatio 的话，画布被 CSS 放大后硬边还是会糊。
  function setupCanvas() {
    const device = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width > 0 ? rect.width : W;
    const scale = Math.min(3, Math.max(1, (cssW * device) / W));
    // 容器尺寸尚未就绪时先不改动，等布局稳定后这一次调用会自动补上
    if (sprites && Math.abs(scale - dpr) < 0.01) return;
    dpr = scale;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    sprites = createSprites(scale);
  }
  setupCanvas();

  // ── 输入 ──
  function toLocal(clientX: number, clientY: number) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * H,
    };
  }

  function onPointerDown(e: PointerEvent) {
    // 倒计时期间也允许拖拽，让玩家能先摆好位置
    if ((w.s.phase !== "playing" && w.s.phase !== "countdown") || paused) return;
    audio.init();
    const p = toLocal(e.clientX, e.clientY);
    drag = { x: p.x, y: p.y, ax: w.s.player.x, ay: w.s.player.y };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag) return;
    const p = toLocal(e.clientX, e.clientY);
    w.s.player.x = clamp(drag.ax + (p.x - drag.x), 14, W - 14);
    w.s.player.y = clamp(drag.ay + (p.y - drag.y), 24, H - 24);
  }

  function onPointerUp() { drag = null; }

  function onKeyDown(e: KeyboardEvent) {
    keys[e.key.toLowerCase()] = true;
    if (w.s.phase !== "playing" || paused) return;
    if (e.key === " " || e.key === "b" || e.key === "B") { e.preventDefault(); useBomb(); }
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
  }

  function onKeyUp(e: KeyboardEvent) { keys[e.key.toLowerCase()] = false; }
  function onResize() { setupCanvas(); }

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(canvas);

  // ═══════════════════════════════════════════════════════════════
  // 生成物
  // ═══════════════════════════════════════════════════════════════

  function emitFloat(x: number, y: number, sprite: number, life: number) {
    const f = w.ft.spawn();
    if (!f) return;
    f.x = x; f.y = y; f.t = 0; f.life = life; f.sprite = sprite; f.scale = 1;
  }

  function emitBurst(x: number, y: number, big: boolean) {
    const n = big ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const p = w.pt.spawn();
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const sp = (big ? 2.2 : 1.4) * (0.4 + Math.random());
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.t = Math.floor(Math.random() * 3);
      p.life = 16 + Math.random() * 8;
      p.frame = 0;
    }
  }

  function dropFragment(x: number, y: number, value: number) {
    const f = w.fr.spawn();
    if (!f) return;
    f.x = x; f.y = y;
    const a = Math.random() * Math.PI * 2;
    f.vx = Math.cos(a) * 1.2;
    f.vy = Math.sin(a) * 1.2 - 0.6;
    f.value = value;
    f.t = 0;
  }

  function spawnBlast(x: number, y: number, size: number) {
    const b = w.bl.spawn();
    if (!b) return;
    b.x = x; b.y = y; b.t = 0; b.size = size;
  }

  function spawnZap(x1: number, y1: number, x2: number, y2: number) {
    const z = w.z.spawn();
    if (!z) return;
    z.x1 = x1; z.y1 = y1; z.x2 = x2; z.y2 = y2;
    z.t = 0; z.seed = Math.random() * 100;
  }

  /** 屏幕中央公告。记下起始帧数，渲染层才能算出正确的淡入 */
  function announce(text: string, frames: number) {
    const s = w.s;
    s.announce = text;
    s.announceTimer = frames;
    s.announceMax = frames;
  }

  function fireEnemyBullet(
    x: number, y: number, vx: number, vy: number, element: Element, big: boolean,
  ) {
    const b = w.eb.spawn();
    if (!b) return;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.element = element; b.big = big; b.r = big ? 7 : 4;
    b.dmg = 1; b.pierce = 0; b.life = 700;
  }

  function firePlayerBullet(
    x: number, y: number, vx: number, vy: number, dmg: number, big: boolean, wing = false,
  ) {
    const b = w.pb.spawn();
    if (!b) return;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.dmg = dmg; b.big = big; b.r = big ? 5 : 3;
    b.element = SHIP_ELEMENT[w.s.ship];
    // 离子炮的定位就是「贯穿激光」，天生带 1 次穿透；贯穿卡在此基础上叠加
    b.pierce = pierceCount(w.s) + (w.s.ship === "ion" ? 1 : 0);
    b.life = 220;
    b.lastUid = 0;
    b.wing = wing;
  }

  function spawnEnemy(kind: 0 | 1 | 2) {
    const e = w.en.spawn();
    if (!e) return;
    const proto = ENEMY_PROTO[kind];
    const scale = Math.pow(STAGE_SCALE.hp, w.s.stage - 1);
    e.kind = kind;
    e.uid = ++enemyUid;
    e.x = 34 + Math.random() * (W - 68);
    e.y = -30;
    e.r = proto.r;
    e.maxHp = Math.round(proto.hp * scale);
    e.hp = e.maxHp;
    e.score = Math.round(proto.score * Math.pow(STAGE_SCALE.score, w.s.stage - 1));
    e.energy = proto.energy;
    e.fireCd = proto.fireCd + Math.random() * 40;
    e.t = 0; e.flash = 0; e.slow = 0; e.burn = 0;
    e.amp = 12 + Math.random() * 28;
    e.ph = Math.random() * Math.PI * 2;
    e.element = pickElement();

    // 属性克制：小怪多为中性，中/精英必带弱点与抗性
    if (kind === 0) {
      e.weak = Math.random() < 0.25 ? pickElement() : null;
      e.resist = null;
    } else {
      const weak = pickElement();
      e.weak = weak;
      e.resist = pickOther(weak);
    }

    if (kind === 0) {
      e.vx = (Math.random() - 0.5) * 1.1;
      e.vy = 1.6 + Math.random() * 1.2;
    } else {
      e.vx = 0;
      e.vy = kind === 1 ? 1.0 : 0.72;
    }
  }

  function spawnBoss() {
    const s = w.s;
    const type = BOSS_ORDER[(s.stage - 1) % BOSS_ORDER.length];
    const info = BOSS_TABLE[type];
    const scale = Math.pow(STAGE_SCALE.hp, s.stage - 1);
    const weak = pickElement();
    const hp = Math.round(info.hp * scale);
    s.boss = {
      x: W / 2, y: -80, hp, maxHp: hp, type,
      element: info.element, weak, resist: pickOther(weak),
      t: 0, phase: 0, fireCd: 40, flash: 0, dying: 0,
    };
    s.bossWarn = 90;
    announce(`STAGE ${s.stage} · ${info.name}`, 150);
    audio.bossWarning();
    emitFloat(W / 2, H / 2 - 60, WORD.warn, 60);
  }

  // ═══════════════════════════════════════════════════════════════
  // 玩家行为
  // ═══════════════════════════════════════════════════════════════

  function weaponStep() {
    const table = WEAPON_TABLE[w.s.ship];
    return table[Math.min(table.length, Math.max(1, w.s.weaponLv)) - 1];
  }

  function firePlayer() {
    const s = w.s;
    s.muzzle = 4;
    const lvl = weaponStep();
    const mul = damageMul(s);
    const big = s.weaponLv >= 4;
    const splitLv = lv(s, "split");
    const extra = splitLv > 0 && s.splitTimer > 0 ? 2 * splitLv : 0;
    const n = lvl.n + extra;
    const py = s.player.y - 20;

    if (s.ship === "nova") {
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;
        firePlayerBullet(s.player.x + t * 13, py, t * 1.5, -11.5, lvl.dmg * mul, big);
      }
    } else if (s.ship === "pulse") {
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        firePlayerBullet(s.player.x + off * 8, py, Math.sin(off * 0.7) * 1.1, -10.5, lvl.dmg * mul, big);
      }
    } else {
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        firePlayerBullet(s.player.x + off * 9, py, 0, -14, lvl.dmg * mul, big);
      }
    }

    if (lv(s, "backfire") > 0 && s.t % 2 === 0) {
      firePlayerBullet(s.player.x, s.player.y + 16, 0, 8, lvl.dmg * 0.45 * mul, false);
    }

    const wings = lv(s, "wings");
    for (let k = 1; k <= wings; k++) {
      const off = WING_X[k] ?? WING_X[WING_X.length - 1];
      firePlayerBullet(s.player.x - off, s.player.y + WING_Y, 0, -11, lvl.dmg * 0.6 * mul, false, true);
      firePlayerBullet(s.player.x + off, s.player.y + WING_Y, 0, -11, lvl.dmg * 0.6 * mul, false, true);
    }

    shootToggle ^= 1;
    if (shootToggle) audio.shoot(s.ship === "ion" ? 1 : s.ship === "pulse" ? 2 : 0);
  }

  function useBomb() {
    const s = w.s;
    if (s.player.bombs <= 0) return;
    s.player.bombs--;
    s.shake = 16;
    audio.bomb();
    w.eb.clear();
    for (let i = w.en.n - 1; i >= 0; i--) {
      const e = w.en.items[i];
      e.hp -= 34;
      e.flash = 4;
      if (e.hp <= 0) killEnemy(i);
    }
    if (s.boss) {
      s.boss.hp -= 130;
      s.boss.flash = 5;
    }
    // 炸弹是全场最重的一击：停帧和全屏闪光都拉满
    s.freeze = Math.max(s.freeze, 8);
    s.flash = 16;
    s.flashRed = false;
    emitFloat(W / 2, H / 2, WORD.clear, 60);
  }

  function killEnemy(i: number) {
    const e = w.en.items[i];
    const s = w.s;
    // 停帧：精英咬得更久一点（取 max，避免同一帧多杀时被后来的覆盖掉）
    s.freeze = Math.max(s.freeze, e.kind > 0 ? 3 : 2);
    emitBurst(e.x, e.y, e.kind > 0);
    spawnBlast(e.x, e.y, e.kind === 0 ? 54 : e.kind === 1 ? 78 : 112);
    audio.explosion(e.kind > 0);
    s.score += e.score;
    s.kills++;
    dropFragment(e.x, e.y, e.energy);
    if (e.kind > 0) dropFragment(e.x + 10, e.y, e.energy);
    emitFloat(e.x, e.y - 8, WORD.kill + (Math.random() < 0.5 ? 0 : 1), 40);
    if (e.kind === 2) emitFloat(e.x, e.y - 26, WORD.elite, 46);

    const leech = lv(s, "leech");
    if (leech > 0 && s.kills % 40 === 0 && s.player.hp < s.player.maxHp) {
      s.player.hp++;
      audio.powerUp();
    }

    w.en.kill(i);
  }

  function hitPlayer() {
    const s = w.s;
    if (s.player.invuln > 0) return;
    s.player.hp--;
    s.player.invuln = PLAYER.invulnOnHit + guardFrames(s);
    s.shake = 12;
    s.freeze = Math.max(s.freeze, 5);
    s.flash = 12;
    s.flashRed = true;
    audio.playerHit();
    emitBurst(s.player.x, s.player.y, false);
    emitFloat(s.player.x, s.player.y - 24, WORD.hurt, 40);
    if (s.player.hp <= 0) onPlayerDown();
  }

  function onPlayerDown() {
    const s = w.s;
    s.player.hp = 0;
    if (s.revivesLeft > 0) {
      s.phase = "revive";
      s.reviveTimer = 8 * 60;
      emit("revive", [], null);
    } else {
      finishRun();
    }
  }

  function doRevive() {
    const s = w.s;
    s.revivesLeft--;
    s.reviveCount++;
    s.player.hp = Math.max(1, Math.ceil(s.player.maxHp / 2));
    s.player.invuln = 6 * 60;
    if (lv(s, "revive") > 0) s.weaponLv = 4;
    s.player.bombs = Math.min(s.player.maxBombs, s.player.bombs + 1);
    w.eb.clear();
    s.shake = 14;
    s.phase = "playing";
    emit("playing", [], null);
    audio.powerUp();
  }

  function finishRun() {
    const s = w.s;
    s.phase = "gameover";
    audio.stopBgm();
    const stats: RunStats = {
      score: s.score,
      kills: s.kills,
      stage: s.stage,
      revives: s.reviveCount,
      seconds: Math.round(s.t / 60),
      stardust: stardustFor(s.score),
      isRecord: meta ? s.score > meta.highScore : false,
    };
    emit("gameover", [], stats);
  }

  function emit(phase: Phase, offer: CardDef[], stats: RunStats | null) {
    events.onPhase(phase, offer, stats);
  }

  // ═══════════════════════════════════════════════════════════════
  // 步进
  // ═══════════════════════════════════════════════════════════════

  /** 键盘走位（拖拽时由 pointermove 直接接管） */
  function movePlayer() {
    if (drag) return;
    const p = w.s.player;
    let dx = 0;
    let dy = 0;
    if (keys["a"] || keys["arrowleft"]) dx -= 1;
    if (keys["d"] || keys["arrowright"]) dx += 1;
    if (keys["w"] || keys["arrowup"]) dy -= 1;
    if (keys["s"] || keys["arrowdown"]) dy += 1;
    if (!dx && !dy) return;
    const l = Math.hypot(dx, dy);
    p.x = clamp(p.x + (dx / l) * PLAYER.speed, 14, W - 14);
    p.y = clamp(p.y + (dy / l) * PLAYER.speed, 24, H - 24);
  }

  function step() {
    const s = w.s;
    s.t++;
    s.bgScroll += 0.9;
    if (s.shake > 0) s.shake *= 0.86;

    // ── 命中停帧：让每一下"咬"住一瞬，世界停、画面继续 ──
    if (s.freeze > 0) {
      s.freeze--;
      return;
    }

    if (s.phase === "countdown") {
      // 倒计时期间就能走位，只是敌人和开火还没开始
      movePlayer();
      if (--s.countdown <= 0) {
        s.phase = "playing";
        announce("GO!", 60);
        s.muzzle = 6;
        s.flash = 10;
        s.flashRed = false;
        s.shake = 8;
        emit("playing", [], null);
      }
      return;
    }
    if (s.phase === "revive") {
      if (--s.reviveTimer <= 0) doRevive();
      return;
    }
    if (s.phase !== "playing") return;

    if (s.player.invuln > 0) s.player.invuln--;
    if (s.splitTimer > 0) s.splitTimer--;
    if (s.announceTimer > 0) s.announceTimer--;
    if (s.bossCooldown > 0) s.bossCooldown--;
    if (s.muzzle > 0) s.muzzle--;
    if (s.flash > 0) s.flash--;

    movePlayer();

    if (--s.player.fireCd <= 0) {
      s.player.fireCd = Math.max(3, Math.round(weaponStep().cd * fireRateMul(s)));
      firePlayer();
    }

    if (!s.boss) {
      if (--s.stageTimer <= 0) spawnBoss();
      if (--s.spawnCd <= 0) {
        s.spawnCd = Math.max(18, 58 - s.stage * 4);
        const roll = Math.random();
        if (s.stage >= 2 && roll < 0.18) spawnEnemy(2);
        else if (roll < 0.5) spawnEnemy(1);
        else spawnEnemy(0);
        if (Math.random() < 0.35) spawnEnemy(0);
      }
    }

    updateEnemies();
    updateBoss();
    updatePlayerBullets();
    updateEnemyBullets();
    updateFragments();
    updateParticles();
    updateBlasts();
    updateZaps();
    updateFloats();
  }

  function updateEnemies() {
    const s = w.s;
    const chillLv = lv(s, "chill");
    for (let i = w.en.n - 1; i >= 0; i--) {
      const e = w.en.items[i];
      e.t++;
      if (e.flash > 0) e.flash--;
      if (e.slow > 0) e.slow--;

      if (e.burn > 0) {
        e.burn--;
        if (e.burn % 30 === 0) {
          e.hp -= 6;
          e.flash = 2;
          if (e.hp <= 0) { killEnemy(i); continue; }
        }
      }

      const slowMul = e.slow > 0 ? 1 - 0.22 * chillLv : 1;
      if (e.kind === 0) {
        e.x += e.vx + Math.sin(e.t * 0.06 + e.ph) * 0.9;
        e.y += e.vy * slowMul;
      } else {
        e.y += e.vy * slowMul;
        e.x += Math.sin(e.t * 0.03 + e.ph) * 1.1;
      }
      if (e.y > H + 50) { w.en.kill(i); continue; }

      if (--e.fireCd <= 0) {
        e.fireCd = e.kind === 0 ? 78 + Math.random() * 60 : 54;
        const dx = s.player.x - e.x;
        const dy = s.player.y - e.y;
        const l = Math.hypot(dx, dy) || 1;
        if (e.kind === 0) {
          fireEnemyBullet(e.x, e.y + 10, (dx / l) * 3.0, (dy / l) * 3.0, e.element, false);
        } else {
          const n = e.kind === 1 ? 3 : 5;
          for (let k = 0; k < n; k++) {
            const ang = Math.atan2(dy, dx) + (k - (n - 1) / 2) * 0.26;
            fireEnemyBullet(e.x, e.y + 12, Math.cos(ang) * 2.8, Math.sin(ang) * 2.8, e.element, true);
          }
        }
      }
    }
  }

  function updateBoss() {
    const s = w.s;
    const B = s.boss;
    if (!B) return;
    B.t++;
    if (B.flash > 0) B.flash--;

    if (B.dying > 0) {
      B.dying--;
      if (B.dying % 6 === 0) {
        const bx = B.x + (Math.random() - 0.5) * 130;
        const by = B.y + (Math.random() - 0.5) * 80;
        emitBurst(bx, by, true);
        spawnBlast(bx, by, 120 + Math.random() * 40);
        audio.explosion(true);
      }
      if (B.dying <= 0) {
        s.score += Math.round(4000 * Math.pow(STAGE_SCALE.score, s.stage - 1));
        s.boss = null;
        s.stage++;
        s.stageTimer = 22 * 60;
        s.bossCooldown = 90;
        s.shake = 18;
        emitFloat(W / 2, H / 2, WORD.clear, 70);
        s.flash = Math.max(s.flash, 20);
        s.flashRed = false;
        announce(`STAGE ${s.stage}`, 110);
      }
      return;
    }

    if (B.hp <= 0) {
      B.dying = 60;
      w.eb.clear();
      s.freeze = Math.max(s.freeze, 12);
      s.flash = Math.max(s.flash, 14);
      s.flashRed = false;
      audio.explosion(true);
      return;
    }

    if (B.y < 96) B.y += 1.2;
    else B.x = W / 2 + Math.sin(B.t * 0.018) * 96;

    const frac = B.hp / B.maxHp;
    const ph = frac > 0.66 ? 0 : frac > 0.33 ? 1 : 2;
    if (ph !== B.phase) {
      B.phase = ph;
      emitBurst(B.x, B.y, true);
      emitFloat(B.x, B.y - 44, WORD.elite, 46);
      s.shake = 10;
      s.freeze = Math.max(s.freeze, 6);
      s.flash = Math.max(s.flash, 10);
      s.flashRed = false;
    }

    if (B.y < 96) return;

    if (--B.fireCd <= 0) {
      B.fireCd = B.phase === 2 ? 26 : B.phase === 1 ? 38 : 52;
      const n = 7 + B.phase * 4;
      const off = B.t * 0.05;
      for (let i = 0; i < n; i++) {
        const ang = off + (i * Math.PI * 2) / n;
        fireEnemyBullet(
          B.x + Math.cos(ang) * 26,
          B.y + 30,
          Math.cos(ang) * 2.4,
          Math.abs(Math.sin(ang)) * 1.2 + 1.6,
          B.element,
          true,
        );
      }
      s.shake = 3;
    }
    if (B.phase >= 2 && B.t % 7 === 0) {
      fireEnemyBullet(
        B.x + (Math.random() - 0.5) * 130,
        B.y + 34,
        (Math.random() - 0.5) * 4,
        3.4,
        B.element,
        false,
      );
    }
  }

  // 卡本身就是效果的来源，不再要求子弹属性匹配。
  // 之前用 element === "fire"/"ice" 过滤，导致离子炮和脉冲拿到这两张卡时完全失效。
  function applyStatus(e: Enemy) {
    const s = w.s;
    const burn = lv(s, "burn");
    if (burn > 0) e.burn = Math.min(150, e.burn + 45 * burn);
    const chill = lv(s, "chill");
    if (chill > 0) e.slow = 75;
  }

  /** 连锁闪电：以命中点为中心，电击最近的另一个敌人 */
  function chainFrom(x: number, y: number, element: Element, skip: Enemy | null) {
    const chainLv = lv(w.s, "chain");
    if (chainLv <= 0) return;
    let best = -1;
    let bestD = 95 * 95;
    for (let k = 0; k < w.en.n; k++) {
      const o = w.en.items[k];
      if (o === skip) continue;
      const dx = o.x - x;
      const dy = o.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = k; }
    }
    if (best < 0) return;
    const o = w.en.items[best];
    const mod = o.weak === element
      ? ELEMENT_MOD.weak + elementBonus(w.s)
      : o.resist === element ? ELEMENT_MOD.resist : 1;
    o.hp -= 5 * chainLv * mod;
    o.flash = 2;
    spawnZap(x, y, o.x, o.y);
    if (o.hp <= 0) killEnemy(best);
  }

  function updatePlayerBullets() {
    const s = w.s;
    for (let i = w.pb.n - 1; i >= 0; i--) {
      const b = w.pb.items[i];
      b.x += b.vx;
      b.y += b.vy;
      if (--b.life <= 0 || b.y < -30 || b.y > H + 30 || b.x < -20 || b.x > W + 20) {
        w.pb.kill(i);
        continue;
      }

      let consumed = false;

      for (let j = w.en.n - 1; j >= 0; j--) {
        const e = w.en.items[j];
        const dx = b.x - e.x;
        const dy = b.y - e.y;
        const rr = e.r + b.r;
        if (dx * dx + dy * dy > rr * rr) continue;
        // 穿透弹不能反复打同一个敌人，否则穿透次数全被它吃掉
        if (e.uid === b.lastUid) continue;

        const ex = e.x;
        const ey = e.y;
        let mod = 1;
        if (e.weak === b.element) mod = ELEMENT_MOD.weak + elementBonus(s);
        else if (e.resist === b.element) mod = ELEMENT_MOD.resist;
        e.hp -= b.dmg * mod;
        e.flash = 3;
        b.lastUid = e.uid;

        const dead = e.hp <= 0;
        if (dead) {
          if (lv(s, "split") > 0) s.splitTimer = 120;
          killEnemy(j);
        } else {
          applyStatus(e);
        }
        chainFrom(ex, ey, b.element, dead ? null : e);

        if (b.pierce > 0) b.pierce--;
        else consumed = true;
        break;
      }

      const B = s.boss;
      if (!consumed && B && B.dying <= 0 && B.y > 60) {
        if (Math.abs(b.x - B.x) < 66 && Math.abs(b.y - B.y) < 40) {
          let mod = 1;
          if (B.weak === b.element) mod = ELEMENT_MOD.weak + elementBonus(s);
          else if (B.resist === b.element) mod = ELEMENT_MOD.resist;
          B.hp -= b.dmg * mod;
          B.flash = 3;
          // 打 Boss 时也要触发连锁（之前只在打小怪时调用，Boss 战里这张卡等于失效）
          chainFrom(b.x, b.y, b.element, null);
          if (b.pierce > 0) b.pierce--;
          else consumed = true;
        }
      }

      if (consumed) w.pb.kill(i);
    }
  }

  function updateEnemyBullets() {
    const s = w.s;
    for (let i = w.eb.n - 1; i >= 0; i--) {
      const b = w.eb.items[i];
      b.x += b.vx;
      b.y += b.vy;
      if (--b.life <= 0 || b.y > H + 30 || b.y < -60 || b.x < -40 || b.x > W + 40) {
        w.eb.kill(i);
        continue;
      }
      if (s.player.invuln > 0) continue;
      const dx = b.x - s.player.x;
      const dy = b.y - s.player.y;
      const rr = b.r + s.player.r;
      if (dx * dx + dy * dy < rr * rr) {
        w.eb.kill(i);
        hitPlayer();
      }
    }
  }

  function updateFragments() {
    const s = w.s;
    const magnet = magnetRadius(s);
    const magnet2 = magnet * magnet;
    for (let i = w.fr.n - 1; i >= 0; i--) {
      const f = w.fr.items[i];
      f.t++;
      const dx = s.player.x - f.x;
      const dy = s.player.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < magnet2) {
        const d = Math.sqrt(d2) || 1;
        const pull = 0.9 + (1 - d / magnet) * 2.4;
        f.vx += (dx / d) * pull;
        f.vy += (dy / d) * pull;
      } else {
        f.vy += 0.045;
      }
      f.vx *= 0.94;
      f.vy *= 0.96;
      f.x += f.vx;
      f.y += f.vy;

      if (d2 < 200) {
        gainEnergy(f.value);
        audio.pick();
        w.fr.kill(i);
        continue;
      }
      if (f.y > H + 30) w.fr.kill(i);
    }

    // 统一结算：一帧内吃到多个碎片也只开一次三选一，不会把选项覆盖掉
    drainEnergy();
  }

  // 只负责累加能量。开三选一的时机交给 drainEnergy()。
  function gainEnergy(v: number) {
    const s = w.s;
    const rate = 1 + (meta?.upgrades.energy ?? 0) * 0.12;
    s.energy += v * rate;
  }

  /**
   * 能量溢出就开一次三选一。
   * 只在 playing 阶段开：否则同一帧连吃几个碎片会连续调用，把前面的选项覆盖掉。
   * 溢出的部分留在 energy 里，选完卡后会再次结算。
   */
  function drainEnergy() {
    const s = w.s;
    if (s.phase !== "playing") return;
    if (s.energy < s.energyNeed) return;
    s.energy -= s.energyNeed;
    s.energyNeed = Math.round(s.energyNeed * ENERGY.growth);
    openCardOffer();
  }

  function openCardOffer() {
    const s = w.s;
    // 带上已拥有层数：UI 靠它把「新获得」和「升级」区分开
    s.offer = rollOffer(s.cards, 3).map((c) => ({ ...c, lv: s.cards[c.id] ?? 0 }));
    s.phase = "card";
    audio.card();
    emit("card", s.offer, null);
  }

  function updateParticles() {
    for (let i = w.pt.n - 1; i >= 0; i--) {
      const p = w.pt.items[i];
      p.t++;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 + 0.05;
      if (p.t >= 4) w.pt.kill(i);
    }
  }

  function updateBlasts() {
    for (let i = w.bl.n - 1; i >= 0; i--) {
      const b = w.bl.items[i];
      b.t++;
      // 10 帧 / 5 张图 = 每张显示 2 帧，整段约 166ms
      if (b.t >= 10) w.bl.kill(i);
    }
  }

  function updateZaps() {
    for (let i = w.z.n - 1; i >= 0; i--) {
      const z = w.z.items[i];
      z.t++;
      if (z.t >= 8) w.z.kill(i);
    }
  }

  function updateFloats() {
    for (let i = w.ft.n - 1; i >= 0; i--) {
      const f = w.ft.items[i];
      f.t++;
      f.y -= 0.5;
      f.scale = 1 + f.t * 0.012;
      if (f.t >= f.life) w.ft.kill(i);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 主循环
  // ═══════════════════════════════════════════════════════════════

  const STEP_MS = 1000 / 60;
  let sizeTick = 0;

  function frame(now: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    // 每 15 帧复核一次容器尺寸：初始布局未就绪时也能自己纠正
    if ((sizeTick = (sizeTick + 1) % 15) === 0) setupCanvas();
    if (!last) last = now;
    const dt = Math.min(100, now - last);
    last = now;
    msAvg = msAvg * 0.92 + dt * 0.08;

    if (!paused) {
      acc += dt;
      let guard = 0;
      while (acc >= STEP_MS && guard++ < 5) {
        acc -= STEP_MS;
        step();
      }
    } else {
      acc = 0;
    }

    if (sprites && ctx) drawWorld(ctx, sprites, w, dpr, msAvg);
  }

  function togglePause() {
    if (w.s.phase !== "playing") return;
    paused = !paused;
    audio.click();
  }

  // ═══════════════════════════════════════════════════════════════
  // 对外接口
  // ═══════════════════════════════════════════════════════════════

  const handle: EngineHandle = {
    start(ship, m) {
      meta = m;
      clearWorld(w);
      w.s = createRun(ship, m);
      w.s.phase = "countdown";
      w.s.countdown = 3 * 60;
      announce("READY", 3 * 60);
      paused = false;
      drag = null;
      audio.init();
      audio.startBgm();
      emit("countdown", [], null);
    },
    chooseCard(id) {
      const s = w.s;
      if (s.phase !== "card") return;
      applyCard(s, id);
      s.offer = [];
      s.phase = "playing";
      emit("playing", [], null);
      // 能量要是溢出不止一级，选完这张立刻接着开下一次三选一
      drainEnergy();
    },
    useRevive() {
      if (w.s.phase !== "revive") return;
      doRevive();
    },
    giveUp() {
      if (w.s.phase !== "revive") return;
      finishRun();
    },
    togglePause,
    setPaused(v) { paused = v; },
    isPaused() { return paused; },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      audio.stopBgm();
    },
  };

  raf = requestAnimationFrame(frame);
  return handle;
}
