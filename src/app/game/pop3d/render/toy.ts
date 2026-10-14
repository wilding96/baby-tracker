// ═══════════════════════════════════════════════════════════════════
// POP3D — 玩具渲染器（?theme=toy）
//
// 与 3D 渲染器（scene.ts）和纸片渲染器（paper.ts）**并行**的第三套实现，
// 引擎与玩法完全不用改（Renderer 接口一致）。
//
// ── 形态：平面世界 + 立体实物 ──
//   场地是一张**正交投影的平面**（没有透视、没有近大远小、判定点 1:1 映射），
//   只有战机 / 敌机 / 子弹 / 障碍是立体实物。参照系：Qute《Ginga Force》《Eschatos》。
//   正交在玩法上更优：远近一样大 → 弹幕判定天然公平，也没有尺寸竞争。
//
// ── 正交关掉了"透视"这条最强深度线索，立体感由这 5 条承担 ──
//   ① 强方向性光照：受光面 / 顶面 / 背光面落在三个不同明度
//      （不要用 scene.ts 的环境光 1.05 + 主光 1.7，那会把顶面曝成一个值 = 平）
//   ② 墨黑描边 = 反向外壳（BackSide 放大 7.5%）—— 只给实体，不给子弹（会糊掉小弹体）
//   ③ 贴地投影按**离地高度**偏移（光源方向全场一致）→ "悬在地面上"立刻成立
//   ④ 姿态旋转：俯视下 roll 看不见，**看得见的是 yaw / pitch**，
//      所以会转的东西（发条玩具原地绕圈）本身就是最好的立体说明
//   ⑤ 厚度与倒角：正交会吃掉纵深，扁盒子看起来就是扁的
//
// ── 俯视剪影的五条规律（造型段全部照这条写）──
//   ① 扁圆盘（DISC）代替球：球从正上方是一团模糊的包，盘才是明确的圆
//   ② 附件必须超出母体轮廓，且高度不低于母体顶部，否则会被母体遮掉
//   ③ "尖"必须用 3 段锥：ConeGeometry(r,h,4) 的俯视剪影是正方形
//   ④ 不要用整圈圆环做机械特征（会被读成同心圆图案）
//   ⑤ 细节不能和主体剪影抢辨识度
//
// ── 性能（§4.3 红线 < 60 draw call）──
//   弹幕按弹型 InstancedMesh + 本体/高光**顶点色合并成一个几何体**；
//   所有贴地投影合成**一个** InstancedMesh；实体按类型实例化。
//   踩坑：mergeGeometries 混用索引/非索引几何会返回 null（Icosahedron 非索引、
//   Box/Sphere/Cylinder 是索引）→ 每块几何先 toNonIndexed + 统一属性集。
// ═══════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { EBULLET, FIELD, HEIGHT, PAL, POP, WORDS } from "../engine/config";
import { PLAYER_BULLET_KINDS, type PlayerBulletKind } from "../engine/bullets";
import { computeFraming } from "../engine/framing";
import { compensatedZ, degToRad } from "../engine/projection";
import type { EnemyBulletKind, Renderer, Vec2, World } from "../engine/types";

/** 本渲染器的可调常量（集中在这里，不散进绘制代码） */
export const TOY = {
  /** 相机俯角（离竖直方向）。pop3d 原本 16°、M5 改 32°；玩具风取中间：
   *  既让玩具的受光/背光面拉开，cos24°=0.914 的纵向压缩又几乎察觉不到 */
  pitchDeg: 24,
  /** 描边放大比例（反向外壳） */
  outlineK: 1.075,
  /** 阴影：偏移 ∝ 离地高度，光源方向全场一致（左上光 → 影子朝右下） */
  shadowSkew: 0.34,
  shadowSkewZ: 0.30,
  shadowOpacity: 0.5,
  shadowCap: 256,
  popCap: 6,
} as const;

const PITCH_RAD = degToRad(TOY.pitchDeg);
const rz = (z: number, y: number): number => compensatedZ(z, y, PITCH_RAD);

// ═══════════════════════════════════════════════════════════════════
// 几何工具：顶点色合并 + 按类型实例化
// ═══════════════════════════════════════════════════════════════════
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _dummy = new THREE.Object3D();

/**
 * 把一块几何体烘焙成"带顶点色 + 已应用局部变换"的形态。
 * 必须统一属性集（只留 position/normal/color），否则 mergeGeometries 返回 null。
 */
function prep(
  geo: THREE.BufferGeometry,
  color: THREE.ColorRepresentation,
  pos: readonly [number, number, number] = [0, 0, 0],
  rot: readonly [number, number, number] = [0, 0, 0],
  scale: readonly [number, number, number] = [1, 1, 1],
): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) {
    if (k !== "position" && k !== "normal" && k !== "color") g.deleteAttribute(k);
  }
  if (!g.attributes.normal) g.computeVertexNormals();
  _m4.compose(_v.set(pos[0], pos[1], pos[2]), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(scale[0], scale[1], scale[2]));
  g.applyMatrix4(_m4);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  const c = new THREE.Color(color);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}

interface Prefab {
  geo: THREE.BufferGeometry;
  outline: THREE.BufferGeometry;
}

/** 一组 parts → 一个合并几何体 + 一份放大后的描边几何体（反向外壳） */
function prefab(parts: THREE.BufferGeometry[], outlineK = TOY.outlineK): Prefab {
  const geo = mergeGeometries(parts, false);
  if (!geo) throw new Error("POP3D/toy: mergeGeometries 返回 null（属性集不一致）");
  const outline = geo.clone();
  outline.scale(outlineK, outlineK, outlineK);
  return { geo, outline };
}

const MAT_BODY = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
const MAT_OUTLINE = new THREE.MeshBasicMaterial({
  color: PAL.ink,
  side: THREE.BackSide,
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
});

interface Pair {
  body: THREE.InstancedMesh;
  outline: THREE.InstancedMesh | null;
  used: number;
  cap: number;
}

/** 按类型实例化的"本体 + 描边"（共享同一批矩阵） */
function makePair(pf: Prefab, cap: number, withOutline = true): Pair {
  const body = new THREE.InstancedMesh(pf.geo, MAT_BODY, cap);
  body.frustumCulled = false;
  const outline = withOutline ? new THREE.InstancedMesh(pf.outline, MAT_OUTLINE, cap) : null;
  if (outline) outline.frustumCulled = false;
  return { body, outline, used: 0, cap };
}

function pushPair(
  p: Pair,
  x: number,
  y: number,
  z: number,
  ry = 0,
  rx = 0,
  s: number | readonly [number, number, number] = 1,
): void {
  if (p.used >= p.cap) return;
  _dummy.position.set(x, y, z);
  _dummy.rotation.set(rx, ry, 0);
  if (typeof s === "number") _dummy.scale.set(s, s, s);
  else _dummy.scale.set(s[0], s[1], s[2]);
  _dummy.updateMatrix();
  p.body.setMatrixAt(p.used, _dummy.matrix);
  if (p.outline) p.outline.setMatrixAt(p.used, _dummy.matrix);
  p.used += 1;
}

function flushPair(p: Pair): void {
  p.body.count = p.used;
  p.body.instanceMatrix.needsUpdate = true;
  if (p.outline) {
    p.outline.count = p.used;
    p.outline.instanceMatrix.needsUpdate = true;
  }
  p.used = 0;
}

// ── 几何简写 ──
const SPH = (r: number, a = 12, b = 8): THREE.SphereGeometry => new THREE.SphereGeometry(r, a, b);
const TOR = (...a: ConstructorParameters<typeof THREE.TorusGeometry>): THREE.TorusGeometry =>
  new THREE.TorusGeometry(...a);
const CYL = (...a: ConstructorParameters<typeof THREE.CylinderGeometry>): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(...a);
const CONE = (...a: ConstructorParameters<typeof THREE.ConeGeometry>): THREE.ConeGeometry =>
  new THREE.ConeGeometry(...a);
const BOXG = (...a: ConstructorParameters<typeof THREE.BoxGeometry>): THREE.BoxGeometry =>
  new THREE.BoxGeometry(...a);
/** 扁圆盘：俯视下的"圆"（规律 ①） */
const DISC = (r: number, h = 0.12, seg = 12): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(r, r, h, seg);
/** 细长管：尾巴 / 线头 */
const TUBE = (
  pts: readonly (readonly [number, number, number])[],
  rad: number,
  seg = 10,
): THREE.TubeGeometry =>
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2]))),
    seg,
    rad,
    5,
    false,
  );
const FLAT: readonly [number, number, number] = [-Math.PI / 2, 0, 0];

// ═══════════════════════════════════════════════════════════════════
// 造型：为俯视剪影而设计
// ═══════════════════════════════════════════════════════════════════

/** 发条老鼠（无人机）：细长身体 + 长尖吻 + 大圆盘耳 + 四只脚 + 甩出体外的细尾 + 小旋钮 */
const PF_MOUSE = prefab([
  prep(SPH(1), PAL.magenta, [0, 0, 0], [0, 0, 0], [1.8, 0.8, 1.05]),
  prep(CONE(0.42, 1.6, 10), PAL.magenta, [1.7, 0, 0], [0, 0, -Math.PI / 2]),
  prep(SPH(0.17, 8, 6), PAL.ink, [2.5, 0, 0]),
  prep(DISC(0.66, 0.14, 14), PAL.magenta, [0.6, 0.82, -0.8]),
  prep(DISC(0.66, 0.14, 14), PAL.magenta, [0.6, 0.82, 0.8]),
  prep(DISC(0.18, 0.12, 10), PAL.ink, [1.5, 0.42, -0.36]),
  prep(DISC(0.18, 0.12, 10), PAL.ink, [1.5, 0.42, 0.36]),
  prep(DISC(0.27, 0.1, 10), PAL.magenta, [0.8, -0.44, -1]),
  prep(DISC(0.27, 0.1, 10), PAL.magenta, [0.8, -0.44, 1]),
  prep(DISC(0.27, 0.1, 10), PAL.magenta, [-0.9, -0.44, -0.95]),
  prep(DISC(0.27, 0.1, 10), PAL.magenta, [-0.9, -0.44, 0.95]),
  prep(TUBE([[-1.35, 0, 0], [-2.3, 0.1, 0.4], [-3.2, 0.28, 1], [-3.75, 0.46, 1.6]], 0.085, 12), PAL.magenta),
  prep(DISC(0.2, 0.1, 10), PAL.ink, [-0.6, 0.72, 0]),
  prep(CYL(0.09, 0.09, 0.45, 8), PAL.paper, [-0.6, 0.98, 0]),
  prep(DISC(0.24, 0.12, 12), PAL.paper, [-0.6, 1.24, 0]),
]);

/** 尖叫鸭（编织机 weaver）：宽扁嘴 + 两片翅膀 + 尾羽 */
const PF_DUCK = prefab([
  prep(SPH(1), 0xffb02e, [0, 0, 0], [0, 0, 0], [1.35, 0.85, 1.05]),
  prep(SPH(0.62), 0xffb02e, [1.15, 0.6, 0]),
  prep(BOXG(1, 0.2, 0.78), PAL.red, [1.95, 0.5, 0]),
  prep(DISC(0.14, 0.12, 10), PAL.ink, [1.5, 0.92, -0.32]),
  prep(DISC(0.14, 0.12, 10), PAL.ink, [1.5, 0.92, 0.32]),
  prep(DISC(0.5, 0.12, 12), 0xffb02e, [-0.2, 0.42, -0.92], [0, 0, 0], [1, 1, 0.72]),
  prep(DISC(0.5, 0.12, 12), 0xffb02e, [-0.2, 0.42, 0.92], [0, 0, 0], [1, 1, 0.72]),
  prep(CONE(0.36, 0.7, 8), 0xffb02e, [-1.35, 0.25, 0], [0, 0, Math.PI / 2]),
]);

/** 扫地机器人（炮台 gunner）：**明确的正面** —— 朝向三角 + 前保险杠 + 伸出的滚刷 */
const PF_VACUUM = prefab([
  prep(CYL(2.25, 2.25, 0.7, 24), PAL.magenta),
  prep(CYL(2.05, 2.05, 0.3, 24), PAL.ink, [0, 0.45, 0]),
  prep(CONE(0.95, 1.5, 3), PAL.red, [0, 0.62, 0.55], [Math.PI / 2, 0, 0]),
  prep(BOXG(3.5, 0.4, 0.6), PAL.red, [0, 0.5, 2]),
  prep(CYL(0.24, 0.24, 2.5, 10), PAL.ink, [0, -0.1, 2.35], [0, 0, Math.PI / 2]),
  prep(CYL(0.5, 0.5, 0.8, 12), PAL.ink, [0, 0.8, -0.7]),
  prep(DISC(0.3, 0.12, 10), PAL.paper, [0, 1.22, -0.7]),
  prep(DISC(0.46, 0.4, 10), PAL.ink, [-1.95, -0.25, -0.7], [0, 0, Math.PI / 2]),
  prep(DISC(0.46, 0.4, 10), PAL.ink, [1.95, -0.25, -0.7], [0, 0, Math.PI / 2]),
]);

/** Boss 毛绒熊：小圆耳（明显小于头）+ 纸白口鼻 + 墨鼻头 + 四肢 + 红补丁 + 缝合线 */
const PF_BEAR = prefab([
  prep(SPH(3.3, 16, 12), PAL.magenta, [0, 0, 0], [0, 0, 0], [1, 0.8, 0.95]),
  prep(SPH(1.1, 10, 8), PAL.magenta, [-2.55, 2.15, -1.6]),
  prep(SPH(1.1, 10, 8), PAL.magenta, [2.55, 2.15, -1.6]),
  prep(DISC(0.55, 0.12, 10), PAL.ink, [-2.55, 2.72, -1.6]),
  prep(DISC(0.55, 0.12, 10), PAL.ink, [2.55, 2.72, -1.6]),
  prep(SPH(1.45, 12, 10), PAL.paper, [0, 0.15, 2.5], [0, 0, 0], [1, 0.6, 0.85]),
  prep(SPH(0.3, 8, 6), PAL.ink, [0, 0.45, 3.3]),
  prep(DISC(0.36, 0.12, 10), PAL.paper, [-1.15, 1.5, 0.85]),
  prep(DISC(0.36, 0.12, 10), PAL.paper, [1.15, 1.5, 0.85]),
  prep(DISC(0.15, 0.12, 8), PAL.ink, [-1.15, 1.58, 0.85]),
  prep(DISC(0.15, 0.12, 8), PAL.ink, [1.15, 1.58, 0.85]),
  prep(SPH(3.9, 14, 10), PAL.magenta, [0, -0.5, -2.4], [0, 0, 0], [1.12, 0.75, 0.9]),
  prep(SPH(1.08, 10, 8), PAL.magenta, [-3.3, -0.2, -0.5]),
  prep(SPH(1.08, 10, 8), PAL.magenta, [3.3, -0.2, -0.5]),
  prep(SPH(1.22, 10, 8), PAL.magenta, [-3.1, -0.45, -2.6]),
  prep(SPH(1.22, 10, 8), PAL.magenta, [3.1, -0.45, -2.6]),
  prep(CYL(1.25, 1.25, 0.3, 16), PAL.red, [-1.95, 0.5, -2.1], FLAT),
  prep(BOXG(0.18, 0.12, 0.5), PAL.paper, [0, 0.62, 1.85]),
  prep(BOXG(0.18, 0.12, 0.5), PAL.paper, [0, 0.78, 1.15]),
  prep(BOXG(0.18, 0.12, 1), PAL.paper, [0, 1.15, -0.1]),
]);

/** 玩家绿猫（面朝 -Z）：**大头 + 立起的 3 段锥尖耳 + 胡须 + 长尾 + 四只脚** */
const PF_CAT = prefab([
  prep(SPH(1, 14, 10), PAL.laser, [0, 0, 0.45], [0, 0, 0], [1.1, 0.8, 1.35]),
  prep(SPH(0.88, 14, 10), PAL.laser, [0, 0.45, -1]),
  prep(CONE(0.78, 1.55, 3), PAL.laser, [-0.54, 1.5, -1.2], [0, Math.PI + 0.22, 0]),
  prep(CONE(0.78, 1.55, 3), PAL.laser, [0.54, 1.5, -1.2], [0, Math.PI - 0.22, 0]),
  prep(CONE(0.4, 0.85, 3), PAL.paper, [-0.54, 1.95, -1.22], [0, Math.PI + 0.22, 0]),
  prep(CONE(0.4, 0.85, 3), PAL.paper, [0.54, 1.95, -1.22], [0, Math.PI - 0.22, 0]),
  prep(DISC(0.3, 0.12, 10), PAL.paper, [-0.42, 1.1, -1.52], [0, 0, 0], [1, 1, 0.66]),
  prep(DISC(0.3, 0.12, 10), PAL.paper, [0.42, 1.1, -1.52], [0, 0, 0], [1, 1, 0.66]),
  prep(DISC(0.13, 0.12, 8), PAL.ink, [-0.42, 1.17, -1.52]),
  prep(DISC(0.13, 0.12, 8), PAL.ink, [0.42, 1.17, -1.52]),
  prep(DISC(0.18, 0.1, 8), PAL.ink, [0, 0.78, -1.82]),
  prep(BOXG(0.62, 0.07, 0.06), PAL.paper, [-0.58, 0.76, -1.72], [0, 0.42, 0]),
  prep(BOXG(0.62, 0.07, 0.06), PAL.paper, [-0.58, 0.68, -1.6], [0, 0.14, 0]),
  prep(BOXG(0.62, 0.07, 0.06), PAL.paper, [0.58, 0.76, -1.72], [0, -0.42, 0]),
  prep(BOXG(0.62, 0.07, 0.06), PAL.paper, [0.58, 0.68, -1.6], [0, -0.14, 0]),
  prep(DISC(0.32, 0.1, 10), PAL.laser, [-0.85, -0.34, -0.35]),
  prep(DISC(0.32, 0.1, 10), PAL.laser, [0.85, -0.34, -0.35]),
  prep(DISC(0.32, 0.1, 10), PAL.laser, [-0.88, -0.34, 1.1]),
  prep(DISC(0.32, 0.1, 10), PAL.laser, [0.88, -0.34, 1.1]),
  prep(TUBE([[0, 0, 1.6], [0.55, 0.2, 2.5], [1.45, 0.5, 3], [2.15, 0.9, 2.65]], 0.13, 12), PAL.laser),
]);

/** 僚机：缩小的猫（保留尖耳与胡须） */
const PF_WING = prefab([
  prep(SPH(0.6), PAL.laser, [0, 0, 0.25], [0, 0, 0], [1.05, 0.8, 1.4]),
  prep(SPH(0.55), PAL.laser, [0, 0.24, -0.6]),
  prep(CONE(0.3, 0.5, 3), PAL.laser, [-0.34, 0.62, -0.76], [0, Math.PI + 0.25, 0]),
  prep(CONE(0.3, 0.5, 3), PAL.laser, [0.34, 0.62, -0.76], [0, Math.PI - 0.25, 0]),
  prep(DISC(0.2, 0.1, 8), PAL.paper, [-0.2, 0.55, -0.86]),
  prep(DISC(0.2, 0.1, 8), PAL.paper, [0.2, 0.55, -0.86]),
  prep(BOXG(0.44, 0.06, 0.05), PAL.paper, [-0.34, 0.38, -0.92], [0, 0.3, 0]),
  prep(BOXG(0.44, 0.06, 0.05), PAL.paper, [0.34, 0.38, -0.92], [0, -0.3, 0]),
]);

// ── 敌弹：弹型就是形状语言（白高光合并进本体，1 个 DC/弹型）──
// 弹芯用纸白（不是墨点）：正交下弹体要读成"一个实心物件"，
// 墨芯在灰度/缩小后会变成甜甜圈，被读成背景装饰。
const bead = (r: number, color: string, hi: number): THREE.BufferGeometry[] => [
  prep(SPH(r, 8, 6), color),
  prep(new THREE.OctahedronGeometry(hi, 0), PAL.paper, [0, r * 0.78, -r * 0.2]),
];

const PF_EBULLET: Record<EnemyBulletKind, Prefab> = {
  ball: prefab(bead(0.5, EBULLET.ball.color, 0.2)),
  diamond: prefab([
    prep(new THREE.OctahedronGeometry(0.62, 0), EBULLET.diamond.color),
    prep(new THREE.OctahedronGeometry(0.2, 0), PAL.paper, [0, 0.38, 0]),
  ]),
  long: prefab([
    prep(BOXG(0.5, 0.5, 1.7), EBULLET.long.color),
    prep(BOXG(0.2, 0.2, 1.05), PAL.paper, [0, 0.3, 0]),
  ]),
  ring: prefab([
    prep(TOR(0.62, 0.18, 6, 18), EBULLET.ring.color, [0, 0, 0], FLAT),
    prep(DISC(0.2, 0.14, 12), PAL.paper),
  ]),
  spike: prefab([prep(CONE(0.5, 1.15, 5), EBULLET.spike.color)]),
  laser: prefab([
    prep(BOXG(0.42, 0.42, 2.6), EBULLET.laser.color),
    prep(BOXG(0.18, 0.18, 1.9), PAL.paper, [0, 0.26, 0]),
  ]),
};

// ── 我方弹：形状区分弹型，配色沿用纸片渲染器的语义（绿 / 金 / 暖米，全部避开敌弹的红品红）──
const PF_PBULLET: Record<PlayerBulletKind, Prefab> = {
  bolt: prefab([
    prep(BOXG(0.34, 0.34, 1.5), PAL.laser),
    prep(BOXG(0.13, 0.13, 1), PAL.paper, [0, 0.24, 0]),
  ]),
  spread: prefab([
    // 小鱼干：椭球身 + 尾鳍
    prep(SPH(0.5), PAL.fish, [0, 0, 0], [0, 0, 0], [0.75, 0.62, 1.25]),
    prep(CONE(0.3, 0.55, 3), PAL.fish, [0, 0, 0.85], [Math.PI / 2, 0, 0]),
    prep(DISC(0.11, 0.1, 8), PAL.ink, [0.24, 0.28, -0.5]),
  ]),
  wave: prefab([
    // 骨头（哑铃）：以中心为原点，沿局部 Z 排布。
    // 注意：v1 的视觉长度是固定的，**没有**跟着 b.arm 拉伸 ——
    // arm 是判定用的偏心距离，视觉要跟上必须按 (2*arm/1.5) 缩放局部 z
    // （pushPair 已支持非等比缩放，下一版接上）。
    prep(SPH(0.38), PAL.bone, [0, 0, -0.75]),
    prep(CYL(0.16, 0.16, 1.5, 8), PAL.bone, [0, 0, 0], [Math.PI / 2, 0, 0]),
    prep(SPH(0.38), PAL.bone, [0, 0, 0.75]),
  ]),
  homing: prefab([
    prep(new THREE.OctahedronGeometry(0.42, 0), PAL.laser, [0, 0, 0], [0, 0, 0], [0.8, 0.8, 1.5]),
    prep(DISC(0.14, 0.1, 8), PAL.paper, [0, 0.2, 0]),
  ]),
  mini: prefab([prep(new THREE.OctahedronGeometry(0.28, 0), PAL.fish)]),
};

// ── 漫画爆炸：挤出的尖刺星（俯视下是"印在地面上的爆炸"）──
function burstStar(outer: number, inner: number, spikes: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  for (let i = 0; i < spikes * 2; i += 1) {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: false });
}
const PF_BURST = prefab([
  prep(burstStar(1, 0.52, 11), PAL.paper, [0, 0, 0], [Math.PI / 2, 0, 0]),
  prep(CYL(0.44, 0.44, 0.3, 14), PAL.red, [0, 0.14, 0]),
]);

// ═══════════════════════════════════════════════════════════════════
// 渲染器
// ═══════════════════════════════════════════════════════════════════
export function createToyRenderer(mount: HTMLElement): Renderer {
  const isMobile =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
  const canvas = renderer.domElement;
  canvas.style.position = "absolute";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(POP.spaceBg);

  // ── 正交相机：场地就是一张平面（屏幕上方 = -Z，与引擎约定一致）──
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 400);
  camera.up.set(0, 0, -1);
  let baseDistance = 160;
  const shake = new THREE.Vector2();
  function placeCamera(): void {
    const p = PITCH_RAD;
    camera.position.set(shake.x, Math.cos(p) * baseDistance, Math.sin(p) * baseDistance + shake.y);
    camera.lookAt(0, 0, 0);
  }
  placeCamera();

  // ── 光照：① 环境压低 + 强方向性主光（受光/顶面/背光三档明度）──
  scene.add(new THREE.AmbientLight(0x53536a, 0.5));
  const key = new THREE.DirectionalLight(0xfff4e2, 1.55);
  key.position.set(-26, 60, 34);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x7fa6ff, 0.45);
  fill.position.set(34, 22, -30);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd9f0, 0.3);
  rim.position.set(10, 30, -60);
  scene.add(rim);

  // ── 场地：一张"印出来的"平面（正交 → 板缝平行不收敛）──
  function printTexture(): THREE.CanvasTexture {
    const S = 512;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#3b3350";
      g.fillRect(0, 0, S, S);
      g.strokeStyle = "#2e2740";
      g.lineWidth = 9;
      for (let x = 0; x <= S; x += 128) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, S);
        g.stroke();
      }
      g.lineWidth = 6;
      for (let y = 0; y <= S; y += 256) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(S, y);
        g.stroke();
      }
      g.fillStyle = "rgba(16,16,16,0.16)";
      for (let y = 16; y < S; y += 32) {
        for (let x = 16 + ((y / 32) % 2) * 16; x < S; x += 32) {
          g.beginPath();
          g.arc(x, y, 3.4, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 3);
    return t;
  }

  // 场地是"印出来的"，**不受光**：一来更贴风格（印刷面不该有明暗），
  // 二来省掉一整块全屏逐像素光照 —— 实测这是本渲染器最大的一笔填充开销。
  const fieldMat = new THREE.MeshBasicMaterial({ map: printTexture() });
  const fieldMesh = new THREE.Mesh(new THREE.PlaneGeometry(FIELD.halfW * 2, FIELD.halfH * 2), fieldMat);
  fieldMesh.rotation.x = -Math.PI / 2;
  scene.add(fieldMesh);

  // 粗黑分格边框：8 条合并成 1 个几何体（顶点色区分纸白/墨黑）→ 1 个 DC
  {
    const bars: THREE.BufferGeometry[] = [];
    const bar = (w: number, d: number, x: number, z: number, col: THREE.ColorRepresentation): void => {
      const g = new THREE.PlaneGeometry(w, d).toNonIndexed().rotateX(-Math.PI / 2);
      g.translate(x, HEIGHT.border, z);
      const n = g.attributes.position.count;
      const arr = new Float32Array(n * 3);
      const c = new THREE.Color(col);
      for (let i = 0; i < n; i += 1) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
      g.deleteAttribute("uv");
      bars.push(g);
    };
    const HW = FIELD.halfW;
    const HH = FIELD.halfH;
    bar(HW * 2 + 2.6, 1.3, 0, HH + 1.3, PAL.paper);
    bar(HW * 2 + 2.6, 1.3, 0, -HH - 1.3, PAL.paper);
    bar(1.3, HH * 2 + 2.6, HW + 1.3, 0, PAL.paper);
    bar(1.3, HH * 2 + 2.6, -HW - 1.3, 0, PAL.paper);
    bar(HW * 2 + 1.2, 0.5, 0, HH + 0.35, PAL.ink);
    bar(HW * 2 + 1.2, 0.5, 0, -HH - 0.35, PAL.ink);
    bar(0.5, HH * 2 + 1.2, HW + 0.35, 0, PAL.ink);
    bar(0.5, HH * 2 + 1.2, -HW - 0.35, 0, PAL.ink);
    const merged = mergeGeometries(bars, false);
    if (merged) {
      // 分格边框同样不受光（印刷物）
      const frame = new THREE.Mesh(
        merged,
        new THREE.MeshBasicMaterial({ vertexColors: true }),
      );
      frame.frustumCulled = false;
      scene.add(frame);
    }
  }

  // ── ③ 所有贴地投影 = 一个 InstancedMesh ──
  const shadowIM = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0x0a0710,
      transparent: true,
      opacity: TOY.shadowOpacity,
      depthWrite: false,
    }),
    TOY.shadowCap,
  );
  shadowIM.frustumCulled = false;
  scene.add(shadowIM);
  let shadowN = 0;
  const _shadowM = new THREE.Matrix4();
  function pushShadow(x: number, z: number, r: number, y: number): void {
    if (shadowN >= TOY.shadowCap) return;
    const k = r * (1 + y * 0.05);
    _shadowM.makeScale(k, 1, k * 0.95);
    _shadowM.setPosition(x + y * TOY.shadowSkew, HEIGHT.shadow, z + y * TOY.shadowSkewZ);
    shadowIM.setMatrixAt(shadowN, _shadowM);
    shadowN += 1;
  }

  // ── 实体实例池 ──
  const MAX_ENEMY = 64;
  const IM = {
    mouse: makePair(PF_MOUSE, MAX_ENEMY),
    duck: makePair(PF_DUCK, MAX_ENEMY),
    vacuum: makePair(PF_VACUUM, 24),
    bear: makePair(PF_BEAR, 1),
    cat: makePair(PF_CAT, 1),
    wing: makePair(PF_WING, 8),
    burst: makePair(PF_BURST, 32, false),
  };
  for (const k of Object.keys(IM) as (keyof typeof IM)[]) {
    scene.add(IM[k].body);
    if (IM[k].outline) scene.add(IM[k].outline);
  }
  // 受击白剪影（pop 风格：整只变成白剪影，不是变黑）——每类敌机一个，+3 DC
  const FLASH = {
    mouse: makePair(PF_MOUSE, MAX_ENEMY, false).body,
    duck: makePair(PF_DUCK, MAX_ENEMY, false).body,
    vacuum: makePair(PF_VACUUM, 24, false).body,
    bear: makePair(PF_BEAR, 1, false).body,
  };
  const flashMat = new THREE.MeshBasicMaterial({ color: PAL.paper });
  for (const k of Object.keys(FLASH) as (keyof typeof FLASH)[]) {
    FLASH[k].material = flashMat;
    FLASH[k].frustumCulled = false;
    scene.add(FLASH[k]);
  }
  let flashN = { mouse: 0, duck: 0, vacuum: 0, bear: 0 } as Record<keyof typeof FLASH, number>;
  const pushFlash = (k: keyof typeof FLASH, x: number, y: number, z: number, ry: number, s: number): void => {
    const m = FLASH[k];
    // 上限只看 instanceMatrix 的容量：m.count 每帧都会被重写，不能当作容量用
    if (flashN[k] >= m.instanceMatrix.count) return;
    _dummy.position.set(x, y, z);
    _dummy.rotation.set(0, ry, 0);
    _dummy.scale.set(s, s, s);
    _dummy.updateMatrix();
    m.setMatrixAt(flashN[k], _dummy.matrix);
    flashN[k] += 1;
  };

  const EB_PAIR: Record<EnemyBulletKind, Pair> = {
    ball: makePair(PF_EBULLET.ball, 400, false),
    diamond: makePair(PF_EBULLET.diamond, 200, false),
    long: makePair(PF_EBULLET.long, 200, false),
    ring: makePair(PF_EBULLET.ring, 200, false),
    spike: makePair(PF_EBULLET.spike, 160, false),
    laser: makePair(PF_EBULLET.laser, 160, false),
  };
  const PB_PAIR = {} as Record<PlayerBulletKind, Pair>;
  for (const k of PLAYER_BULLET_KINDS) PB_PAIR[k] = makePair(PF_PBULLET[k], 260, false);
  for (const k of Object.keys(EB_PAIR) as EnemyBulletKind[]) scene.add(EB_PAIR[k].body);
  for (const k of PLAYER_BULLET_KINDS) scene.add(PB_PAIR[k].body);

  // ── 激光笔光束（绿管 + 白芯 + 贴地投影线）──
  const beamMat = new THREE.MeshBasicMaterial({ color: PAL.laser });
  const beamCoreMat = new THREE.MeshBasicMaterial({ color: PAL.paper });
  const beamMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), beamMat);
  const beamCore = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), beamCoreMat);
  const beamDecal = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ color: PAL.laser, transparent: true, opacity: 0.45 }),
  );
  beamDecal.rotation.x = -Math.PI / 2;
  beamMesh.visible = beamCore.visible = beamDecal.visible = false;
  scene.add(beamMesh, beamCore, beamDecal);

  // ── 护盾环 / 核弹光环 ──
  const shieldRing = new THREE.Mesh(
    new THREE.RingGeometry(2.1, 2.55, 28),
    new THREE.MeshBasicMaterial({ color: PAL.cyan, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  shieldRing.rotation.x = -Math.PI / 2;
  shieldRing.visible = false;
  scene.add(shieldRing);
  const nukeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.3, 26),
    new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.7, side: THREE.DoubleSide }),
  );
  nukeRing.rotation.x = -Math.PI / 2;
  nukeRing.visible = false;
  scene.add(nukeRing);
  // 玩家定位环：保证"我在哪"永远一眼可见（贴紧机体的尺度）
  const playerRing = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.02, 28),
    new THREE.MeshBasicMaterial({ color: PAL.paper, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  playerRing.rotation.x = -Math.PI / 2;
  scene.add(playerRing);

  // ── 拟声词：小对象池（每种词一份贴图，复用）──
  const wordTex = new Map<number, THREE.CanvasTexture>();
  function wordTexture(i: number): THREE.CanvasTexture {
    const hit = wordTex.get(i);
    if (hit) return hit;
    const text = WORDS[i % WORDS.length] ?? "POW!";
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const g = c.getContext("2d");
    if (g) {
      g.font = '900 64px "Arial Black", Impact, sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.lineJoin = "round";
      g.lineWidth = 8;
      g.strokeStyle = PAL.ink;
      g.strokeText(text, 128, 64);
      g.fillStyle = PAL.yellow;
      g.fillText(text, 128, 64);
    }
    const t = new THREE.CanvasTexture(c);
    wordTex.set(i, t);
    return t;
  }
  const popMeshes: THREE.Mesh[] = [];
  for (let i = 0; i < TOY.popCap; i += 1) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 2),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }),
    );
    m.visible = false;
    scene.add(m);
    popMeshes.push(m);
  }
  let popUsed = 0;

  // ═════════════════════════════════════════════════════════════════
  // 每帧
  // ═════════════════════════════════════════════════════════════════
  let drawCallCount = 0;

  function render(world: World): void {
    shadowN = 0;
    popUsed = 0;
    flashN = { mouse: 0, duck: 0, vacuum: 0, bear: 0 };
    for (const k of Object.keys(IM) as (keyof typeof IM)[]) IM[k].used = 0;
    for (const k of Object.keys(EB_PAIR) as EnemyBulletKind[]) EB_PAIR[k].used = 0;
    for (const k of PLAYER_BULLET_KINDS) PB_PAIR[k].used = 0;

    // ── 相机震动（引擎负责衰减）──
    if (world.shake > 0.001) {
      shake.set(Math.sin(world.time * 71) * world.shake, Math.cos(world.time * 63) * world.shake);
    } else {
      shake.set(0, 0);
    }
    placeCamera();

    const py = HEIGHT.player;
    const p = world.player;

    // ── 玩家：绿猫（yaw 跟随横向速度）+ 定位环 ──
    const pvy = p.vel.z;
    const pvx = p.vel.x;
    const pAng = Math.atan2(-pvy, pvx) - Math.PI / 2;
    pushPair(IM.cat, p.pos.x, py, rz(p.pos.z, py), pAng, 0, 1);
    pushShadow(p.pos.x, p.pos.z, 2.1, py);
    playerRing.position.set(p.pos.x, HEIGHT.shadow + 0.02, p.pos.z);
    playerRing.visible = world.phase === "playing";
    shieldRing.visible = world.shield > 0 && world.phase === "playing";
    if (shieldRing.visible) shieldRing.position.set(p.pos.x, HEIGHT.shadow + 0.03, p.pos.z);

    // ── 僚机 ──
    for (let i = 0; i < world.wingmen.slots.capacity; i += 1) {
      if (!world.wingmen.slots.alive[i]) continue;
      const m = world.wingmen.items[i];
      pushPair(IM.wing, m.x, py, rz(m.z, py), 0, 0, m.type === "attack" ? 1 : 0.88);
      pushShadow(m.x, m.z, 1.1, py);
    }

    // ── 敌机：按类型实例化 ──
    for (let i = 0; i < world.enemies.slots.capacity; i += 1) {
      if (!world.enemies.slots.alive[i]) continue;
      const e = world.enemies.items[i];
      const ey = HEIGHT.enemy;
      const s = e.scale;
      // 摇摆型用横向速度定 yaw（转向 = 正交下最强的立体线索）
      const yaw = Math.atan2(-e.vz, e.vx);
      const key2: "mouse" | "duck" | "vacuum" =
        e.kind === "drone" ? "mouse" : e.kind === "weaver" ? "duck" : "vacuum";
      pushPair(IM[key2], e.x, ey, rz(e.z, ey), yaw, 0, s);
      pushShadow(e.x, e.z, 2.2 * s, ey);
      if (e.flash > 0) pushFlash(key2, e.x, ey, rz(e.z, ey), yaw, s * 1.02);
      // 灼烧/减速：脚下各加一枚小色环（不新增 DC，用阴影色近似不方便，故省略）
    }

    // ── Boss ──
    if (world.boss.active) {
      const b = world.boss;
      const by = HEIGHT.bossCenter;
      const breathe = 1 + 0.04 * Math.sin(world.time * 1.5);
      pushPair(IM.bear, b.x, by, rz(b.z, by), 0.06 * Math.sin(world.time * 0.7), 0.05 * Math.sin(world.time * 0.6), breathe);
      pushShadow(b.x, b.z, 5.4, by);
      if (b.flash > 0) pushFlash("bear", b.x, by, rz(b.z, by), 0, breathe * 1.02);
    }

    // ── 敌弹（⑥ 高度最高，永远压在最上层 → §5 红线）──
    const eby = HEIGHT.ebullet;
    for (let i = 0; i < world.enemyBullets.slots.capacity; i += 1) {
      if (!world.enemyBullets.slots.alive[i]) continue;
      const b = world.enemyBullets.items[i];
      pushPair(EB_PAIR[b.kind], b.x, eby, rz(b.z, eby), b.angle, 0, 1);
      pushShadow(b.x, b.z, 0.6, eby);
    }

    // ── 我方弹 ──
    const by = HEIGHT.bullet;
    for (let i = 0; i < world.playerBullets.slots.capacity; i += 1) {
      if (!world.playerBullets.slots.alive[i]) continue;
      const b = world.playerBullets.items[i];
      pushPair(PB_PAIR[b.kind], b.x, by, rz(b.z, by), b.angle, 0, 1);
      pushShadow(b.x, b.z, 0.5, by);
    }

    // ── 激光笔光束 ──
    const beam = world.beam;
    const showBeam = beam.active && world.phase === "playing";
    beamMesh.visible = beamCore.visible = beamDecal.visible = showBeam;
    if (showBeam) {
      const w = beam.halfW * 2;
      const z0 = rz(beam.z0, HEIGHT.player);
      const z1 = rz(Math.min(beam.tipZ, beam.z0), HEIGHT.player);
      const len = Math.max(0.01, z0 - z1);
      const cz = (z0 + z1) / 2;
      beamMesh.scale.set(w * 2.4, 0.5, len);
      beamMesh.position.set(beam.x, HEIGHT.bullet, cz);
      beamCore.scale.set(w * 0.7, 0.5, len);
      beamCore.position.set(beam.x, HEIGHT.bullet + 0.06, cz);
      beamDecal.scale.set(w * 2.8, len, 1);
      beamDecal.position.set(beam.x, HEIGHT.shadow + 0.03, cz);
    }

    // ── 爆炸 + 拟声词 ──
    for (let i = 0; i < world.bursts.slots.capacity; i += 1) {
      if (!world.bursts.slots.alive[i]) continue;
      const b = world.bursts.items[i];
      const k = b.t / Math.max(0.001, b.life);
      pushPair(IM.burst, b.x, HEIGHT.burst + k * 0.6, rz(b.z, HEIGHT.burst), k * 1.2, 0, b.scale * (0.65 + k * 0.85));
    }
    for (let i = 0; i < world.pops.slots.capacity; i += 1) {
      if (!world.pops.slots.alive[i]) continue;
      if (popUsed >= popMeshes.length) break;
      const pop = world.pops.items[i];
      const k = pop.t / Math.max(0.001, pop.life);
      const m = popMeshes[popUsed];
      popUsed += 1;
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.map = wordTexture(pop.word);
      mat.opacity = Math.max(0, 1 - k * k);
      mat.needsUpdate = true;
      const size = pop.scale * (1 + k * 0.25);
      m.scale.set(size, size * 0.5, 1);
      m.position.set(pop.x, HEIGHT.pop + k * 1.6, rz(pop.z, HEIGHT.pop));
      m.rotation.set(-Math.PI / 2 + PITCH_RAD, 0, -0.12 + (pop.word % 3) * 0.06);
      m.visible = true;
    }
    for (let i = popUsed; i < popMeshes.length; i += 1) popMeshes[i].visible = false;

    // ── 核弹演出 ──
    nukeRing.visible = world.nukeFx > 0;
    if (nukeRing.visible) {
      const t = 1 - world.nukeFx / 1.15;
      const k = Math.max(0, (t - 0.35) / 0.65);
      nukeRing.scale.setScalar(1 + k * 26);
      nukeRing.position.set(p.pos.x, HEIGHT.shadow + 0.04, p.pos.z);
      (nukeRing.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.8 - k * 0.8);
    }

    // ── 提交实例 ──
    for (const k of Object.keys(IM) as (keyof typeof IM)[]) flushPair(IM[k]);
    for (const k of Object.keys(EB_PAIR) as EnemyBulletKind[]) flushPair(EB_PAIR[k]);
    for (const k of PLAYER_BULLET_KINDS) flushPair(PB_PAIR[k]);
    for (const k of Object.keys(FLASH) as (keyof typeof FLASH)[]) {
      FLASH[k].count = flashN[k];
      FLASH[k].instanceMatrix.needsUpdate = true;
    }
    shadowIM.count = shadowN;
    shadowIM.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
    drawCallCount = renderer.info.render.calls;
  }

  // ═════════════════════════════════════════════════════════════════
  function resize(containerW: number, containerH: number): void {
    const f = computeFraming(containerW, containerH, {
      halfW: FIELD.halfW,
      halfH: FIELD.halfH,
      marginY: 1.06,
      coverX: 1.12,
      maxAspect: 0.72,
    });
    canvas.style.width = `${f.cssW}px`;
    canvas.style.height = `${f.cssH}px`;
    canvas.style.left = `${Math.round((containerW - f.cssW) / 2)}px`;
    canvas.style.top = `${Math.round((containerH - f.cssH) / 2)}px`;
    renderer.setSize(f.cssW, f.cssH, false);
    camera.left = -f.halfViewW;
    camera.right = f.halfViewW;
    camera.top = f.halfViewH;
    camera.bottom = -f.halfViewH;
    // 相机距离只影响 near/far 裁剪与"正交下不改变尺寸"，取场地尺度即可
    baseDistance = 160;
    camera.updateProjectionMatrix();
    placeCamera();
  }

  const ndc = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  function pointerToWorld(clientX: number, clientY: number): Vec2 | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const pt = raycaster.ray.intersectPlane(groundPlane, hit);
    if (!pt) return null;
    return { x: pt.x, z: pt.z };
  }

  function drawCalls(): number {
    return drawCallCount;
  }

  function dispose(): void {
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    for (const t of wordTex.values()) t.dispose();
    fieldMat.map?.dispose();
    fieldMat.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { element: canvas, resize, render, drawCalls, pointerToWorld, dispose };
}
