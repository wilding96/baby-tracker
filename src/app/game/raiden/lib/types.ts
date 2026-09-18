// ═══════════════════════════════════════════════════════════════════
// RAIDEN — entity & system types
// ═══════════════════════════════════════════════════════════════════

export type WeaponType = "spread" | "laser" | "wave";
export type OptionForm = "greenLaser" | "purpleWing";
export type ShipType = "ion" | "nova" | "pulse";
export type BossType = "fortress" | "carrier" | "eye";

export interface CardDef {
  id: string;
  name: string;
  icon: string;
  rarity: "SR" | "SSR";
  desc: string;
}

export interface OptionState {
  x: number; y: number;
  targetX: number; targetY: number;
  form: OptionForm;
  transformProgress: number;
  slashCooldown: number;
}

export interface SlashEffect {
  x: number; y: number;
  alpha: number; radius: number;
  timer: number; maxTimer: number;
  alive: boolean;
}

export interface Bullet {
  x: number; y: number; vx: number; vy: number;
  type: "player" | "enemy";
  wtype?: WeaponType;
  wingman?: boolean;
  lightning?: boolean;
  damage: number;
  alive: boolean;
}

export interface Monster {
  x: number; y: number; hp: number; maxHp: number;
  speed: number;
  type: "fighter" | "bomber" | "interceptor" | "elite";
  alive: boolean;
  formation: boolean;
  vx: number; vy: number;
  formationGroup: number;
  flashTimer: number;
  // 飞行轨迹（数学公式驱动）
  age: number;
  traj: "dive" | "sine" | "sweep";
  baseX: number; baseY: number;
  amp: number; freq: number; phase: number;
  // 贝塞尔入场（编队弧线飞入）
  bezier: boolean;
  p0x: number; p0y: number; p3x: number; p3y: number;
  bezT: number; bezSpeed: number;
}

export interface PowerUp {
  x: number; y: number; alive: boolean;
  type: "weapon" | "wingman" | "optionForm";
}

export interface Boss {
  x: number; y: number; hp: number; maxHp: number;
  speed: number; alive: boolean;
  type: BossType;
  attackTimer: number;
  phase: number;
  rageTimer: number;
}

export interface Miniboss {
  x: number; y: number; hp: number; maxHp: number;
  speed: number; alive: boolean;
  type: BossType;
  attackTimer: number;
  enterAnim: number;
}

export interface EnergyFragment {
  x: number; y: number; value: number; alive: boolean;
  vx: number; vy: number;
  age: number; phase: number;
}

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; color: string; size: number;
  life: number; maxLife: number; gravity: number;
  alive: boolean;
}

export interface Missile {
  x: number; y: number; vx: number; vy: number;
  targetX: number; targetY: number;
  alive: boolean;
}

export interface Star {
  x: number; y: number; speed: number; size: number; brightness: number; layer: number;
}

export interface ExhaustParticle {
  x: number; y: number; vx: number; vy: number;
  alpha: number; size: number; life: number; maxLife: number;
  alive: boolean;
}

export interface WaveEntry {
  score: number;
  boss: BossType;
  bossHp: number;
  name: string;
  subtitle: string;
}

export interface SaveData {
  highScore: number;
  totalGames: number;
  upgrades: {
    extraBomb: number;
    weaponBoost: boolean;
    startShield: boolean;
    startWingman: boolean;
  };
}

// Boss charged laser beam (charge-up → fire)
export interface Beam {
  x: number; y: number;       // 炮口（Boss 位置）
  angle: number;              // 方向（弧度）
  length: number;             // 光束长度
  width: number;              // 当前宽度（蓄力渐增，发射时最大）
  state: "charging" | "firing";
  timer: number;              // 当前状态剩余帧数
  alive: boolean;
}
