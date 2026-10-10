// ═══════════════════════════════════════════════════════════════════
// POP3D — 游戏循环、世界状态与局内构筑
// 固定步长积分 + rAF 渲染。这里没有 React，也没有 three。
// ═══════════════════════════════════════════════════════════════════

import { cardDef, rollOffer } from "./cards";
import {
  UP_ANGLE,
  SHIP_BULLET,
  bulletDef,
  fanShotAngles,
  homingStep,
  splitShotAngles,
} from "./bullets";
import type { PlayerBulletKind } from "./bullets";
import {
  BEAM,
  BOSS,
  BOSS_PHASE,
  BURST,
  CARDS,
  EBULLET,
  ELEMENTS,
  ELEMENT_MOD,
  ENERGY,
  ENEMY_KINDS,
  FIELD,
  FX,
  FPS_SAMPLE_MS,
  HOMING,
  JUICE,
  LOOP,
  NUKE,
  PLAYER,
  POOL,
  POOL_WINGMEN,
  RUN,
  SCORE,
  SHIELD,
  SHIP_INFO,
  STATUS,
  WAVES,
  WEAPON_MAX_LV,
  WINGMAN,
  WORD_BOOM,
  WORD_CLEAR,
  WORD_HURT,
  WORD_KILL_BASE,
  WORD_KILL_COUNT,
  WORD_LEVEL,
  WORD_WARN,
} from "./config";
import { stardustFor } from "./meta";
import { aimedAngle, fanAngle, spiralAngle } from "./patterns";
import { createSlots } from "./pools";
// 命名债：approach 其实住在 rig.ts（当初为运镜写的），僚机跟随复用它。
// 它零相对导入，动它会连带 tests/pop3d-rig.test.mjs 的加载，故本批次不挪窝。
import { approach } from "./rig";
import { resolveSpawnXs } from "./waves";
import type {
  Boss,
  CardDef,
  Element,
  Enemy,
  EnemyKind,
  EnemyBullet,
  EnemyBulletKind,
  EntitySet,
  EngineHandle,
  EngineOptions,
  InputState,
  MetaData,
  Phase,
  Player,
  PlayerBullet,
  Pop,
  ShipType,
  WaveDef,
  Wingman,
  World,
} from "./types";
import { EMPTY_META } from "./types";

/** 由已选卡与局外养成推导出的战斗修正值：只在选卡/开局时重算 */
interface Mods {
  fireCd: number;
  bulletDmg: number;
  bulletCount: number;
  spreadAngle: number;
  pierce: number;
  element: Element | null;
  chain: number;
  burn: number;
  chill: number;
  /** 主武器强化层数 / 是否已进化（v2 卡） */
  wpn: number;
  wpnX: boolean;
  /** 僚机：攻击型 / 支援型层数与核心升级 */
  wingA: number;
  wingS: number;
  wingX: boolean;
  /** 永续护盾 / 生命核心 / 核弹扩容 */
  shieldX: boolean;
  hpX: boolean;
  nukeX: boolean;
  energyMul: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

function cloneMeta(m: MetaData): MetaData {
  return { ...m, upgrades: { ...m.upgrades } };
}

function makePlayerBullets(capacity: number): EntitySet<PlayerBullet> {
  const items: PlayerBullet[] = [];
  for (let i = 0; i < capacity; i += 1) {
    items.push({
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      r: 0,
      dmg: 0,
      hitCd: 0,
      kind: "bolt",
      pierce: 0,
      element: null,
      life: 0,
      angle: 0,
      age: 0,
      spin: 0,
      drift: 0,
      wAmp: 0,
      wFreq: 0,
      arm: 0,
      fromWing: false,
    });
  }
  return { items, slots: createSlots(capacity) };
}

function makeEnemyBullets(capacity: number): EntitySet<EnemyBullet> {
  const items: EnemyBullet[] = [];
  for (let i = 0; i < capacity; i += 1) {
    items.push({ x: 0, z: 0, vx: 0, vz: 0, r: 0, dmg: 0, hitCd: 0, kind: "ball", angle: 0 });
  }
  return { items, slots: createSlots(capacity) };
}

function makeWingmen(capacity: number): EntitySet<Wingman> {
  const items: Wingman[] = [];
  for (let i = 0; i < capacity; i += 1) {
    items.push({ slot: i, type: "attack", x: 0, z: 0, cd: 0, muzzle: 0, pulse: 0 });
  }
  return { items, slots: createSlots(capacity) };
}

function makeEnemies(capacity: number): EntitySet<Enemy> {
  const items: Enemy[] = [];
  for (let i = 0; i < capacity; i += 1) {
    items.push({
      kind: "drone",
      x: 0,
      z: 0,
      x0: 0,
      t: 0,
      vx: 0,
      vz: 0,
      amp: 0,
      w: 0,
      r: 0,
      scale: 1,
      hp: 0,
      maxHp: 0,
      cd: 0,
      shots: 0,
      flash: 0,
      burn: 0,
      slow: 0,
    });
  }
  return { items, slots: createSlots(capacity) };
}

function makeBursts(capacity: number): EntitySet<{ x: number; z: number; t: number; life: number; scale: number }> {
  const items: { x: number; z: number; t: number; life: number; scale: number }[] = [];
  for (let i = 0; i < capacity; i += 1) items.push({ x: 0, z: 0, t: 0, life: 0, scale: 1 });
  return { items, slots: createSlots(capacity) };
}

function makePops(capacity: number): EntitySet<Pop> {
  const items: Pop[] = [];
  for (let i = 0; i < capacity; i += 1) items.push({ x: 0, z: 0, t: 0, life: 0, word: 0, scale: 1 });
  return { items, slots: createSlots(capacity) };
}

function countAlive<T>(set: EntitySet<T>): number {
  let n = 0;
  for (let i = 0; i < set.slots.capacity; i += 1) if (set.slots.alive[i]) n += 1;
  return n;
}

const KEY_MAP: Record<string, keyof Pick<InputState, "up" | "down" | "left" | "right">> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

/** 调试驾驶员的候选横坐标数量（越大越会躲，也越费 CPU，仅调试路径使用） */
const AUTOPILOT_CANDIDATES = 9;
/** 拖动灵敏度：手指移动 1 像素，飞机移动 1.2 像素 */
const DRAG_SENSITIVITY = 1.2;
export function createEngine({
  mount,
  renderer,
  callbacks,
  audio,
  autopilot = false,
  stress = false,
  skipTo = 0,
}: EngineOptions): EngineHandle {
  const cardPool = CARDS;
  // ── 输入 ──
  const input: InputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    pointerActive: false,
    pointer: { x: 0, z: 0 },
    dragActive: false,
    dragPointer: { x: 0, z: 0 },
    dragPlayer: { x: 0, z: 0 },
  };

  const player: Player = {
    pos: { x: 0, z: PLAYER.spawnZ },
    vel: { x: 0, z: 0 },
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    invuln: 0,
    cd: 0,
  };

  const boss: Boss = {
    active: false,
    entering: false,
    x: 0,
    z: 0,
    t: 0,
    hp: 0,
    maxHp: 0,
    phase: 1,
    fanCd: 0,
    ringCd: 0,
    aimCd: 0,
    spiralCd: 0,
    spiralAngle: 0,
    flash: 0,
    weak: "fire",
    resist: "ice",
    burn: 0,
    slow: 0,
  };

  const world: World = {
    time: skipTo,
    frame: 0,
    phase: "menu",
    score: 0,
    kills: 0,
    level: 0,
    weaponLv: 1,
    ship: "nova",
    energy: 0,
    energyNeed: ENERGY.base,
    cards: {},
    revivesLeft: 0,
    revivesUsed: 0,
    player,
    input,
    playerBullets: makePlayerBullets(POOL.playerBullets),
    enemyBullets: makeEnemyBullets(POOL.enemyBullets),
    wingmen: makeWingmen(POOL_WINGMEN),
    shield: 0,
    shieldMax: 0,
    shieldPulse: 0,
    shieldBreak: 0,
    hpXUsed: false,
    hurtTimer: 0,
    nukes: 0,
    nukeMax: 0,
    nukeFx: 0,
    prismaticTaken: false,
    beam: { active: false, x: 0, z0: 0, z1: 0, halfW: BEAM.halfW, forks: false, tipZ: 0 },
    enemies: makeEnemies(POOL.enemies),
    bursts: makeBursts(POOL.bursts),
    pops: makePops(JUICE.popCap),
    boss,
    cine: { active: false, kind: "intro", t: 0, dur: 0 },
    timeScale: 1,
    bulletCount: 0,
    freeze: 0,
    shake: 0,
    muzzle: 0,
    warn: 0,
  };

  let meta: MetaData = cloneMeta(EMPTY_META);
  let ship: ShipType = "nova";
  let offer: CardDef[] = [];

  const mods: Mods = {
    fireCd: PLAYER.fireCd,
    bulletDmg: PLAYER.bulletDmg,
    bulletCount: 2,
    spreadAngle: 0.05,
    pierce: 0,
    element: null,
    chain: 0,
    burn: 0,
    chill: 0,
    wpn: 0,
    wpnX: false,
    wingA: 0,
    wingS: 0,
    wingX: false,
    shieldX: false,
    hpX: false,
    nukeX: false,
    energyMul: 1,
  };

  const minX = -FIELD.halfW + PLAYER.margin;
  const maxX = FIELD.halfW - PLAYER.margin;
  const minZ = -FIELD.halfH + PLAYER.margin;
  const maxZ = FIELD.halfH - PLAYER.margin;

  const waveTimers: number[] = WAVES.map(() => 0);
  let bossSpawned = false;
  let stressAngle = 0;
  let sfxKillCd = 0; // 击杀音效节流：密集波次下不能每杀都响
  let sparkCd = 0; // 命中火花节流

  // ── 循环状态 ──
  let raf = 0;
  let running = false;
  let last = 0;
  let acc = 0;

  // ── 帧率采样 ──
  let sampleFrames = 0;
  let sampleMs = 0;
  let sampleStart = 0;

  // ── 相位与 HUD ──

  function emitPhase(): void {
    callbacks?.onPhase?.(world.phase, world.phase === "card" ? offer : []);
  }

  function setPhase(next: Phase): void {
    world.phase = next;
    emitPhase();
  }

  function pushHud(): void {
    callbacks?.onHud?.({
      hp: player.hp,
      maxHp: player.maxHp,
      score: world.score,
      time: world.time,
      level: world.level,
      energyPct: world.energyNeed > 0 ? Math.min(1, world.energy / world.energyNeed) : 0,
      element: mods.element,
      shield: world.shield,
      shieldMax: world.shieldMax,
      nukes: world.nukes,
      revivesLeft: world.revivesLeft,
      bossHp: boss.active ? boss.hp : 0,
      bossMaxHp: boss.active ? boss.maxHp : 0,
      bossWeak: boss.active ? boss.weak : null,
      warn: world.warn > 0,
    });
  }

  /** 难度系数：随本局时间从 rampFrom 线性拉到 rampTo */
  function difficulty(): number {
    const t = Math.min(world.time / RUN.duration, 1);
    return RUN.rampFrom + (RUN.rampTo - RUN.rampFrom) * t;
  }

  // ── 构筑：卡牌 → 战斗修正值 ──

  function recomputeMods(): void {
    const c = (id: string): number => world.cards[id] ?? 0;
    const info = SHIP_INFO[ship];
    const metaPower = 1 + meta.upgrades.power * 0.08;

    mods.fireCd = PLAYER.fireCd * info.cdMul;
    mods.bulletCount = info.bulletCount + (world.weaponLv - 1);
    // 散射角度带机型倍率：小鱼干摊得开，激光笔集中
    mods.spreadAngle = 0.05 * info.spreadMul;
    mods.pierce = 0;
    mods.wpn = c("wpn");
    mods.wpnX = c("wpnX") > 0;
    mods.wingA = c("wingA");
    mods.wingS = c("wingS");
    mods.wingX = c("wingX") > 0;
    mods.shieldX = c("shieldX") > 0;
    mods.hpX = c("hpX") > 0;
    mods.nukeX = c("nukeX") > 0;
    // 主武器强化：**按当前弹型**给不同的成长（小鱼干/骨头加伤，激光笔是加宽，见 updateBeam）
    let dmgMul = info.dmgMul * metaPower;
    if (ship !== "ion") dmgMul *= Math.pow(1.25, mods.wpn);
    if (mods.wpnX && ship === "pulse") dmgMul *= 0.65; // 双骨头：单根弱一点
    mods.bulletDmg = PLAYER.bulletDmg * dmgMul;
    // 机型自带属性：电＝连锁、火＝灼烧、冰＝减速（属性不再进卡池）
    mods.element = info.element;
    mods.chain = info.element === "electric" ? 1 : 0;
    mods.burn = info.element === "fire" ? 1 : 0;
    mods.chill = info.element === "ice" ? 1 : 0;
    mods.energyMul = 1 + meta.upgrades.energy * 0.12;
    // 僚机编队跟着卡走（卡是数据、实体是状态；这里也覆盖开局时的清零）
    syncWingmen();
  }

  function computeEnergyNeed(): number {
    const flow = world.cards["flow"] ?? 0;
    return Math.max(
      50,
      Math.round(ENERGY.base * Math.pow(ENERGY.growth, world.level) * Math.pow(0.86, flow)),
    );
  }

  function gainEnergy(v: number): void {
    world.energy += v * mods.energyMul;
    if (world.energy >= world.energyNeed && world.phase === "playing") openCardOffer();
  }

  function openCardOffer(): void {
    world.energy -= world.energyNeed;
    world.level += 1;
    if (world.level % ENERGY.levelsPerWeaponUp === 0 && world.weaponLv < WEAPON_MAX_LV) {
      world.weaponLv += 1;
    }
    world.energyNeed = computeEnergyNeed();
    recomputeMods();
    // 炫彩卡每局只出一次（出现在它该出现的那次三选一里，跳过就没了）
    offer = rollOffer(world.cards, 3, cardPool, { prismatic: !world.prismaticTaken });
    if (offer.some((c) => c.tier === "prismatic")) world.prismaticTaken = true;
    spawnPop(player.pos.x, player.pos.z - 3, WORD_LEVEL, 1.6);
    audio?.card();
    setPhase("card");
    pushHud();
  }

  function applyCardInstant(id: string): void {
    switch (id) {
      case "hp":
        player.maxHp += 25;
        player.hp = Math.min(player.maxHp, player.hp + 25);
        break;
      case "hpX":
        player.maxHp += 50;
        player.hp = Math.min(player.maxHp, player.hp + 50);
        break;
      case "shield":
        world.shieldMax += 40;
        world.shield = world.shieldMax;
        world.shieldPulse = SHIELD.pulseTime;
        break;
      case "shieldX":
        world.shieldMax += 80;
        world.shield = world.shieldMax;
        world.shieldPulse = SHIELD.pulseTime;
        break;
      case "nuke":
        world.nukeMax = Math.min(NUKE.max, world.nukeMax + 1);
        world.nukes += 1;
        break;
      case "nukeX":
        world.nukeMax += 2;
        world.nukes += 2;
        break;
      case "wingA":
      case "wingS":
      case "wingX":
        // 卡是数据、实体是状态：拿了卡就立刻把僚机补到位
        // （applyCardInstant 在 recomputeMods 之前调用，所以这里按卡层数直接算）
        syncWingmen();
        break;
      default:
        break;
    }
  }

  function chooseCard(id: string): void {
    if (world.phase !== "card") return;
    const def = cardDef(id);
    if (!def) return;
    if ((world.cards[id] ?? 0) >= def.max) return;
    world.cards[id] = (world.cards[id] ?? 0) + 1;
    applyCardInstant(id);
    recomputeMods();
    audio?.click();
    offer = [];
    setPhase("playing");
    pushHud();
    if (world.energy >= world.energyNeed) openCardOffer(); // 一次拿够多张时连续弹
  }

  // ── 移动 ──
  function movePlayer(dt: number): void {
    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const kz = (input.down ? 1 : 0) - (input.up ? 1 : 0);

    if (kx !== 0 || kz !== 0) {
      // 键盘优先：等速直行，屏蔽指针跟随直到松手
      input.pointerActive = false;
      const len = Math.hypot(kx, kz) || 1;
      player.vel.x = (kx / len) * PLAYER.speed;
      player.vel.z = (kz / len) * PLAYER.speed;
      player.pos.x += player.vel.x * dt;
      player.pos.z += player.vel.z * dt;
    } else if (input.pointerActive) {
      const k = Math.min(1, PLAYER.follow * dt);
      player.pos.x += (input.pointer.x - player.pos.x) * k;
      player.pos.z += (input.pointer.z - player.pos.z) * k;
      player.vel.x = 0;
      player.vel.z = 0;
    } else {
      player.vel.x = 0;
      player.vel.z = 0;
    }

    player.pos.x = clamp(player.pos.x, minX, maxX);
    player.pos.z = clamp(player.pos.z, minZ, maxZ);
  }

  /**
   * 调试用自动驾驶员：在候选横坐标里挑"最安全又最接近目标"的一个。
   * 对来袭敌弹/敌机做落点预测再躲避，因此在密集弹幕下也能走完整局，
   * 用来做无人值守的难度观测。只走 ?auto=1 调试开关，不参与正式玩法。
   */
  function autopilotStep(dt: number): void {
    let targetX = 0;
    let found = false;
    if (boss.active && !boss.entering) {
      targetX = boss.x;
      found = true;
    } else {
      let bestDz = -Infinity;
      const es = world.enemies;
      for (let i = 0; i < es.slots.capacity; i += 1) {
        if (!es.slots.alive[i]) continue;
        const e = es.items[i];
        // 贴边游走的 weaver 不值得追：追过去等于自己撞上去
        if (Math.abs(e.x) > 12) continue;
        const dz = e.z - player.pos.z;
        if (dz >= 0) continue;
        if (dz > bestDz) {
          bestDz = dz;
          targetX = e.x;
          found = true;
        }
      }
    }
    if (!found) targetX = 0;

    const pz = player.pos.z;
    const bs = world.enemyBullets;
    const es = world.enemies;
    let bestScore = -Infinity;
    let bestX = player.pos.x;

    for (let c = 0; c < AUTOPILOT_CANDIDATES; c += 1) {
      const cx = minX + ((maxX - minX) * c) / (AUTOPILOT_CANDIDATES - 1);
      let danger = 0;

      // 来袭敌弹：预测到达玩家所在 z 时的横坐标
      for (let i = 0; i < bs.slots.capacity; i += 1) {
        if (!bs.slots.alive[i]) continue;
        const b = bs.items[i];
        if (b.vz <= 0) continue;
        const t = (pz - b.z) / b.vz;
        if (t <= 0 || t > 2.4) continue;
        const gap = Math.abs(b.x + b.vx * t - cx);
        if (gap > 3.0) continue;
        danger += (1 - gap / 3.0) * (1 - t / 2.4) * 14;
      }

      // 敌机撞机：weaver 是正弦走位，必须按正弦外推，直线预测会一直漏躲
      for (let i = 0; i < es.slots.capacity; i += 1) {
        if (!es.slots.alive[i]) continue;
        const e = es.items[i];
        if (e.vz <= 0) continue;
        const t = (pz - e.z) / e.vz;
        if (t <= 0 || t > 2.4) continue;
        const reach = e.r + player.radius + 2.2;
        const px =
          e.amp > 0
            ? e.x0 + e.vx * t + Math.sin((e.t + t) * e.w) * e.amp
            : e.x0 + e.vx * t;
        const gap = Math.abs(clamp(px, -FIELD.halfW + e.r, FIELD.halfW - e.r) - cx);
        if (gap > reach) continue;
        danger += (1 - gap / reach) * (1 - t / 2.4) * 16;
      }

      const score = -danger - Math.abs(cx - targetX) * 0.3 - Math.abs(cx - player.pos.x) * 0.2;
      if (score > bestScore) {
        bestScore = score;
        bestX = cx;
      }
    }

    const maxStep = PLAYER.speed * dt;
    player.pos.x += clamp(bestX - player.pos.x, -maxStep, maxStep);
    player.pos.z += clamp(PLAYER.spawnZ - player.pos.z, -maxStep, maxStep);
    player.pos.x = clamp(player.pos.x, minX, maxX);
    player.pos.z = clamp(player.pos.z, minZ, maxZ);
  }

  // ── 开火 ──
  // 复用同一个数组，避免每次齐射都新建（开火路径零分配）
  const shotAngles: number[] = [];
  const splitAngles: number[] = [];

  function spawnPlayerBullet(
    kind: PlayerBulletKind,
    x: number,
    z: number,
    vx: number,
    vz: number,
    dmgMul = 1,
    fromWing = false,
  ): number {
    const index = world.playerBullets.slots.acquire();
    if (index < 0) return -1;
    const def = bulletDef(kind);
    const b = world.playerBullets.items[index];
    b.kind = kind;
    b.x = x;
    b.z = z;
    b.vx = vx;
    b.vz = vz;
    b.r = def.radius;
    b.dmg = mods.bulletDmg * def.dmgMul * dmgMul;
    b.pierce = def.pierce + mods.pierce;
    b.element = mods.element;
    b.life = def.life;
    b.angle = Math.atan2(vz, vx);
    b.age = 0;
    b.spin = 0;
    b.drift = 0;
    b.wAmp = 0;
    b.wFreq = 0;
    b.arm = 0;
    // 哑铃弹：两瓣相位、自转方向、横漂、蛇形——全部每发随机，所以直线也会打空
    if (def.chaotic) {
      const c = def.chaotic;
      // 主武器强化：骨头变长（判定与外观一起长）
      b.arm = c.arm + mods.wpn * 0.15;
      b.angle = Math.random() * Math.PI * 2;
      b.spin = (Math.random() * 2 - 1) * c.spin;
      // 强化也让横漂收敛（更好命中）
      b.drift = (Math.random() * 2 - 1) * c.drift * Math.pow(0.85, mods.wpn);
      b.wAmp = c.amp * (0.4 + Math.random());
      b.wFreq = c.freq * (0.6 + Math.random() * 0.9);
    }
    b.fromWing = fromWing;
    // 刚生成的子母弹与父弹位置重合，给一点隔断防止同帧自我触发
    b.hitCd = 0.05;
    return index;
  }

  /** 在命中点生成 n 发子母弹（冲击波溅射与分裂弹共用） */
  function spawnSplit(x: number, z: number, baseAngle: number, n: number): void {
    const count = splitShotAngles(n, baseAngle, splitAngles);
    const def = bulletDef("mini");
    for (let k = 0; k < count; k += 1) {
      const a = splitAngles[k];
      spawnPlayerBullet("mini", x, z, Math.cos(a) * def.speed, Math.sin(a) * def.speed);
    }
  }

  function firePlayer(dt: number): void {
    // 1 号机不发射子弹，而是一道常驻光束（判定与渲染共用 world.beam 里的那组数）
    if (ship === "ion") {
      updateBeam(dt);
      return;
    }
    player.cd -= dt;
    if (player.cd > 0) return;
    player.cd = mods.fireCd;
    world.muzzle = JUICE.muzzle;
    // ion 在上面已经 return（常驻光束不走"每次开火"这条路），这里只有 nova / pulse
    audio?.shoot(ship === "pulse" ? 1 : 2);

    // 主炮：弹型由机型决定，扇形角度由 patterns 的几何公式给出
    const kind = SHIP_BULLET[ship];
    const def = bulletDef(kind);
    const n = mods.bulletCount;
    // 小鱼干的主武器强化是"加伤 + 提速"
    const speed = ship === "nova" ? def.speed * Math.pow(1.08, mods.wpn) : def.speed;
    fanShotAngles(n, mods.spreadAngle, shotAngles);
    for (let k = 0; k < n; k += 1) {
      const a = shotAngles[k];
      const off = k - (n - 1) / 2;
      spawnPlayerBullet(
        kind,
        player.pos.x + off * PLAYER.bulletSpread * 0.9,
        player.pos.z - 1.8,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
      );
    }

    // 骨头进化（炫彩）：一次射出两根、相位相反 —— 命中率翻倍，单根伤害已在上面的 dmgMul 里打过折
    if (mods.wpnX && ship === "pulse") {
      const first = spawnPlayerBullet(
        kind,
        player.pos.x,
        player.pos.z - 1.8,
        Math.cos(UP_ANGLE) * speed,
        Math.sin(UP_ANGLE) * speed,
      );
      if (first >= 0) world.playerBullets.items[first].angle += Math.PI;
    }
  }

  /**
   * 激光笔：从机头到场地顶端的一道常驻光束。
   * 判定 = 一条竖线（x = 玩家 x，z ∈ [z1, z0]）加半宽 halfW，和渲染是同一组数；
   * 伤害按 DPS × dt 连续结算，升级只加宽（弹数成长 → 束宽）。
   */
  function updateBeam(dt: number): void {
    const beam = world.beam;
    const bx = player.pos.x;
    const z0 = player.pos.z - 2;
    const z1 = -FIELD.halfH - BEAM.overhang;
    // 主武器强化：激光笔的成长是**加宽**（弹数成长也加宽）；进化则末端分叉
    const halfW = BEAM.halfW + Math.max(0, mods.bulletCount - 1) * BEAM.halfWPerLevel + mods.wpn * 0.15;
    beam.active = true;
    beam.forks = mods.wpnX;
    beam.x = bx;
    beam.z0 = z0;
    beam.z1 = z1;
    beam.halfW = halfW;
    beam.tipZ = z1;

    // 每秒伤害：沿用"单发伤害 ÷ 冷却"的口径，于是超频卡对光束就是 DPS 提升
    const dps =
      (mods.bulletDmg * bulletDef(SHIP_BULLET.ion).dmgMul * Math.pow(1.1, mods.wpn)) / mods.fireCd;
    const tickDmg = dps * BEAM.hitFxCd;
    const es = world.enemies;
    // ── 由近到远结算：默认只打"最靠前"的那一个，贯穿卡每层多穿一个目标 ──
    // 光束的绘制长度也只画到最后一个命中点，所以不会出现"光穿过敌人还在飞"。
    let pierceLeft = mods.pierce;
    let limitZ = z0;
    let hitAny = false;
    for (;;) {
      let bestIndex = -1;
      let bestZ = -Infinity;
      for (let i = 0; i < es.slots.capacity; i += 1) {
        if (!es.slots.alive[i]) continue;
        const e = es.items[i];
        if (e.z > limitZ || e.z < z1 - e.r) continue;
        if (Math.abs(e.x - bx) > e.r + halfW) continue;
        if (e.z > bestZ) {
          bestZ = e.z;
          bestIndex = i;
        }
      }
      const bossHit =
        boss.active &&
        !boss.entering &&
        boss.z <= limitZ &&
        boss.z >= z1 - BOSS.radius &&
        Math.abs(boss.x - bx) <= BOSS.radius + halfW;

      if (bossHit && boss.z >= bestZ) {
        const mul = elementMulFor(mods.element, boss.weak, boss.resist) * playerDamageMul();
        boss.hp -= dps * dt * mul;
        boss.flash = 0.08;
        bestZ = boss.z;
        hitAny = true;
        if (sparkCd <= 0) spawnSpark(boss.x, boss.z);
        if (boss.hp <= 0) {
          boss.hp = 0;
          win();
          return;
        }
      } else if (bestIndex >= 0) {
        const e = es.items[bestIndex];
        e.hp -= dps * dt * playerDamageMul();
        e.flash = 0.08;
        hitAny = true;
        if (sparkCd <= 0) {
          // 每帧都触发会很吵：光斑 / 连锁 / 分裂环统一按节流窗口走
          spawnSpark(e.x, e.z);
          if (mods.chain > 0) chainTo(e, bestIndex, tickDmg);
          if (mods.wpnX) {
            spawnSplit(e.x, e.z, -Math.PI / 2, 4); // 末端溅射环
            forkSplash(e.x, e.z, bestIndex, tickDmg * 0.4); // 分叉：再打最近的 2 个
          }
        }
        if (e.hp <= 0) killEnemy(e, bestIndex, true);
      } else {
        break;
      }

      beam.tipZ = bestZ; // 光束就画到这里为止
      if (pierceLeft <= 0) break;
      pierceLeft -= 1;
      limitZ = bestZ - 0.01; // 再往上找下一个目标
    }
    if (hitAny && sparkCd <= 0) sparkCd = BEAM.hitFxCd;
  }

  /** 激光分叉：从命中点再溅射给最近的 2 个敌人（各自 ×0.4） */
  function forkSplash(x: number, z: number, exclude: number, dmg: number): void {
    const es = world.enemies;
    let first = -1;
    let firstD2 = Infinity;
    let second = -1;
    let secondD2 = Infinity;
    for (let i = 0; i < es.slots.capacity; i += 1) {
      if (i === exclude || !es.slots.alive[i]) continue;
      const e = es.items[i];
      const dx = e.x - x;
      const dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 18 * 18) continue;
      if (d2 < firstD2) {
        secondD2 = firstD2;
        second = first;
        firstD2 = d2;
        first = i;
      } else if (d2 < secondD2) {
        secondD2 = d2;
        second = i;
      }
    }
    if (first >= 0) {
      const e1 = es.items[first];
      e1.hp -= dmg;
      e1.flash = 0.08;
      if (e1.hp <= 0) killEnemy(e1, first, true);
    }
    if (second >= 0) {
      const e2 = es.items[second];
      e2.hp -= dmg;
      e2.flash = 0.08;
      if (e2.hp <= 0) killEnemy(e2, second, true);
    }
  }

  function spawnEnemyBullet(
    kind: EnemyBulletKind,
    x: number,
    z: number,
    vx: number,
    vz: number,
    dmg: number,
  ): void {
    const index = world.enemyBullets.slots.acquire();
    if (index < 0) return;
    const b = world.enemyBullets.items[index];
    b.kind = kind;
    b.x = x;
    b.z = z;
    b.vx = vx;
    b.vz = vz;
    b.r = EBULLET[kind].radius;
    b.dmg = dmg;
    b.angle = Math.atan2(vz, vx);
    b.hitCd = 0;
  }

  // ── 僚机（实体编队，不是"多发子弹"）──
  /**
   * 僚机编队：攻击型占槽位 0..3、支援型占 4..5。
   * 核心升级（wingX）会给"当前更多的那一类"再加一架。
   * 卡是数据、实体是状态——所以这里直接数卡层数，不依赖 mods 的更新时间。
   */
  function syncWingmen(): void {
    const core = (world.cards["wingX"] ?? 0) > 0;
    let attack = Math.min(WINGMAN.max, (world.cards["wingA"] ?? 0) * 2);
    let support = Math.min(WINGMAN.supportMax, world.cards["wingS"] ?? 0);
    if (core) {
      if (attack >= support) attack = Math.min(WINGMAN.max, attack + 1);
      else support = Math.min(WINGMAN.supportMax, support + 1);
    }
    const wantAttack = attack;
    const wantSupport = support;

    // 先统计现有编队
    let haveAttack = 0;
    let haveSupport = 0;
    for (let i = 0; i < world.wingmen.slots.capacity; i += 1) {
      if (!world.wingmen.slots.alive[i]) continue;
      if (world.wingmen.items[i].type === "attack") haveAttack += 1;
      else haveSupport += 1;
    }
    const add = (type: "attack" | "support", n: number): void => {
      for (let k = 0; k < n; k += 1) {
        const i = world.wingmen.slots.acquire();
        if (i < 0) return;
        const w = world.wingmen.items[i];
        w.type = type;
        w.slot = type === "attack" ? haveAttack : 4 + haveSupport;
        w.x = player.pos.x + (type === "attack" ? -2 : 0);
        w.z = player.pos.z;
        w.cd = type === "attack" ? 0.3 : SHIELD.supportCd;
        w.muzzle = 0;
        w.pulse = 0;
        if (type === "attack") haveAttack += 1;
        else haveSupport += 1;
      }
    };
    add("attack", Math.max(0, wantAttack - haveAttack));
    add("support", Math.max(0, wantSupport - haveSupport));
    // 多出来的从最大槽位开始回收
    const removeOne = (type: "attack" | "support"): boolean => {
      let bestSlot = -1;
      let bestIndex = -1;
      for (let i = 0; i < world.wingmen.slots.capacity; i += 1) {
        if (!world.wingmen.slots.alive[i]) continue;
        const w = world.wingmen.items[i];
        if (w.type !== type) continue;
        if (w.slot > bestSlot) {
          bestSlot = w.slot;
          bestIndex = i;
        }
      }
      if (bestIndex < 0) return false;
      world.wingmen.slots.release(bestIndex);
      return true;
    };
    for (let k = haveAttack; k > wantAttack; k -= 1) if (!removeOne("attack")) break;
    for (let k = haveSupport; k > wantSupport; k -= 1) if (!removeOne("support")) break;
  }

  function updateWingmen(dt: number): void {
    const set = world.wingmen;
    const kind = SHIP_BULLET[ship];
    const def = bulletDef(kind);
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const w = set.items[i];
      if (w.muzzle > 0) w.muzzle -= dt;
      if (w.pulse > 0) w.pulse -= dt;
      w.cd -= dt;

      if (w.type === "attack") {
        // 攻击型：编队位（内联展开 attachments.wingmanSlot，避免每帧分配）
        const side = w.slot % 2 === 0 ? -1 : 1;
        const row = Math.floor(w.slot / 2);
        const tx = player.pos.x + side * (WINGMAN.offsetX + row * 1.4);
        const tz = player.pos.z + WINGMAN.offsetZ + row * 1.0;
        w.x = approach(w.x, tx, dt, WINGMAN.follow);
        w.z = approach(w.z, tz, dt, WINGMAN.follow);
        if (w.cd <= 0) {
          w.cd = mods.fireCd * WINGMAN.fireCdMul;
          w.muzzle = JUICE.muzzle;
          spawnPlayerBullet(kind, w.x, w.z - 1.2, 0, -def.speed, WINGMAN.dmgMul, true);
        }
      } else {
        // 支援型：绕玩家慢速公转（角度由时间推出来，零状态），每 2 秒把护盾顶上去
        const angle = (w.slot - 4) * Math.PI + world.time * WINGMAN.supportSpin;
        w.x = player.pos.x + Math.cos(angle) * WINGMAN.supportRadius;
        w.z = player.pos.z + Math.sin(angle) * WINGMAN.supportRadius;
        if (w.cd <= 0) {
          w.cd = SHIELD.supportCd;
          const gain = mods.wingX ? SHIELD.supportGainX : SHIELD.supportGain;
          world.shieldMax = Math.min(SHIELD.maxCap, world.shieldMax + gain);
          world.shield = Math.min(world.shieldMax, world.shield + gain);
          world.shieldPulse = SHIELD.pulseTime;
          w.pulse = SHIELD.pulseTime;
        }
      }
    }
  }

  // ── 敌机 ──
  function spawnEnemy(kind: EnemyKind, x: number): void {
    const index = world.enemies.slots.acquire();
    if (index < 0) return;
    const def = ENEMY_KINDS[kind];
    const diff = difficulty();
    const e = world.enemies.items[index];
    e.kind = kind;
    e.x0 = clamp(x, -FIELD.halfW + def.radius, FIELD.halfW - def.radius);
    e.x = e.x0;
    e.z = -FIELD.halfH - 2.5;
    e.t = 0;
    e.vx = rand(-def.xspeed, def.xspeed);
    e.vz = def.speed;
    e.amp = def.waveAmp > 0 ? rand(def.waveAmp * 0.7, def.waveAmp * 1.2) : 0;
    e.w = def.waveSpeed > 0 ? rand(def.waveSpeed * 0.8, def.waveSpeed * 1.2) : 0;
    e.r = def.radius;
    e.scale = def.scale;
    e.hp = def.hp * diff;
    e.maxHp = e.hp;
    e.cd = def.fireCd > 0 ? rand(0.6, 1.3) * (def.fireCd / diff) : 0;
    e.shots = 0;
    e.flash = 0;
    e.burn = 0;
    e.slow = 0;
  }

  // 复用同一个数组，避免每次生成都新建（生成路径零分配）
  const spawnXs: number[] = [];

  function spawnWave(w: WaveDef): void {
    const n = resolveSpawnXs(w.pattern, w.count, FIELD.halfW, Math.random, spawnXs);
    for (let k = 0; k < n; k += 1) spawnEnemy(w.kind, spawnXs[k]);
  }

  function updateWaves(dt: number): void {
    for (let i = 0; i < WAVES.length; i += 1) {
      const w = WAVES[i];
      if (world.time < w.at || world.time >= w.until) continue;
      waveTimers[i] -= dt;
      if (waveTimers[i] > 0) continue;
      waveTimers[i] = w.interval;
      spawnWave(w);
    }
  }

  function fireEnemy(e: Enemy): void {
    const dx = player.pos.x - e.x;
    const dz = player.pos.z - e.z;
    const len = Math.hypot(dx, dz) || 1;
    const def = ENEMY_KINDS[e.kind];
    const base = Math.atan2(dz / len, dx / len);
    const speed = def.bulletSpeed;
    e.shots += 1;
    if (e.kind === "gunner") {
      if (e.shots % 3 === 0) {
        // 每三炮来一圈环形扩散
        for (let k = 0; k < 8; k += 1) {
          const a = base + (k / 8) * Math.PI * 2;
          spawnEnemyBullet("ring", e.x, e.z, Math.cos(a) * speed * 0.75, Math.sin(a) * speed * 0.75, def.bulletDmg * 0.8);
        }
      } else {
        // 三向菱形散射
        for (let k = -1; k <= 1; k += 1) {
          const a = base + k * 0.3;
          spawnEnemyBullet("diamond", e.x, e.z + 1.2, Math.cos(a) * speed, Math.sin(a) * speed, def.bulletDmg);
        }
      }
      return;
    }
    if (e.kind === "weaver") {
      // 高速长条弹（weaver 只在正弦端点开火，见 updateEnemies）
      spawnEnemyBullet("long", e.x, e.z + 1.0, Math.cos(base) * speed * 1.7, Math.sin(base) * speed * 1.7, def.bulletDmg);
      return;
    }
    if (e.shots % 3 === 0) {
      // drone 每三炮来一次三连点射
      for (let k = -1; k <= 1; k += 1) {
        const a = base + k * 0.22;
        spawnEnemyBullet("ball", e.x, e.z + 1.2, Math.cos(a) * speed, Math.sin(a) * speed, def.bulletDmg);
      }
    } else {
      spawnEnemyBullet("ball", e.x, e.z + 1.2, Math.cos(base) * speed, Math.sin(base) * speed, def.bulletDmg);
    }
  }

  function updateEnemies(dt: number): void {
    const set = world.enemies;
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const e = set.items[i];
      const def = ENEMY_KINDS[e.kind];

      // 灼烧：按卡层数持续掉血
      if (e.burn > 0) {
        e.burn -= dt;
        e.hp -= STATUS.burnDps * mods.burn * dt;
        if (e.hp <= 0) {
          killEnemy(e, i, true);
          continue;
        }
      }
      if (e.slow > 0) e.slow -= dt;

      const speedMul = e.slow > 0 ? STATUS.chillMul : 1;
      e.t += dt;
      e.x0 = clamp(e.x0 + e.vx * dt * speedMul, -FIELD.halfW + e.r, FIELD.halfW - e.r);
      e.x =
        e.amp > 0
          ? clamp(e.x0 + Math.sin(e.t * e.w) * e.amp, -FIELD.halfW + e.r, FIELD.halfW - e.r)
          : e.x0;
      e.z += e.vz * dt * speedMul;
      if (e.flash > 0) e.flash -= dt;
      if (e.z > FIELD.halfH + 3) {
        set.slots.release(i); // 漏过去的敌机直接离场
        continue;
      }
      if (def.fireCd > 0 && e.z > -FIELD.halfH + 6) {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = def.fireCd / difficulty();
          fireEnemy(e);
        }
      }
      // weaver 没有常规射速：它在正弦摆动**到端点**时打一发高速长条弹
      if (e.kind === "weaver" && e.w > 0 && e.z > -FIELD.halfH + 4) {
        const s0 = Math.sin((e.t - dt) * e.w);
        const s1 = Math.sin(e.t * e.w);
        if (s0 * s1 < 0) fireEnemy(e);
      }
    }
  }

  // ── Boss ──
  function spawnBoss(): void {
    boss.active = true;
    boss.entering = true;
    boss.x = 0;
    boss.z = -FIELD.halfH - 12;
    boss.t = 0;
    // 血量随选卡数上浮：否则满 build 会把 Boss 秒掉（实测满 11 张卡只撑 5 秒）
    const bossHp = Math.round(BOSS.hp * (1 + BOSS.hpPerLevel * world.level));
    boss.hp = bossHp;
    boss.maxHp = bossHp;
    boss.phase = 1;
    boss.fanCd = 1.2;
    boss.ringCd = 2.2;
    boss.aimCd = 2.6;
    boss.spiralCd = 0;
    boss.spiralAngle = 0;
    boss.flash = 0;
    boss.burn = 0;
    boss.slow = 0;
    // 弱点 / 抗性：每次登场随机，逼玩家临场调 build（§8.2）
    boss.weak = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    let r = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    while (r === boss.weak) r = ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
    boss.resist = r;
    world.warn = JUICE.warn;
    world.freeze = Math.max(world.freeze, JUICE.freezeBoss);
    addShake(JUICE.shakeBoss);
    // 注意用屏幕内的坐标：Boss 入场点在场地外，直接用它会把横幅甩出画面
    spawnPop(0, -FIELD.halfH + 12, WORD_WARN, 2.4);
    audio?.bossWarning();
    playCine("intro", 2.0);
    pushHud();
  }

  function fireBossFan(n: number, spread: number): void {
    for (let k = 0; k < n; k += 1) {
      const a = fanAngle(k, n, spread, Math.PI / 2);
      spawnEnemyBullet("spike", boss.x, boss.z + 2, Math.cos(a) * BOSS.fanSpeed, Math.sin(a) * BOSS.fanSpeed, BOSS.fanDmg);
    }
  }

  /** 环形扩散：随机相位，避免每次都在同一个角度留缝 */
  function fireBossRing(count: number, speed: number): void {
    const off = Math.random() * Math.PI * 2;
    for (let k = 0; k < count; k += 1) {
      const a = off + (k / count) * Math.PI * 2;
      spawnEnemyBullet("ball", boss.x, boss.z, Math.cos(a) * speed, Math.sin(a) * speed, BOSS.fanDmg * 0.8);
    }
  }

  /** 自机狙三连（菱形弹）：逼玩家横向走位 */
  function fireBossAim(): void {
    const base = aimedAngle(player.pos.x - boss.x, player.pos.z - boss.z);
    for (let k = -1; k <= 1; k += 1) {
      const a = base + k * 0.2;
      spawnEnemyBullet("diamond", boss.x, boss.z + 2, Math.cos(a) * BOSS.fanSpeed, Math.sin(a) * BOSS.fanSpeed, BOSS.fanDmg * 0.9);
    }
  }

  function fireBossSpiral(): void {
    const a = boss.spiralAngle;
    spawnEnemyBullet("laser", boss.x, boss.z, Math.cos(a) * BOSS.spiralSpeed, Math.sin(a) * BOSS.spiralSpeed, BOSS.spiralDmg);
  }

  function updateBoss(dt: number): void {
    if (!boss.active) return;
    boss.t += dt;
    if (boss.flash > 0) boss.flash -= dt;
    if (boss.burn > 0) {
      boss.burn -= dt;
      boss.hp -= STATUS.burnDps * mods.burn * dt;
      if (boss.hp <= 0) {
        boss.hp = 0;
        win();
        return;
      }
    }

    // 入场阶段：未就位前不攻击也不可被击中
    if (boss.entering) {
      boss.z += 16 * dt;
      if (boss.z >= BOSS.enterZ) {
        boss.z = BOSS.enterZ;
        boss.entering = false;
      }
      return;
    }

    // ── 三阶段：按血量切成三段，和 HUD 的三段血条一一对应 ──
    const ratio = boss.hp / boss.maxHp;
    const want: 1 | 2 | 3 = ratio > 2 / 3 ? 1 : ratio > 1 / 3 ? 2 : 3;
    if (want !== boss.phase) {
      boss.phase = want;
      // 阶段切换演出：停帧 + 强震 + 清屏（喘息窗口）+ 运镜 + 爆炸
      playCine("phase", 0.6);
      clear(world.enemyBullets);
      spawnBurst(boss.x, boss.z, 2.4);
      spawnPop(boss.x, boss.z + 7, WORD_WARN, 2);
      world.freeze = Math.max(world.freeze, JUICE.freezeBoss);
      addShake(JUICE.shakeBoss);
      audio?.explosion(true);
      // 换阶段时重置节奏，先给玩家一个呼吸窗口
      boss.fanCd = 1.1;
      boss.ringCd = 1.7;
      boss.aimCd = 1.9;
      boss.spiralCd = 0.45;
      pushHud();
    }

    const p = BOSS_PHASE[boss.phase];
    boss.x = Math.sin(boss.t * p.swaySpeed) * BOSS.swayX;

    // 扇形：全程都有，越往后越密
    boss.fanCd -= dt;
    if (boss.fanCd <= 0) {
      boss.fanCd = p.fanCd;
      fireBossFan(p.fanCount, p.fanSpread);
    }
    // 环形扩散：全程都有
    boss.ringCd -= dt;
    if (boss.ringCd <= 0) {
      boss.ringCd = p.ringCd;
      fireBossRing(p.ringCount, p.ringSpeed);
    }
    // 二阶段起：螺旋（细光束弹）
    if (p.spiralCd > 0) {
      boss.spiralCd -= dt;
      if (boss.spiralCd <= 0) {
        boss.spiralCd = p.spiralCd;
        boss.spiralAngle = spiralAngle(boss.spiralAngle, BOSS.spiralStep);
        fireBossSpiral();
      }
    }
    // 二阶段起：自机狙三连（菱形）
    if (p.aimCd > 0) {
      boss.aimCd -= dt;
      if (boss.aimCd <= 0) {
        boss.aimCd = p.aimCd;
        fireBossAim();
      }
    }
  }

  // ── 结算 / 相位 ──
  function spawnBurst(x: number, z: number, scale: number): void {
    const index = world.bursts.slots.acquire();
    if (index < 0) return;
    const b = world.bursts.items[index];
    b.x = x;
    b.z = z;
    b.t = 0;
    b.life = BURST.life;
    b.scale = scale;
  }

  /**
   * 命中火花：复用爆点池（短命 + 小），节流到 ~33发/秒，
   * 免得满屏弹幕时把池子占满、把真正的爆炸挤掉。
   */
  function spawnSpark(x: number, z: number): void {
    if (!FX.hitSpark || sparkCd > 0) return;
    const index = world.bursts.slots.acquire();
    if (index < 0) return;
    sparkCd = 0.03;
    const b = world.bursts.items[index];
    b.x = x;
    b.z = z;
    b.t = 0;
    b.life = BURST.life * 0.35;
    b.scale = 0.5;
  }

  function spawnPop(x: number, z: number, word: number, scale: number): void {
    const index = world.pops.slots.acquire();
    if (index < 0) return;
    const p = world.pops.items[index];
    p.x = x;
    p.z = z;
    p.t = 0;
    p.life = JUICE.popLife;
    p.word = word;
    p.scale = scale;
  }

  function addShake(v: number): void {
    world.shake = Math.min(JUICE.shakeMax, world.shake + v);
  }

  function playCine(kind: "intro" | "phase" | "down", dur: number): void {
    world.cine.active = true;
    world.cine.kind = kind;
    world.cine.t = 0;
    world.cine.dur = dur;
  }

  function updateCine(dt: number): void {
    if (!world.cine.active) return;
    world.cine.t += dt;
    if (world.cine.t >= world.cine.dur) {
      world.cine.active = false;
      world.timeScale = 1; // 慢动作结束必须还原，否则整局变慢
    }
  }

  function clear<T>(set: EntitySet<T>): void {
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (set.slots.alive[i]) set.slots.release(i);
    }
  }

  function endRun(won: boolean): void {
    const stardust = stardustFor(world.score, 1);
    const isRecord = world.score > meta.highScore;
    audio?.stopBgm();
    setPhase(won ? "victory" : "gameover");
    callbacks?.onRunEnd?.({
      score: world.score,
      kills: world.kills,
      level: world.level,
      seconds: Math.round(world.time),
      revives: world.revivesUsed,
      stardust,
      won,
      isRecord,
    });
    pushHud();
  }

  function die(): void {
    spawnBurst(player.pos.x, player.pos.z, 1.8);
    if (world.revivesLeft > 0) {
      setPhase("revive");
      return;
    }
    clear(world.playerBullets);
    clear(world.enemyBullets);
    clear(world.enemies);
    endRun(false);
  }

  function useRevive(): void {
    if (world.phase !== "revive") return;
    world.revivesLeft -= 1;
    world.revivesUsed += 1;
    player.hp = player.maxHp;
    player.invuln = 3;
    player.pos.x = 0;
    player.pos.z = PLAYER.spawnZ;
    clear(world.enemyBullets);
    clear(world.enemies);
    addShake(JUICE.shakeBoss);
    audio?.powerUp();
    setPhase("playing");
    pushHud();
  }

  function giveUp(): void {
    if (world.phase !== "revive") return;
    endRun(false);
  }

  /**
   * 核弹：清空全部敌弹 + 全场伤害 + 演出（屏幕中心落下、光环扩散）。
   * 演出交给渲染层按 world.nukeFx 播，这里只负责数值与手感。
   */
  function useNuke(): void {
    if (world.phase !== "playing" || world.nukes <= 0) return;
    world.nukes -= 1;
    world.nukeFx = NUKE.fxTime;
    world.freeze = Math.max(world.freeze, NUKE.freeze);
    addShake(NUKE.shake);
    audio?.explosion(true);
    playCine("down", 0.25); // 借用击破的慢动作，结束会自动还原 timeScale

    const mul = mods.nukeX ? NUKE.upgradeMul : 1;
    const dmg = NUKE.damage * mul;
    clear(world.enemyBullets);
    const es = world.enemies;
    for (let i = 0; i < es.slots.capacity; i += 1) {
      if (!es.slots.alive[i]) continue;
      const e = es.items[i];
      e.hp -= dmg;
      e.flash = 0.12;
      if (e.hp <= 0) killEnemy(e, i, true);
    }
    if (boss.active && !boss.entering) {
      boss.hp -= dmg * elementMulFor(mods.element, boss.weak, boss.resist);
      boss.flash = 0.16;
      if (boss.hp <= 0) {
        boss.hp = 0;
        win();
        return;
      }
    }
    spawnPop(0, 6, WORD_BOOM, 3);
    pushHud();
  }

  function win(): void {
    boss.active = false;
    playCine("down", 0.4); // 0.4 游戏秒 ÷ 0.25 倍速 ≈ 1.6 秒真实时间
    world.timeScale = 0.25;
    for (let k = 0; k < 8; k += 1) {
      spawnBurst(boss.x + rand(-6, 6), boss.z + rand(-3, 3), rand(1.4, 2.6));
    }
    spawnPop(boss.x, boss.z + 6, WORD_CLEAR, 3);
    world.freeze = Math.max(world.freeze, JUICE.freezeBoss);
    addShake(JUICE.shakeMax);
    audio?.explosion(true);
    world.score += SCORE.bossKill;
    clear(world.enemyBullets);
    clear(world.enemies);
    endRun(true);
  }

  function damagePlayer(amount: number): void {
    if (stress) return; // 压力模式不结算玩家血量，保证长时间观测
    if (player.invuln > 0 || world.phase !== "playing") return;
    world.hurtTimer = SHIELD.regenDelay;

    // 护盾先吃伤害：盾破才掉血，并放一次碎裂（永续护盾还会顺手清一圈弹）
    let left = amount;
    if (world.shield > 0) {
      const absorbed = Math.min(world.shield, left);
      world.shield -= absorbed;
      left -= absorbed;
      if (world.shield <= 0) {
        world.shield = 0;
        world.shieldBreak = SHIELD.breakTime;
        if (mods.shieldX) clear(world.enemyBullets);
      }
      player.invuln = Math.max(player.invuln, 0.25); // 别让接触伤害把盾"按帧削光"
      addShake(JUICE.shakeKill);
      pushHud();
      if (left <= 0) return;
    }

    player.hp = Math.max(0, player.hp - left);
    player.invuln = PLAYER.invuln;
    world.muzzle = 0;
    addShake(JUICE.shakeHit);
    world.freeze = Math.max(world.freeze, JUICE.freezeKill);
    spawnPop(player.pos.x, player.pos.z - 2, WORD_HURT, 1.2);
    audio?.playerHit();
    pushHud();
    if (player.hp <= 0) {
      // 生命核心（炫彩）：每局一次"致命伤改为满血 + 3 秒无敌"
      if (mods.hpX && !world.hpXUsed) {
        world.hpXUsed = true;
        player.hp = player.maxHp;
        player.invuln = 3;
        spawnPop(player.pos.x, player.pos.z - 3, WORD_CLEAR, 2);
        audio?.powerUp();
        pushHud();
        return;
      }
      die();
    }
  }

  function killEnemy(e: Enemy, index: number, award: boolean): void {
    spawnBurst(e.x, e.z, 1);
    spawnPop(e.x, e.z, WORD_KILL_BASE + Math.floor(Math.random() * WORD_KILL_COUNT), 1);
    world.freeze = Math.max(world.freeze, JUICE.freezeKill);
    addShake(JUICE.shakeKill);
    if (sfxKillCd <= 0) {
      sfxKillCd = 0.08;
      audio?.explosion(false);
    }
    world.enemies.slots.release(index);
    if (!award) return;
    world.kills += 1;
    world.score += SCORE.perKill;
    gainEnergy(ENERGY.perKill);
  }

  // ── 伤害计算 ──
  function elementMulFor(element: Element | null, weak: Element, resist: Element): number {
    if (!element) return 1;
    if (element === weak) return ELEMENT_MOD.weak;
    if (element === resist) return ELEMENT_MOD.resist;
    return 1;
  }

  function playerDamageMul(): number {
    // 预留的"主武器增伤"总入口（v2 暂时恒为 1：所有增伤都直接进了 bulletDmg）
    return 1;
  }

  // ── 更新 ──
  /** 最近敌机：只返回池里的对象引用，不分配（追踪弹每帧要用） */
  function nearestEnemy(x: number, z: number): Enemy | null {
    const es = world.enemies;
    let best: Enemy | null = null;
    let bestD2 = Infinity;
    for (let i = 0; i < es.slots.capacity; i += 1) {
      if (!es.slots.alive[i]) continue;
      const e = es.items[i];
      const dx = e.x - x;
      const dz = e.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = e;
      }
    }
    return best;
  }

  function updatePlayerBullets(dt: number): void {
    const set = world.playerBullets;
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const b = set.items[i];
      if (b.hitCd > 0) b.hitCd -= dt;
      b.age += dt;
      // 寿命回收：子母弹与追踪弹不能永久堆积
      if (b.life > 0) {
        b.life -= dt;
        if (b.life <= 0) {
          set.slots.release(i);
          continue;
        }
      }
      // 追踪弹：每帧朝最近的敌机转一步（比例导引）
      if (b.kind === "homing") {
        const target = nearestEnemy(b.x, b.z);
        if (target) {
          const want = aimedAngle(target.x - b.x, target.z - b.z);
          b.angle = homingStep(b.angle, want, dt, HOMING.turnRate);
          const speed = Math.hypot(b.vx, b.vz) || bulletDef("homing").speed;
          b.vx = Math.cos(b.angle) * speed;
          b.vz = Math.sin(b.angle) * speed;
        }
      }
      // 哑铃弹：横向速度 = 恒定横漂 + 蛇形摆动（对 amp·sin 求导）。
      // 位置由引擎积分，所以"打空"是真的打空，判定和视觉始终一致。
      const chaos = bulletDef(b.kind).chaotic;
      if (chaos) b.vx = b.drift + b.wAmp * b.wFreq * Math.cos(b.wFreq * b.age);
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.z < -FIELD.halfH - 3 || b.z > FIELD.halfH + 3) set.slots.release(i);
    }
  }

  function updateEnemyBullets(dt: number): void {
    const set = world.enemyBullets;
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const b = set.items[i];
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.z > FIELD.halfH + 3 || b.z < -FIELD.halfH - 3 || Math.abs(b.x) > FIELD.halfW + 3) {
        set.slots.release(i);
      }
    }
  }

  function updateBursts(dt: number): void {
    const set = world.bursts;
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const b = set.items[i];
      b.t += dt;
      if (b.t >= b.life) set.slots.release(i);
    }
  }

  function updatePops(dt: number): void {
    const set = world.pops;
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const p = set.items[i];
      p.t += dt;
      if (p.t >= p.life) set.slots.release(i);
    }
  }

  // ── 碰撞 ──
  function collidePlayerBullets(): void {
    const bs = world.playerBullets;
    const es = world.enemies;
    for (let i = 0; i < bs.slots.capacity; i += 1) {
      if (!bs.slots.alive[i]) continue;
      const b = bs.items[i];
      if (b.hitCd > 0) continue;
      // 哑铃弹是一根"棍"：两瓣小球 + 连杆都算判定。
      // 打空来自它自己的随机弹道（横漂 + 蛇形），而不是"中间有洞"。
      const chaos = bulletDef(b.kind).chaotic;
      const ux = chaos ? Math.cos(b.angle + b.spin * b.age) : 0;
      const uz = chaos ? Math.sin(b.angle + b.spin * b.age) : 0;
      for (let j = 0; j < es.slots.capacity; j += 1) {
        if (!es.slots.alive[j]) continue;
        const e = es.items[j];
        // 棍的最近点：把敌机投影到杆上，夹在 ±arm 之间
        let hitX = b.x;
        let hitZ = b.z;
        if (chaos) {
          const raw = (e.x - b.x) * ux + (e.z - b.z) * uz;
          const arm = b.arm > 0 ? b.arm : chaos.arm;
          const t = raw > arm ? arm : raw < -arm ? -arm : raw;
          hitX = b.x + ux * t;
          hitZ = b.z + uz * t;
        }
        const dx = hitX - e.x;
        const dz = hitZ - e.z;
        const rr = b.r + e.r;
        if (dx * dx + dz * dz > rr * rr) continue;

        const dmg = b.dmg * playerDamageMul();
        e.hp -= dmg;
        e.flash = 0.1;
        spawnSpark(hitX, hitZ);
        if (mods.burn > 0) e.burn = STATUS.burnTime;
        if (mods.chill > 0) e.slow = STATUS.chillTime;
        if (mods.chain > 0) chainTo(e, j, dmg);

        // 溅射：火球命中炸成两发小弹，分裂弹卡按层数追加子母弹。
        // 子母弹不再分裂——否则每命中一次都自我复制，弹幕会指数爆炸。
        // 骨头命中：炸成两发小弹；小鱼干进化（炫彩）：再炸出 3 片鱼鳞
        if (b.kind === "wave") spawnSplit(hitX, hitZ, -Math.PI / 2, 2);
        if (mods.wpnX && b.kind === "spread") {
          for (let k = -1; k <= 1; k += 1) {
            const a = -Math.PI / 2 + k * 0.5;
            const sdef = bulletDef("mini");
            spawnPlayerBullet("mini", hitX, hitZ, Math.cos(a) * sdef.speed, Math.sin(a) * sdef.speed);
          }
        }

        if (b.pierce > 0) {
          b.pierce -= 1;
          b.hitCd = 0.06;
        } else {
          bs.slots.release(i);
        }
        if (e.hp <= 0) killEnemy(e, j, true);
        break;
      }
    }
  }

  /** 连锁闪电：命中时电击最近的另一个敌人 */
  function chainTo(source: Enemy, sourceIndex: number, dmg: number): void {
    const es = world.enemies;
    let best = -1;
    let bestD2 = STATUS.chainRange * STATUS.chainRange;
    for (let k = 0; k < es.slots.capacity; k += 1) {
      if (k === sourceIndex || !es.slots.alive[k]) continue;
      const o = es.items[k];
      const dx = o.x - source.x;
      const dz = o.z - source.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = k;
      }
    }
    if (best < 0) return;
    const o = es.items[best];
    o.hp -= dmg * STATUS.chainRatio * mods.chain;
    o.flash = 0.08;
    if (o.hp <= 0) killEnemy(o, best, true);
  }

  function collideBoss(): void {
    if (!boss.active || boss.entering) return;
    const bs = world.playerBullets;
    let changed = false;
    for (let i = 0; i < bs.slots.capacity; i += 1) {
      if (!bs.slots.alive[i]) continue;
      const b = bs.items[i];
      if (b.hitCd > 0) continue;
      const dx = b.x - boss.x;
      const dz = b.z - boss.z;
      const rr = b.r + BOSS.radius;
      if (dx * dx + dz * dz > rr * rr) continue;

      const mul = elementMulFor(b.element, boss.weak, boss.resist) * playerDamageMul();
      boss.hp -= b.dmg * mul;
      boss.flash = 0.08;
      spawnSpark(b.x, b.z);
      if (mods.burn > 0) boss.burn = STATUS.burnTime;
      changed = true;

      if (b.pierce > 0) {
        b.pierce -= 1;
        b.hitCd = 0.06;
      } else {
        bs.slots.release(i);
      }
      if (boss.hp <= 0) {
        boss.hp = 0;
        win();
        return;
      }
    }
    if (changed) pushHud();
  }

  function collideEnemyBullets(): void {
    const bs = world.enemyBullets;
    for (let i = 0; i < bs.slots.capacity; i += 1) {
      if (!bs.slots.alive[i]) continue;
      const b = bs.items[i];
      const dx = b.x - player.pos.x;
      const dz = b.z - player.pos.z;
      const rr = b.r + player.radius;
      if (dx * dx + dz * dz > rr * rr) continue;
      bs.slots.release(i);
      damagePlayer(b.dmg);
    }
  }

  function collideEnemyBody(): void {
    const es = world.enemies;
    for (let i = 0; i < es.slots.capacity; i += 1) {
      if (!es.slots.alive[i]) continue;
      const e = es.items[i];
      const dx = e.x - player.pos.x;
      const dz = e.z - player.pos.z;
      const rr = e.r + player.radius;
      if (dx * dx + dz * dz > rr * rr) continue;
      killEnemy(e, i, false); // 撞机：敌机也炸，但不给分
      damagePlayer(ENEMY_KINDS[e.kind].contactDmg);
    }
  }

  function collideBossBody(): void {
    if (!boss.active || boss.entering) return;
    const dx = boss.x - player.pos.x;
    const dz = boss.z - player.pos.z;
    const rr = BOSS.radius + player.radius;
    if (dx * dx + dz * dz <= rr * rr) damagePlayer(BOSS.contactDmg);
  }

  // ── 压力模式：持续灌满弹幕（§4.2 实测用）──
  function stressEmit(dt: number): void {
    stressAngle += dt * 2.2;
    for (let k = 0; k < 10; k += 1) {
      const a = stressAngle + (k * Math.PI * 2) / 10;
      spawnEnemyBullet("ball", 0, 0, Math.cos(a) * 13, Math.sin(a) * 13, 0);
    }
  }

  function step(dt: number): void {
    // 命中停帧：世界冻结但仍渲染（§M4 打击感）
    if (world.freeze > 0) {
      world.freeze -= dt;
      return;
    }
    // 运镜要在相位判断之前推进：击破后会进入 victory，否则慢动作永远不结束
    updateCine(dt);

    if (world.phase !== "playing") {
      updateBursts(dt);
      updatePops(dt);
      return;
    }

    world.time += dt;
    world.frame += 1;
    if (sfxKillCd > 0) sfxKillCd -= dt;
    if (sparkCd > 0) sparkCd -= dt;
    if (world.shake > 0) world.shake = Math.max(0, world.shake - JUICE.shakeDecay * dt);
    if (world.muzzle > 0) world.muzzle -= dt;
    if (world.warn > 0) world.warn -= dt;
    // 护盾/核弹的表现计时 + 永续护盾的回填
    if (world.shieldPulse > 0) world.shieldPulse -= dt;
    if (world.shieldBreak > 0) world.shieldBreak -= dt;
    if (world.nukeFx > 0) world.nukeFx -= dt;
    if (world.hurtTimer > 0) world.hurtTimer -= dt;
    if (mods.shieldX && world.shield < world.shieldMax) {
      const rate = world.hurtTimer > 0 ? SHIELD.regenPct : SHIELD.regenPctOutOfCombat;
      world.shield = Math.min(world.shieldMax, world.shield + world.shieldMax * rate * dt);
    }

    if (autopilot) autopilotStep(dt);
    else movePlayer(dt);
    if (player.invuln > 0) player.invuln -= dt;

    firePlayer(dt);
    updateWingmen(dt);
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    updateEnemies(dt);
    updateWaves(dt);

    if (stress) {
      stressEmit(dt);
    } else if (!boss.active && !bossSpawned && world.time >= RUN.bossAt) {
      bossSpawned = true;
      spawnBoss();
    }
    updateBoss(dt);

    collidePlayerBullets();
    collideBoss();
    collideEnemyBullets();
    collideEnemyBody();
    collideBossBody();
    updateBursts(dt);
    updatePops(dt);
  }

  function reportStats(now: number): void {
    if (sampleStart === 0) {
      sampleStart = now;
      return;
    }
    const elapsed = now - sampleStart;
    if (elapsed < FPS_SAMPLE_MS) return;

    world.bulletCount = countAlive(world.playerBullets) + countAlive(world.enemyBullets);
    callbacks?.onStats?.({
      fps: (sampleFrames * 1000) / elapsed,
      frameMs: sampleMs / Math.max(1, sampleFrames),
      bullets: world.bulletCount,
      calls: renderer.drawCalls(),
    });
    pushHud();

    sampleStart = now;
    sampleFrames = 0;
    sampleMs = 0;
  }

  function frame(now: number): void {
    if (!running) return;
    raf = requestAnimationFrame(frame);

    const deltaMs = last === 0 ? 16.7 : now - last;
    last = now;

    acc += Math.min(deltaMs / 1000, 0.25) * world.timeScale;
    let steps = 0;
    while (acc >= LOOP.step && steps < LOOP.maxSteps) {
      step(LOOP.step);
      acc -= LOOP.step;
      steps += 1;
    }
    if (steps === LOOP.maxSteps) acc = 0; // 掉落帧时丢弃余量，避免死亡螺旋

    renderer.render(world);

    sampleFrames += 1;
    sampleMs += deltaMs;
    reportStats(now);
  }

  // ── 事件 ──
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      if (world.phase === "playing") setPhase("pause");
      else if (world.phase === "pause") setPhase("playing");
      return;
    }
    const key = KEY_MAP[e.key] ?? KEY_MAP[e.key.toLowerCase()];
    if (!key) return;
    input[key] = true;
    if (e.key.startsWith("Arrow")) e.preventDefault();
  }

  function onKeyUp(e: KeyboardEvent): void {
    const key = KEY_MAP[e.key] ?? KEY_MAP[e.key.toLowerCase()];
    if (!key) return;
    input[key] = false;
  }

  function onPointerDown(e: PointerEvent): void {
    const p = renderer.pointerToWorld(e.clientX, e.clientY);
    if (!p) return;
    input.dragActive = true;
    input.dragPointer.x = p.x;
    input.dragPointer.z = p.z;
    input.dragPlayer.x = player.pos.x;
    input.dragPlayer.z = player.pos.z;
    renderer.element.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent): void {
    // 相对拖动：飞机不跟到手指底下，而是按位移量走（手指不会盖住自己）
    if (!input.dragActive) return;
    const p = renderer.pointerToWorld(e.clientX, e.clientY);
    if (!p) return;
    input.pointer.x = input.dragPlayer.x + (p.x - input.dragPointer.x) * DRAG_SENSITIVITY;
    input.pointer.z = input.dragPlayer.z + (p.z - input.dragPointer.z) * DRAG_SENSITIVITY;
    input.pointerActive = true;
  }

  function onPointerEnd(): void {
    input.dragActive = false;
    input.pointerActive = false;
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const rect = entries[0]?.contentRect;
    if (!rect) return;
    renderer.resize(rect.width, rect.height);
  });

  function attach(): void {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    renderer.element.addEventListener("pointerdown", onPointerDown);
    renderer.element.addEventListener("pointermove", onPointerMove);
    renderer.element.addEventListener("pointerup", onPointerEnd);
    renderer.element.addEventListener("pointercancel", onPointerEnd);
    resizeObserver.observe(mount);
    renderer.resize(mount.clientWidth, mount.clientHeight);
  }

  function detach(): void {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    renderer.element.removeEventListener("pointerdown", onPointerDown);
    renderer.element.removeEventListener("pointermove", onPointerMove);
    renderer.element.removeEventListener("pointerup", onPointerEnd);
    renderer.element.removeEventListener("pointercancel", onPointerEnd);
    resizeObserver.disconnect();
  }

  function resetWorld(): void {
    clear(world.playerBullets);
    clear(world.enemyBullets);
    clear(world.wingmen);
    world.beam.active = false;
    clear(world.enemies);
    clear(world.bursts);
    clear(world.pops);
    for (let i = 0; i < waveTimers.length; i += 1) waveTimers[i] = 0;
    bossSpawned = false;
    boss.active = false;
    boss.entering = false;
    boss.burn = 0;
    stressAngle = 0;
    sfxKillCd = 0;
    sparkCd = 0;
    world.shield = 0;
    world.shieldMax = 0;
    world.shieldPulse = 0;
    world.shieldBreak = 0;
    world.hpXUsed = false;
    world.hurtTimer = 0;
    world.nukes = 0;
    world.nukeMax = 0;
    world.nukeFx = 0;
    world.prismaticTaken = false;
    world.freeze = 0;
    world.shake = 0;
    world.muzzle = 0;
    world.warn = 0;
    world.cine.active = false;
    world.cine.t = 0;
    world.timeScale = 1;
  }

  function newRun(nextShip: ShipType, nextMeta: MetaData): void {
    audio?.init();
    audio?.startBgm();
    ship = nextShip;
    meta = cloneMeta(nextMeta);
    offer = [];
    resetWorld();

    world.ship = ship;
    world.time = skipTo;
    world.score = 0;
    world.kills = 0;
    world.level = 0;
    world.weaponLv = 1;
    world.cards = {};
    world.energy = 0;
    world.energyNeed = ENERGY.base;
    world.revivesLeft = meta.upgrades.revive;
    world.revivesUsed = 0;

    player.maxHp = PLAYER.maxHp + meta.upgrades.life * 25;
    player.hp = player.maxHp;
    player.pos.x = 0;
    player.pos.z = PLAYER.spawnZ;
    player.vel.x = 0;
    player.vel.z = 0;
    player.invuln = PLAYER.invuln;
    player.cd = 0;

    recomputeMods();
    setPhase("playing");
    pushHud();
  }

  function toMenu(): void {
    audio?.stopBgm();
    resetWorld();
    offer = [];
    setPhase("menu");
    pushHud();
  }

  attach();

  return {
    world,
    start() {
      if (running) return;
      running = true;
      last = 0;
      acc = 0;
      sampleStart = 0;
      sampleFrames = 0;
      sampleMs = 0;
      pushHud();
      emitPhase();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      detach();
      renderer.dispose();
    },
    newRun,
    toMenu,
    chooseCard,
    useNuke,
    useRevive,
    giveUp,
    setPaused(v: boolean) {
      if (v && world.phase === "playing") setPhase("pause");
      else if (!v && world.phase === "pause") setPhase("playing");
    },
    isPaused() {
      return world.phase === "pause";
    },
  };
}
