// ═══════════════════════════════════════════════════════════════════
// POP3D — 类型定义（engine 层不出现 React，也不出现 three）
// ═══════════════════════════════════════════════════════════════════

/** 地面平面坐标（+X 右，+Z 下）。所有实体都活在 X/Z 平面上。 */
export interface Vec2 {
  x: number;
  z: number;
}

// ── 属性 / 机型 / 流派 ──

export type Element = "electric" | "fire" | "ice";
export type ShipType = "ion" | "nova" | "pulse";
export type CardSchool = "barrage" | "element" | "survival" | "economy";

export interface ShipDef {
  label: string;
  blurb: string;
  element: Element;
  icon: string;
  bulletCount: number;
  dmgMul: number;
  cdMul: number;
}

export interface CardDef {
  id: string;
  name: string;
  school: CardSchool;
  icon: string;
  desc: string;
  /** 同一张卡最多叠几层 */
  max: number;
}

export interface MetaData {
  stardust: number;
  highScore: number;
  runs: number;
  upgrades: {
    life: number;
    power: number;
    energy: number;
    revive: number;
  };
}

export interface RunStats {
  score: number;
  kills: number;
  level: number;
  seconds: number;
  revives: number;
  stardust: number;
  won: boolean;
  isRecord: boolean;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** 指针是否在画布内（在则跟随指针世界坐标） */
  pointerActive: boolean;
  pointer: Vec2;
  /** 相对拖动：按下瞬间的指针世界坐标与玩家位置 */
  dragActive: boolean;
  dragPointer: Vec2;
  dragPlayer: Vec2;
}

export interface Player {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  hp: number;
  maxHp: number;
  /** 剩余无敌时间（秒），> 0 时不受伤并闪烁 */
  invuln: number;
  /** 开火冷却剩余（秒） */
  cd: number;
}

export interface Bullet {
  x: number;
  z: number;
  vx: number;
  vz: number;
  r: number;
  dmg: number;
  /** 剩余可穿透次数 */
  pierce: number;
  /** 属性（null = 无属性，不吃克制） */
  element: Element | null;
  /** 命中后的短暂隔断，避免穿透弹在同一敌人身上每帧重复结算 */
  hitCd: number;
}

// ── 敌机 ──

export type EnemyKind = "drone" | "weaver" | "gunner";

export interface EnemyKindDef {
  hp: number;
  speed: number; // 下落速度
  radius: number; // 判定半径（与视觉缩放一致，避免"看着没中却中了"）
  scale: number; // 视觉缩放
  xspeed: number; // 横向漂移速度上限（0 = 不漂移）
  waveAmp: number; // 正弦摆动幅度（0 = 不摆动）
  waveSpeed: number; // 正弦角速度
  fireCd: number; // 开火间隔（0 = 不开火）
  bulletSpeed: number;
  bulletDmg: number;
  contactDmg: number; // 撞机伤害
  color: string;
}

export interface Enemy {
  kind: EnemyKind;
  x: number;
  z: number;
  x0: number; // 摆动基准横坐标
  t: number; // 存活时间（驱动正弦摆动）
  vx: number;
  vz: number;
  amp: number;
  w: number;
  r: number;
  scale: number;
  hp: number;
  maxHp: number;
  cd: number; // 开火冷却剩余
  flash: number; // 受击闪白剩余
  burn: number; // 灼烧剩余时间
  slow: number; // 减速剩余时间
}

// ── 波次 ──

export type SpawnPattern = "random" | "line" | "sides" | "column";

export interface WaveDef {
  at: number; // 开始时间（秒）
  until: number; // 结束时间（秒）
  kind: EnemyKind;
  interval: number; // 生成间隔（秒）
  count: number; // 每次生成几架
  pattern: SpawnPattern;
}

// ── Boss ──

export interface Boss {
  active: boolean;
  entering: boolean; // 入场阶段（未就位前不攻击、不可被击中）
  x: number;
  z: number;
  t: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2;
  fanCd: number;
  spiralCd: number;
  spiralAngle: number;
  flash: number;
  weak: Element;
  resist: Element;
  burn: number;
  slow: number;
}

/** 运镜事件：只在无弹幕的过场窗口偏离俯视 */
export interface Cinematic {
  active: boolean;
  kind: "intro" | "phase" | "down";
  t: number;
  dur: number;
}

export interface Burst {
  x: number;
  z: number;
  t: number;
  life: number;
  scale: number;
}

/** 拟声词贴片：屏幕上的 POW! / BOOM! 反馈 */
export interface Pop {
  x: number;
  z: number;
  t: number;
  life: number;
  word: number;
  scale: number;
}

/** 固定容量的槽位管理：acquire 返回下标，-1 表示池满 */
export interface SlotSet {
  readonly capacity: number;
  readonly alive: Uint8Array;
  acquire(): number;
  release(index: number): void;
  readonly freeCount: number;
}

/** 一种实体 = 定长对象数组 + 槽位管理，循环内零分配（§4.4） */
export interface EntitySet<T> {
  items: T[];
  slots: SlotSet;
}

/** 引擎对外暴露的阶段。只有这些切换才需要惊动 React（§8.7 六相位外壳）。 */
export type Phase = "menu" | "playing" | "card" | "revive" | "pause" | "gameover" | "victory";

/** 世界状态：唯一真相来源，绝不放 React state（§9.1） */
export interface World {
  time: number; // 累积秒数（本局）
  frame: number; // 已执行的固定步数
  phase: Phase;
  score: number;
  kills: number;
  level: number; // 已选卡次数
  weaponLv: number; // 主武器等级 1~4
  ship: ShipType;
  energy: number;
  energyNeed: number;
  /** 已获得的卡 → 层数 */
  cards: Record<string, number>;
  revivesLeft: number;
  revivesUsed: number;
  player: Player;
  input: InputState;
  playerBullets: EntitySet<Bullet>;
  enemyBullets: EntitySet<Bullet>;
  enemies: EntitySet<Enemy>;
  bursts: EntitySet<Burst>;
  pops: EntitySet<Pop>;
  boss: Boss;
  cine: Cinematic;
  /** 时间缩放（只有 Boss 击破的慢动作会改它） */
  timeScale: number;
  /** 当前存活弹幕总数（HUD 用） */
  bulletCount: number;
  /** 打击感计时器 */
  freeze: number;
  shake: number;
  muzzle: number;
  warn: number;
}

export interface FrameStats {
  fps: number;
  frameMs: number;
  bullets: number;
  /** 每帧 draw call（§4.3 硬指标：< 60） */
  calls: number;
}

export interface HudState {
  hp: number;
  maxHp: number;
  score: number;
  time: number; // 本局已进行秒数
  level: number;
  energyPct: number; // 升级进度 0~1
  element: Element | null;
  revivesLeft: number;
  bossHp: number;
  bossMaxHp: number; // 0 表示当前无 Boss
  bossWeak: Element | null; // Boss 弱点属性（null 表示当前无 Boss）
  warn: boolean; // BOSS 警告横幅
}

/**
 * 渲染层接口（由 render/ 用 three 实现）。
 * engine 只调用它做 GPU 提交，不关心 three。
 */
export interface Renderer {
  /** 输入事件应挂载的元素（画布本身，不含画板外的留白区） */
  readonly element: HTMLElement;
  resize(width: number, height: number): void;
  render(world: World, alpha?: number): void;
  /** 上一帧的 draw call 数 */
  drawCalls(): number;
  /** 屏幕坐标 → 地面世界坐标；命中不到地面返回 null */
  pointerToWorld(clientX: number, clientY: number): Vec2 | null;
  dispose(): void;
}

export interface EngineCallbacks {
  onStats?: (stats: FrameStats) => void;
  onHud?: (hud: HudState) => void;
  onPhase?: (phase: Phase, offer: CardDef[]) => void;
  onRunEnd?: (stats: RunStats) => void;
}

/**
 * 音频适配器：由 React 侧注入（复用 2D 版已验证的 useGameAudio），
 * 引擎只喊事件名，不碰 WebAudio。
 */
export interface AudioAdapter {
  init(): void;
  shoot(kind: number): void;
  explosion(big: boolean): void;
  playerHit(): void;
  powerUp(): void;
  card(): void;
  click(): void;
  bossWarning(): void;
  startBgm(): void;
  stopBgm(): void;
}

export interface EngineOptions {
  mount: HTMLElement;
  renderer: Renderer;
  callbacks?: EngineCallbacks;
  audio?: AudioAdapter;
  /** 调试：自动寻敌移动（用于跑通整局 / 难度观测） */
  autopilot?: boolean;
  /** 调试：持续灌满弹幕，用于 §4.2 压力实测 */
  stress?: boolean;
  /** 调试：本局从第几秒开始（跳段验证 Boss / 后期波次） */
  skipTo?: number;
}

export interface EngineHandle {
  start(): void;
  stop(): void;
  destroy(): void;
  /** 用当前 meta 开一局新游戏 */
  newRun(ship: ShipType, meta: MetaData): void;
  toMenu(): void;
  chooseCard(id: string): void;
  useRevive(): void;
  giveUp(): void;
  setPaused(v: boolean): void;
  isPaused(): boolean;
  /** 只读访问世界状态（调试 / 测试用） */
  world: World;
}

export const EMPTY_META: MetaData = {
  stardust: 0,
  highScore: 0,
  runs: 0,
  upgrades: { life: 0, power: 0, energy: 0, revive: 0 },
};
