// ═══════════════════════════════════════════════════════════════════
// POP3D — 全部可调数值集中在这里（数值不要散落进渲染代码）
// 方向 A：3D 竖版弹幕 · 近正交俯视相机 · 波普平涂
// ═══════════════════════════════════════════════════════════════════

import type {
  CardDef,
  CardSchool,
  Element,
  EnemyKind,
  EnemyKindDef,
  MetaData,
  ShipDef,
  ShipType,
  WaveDef,
} from "./types";
import type { PlayerBulletKind } from "./bullets";

// ── 波普调色板（与 2D 版一致）──
// 放在最前：下面的敌种 / 属性定义要引用它。
export const PAL = {
  red: "#FF2D2D",
  magenta: "#E5007E",
  yellow: "#FFD400",
  blue: "#0057FF",
  cyan: "#00C2FF",
  ink: "#101010",
  paper: "#FFF8E7",
  green: "#00A05A",
  /** 玩家火球专用橙：和敌弹的红、敌机的品红都拉得开 */
  orange: "#FF6A00",
} as const;

// ── 属性（电 / 火 / 冰）──
export const ELEMENTS: readonly Element[] = ["electric", "fire", "ice"] as const;

export const ELEMENT_NAME: Record<Element, string> = {
  electric: "电",
  fire: "火",
  ice: "冰",
};

export const ELEMENT_ICON: Record<Element, string> = {
  electric: "⚡",
  fire: "🔥",
  ice: "❄",
};

export const ELEMENT_COLOR: Record<Element, string> = {
  electric: PAL.cyan,
  fire: PAL.red,
  ice: PAL.blue,
};

/** 属性克制倍率；mastery 卡在此之上继续加 */
export const ELEMENT_MOD = { weak: 1.9, resist: 0.45, masteryPer: 0.5 } as const;

// ── 机型：决定起始属性与主炮手感 ──
// 三把枪的初始形态都是**每发 1 枚**——多弹要靠卡（扇形弹）与主武器等级长出来，
// 差别放在"单发有多重、射速多快、弹形多粗"上，而不是一上来就撒一把。
// 强度口径：三者 DPS 都落在 ~210/秒（单发伤害 / 实际冷却）。
export const SHIPS: readonly ShipType[] = ["ion", "nova", "pulse"] as const;

export const SHIP_INFO: Record<ShipType, ShipDef> = {
  ion: {
    label: "离子炮",
    blurb: "贯穿单发 · 高单体",
    element: "electric",
    icon: "🔫",
    bulletCount: 1,
    dmgMul: 2.6,
    cdMul: 1.15,
    spreadMul: 0.6,
  },
  nova: {
    label: "新星",
    blurb: "小鱼干 · 一击见效",
    element: "fire",
    icon: "💥",
    bulletCount: 1,
    dmgMul: 5.0,
    cdMul: 1.45,
    spreadMul: 1.6,
  },
  pulse: {
    label: "脉冲",
    blurb: "骨头飞镖 · 弹道随缘",
    element: "ice",
    icon: "〰️",
    bulletCount: 1,
    dmgMul: 4.0,
    cdMul: 1.2,
    spreadMul: 1.0,
  },
};

// ── 逻辑画布（竖屏参考比例，用于 UI 布局）──
export const LOGICAL = { width: 360, height: 640 } as const;

// ── 世界坐标（1 世界单位 ≈ 10 逻辑像素）──
// 约定：+X 为屏幕右；+Z 为屏幕下（靠近相机 = 玩家侧）；-Z 是敌机来的方向。
export const FIELD = { halfW: 18, halfH: 32 } as const;

// ── 相机：长焦弱透视 + 俯视 ──
// 为什么是长焦（fov 15°）而不是普通透视：场地纵深约 ±27 世界单位，
// 相机一近，远端会缩到近端的三分之一，弹幕"上小下大"没法判读。
// fov 15° 时远近尺寸比约 1.25:1 —— 有纵深，不伤判读。
export const CAMERA = {
  /** "persp" = 长焦弱透视（默认）；"ortho" = 正交（对照与回退用） */
  mode: "persp" as "persp" | "ortho",
  fovDeg: 15,
  pitchDeg: 32,
  /** 仅正交模式使用的相机距离；透视模式由 fov 反推，不用这个值 */
  orthoDistance: 120,
  near: 1,
  far: 900,
  marginY: 1.06, // 纵向留白倍数（越小画面越饱满）
  // 横向最小覆盖倍数。1.12 而不是 1.06：透视下场地底边离相机更近，
  // 近端可见宽度约比注视点小 7%，窄屏上 1.06 会让底角刚好被裁掉。
  // 该约束只在很窄的屏（aspect < 0.6）生效，宽屏由 marginY 主导。
  coverX: 1.12,
  // 画布最大宽高比。超宽窗口下把画布裁成竖屏板并居中，
  // 否则竖版场地会被摊成中间一条窄缝、两侧大片空白。
  maxAspect: 0.72,
} as const;

// ── 玩家机 ──
export const PLAYER = {
  speed: 30, // 键盘速度（世界单位/秒）
  follow: 14, // 指针跟随插值系数，越大越跟手
  radius: 1.0, // 判定半径（小判定，弹幕游戏惯例）
  margin: 2.4, // 离场地边缘的余量
  spawnZ: FIELD.halfH - 6.4, // 出生点（靠近屏幕底部）
  maxHp: 100,
  invuln: 1.0, // 受击后无敌时间（秒）
  fireCd: 0.13, // 自动开火冷却（秒）
  bulletDmg: 10,
  bulletSpread: 0.55, // 多管射击的横向间距
} as const;

// ── 敌弹 ──
export const BULLET = { enemyRadius: 0.5 } as const;

// ── 追踪弹 ──
/** 比例导引的最大转向速率（rad/s）：太大像锁头，太小追不上 */
export const HOMING = { turnRate: 2.6 } as const;

// ── 弹幕表现力（T1：尺寸/描边/拖尾；想调观感只改这里，不用碰渲染代码）──
// 背景：720p 画布下约 10.6 像素/世界单位，原始弹体只有 2.6~13px，看着像纸屑。
export const BULLET_VIS = {
  /** 弹体整体放大倍率（几何在创建时放大，不产生运行时开销） */
  scale: 1.5,
  /** 描边壳倍率（1 = 关）：黑色的反向外壳，和玩家机/敌机同一套硬边风 */
  outline: 1.15,
  /** 发光贴片倍率（1 = 关）：加法混合的径向渐变 billboard，1 个 draw call 覆盖所有弹 */
  glow: 1.3,
  /** 发光强度（加法混合下 = 颜色亮度倍率） */
  glowGain: 0.7,
  /**
   * 每种弹型的拖尾节数。常规射击不拖尾（满屏流光会盖掉打击感），
   * 只有"有分量的东西"才给尾焰——比如追踪弹。
   */
  trailByKind: { bolt: 0, spread: 0, wave: 0, homing: 3, mini: 0 } as Record<PlayerBulletKind, number>,
  /** 相邻两节拖尾的间距（世界单位） */
  trailGap: 0.55,
  /** 每节拖尾的亮度衰减（加法混合下 = 越远越淡） */
  trailDim: 0.42,
} as const;

// ── 屏幕特效总开关（性能分级：桌面开，移动端在 renderer 里强制关）──
export const FX = {
  bloom: true,
  bloomStrength: 0.6,
  bloomRadius: 0.35,
  /**
   * 1.0 = 只让"过曝"的部分发光。米色场地线性亮度约 0.94，
   * 加法发光贴片叠出来的高光会越过 1.0 —— 于是背景不糊、弹头自己发亮。
   */
  bloomThreshold: 1.0,
  speedLines: true,
  /** 速度线的条数 / 长度（世界单位）/ 不透明度——太密太长会像"技术预览的线框" */
  speedLineCount: 14,
  speedLineLength: 7,
  speedLineOpacity: 0.1,
  hitSpark: true,
} as const;

// ── 僚机（实体编队）──
export const WINGMAN = {
  max: 4,
  offsetX: 2.6,
  offsetZ: 1.2,
  follow: 10, // 跟随速率（复用 rig 的 approach）
  fireCdMul: 1.15,
  dmgMul: 0.6,
} as const;

export const POOL_WINGMEN = 4;

// ── 环绕护卫弹（附着物，不进子弹池）──
export const ORBIT = {
  max: 4,
  radius: 3.2,
  angular: 2.4,
  dmgCd: 0.25,
  dmgMul: 0.9,
} as const;

// ── 高度分层（世界 Y）──
// 透视下"离地高度"就是纵深线索；但抬高会让屏幕位置偏移，
// 因此所有实体绘制时都要走 projection.compensatedZ 补偿回判定点。
// 敌弹最高（离相机最近），保证永远压在最上层 —— §5 可读性红线。
export const HEIGHT = {
  border: 0.02,
  shadow: 0.04, // 贴地投影
  burst: 0.5,
  player: 0.8,
  bullet: 1.0,
  enemy: 1.3,
  ebullet: 1.5,
  bossCenter: 1.6, // Boss 视觉中心相对地面的高度
  pop: 3.0, // 拟声词基准高度（之后还会向上飘）
} as const;

// ── 背景（§5：背景对比度永远低于前景）──
export const BACKGROUND = {
  nearSize: 64,
  nearDivisions: 32,
  nearOpacity: 0.1,
  nearSpeed: 7,
  farSize: 128,
  farDivisions: 32,
  farOpacity: 0.05,
  farSpeedMul: 0.6,
  laneXs: [-12, -6, 0, 6, 12],
  laneOpacity: 0.06,
  laneHalfLength: 40,
} as const;

// ── 敌种：三种，颜色 + 缩放区分（不新增 draw call）──
export const ENEMY_KINDS: Record<EnemyKind, EnemyKindDef> = {
  drone: {
    hp: 26,
    speed: 12,
    radius: 1.5,
    scale: 1.0,
    xspeed: 2.0,
    waveAmp: 0,
    waveSpeed: 0,
    fireCd: 2.6,
    bulletSpeed: 19,
    bulletDmg: 10,
    contactDmg: 15,
    color: PAL.magenta,
  },
  weaver: {
    hp: 18,
    speed: 16,
    radius: 1.28,
    scale: 0.85,
    xspeed: 0,
    waveAmp: 4.2,
    waveSpeed: 2.1,
    fireCd: 0, // 不反击，靠数量与走位施压
    bulletSpeed: 0,
    bulletDmg: 0,
    contactDmg: 12,
    color: PAL.green,
  },
  gunner: {
    hp: 70,
    speed: 8,
    radius: 2.4,
    scale: 1.6,
    xspeed: 1.4,
    waveAmp: 0,
    waveSpeed: 0,
    fireCd: 3.0,
    bulletSpeed: 24,
    bulletDmg: 12,
    contactDmg: 22,
    color: PAL.magenta,
  },
};

// ── 本局节奏：波次表 ──
// 允许重叠 → 制造"难度有起伏"（90~118s 只留稀疏散射，是刻意的低谷）。
export const RUN = {
  duration: 180, // 参考整局时长（秒）
  bossAt: 150, // Boss 登场时间（秒）
  rampFrom: 1.0, // 难度系数起点
  rampTo: 1.8, // 难度系数终点
} as const;

export const WAVES: readonly WaveDef[] = [
  { at: 0, until: 20, kind: "drone", interval: 1.3, count: 1, pattern: "random" },
  { at: 20, until: 42, kind: "drone", interval: 1.0, count: 2, pattern: "line" },
  { at: 42, until: 66, kind: "weaver", interval: 0.85, count: 2, pattern: "sides" },
  { at: 66, until: 90, kind: "drone", interval: 0.8, count: 3, pattern: "line" },
  { at: 90, until: 118, kind: "gunner", interval: 2.8, count: 1, pattern: "random" },
  { at: 100, until: 128, kind: "weaver", interval: 0.75, count: 3, pattern: "sides" },
  { at: 118, until: 150, kind: "drone", interval: 0.7, count: 3, pattern: "line" },
  { at: 132, until: 150, kind: "gunner", interval: 2.6, count: 2, pattern: "sides" },
] as const;

// ── Boss ──
export const BOSS = {
  hp: 2800,
  /** 每选 1 张卡，Boss 血量按此比例上浮：满 build 下 Boss 才仍是场战斗 */
  hpPerLevel: 0.22,
  radius: 5.4,
  enterZ: -17,
  swayX: 9,
  swaySpeed: 0.55,
  fanCd: 1.5,
  fanCount: 5,
  fanSpread: 0.38, // 弧度间隔
  fanSpeed: 18,
  fanDmg: 12,
  spiralCd: 0.1, // 二阶段螺旋发射间隔
  spiralStep: 0.42, // 螺旋每次推进的相位
  spiralSpeed: 15,
  spiralDmg: 10,
  contactDmg: 40,
  phase2At: 0.5, // HP 比例低于此值进入二阶段
} as const;

// ── 能量与升级曲线（§8.3：沿用 2D 版的 base / growth 口径）──
export const ENERGY = {
  base: 140,
  growth: 1.18,
  perKill: 10,
  perBoss: 400,
  /** 每几次升级提一级主武器 */
  levelsPerWeaponUp: 3,
} as const;

export const WEAPON_MAX_LV = 4;

// ── 灼烧 / 减速 ──
export const STATUS = {
  burnTime: 2.0,
  burnDps: 7, // 每层每秒伤害
  chillTime: 1.6,
  chillMul: 0.78, // 被减速后的移动速度系数
  chainRange: 12,
  chainRatio: 0.4, // 连锁闪电的伤害比例（每层）
} as const;

// ── 流派卡：16 张行为卡，分四流派（§8.1）──
export const CARDS: readonly CardDef[] = [
  // 弹幕流
  { id: "rate", name: "超频", school: "barrage", icon: "⏩", desc: "射速提升 18%", max: 3 },
  { id: "spread", name: "扇形弹", school: "barrage", icon: "⊹", desc: "主炮 +1 发并呈扇形散开", max: 3 },
  { id: "pierce", name: "贯穿", school: "barrage", icon: "↟", desc: "子弹可多穿透 1 个敌人", max: 3 },
  { id: "backfire", name: "后向炮", school: "barrage", icon: "⇅", desc: "同时向后发射 45% 伤害的弹", max: 1 },
  { id: "wing", name: "侧翼僚机", school: "barrage", icon: "✈", desc: "Lv1 两架 / Lv2 四架实体僚机，继承机型弹型", max: 2 },
  { id: "wingrate", name: "僚机超频", school: "barrage", icon: "⟫", desc: "僚机射速 +25%", max: 2 },
  { id: "winglink", name: "僚机协同", school: "barrage", icon: "⇄", desc: "僚机命中给主武器叠增伤（每层 +4%，上限 5 层，2 秒衰减）", max: 2 },
  { id: "split", name: "分裂弹", school: "barrage", icon: "❉", desc: "主弹命中后分裂成 2 发小弹", max: 2 },
  { id: "homing", name: "追踪弹", school: "barrage", icon: "➹", desc: "每次齐射附带 N 发追踪弹", max: 2 },
  // 元素流
  { id: "volt", name: "电击弹", school: "element", icon: "⚡", desc: "弹附电属性；命中电击最近的敌人", max: 2 },
  { id: "flame", name: "燃烧弹", school: "element", icon: "🔥", desc: "弹附火属性；命中叠加灼烧", max: 2 },
  { id: "frost", name: "冰缓弹", school: "element", icon: "❄", desc: "弹附冰属性；命中减速敌人 22%", max: 2 },
  { id: "mastery", name: "属性精通", school: "element", icon: "◆", desc: "属性克制倍率 +0.5", max: 2 },
  // 生存流
  { id: "bulk", name: "强化装甲", school: "survival", icon: "❤", desc: "最大生命 +25，并立即回复", max: 3 },
  { id: "leech", name: "击杀回血", school: "survival", icon: "✚", desc: "每 40 击杀回复 6 点生命", max: 2 },
  { id: "guard", name: "受击护盾", school: "survival", icon: "🛡", desc: "受伤后无敌时间 +1.2 秒", max: 1 },
  { id: "last", name: "背水一战", school: "survival", icon: "‼", desc: "生命低于 30% 时伤害 ×1.6", max: 1 },
  { id: "orbit", name: "环绕护卫弹", school: "survival", icon: "◎", desc: "Lv1 两发 / Lv2 四发绕机公转，接触伤害", max: 2 },
  // 经济流
  { id: "flow", name: "能量回流", school: "economy", icon: "∞", desc: "升级所需能量 -14%", max: 3 },
  { id: "bounty", name: "赏金猎人", school: "economy", icon: "★", desc: "击杀得分 +50%", max: 2 },
  { id: "star", name: "星尘转化", school: "economy", icon: "✧", desc: "本局星尘结算 +25%", max: 2 },
] as const;

export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export const SCHOOL_NAME: Record<CardSchool, string> = {
  barrage: "弹幕流",
  element: "元素流",
  survival: "生存流",
  economy: "经济流",
};

export const SCHOOL_COLOR: Record<CardSchool, string> = {
  barrage: PAL.blue,
  element: PAL.magenta,
  survival: PAL.red,
  economy: PAL.yellow,
};

// ── 局外养成 ──
export interface MetaUpgradeDef {
  key: keyof MetaData["upgrades"];
  label: string;
  desc: string;
  max: number;
  cost: (level: number) => number;
}

export const META_UPGRADES: readonly MetaUpgradeDef[] = [
  { key: "life", label: "强化装甲", desc: "初始最大生命 +25", max: 3, cost: (l) => 60 + l * 60 },
  { key: "power", label: "火力强化", desc: "子弹伤害 +8%", max: 3, cost: (l) => 70 + l * 70 },
  { key: "energy", label: "能量引擎", desc: "能量获取 +12%", max: 3, cost: (l) => 70 + l * 70 },
  { key: "revive", label: "备用机体", desc: "额外复活 1 次", max: 1, cost: () => 260 },
] as const;

/** 每局得分换算星尘的比例 */
export const STARDUST_RATE = 0.06;

// ── 对象池容量（§4.2：同屏 400+ 弹幕）──
export const POOL = {
  playerBullets: 400,
  enemyBullets: 512,
  enemies: 48,
  bursts: 96,
} as const;

export const SCORE = { perKill: 10, bossKill: 500 } as const;
export const BURST = { life: 0.35, maxScale: 2.4 } as const;

// ── 打击感（M4）──
export const JUICE = {
  freezeKill: 0.03, // 击杀停帧
  freezeBoss: 0.14, // Boss 受创停帧
  freezeDeath: 0.25, // 玩家阵亡停帧
  shakeKill: 0.22,
  shakeHit: 0.85,
  shakeBoss: 1.5,
  shakeDecay: 4.5, // 每秒衰减
  shakeMax: 1.4,
  muzzle: 0.06, // 枪口闪光时长
  warn: 2.2, // BOSS WARNING 时长
  popLife: 0.5, // 拟声词存活
  popCap: 12, // 同屏拟声词上限
} as const;

// ── 拟声词（§8.8）：预渲染成贴图，运行时只查表 ──
export const WORDS = ["POW!", "WHAM!", "BIFF!", "BOOM!", "KAPOW!", "OUCH!", "WARNING!", "LEVEL UP!"] as const;
export const WORD_KILL_BASE = 0; // POW! / WHAM! / BIFF! 三连
export const WORD_KILL_COUNT = 3;
export const WORD_BOOM = 3;
export const WORD_CLEAR = 4;
export const WORD_HURT = 5;
export const WORD_WARN = 6;
export const WORD_LEVEL = 7;

// ── 循环 ──
export const LOOP = { step: 1 / 60, maxSteps: 5 } as const;

// ── 帧率采样窗口（毫秒）──
export const FPS_SAMPLE_MS = 250;
