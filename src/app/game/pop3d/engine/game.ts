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
  BOSS,
  BULLET,
  BURST,
  ELEMENTS,
  ELEMENT_MOD,
  ENERGY,
  ENEMY_KINDS,
  FIELD,
  FPS_SAMPLE_MS,
  HOMING,
  JUICE,
  LOOP,
  ORBIT,
  PLAYER,
  POOL,
  POOL_WINGMEN,
  RUN,
  SCORE,
  SHIP_INFO,
  STATUS,
  WAVES,
  WEAPON_MAX_LV,
  WINGMAN,
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
  EntitySet,
  EngineHandle,
  EngineOptions,
  InputState,
  MetaData,
  Phase,
  Player,
  PlayerBullet,
  Pop,
  Orb,
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
  split: number;
  homing: number;
  backfire: boolean;
  /** 僚机射速冷却乘数（层数越高越小） */
  wingRateMul: number;
  /** 僚机协同：命中给主武器叠增伤的层数（每层 +4%） */
  wingLink: number;
  element: Element | null;
  chain: number;
  burn: number;
  chill: number;
  elementWeakBonus: number;
  leech: number;
  guardBonus: number;
  lastStand: boolean;
  scoreMul: number;
  dustMul: number;
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
      fromWing: false,
    });
  }
  return { items, slots: createSlots(capacity) };
}

function makeEnemyBullets(capacity: number): EntitySet<EnemyBullet> {
  const items: EnemyBullet[] = [];
  for (let i = 0; i < capacity; i += 1) {
    items.push({ x: 0, z: 0, vx: 0, vz: 0, r: 0, dmg: 0, hitCd: 0 });
  }
  return { items, slots: createSlots(capacity) };
}

function makeWingmen(capacity: number): EntitySet<Wingman> {
  const items: Wingman[] = [];
  for (let i = 0; i < capacity; i += 1) items.push({ slot: i, x: 0, z: 0, cd: 0 });
  return { items, slots: createSlots(capacity) };
}

function makeOrbs(capacity: number): EntitySet<Orb> {
  const items: Orb[] = [];
  for (let i = 0; i < capacity; i += 1) items.push({ angle: 0, cd: 0 });
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
/** 击杀回血的触发间隔 */
const LEECH_EVERY = 40;

export function createEngine({
  mount,
  renderer,
  callbacks,
  audio,
  autopilot = false,
  stress = false,
  skipTo = 0,
}: EngineOptions): EngineHandle {
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
    orbs: makeOrbs(ORBIT.max),
    linkStacks: 0,
    linkTimer: 0,
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
  let lastElement: Element | null = null;
  let offer: CardDef[] = [];

  const mods: Mods = {
    fireCd: PLAYER.fireCd,
    bulletDmg: PLAYER.bulletDmg,
    bulletCount: 2,
    spreadAngle: 0.05,
    pierce: 0,
    split: 0,
    homing: 0,
    backfire: false,
    wingRateMul: 1,
    wingLink: 0,
    element: null,
    chain: 0,
    burn: 0,
    chill: 0,
    elementWeakBonus: 0,
    leech: 0,
    guardBonus: 0,
    lastStand: false,
    scoreMul: 1,
    dustMul: 1,
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

    mods.fireCd = (PLAYER.fireCd * info.cdMul) / (1 + c("rate") * 0.18);
    mods.bulletCount = info.bulletCount + c("spread") + (world.weaponLv - 1);
    mods.spreadAngle = 0.05 + c("spread") * 0.035;
    // 扇形弹：弹数上去、单发下来，避免"纯数值膨胀"
    mods.bulletDmg = PLAYER.bulletDmg * info.dmgMul * metaPower / (1 + c("spread") * 0.1);
    mods.pierce = c("pierce");
    mods.split = c("split");
    mods.homing = c("homing");
    mods.backfire = c("backfire") > 0;
    // 射速倍率是"冷却乘数"，层数越高越小
    mods.wingRateMul = 1 / (1 + c("wingrate") * 0.25);
    mods.wingLink = c("winglink");
    mods.element = lastElement;
    mods.chain = c("volt");
    mods.burn = c("flame");
    mods.chill = c("frost");
    mods.elementWeakBonus = c("mastery") * ELEMENT_MOD.masteryPer;
    mods.leech = c("leech");
    mods.guardBonus = c("guard") > 0 ? 1.2 : 0;
    mods.lastStand = c("last") > 0;
    mods.scoreMul = 1 + c("bounty") * 0.5;
    mods.dustMul = 1 + c("star") * 0.25;
    mods.energyMul = 1 + meta.upgrades.energy * 0.12;
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
    offer = rollOffer(world.cards, 3);
    spawnPop(player.pos.x, player.pos.z - 3, WORD_LEVEL, 1.6);
    audio?.card();
    setPhase("card");
    pushHud();
  }

  function applyCardInstant(id: string): void {
    switch (id) {
      case "bulk":
        player.maxHp += 25;
        player.hp = Math.min(player.maxHp, player.hp + 25);
        break;
      case "volt":
        lastElement = "electric";
        break;
      case "flame":
        lastElement = "fire";
        break;
      case "frost":
        lastElement = "ice";
        break;
      case "orbit":
        // 卡是数据、实体是状态：拿了卡就立刻把环绕弹补到位
        syncOrbs((world.cards["orbit"] ?? 0) * 2);
        break;
      case "wing":
        // 卡是数据、实体是状态：拿了卡就立刻把僚机补到位
        // （applyCardInstant 在 recomputeMods 之前调用，所以这里直接数层数）
        syncWingmen((world.cards["wing"] ?? 0) * 2);
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
  ): void {
    const index = world.playerBullets.slots.acquire();
    if (index < 0) return;
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
    b.fromWing = fromWing;
    // 刚生成的子母弹与父弹位置重合，给一点隔断防止同帧自我触发
    b.hitCd = 0.05;
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
    player.cd -= dt;
    if (player.cd > 0) return;
    player.cd = mods.fireCd;
    world.muzzle = JUICE.muzzle;
    audio?.shoot(ship === "ion" ? 0 : ship === "pulse" ? 1 : 2);

    // 主炮：弹型由机型决定，扇形角度由 patterns 的几何公式给出
    const kind = SHIP_BULLET[ship];
    const def = bulletDef(kind);
    const n = mods.bulletCount;
    fanShotAngles(n, mods.spreadAngle, shotAngles);
    for (let k = 0; k < n; k += 1) {
      const a = shotAngles[k];
      const off = k - (n - 1) / 2;
      spawnPlayerBullet(
        kind,
        player.pos.x + off * PLAYER.bulletSpread * 0.9,
        player.pos.z - 1.8,
        Math.cos(a) * def.speed,
        Math.sin(a) * def.speed,
      );
    }

    // 追踪弹：按卡层数附带（从机头两侧斜射出去再拐弯）
    for (let k = 0; k < mods.homing; k += 1) {
      const side = k % 2 === 0 ? -1 : 1;
      const a = UP_ANGLE + side * 0.5;
      const hdef = bulletDef("homing");
      spawnPlayerBullet(
        "homing",
        player.pos.x + side * 1.2,
        player.pos.z - 1.2,
        Math.cos(a) * hdef.speed,
        Math.sin(a) * hdef.speed,
      );
    }

    // 后向炮：45% 伤害（弹型是子母弹，故按 mini 的倍率反推成总量）
    if (mods.backfire) {
      const back = bulletDef("mini");
      spawnPlayerBullet(
        "mini",
        player.pos.x,
        player.pos.z + 1.6,
        0,
        back.speed * 0.85,
        0.45 / back.dmgMul,
      );
    }
  }

  function spawnEnemyBullet(x: number, z: number, vx: number, vz: number, dmg: number): void {
    const index = world.enemyBullets.slots.acquire();
    if (index < 0) return;
    const b = world.enemyBullets.items[index];
    b.x = x;
    b.z = z;
    b.vx = vx;
    b.vz = vz;
    b.r = BULLET.enemyRadius;
    b.dmg = dmg;
    b.hitCd = 0;
  }

  // ── 僚机（实体编队，不是"多发子弹"）──
  /** 把僚机数量补/减到目标值（卡是数据，实体是状态） */
  function syncWingmen(want: number): void {
    const target = Math.min(WINGMAN.max, want);
    let have = countAlive(world.wingmen);
    while (have < target) {
      const i = world.wingmen.slots.acquire();
      if (i < 0) break;
      const w = world.wingmen.items[i];
      w.slot = have;
      w.x = player.pos.x;
      w.z = player.pos.z;
      w.cd = 0.3;
      have += 1;
    }
    // 多出来的从最大槽位开始回收
    while (have > target) {
      let maxSlot = -1;
      let maxIndex = -1;
      for (let i = 0; i < world.wingmen.slots.capacity; i += 1) {
        if (!world.wingmen.slots.alive[i]) continue;
        const s = world.wingmen.items[i].slot;
        if (s > maxSlot) {
          maxSlot = s;
          maxIndex = i;
        }
      }
      if (maxIndex < 0) break;
      world.wingmen.slots.release(maxIndex);
      have -= 1;
    }
  }

  function updateWingmen(dt: number): void {
    const set = world.wingmen;
    const kind = SHIP_BULLET[ship];
    const def = bulletDef(kind);
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const w = set.items[i];
      // 编队位：内联展开 attachments.wingmanSlot（避免每帧分配）
      const side = w.slot % 2 === 0 ? -1 : 1;
      const row = Math.floor(w.slot / 2);
      const tx = player.pos.x + side * (WINGMAN.offsetX + row * 1.4);
      const tz = player.pos.z + WINGMAN.offsetZ + row * 1.0;
      w.x = approach(w.x, tx, dt, WINGMAN.follow);
      w.z = approach(w.z, tz, dt, WINGMAN.follow);

      w.cd -= dt;
      if (w.cd <= 0) {
        w.cd = mods.fireCd * WINGMAN.fireCdMul * mods.wingRateMul;
        spawnPlayerBullet(kind, w.x, w.z - 1.2, 0, -def.speed, WINGMAN.dmgMul, true);
      }
    }
  }

  // ── 环绕护卫弹（附着物：绕玩家公转的接触伤害）──
  /** 把环绕弹数量补/减到目标值（和僚机一样：卡是数据，实体是状态） */
  function syncOrbs(want: number): void {
    const target = Math.min(ORBIT.max, want);
    let have = countAlive(world.orbs);
    while (have < target) {
      const i = world.orbs.slots.acquire();
      if (i < 0) break;
      const o = world.orbs.items[i];
      o.angle = (have * Math.PI * 2) / target; // 均匀铺开，避免重叠
      o.cd = 0;
      have += 1;
    }
    while (have > target) {
      for (let i = world.orbs.slots.capacity - 1; i >= 0; i -= 1) {
        if (world.orbs.slots.alive[i]) {
          world.orbs.slots.release(i);
          have -= 1;
          break;
        }
      }
    }
  }

  /** 用一个圆去撞敌机；命中一台就返回 true（环绕弹的接触伤害） */
  function hitEnemyAt(x: number, z: number, r: number, dmg: number): boolean {
    const es = world.enemies;
    for (let i = 0; i < es.slots.capacity; i += 1) {
      if (!es.slots.alive[i]) continue;
      const e = es.items[i];
      const dx = e.x - x;
      const dz = e.z - z;
      const rr = e.r + r;
      if (dx * dx + dz * dz > rr * rr) continue;
      e.hp -= dmg * playerDamageMul();
      e.flash = 0.08;
      if (e.hp <= 0) killEnemy(e, i, true);
      return true;
    }
    return false;
  }

  function updateOrbs(dt: number): void {
    const set = world.orbs;
    if (set.slots.freeCount === set.slots.capacity) return; // 一颗都没有，直接跳过
    for (let i = 0; i < set.slots.capacity; i += 1) {
      if (!set.slots.alive[i]) continue;
      const o = set.items[i];
      o.angle += ORBIT.angular * dt;
      if (o.cd > 0) o.cd -= dt;

      // 位置内联展开 orbitPos：每帧每颗都算，不能分配
      const ox = player.pos.x + Math.cos(o.angle) * ORBIT.radius;
      const oz = player.pos.z + Math.sin(o.angle) * ORBIT.radius;
      if (o.cd > 0) continue;
      if (hitEnemyAt(ox, oz, 0.55, mods.bulletDmg * ORBIT.dmgMul)) o.cd = ORBIT.dmgCd;
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
    spawnEnemyBullet(e.x, e.z + 1.2, (dx / len) * def.bulletSpeed, (dz / len) * def.bulletSpeed, def.bulletDmg);
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

  function fireBossFan(): void {
    const n = BOSS.fanCount;
    for (let k = 0; k < n; k += 1) {
      const a = fanAngle(k, n, BOSS.fanSpread, Math.PI / 2);
      spawnEnemyBullet(boss.x, boss.z + 2, Math.cos(a) * BOSS.fanSpeed, Math.sin(a) * BOSS.fanSpeed, BOSS.fanDmg);
    }
  }

  function fireBossSpiral(): void {
    const a = boss.spiralAngle;
    spawnEnemyBullet(boss.x, boss.z, Math.cos(a) * BOSS.spiralSpeed, Math.sin(a) * BOSS.spiralSpeed, BOSS.spiralDmg);
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

    boss.x = Math.sin(boss.t * BOSS.swaySpeed) * BOSS.swayX;
    if (boss.phase === 1 && boss.hp <= boss.maxHp * BOSS.phase2At) {
      boss.phase = 2;
      playCine("phase", 0.6);
      clear(world.enemyBullets); // 喘息窗口：清屏后过场才安全
    }

    boss.fanCd -= dt;
    if (boss.fanCd <= 0) {
      boss.fanCd = boss.phase === 2 ? BOSS.fanCd * 0.7 : BOSS.fanCd;
      fireBossFan();
    }
    if (boss.phase === 2) {
      boss.spiralCd -= dt;
      if (boss.spiralCd <= 0) {
        boss.spiralCd = BOSS.spiralCd;
        boss.spiralAngle = spiralAngle(boss.spiralAngle, BOSS.spiralStep);
        fireBossSpiral();
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
    const stardust = stardustFor(world.score, mods.dustMul);
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
    player.hp = Math.max(0, player.hp - amount);
    player.invuln = PLAYER.invuln + mods.guardBonus;
    world.muzzle = 0;
    addShake(JUICE.shakeHit);
    world.freeze = Math.max(world.freeze, JUICE.freezeKill);
    spawnPop(player.pos.x, player.pos.z - 2, WORD_HURT, 1.2);
    audio?.playerHit();
    pushHud();
    if (player.hp <= 0) die();
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
    world.score += Math.round(SCORE.perKill * mods.scoreMul);
    gainEnergy(ENERGY.perKill);
    if (mods.leech > 0 && world.kills % LEECH_EVERY === 0) {
      player.hp = Math.min(player.maxHp, player.hp + 6 * mods.leech);
    }
  }

  // ── 伤害计算 ──
  function elementMulFor(element: Element | null, weak: Element, resist: Element): number {
    if (!element) return 1;
    if (element === weak) return ELEMENT_MOD.weak + mods.elementWeakBonus;
    if (element === resist) return ELEMENT_MOD.resist;
    return 1;
  }

  function playerDamageMul(): number {
    const link = 1 + world.linkStacks * 0.04;
    return (mods.lastStand && player.hp <= player.maxHp * 0.3 ? 1.6 : 1) * link;
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
      for (let j = 0; j < es.slots.capacity; j += 1) {
        if (!es.slots.alive[j]) continue;
        const e = es.items[j];
        const dx = b.x - e.x;
        const dz = b.z - e.z;
        const rr = b.r + e.r;
        if (dx * dx + dz * dz > rr * rr) continue;

        const dmg = b.dmg * playerDamageMul();
        e.hp -= dmg;
        e.flash = 0.1;
        if (mods.burn > 0) e.burn = STATUS.burnTime;
        if (mods.chill > 0) e.slow = STATUS.chillTime;
        if (mods.chain > 0) chainTo(e, j, dmg);

        // 溅射：冲击波机型天生分裂，分裂弹卡按层数追加子母弹。
        // 子母弹不再分裂——否则每命中一次都自我复制，弹幕会指数爆炸。
        if (b.kind !== "mini") {
          if (b.kind === "wave") spawnSplit(b.x, b.z, b.angle, 2);
          if (mods.split > 0) spawnSplit(b.x, b.z, b.angle, mods.split * 2);
        }

        // 僚机协同：僚机的命中给主武器叠增伤（2 秒不命中就清零）
        if (b.fromWing && mods.wingLink > 0) {
          world.linkStacks = Math.min(5, world.linkStacks + mods.wingLink);
          world.linkTimer = 2;
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
      spawnEnemyBullet(0, 0, Math.cos(a) * 13, Math.sin(a) * 13, 0);
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
    if (world.shake > 0) world.shake = Math.max(0, world.shake - JUICE.shakeDecay * dt);
    if (world.muzzle > 0) world.muzzle -= dt;
    if (world.warn > 0) world.warn -= dt;
    // 僚机协同的叠层：2 秒内没有新的僚机命中就清零
    if (world.linkTimer > 0) {
      world.linkTimer -= dt;
      if (world.linkTimer <= 0) world.linkStacks = 0;
    }

    if (autopilot) autopilotStep(dt);
    else movePlayer(dt);
    if (player.invuln > 0) player.invuln -= dt;

    firePlayer(dt);
    updateWingmen(dt);
    updateOrbs(dt);
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
    clear(world.orbs);
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
    world.linkStacks = 0;
    world.linkTimer = 0;
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
    lastElement = null;
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
