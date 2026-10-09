// ═══════════════════════════════════════════════════════════════════
// POP3D — 网格资源工厂（低多边形 + 平涂，§5）
// 只做几何/材质的生成与复用，不含任何逻辑。
// ═══════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BACKGROUND, BULLET_VIS, FIELD, PAL } from "../engine/config";
import { PLAYER_BULLET_KINDS } from "../engine/bullets";
import type { PlayerBulletKind } from "../engine/bullets";

function flat(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

/** 硬边描边：沿几何体的棱画一圈黑线（§5 硬边风，不用后处理） */
function edgeLines(geometry: THREE.BufferGeometry): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(geometry, 20);
  const lines = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: PAL.ink }),
  );
  lines.scale.setScalar(1.02);
  return lines;
}

function part(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.add(edgeLines(geometry));
  return mesh;
}

/**
 * 玩家机：低多边形"箭形"机体，机头朝 -Z（屏幕上方）。
 * 青色机身 + 黄色机翼：品红留给敌机，红留给敌弹（§5 可读性红线）。
 */
export function createPlayerMesh(): THREE.Group {
  const group = new THREE.Group();

  const body = part(new THREE.ConeGeometry(0.9, 3.6, 4), flat(PAL.cyan), 0, 0, -0.4);
  body.rotation.x = -Math.PI / 2; // 机头转向 -Z
  group.add(body);

  const wings = part(new THREE.BoxGeometry(4.6, 0.28, 1.2), flat(PAL.yellow), 0, 0, 0.8);
  group.add(wings);

  const fin = part(new THREE.BoxGeometry(0.24, 1.2, 0.9), flat(PAL.blue), 0, 0.5, 1.4);
  fin.rotation.x = -0.25;
  group.add(fin);

  return group;
}

/** 场地参考网格：极低对比度，永远弱于前景（§5） */
export function createFieldGrid(): THREE.GridHelper {
  const grid = new THREE.GridHelper(
    BACKGROUND.nearSize,
    BACKGROUND.nearDivisions,
    new THREE.Color(PAL.ink),
    new THREE.Color(PAL.ink),
  );
  grid.material.transparent = true;
  grid.material.opacity = BACKGROUND.nearOpacity;
  grid.position.y = -0.02;
  return grid;
}

/** 场地边界框：让玩家一眼看清可活动范围（M1 遗留项） */
export function createFieldBorder(): THREE.LineSegments {
  const g = new THREE.BufferGeometry();
  const w = FIELD.halfW;
  const h = FIELD.halfH;
  const pts = new Float32Array([
    -w, 0.02, -h, w, 0.02, -h,
    w, 0.02, -h, w, 0.02, h,
    w, 0.02, h, -w, 0.02, h,
    -w, 0.02, h, -w, 0.02, -h,
  ]);
  g.setAttribute("position", new THREE.BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: PAL.ink }));
  const mat = lines.material as THREE.LineBasicMaterial;
  mat.transparent = true;
  mat.opacity = 0.22;
  return lines;
}

/** 敌机：低多边形六棱锥，机头朝 +Z（朝玩家方向）。基准半径 1.5，靠实例缩放区分敌种。 */
export function createEnemyGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(1.5, 3.0, 6);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/**
 * 弹型形状表：`s` 是缩放倍率，几何在创建期放大，运行时零开销。
 * 描边层用同一张表、不同倍率生成，保证"壳"永远贴着芯。
 */
const BULLET_SHAPES: Record<PlayerBulletKind, (s: number) => THREE.BufferGeometry> = {
  bolt: (s) => new THREE.BoxGeometry(0.25 * s, 0.25 * s, 2.6 * s), // 离子束：细长
  spread: (s) => {
    // 新星：粗短的"子弹头"——三把枪里最胖的一颗，和脉冲的薄环一眼分开
    const g = new THREE.OctahedronGeometry(0.5 * s, 0);
    g.scale(1, 1, 1.35);
    return g;
  },
  // 脉冲：多面体火球（魂斗罗 F 弹）——三把枪里最大的一颗，靠自转的棱面闪动做"火焰"
  wave: (s) => new THREE.IcosahedronGeometry(0.62 * s, 1),
  homing: (s) => {
    // 追踪弹：拉长的八面体 = 小飞弹（尾焰由 trailByKind 单独给）
    const g = new THREE.OctahedronGeometry(0.32 * s, 0);
    g.scale(1, 1, 1.9);
    return g;
  },
  mini: (s) => new THREE.OctahedronGeometry(0.18 * s, 0), // 子母弹
};

/** 我方弹型几何：一颗子弹一种形状，"换了牌"一眼看得出来（已放大 BULLET_VIS.scale） */
export function createPlayerBulletGeometries(): Record<PlayerBulletKind, THREE.BufferGeometry> {
  const out = {} as Record<PlayerBulletKind, THREE.BufferGeometry>;
  for (const k of PLAYER_BULLET_KINDS) out[k] = BULLET_SHAPES[k](BULLET_VIS.scale);
  return out;
}

/**
 * 描边几何：实心弹用"反向外壳"（材质走 BackSide），平躺环是单面几何、
 * 外壳看不见，所以改用一圈更大的 ink 环当粗描边。
 */
export function createPlayerBulletOutlineGeometries(): Record<PlayerBulletKind, THREE.BufferGeometry> {
  const out = {} as Record<PlayerBulletKind, THREE.BufferGeometry>;
  for (const k of PLAYER_BULLET_KINDS) {
    out[k] = BULLET_SHAPES[k](BULLET_VIS.scale * BULLET_VIS.outline);
  }
  return out;
}

/** 拖尾：一片平躺的小四边形，长边沿局部 +Z（与弹体同一套朝向约定） */
export function createTrailGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(0.34 * BULLET_VIS.scale, 0.95 * BULLET_VIS.scale);
  g.rotateX(-Math.PI / 2);
  return g;
}

/**
 * 发光贴片：中心留空（弹芯本身已经很亮，贴片只做外圈光晕），
 * 加法混合时贴图 alpha 就是强度。1 个 draw call 覆盖所有弹。
 */
export function createGlowTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.24, "rgba(255,255,255,0.5)");
  g.addColorStop(0.46, "rgba(255,255,255,0.85)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 发光贴片的载体：单位平面，实例缩放决定大小，朝向每帧抄相机 */
export function createGlowGeometry(): THREE.BufferGeometry {
  return new THREE.PlaneGeometry(1, 1);
}

/** 敌弹：小球 */
export function createEnemyBulletGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.45, 8, 6);
}

/**
 * 僚机：玩家机的缩小版——后掠翼 + 翼尖灯。
 * 机身与机翼合并成一块几何，一架僚机只占 3 个 draw call（4 架 = 12），
 * 翼尖灯是**稳态**的，不做闪烁。
 */
export function createWingmanMesh(): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.ConeGeometry(0.44, 2.0, 4);
  body.rotateX(-Math.PI / 2);
  body.translate(0, 0, -0.2);
  const wingL = new THREE.BoxGeometry(1.7, 0.18, 0.5);
  wingL.rotateY(0.42);
  wingL.translate(-0.8, 0, 0.4);
  const wingR = new THREE.BoxGeometry(1.7, 0.18, 0.5);
  wingR.rotateY(-0.42);
  wingR.translate(0.8, 0, 0.4);
  const hull = mergeGeometries([body, wingL, wingR]);
  const hullMesh = new THREE.Mesh(hull, flat(PAL.cyan));
  hullMesh.add(edgeLines(hull));
  group.add(hullMesh);

  const tips = mergeGeometries([
    new THREE.BoxGeometry(0.26, 0.26, 0.26).translate(-1.45, 0.06, 0.62),
    new THREE.BoxGeometry(0.26, 0.26, 0.26).translate(1.45, 0.06, 0.62),
  ]);
  group.add(new THREE.Mesh(tips, flat(PAL.yellow)));
  return group;
}

/** 环绕护卫弹：平躺的小环 */
export function createOrbGeometry(): THREE.BufferGeometry {
  const g = new THREE.RingGeometry(0.34, 0.48, 12);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** 爆点：低面数多面体，靠缩放做大再收回 */
export function createBurstGeometry(): THREE.BufferGeometry {
  return new THREE.IcosahedronGeometry(0.9, 0);
}

export interface BossMesh {
  group: THREE.Group;
  /** 核心发光块：受击时闪白 */
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

/** Boss：低多边形巨舰，比小敌机大一个量级，配色仍守住波普三色 */
export function createBossMesh(): BossMesh {
  const group = new THREE.Group();

  const hull = part(new THREE.BoxGeometry(9, 2.6, 4.2), flat(PAL.magenta), 0, 1.4, 0);
  group.add(hull);

  const wings = part(new THREE.BoxGeometry(19, 0.5, 2.6), flat(PAL.blue), 0, 1.2, 0.8);
  group.add(wings);

  const podL = part(new THREE.BoxGeometry(2.6, 2.6, 2.6), flat(PAL.ink), -6.6, 1.5, 1.0);
  group.add(podL);
  const podR = part(new THREE.BoxGeometry(2.6, 2.6, 2.6), flat(PAL.ink), 6.6, 1.5, 1.0);
  group.add(podR);

  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.6, 0),
    new THREE.MeshBasicMaterial({ color: PAL.yellow }),
  );
  core.position.set(0, 1.9, 2.3);
  group.add(core);

  return { group, core };
}
