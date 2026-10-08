// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — engine types (纯 TS，不依赖 React / DOM)
// ═══════════════════════════════════════════════════════════════════

export type ShipType = "ion" | "nova" | "pulse";
export type Element = "electric" | "fire" | "ice";
export type BossType = "fortress" | "carrier" | "eye";
export type CardSchool = "barrage" | "element" | "survival" | "economy";

/** 引擎对外暴露的阶段。只有这些切换才需要惊动 React。 */
export type Phase = "menu" | "countdown" | "playing" | "card" | "revive" | "gameover";

export interface CardDef {
  id: string;
  name: string;
  school: CardSchool;
  icon: string;
  desc: string;
  /** 同一张卡最多叠几层 */
  max: number;
  /** 已拥有的层数；只在三选一里填充，用来区分「新获得」和「升级」 */
  lv?: number;
}

export interface MetaData {
  stardust: number;
  highScore: number;
  runs: number;
  upgrades: {
    life: number;
    bomb: number;
    energy: number;
    revive: number;
  };
}

export interface RunStats {
  score: number;
  kills: number;
  stage: number;
  revives: number;
  seconds: number;
  stardust: number;
  isRecord: boolean;
}

// ── 实体 ──

export interface Player {
  x: number;
  y: number;
  /** 命中判定半径（远小于视觉尺寸，弹幕游戏惯例） */
  r: number;
  hp: number;
  maxHp: number;
  bombs: number;
  maxBombs: number;
  invuln: number;
  fireCd: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  r: number;
  pierce: number;
  element: Element;
  big: boolean;
  life: number;
  /** 僚机发出的子弹：造型和本机不同，避免分不清谁打的 */
  wing: boolean;
  /** 上一颗命中的敌人 uid：防止穿透弹在同一个敌人身上反复扣穿透次数 */
  lastUid: number;
}

export interface Enemy {
  /** 唯一编号：对象池复用后编号会变，穿透弹靠它区分"同一个敌人" */
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  kind: 0 | 1 | 2;
  element: Element;
  resist: Element | null;
  weak: Element | null;
  t: number;
  fireCd: number;
  flash: number;
  slow: number;
  burn: number;
  amp: number;
  ph: number;
  score: number;
  energy: number;
}

export interface Boss {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type: BossType;
  element: Element;
  resist: Element | null;
  weak: Element | null;
  t: number;
  phase: number;
  fireCd: number;
  flash: number;
  dying: number;
}

export interface Fragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  t: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  frame: number;
}

export interface FloatText {
  x: number;
  y: number;
  t: number;
  life: number;
  sprite: number;
  scale: number;
}

/** 击破爆炸：一次击杀放一朵，播放 5 帧后消失 */
export interface Blast {
  x: number;
  y: number;
  t: number;
  size: number;
}

/** 连锁闪电的电弧：从命中点连到被电击的敌人 */
export interface Zap {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t: number;
  seed: number;
}

// ── 局内状态 ──

export interface RunState {
  phase: Phase;
  t: number;
  score: number;
  kills: number;
  stage: number;

  player: Player;
  ship: ShipType;
  weaponLv: number;
  /** 已选卡次数；每 3 次提一级主武器 */
  upgrades: number;

  energy: number;
  energyNeed: number;
  /** 已获得的卡 → 层数 */
  cards: Record<string, number>;

  revivesLeft: number;
  reviveCount: number;

  /** 正在展示的三选一 */
  offer: CardDef[];

  stageTimer: number;
  bossCooldown: number;
  spawnCd: number;
  boss: Boss | null;
  bossWarn: number;
  /** 开局倒计时剩余帧 */
  countdown: number;
  /** 复活询问的自动确认倒计时 */
  reviveTimer: number;
  announce: string;
  announceTimer: number;
  /** 公告的起始帧数：用来算淡入，不然短公告会整段不可见 */
  announceMax: number;

  shake: number;
  bgScroll: number;
  /** 击杀后剩余的分裂弹窗口帧数 */
  splitTimer: number;
  /** 受击护盾触发后剩余的无敌帧 */
  guardTimer: number;

  // ── 打击感 ──
  /** 命中停帧：>0 时世界暂停推进，只渲染 */
  freeze: number;
  /** 枪口闪光剩余帧数 */
  muzzle: number;
  /** 全屏闪光剩余帧数 */
  flash: number;
  /** 全屏闪光是否用危险红（受击），否则用纸白（爆炸 / 炸弹） */
  flashRed: boolean;
}

// ── 音频适配器（由 React 侧注入，引擎只喊事件名） ──

export interface AudioAdapter {
  init(): void;
  shoot(kind: number): void;
  explosion(big: boolean): void;
  playerHit(): void;
  pick(): void;
  powerUp(): void;
  bossWarning(): void;
  bomb(): void;
  card(): void;
  click(): void;
  startBgm(): void;
  stopBgm(): void;
}

/** 引擎 → React 的低频事件。绝不每帧触发。 */
export interface EngineEvents {
  onPhase: (phase: Phase, offer: CardDef[], stats: RunStats | null) => void;
}

export interface EngineHandle {
  start: (ship: ShipType, meta: MetaData) => void;
  chooseCard: (id: string) => void;
  useRevive: () => void;
  giveUp: () => void;
  togglePause: () => void;
  setPaused: (v: boolean) => void;
  isPaused: () => boolean;
  destroy: () => void;
}

export const EMPTY_META: MetaData = {
  stardust: 0,
  highScore: 0,
  runs: 0,
  upgrades: { life: 0, bomb: 0, energy: 0, revive: 0 },
};
