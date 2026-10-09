// ═══════════════════════════════════════════════════════════════════
// POP3D — 网格资源工厂（低多边形 + 平涂，§5）
// 只做几何/材质的生成与复用，不含任何逻辑。
// ═══════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { BACKGROUND, FIELD, PAL } from "../engine/config";
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

/** 我方弹型几何：一颗子弹一种形状，"换了牌"一眼看得出来 */
export function createPlayerBulletGeometries(): Record<PlayerBulletKind, THREE.BufferGeometry> {
  const flatRing = (inner: number, outer: number): THREE.BufferGeometry => {
    const g = new THREE.RingGeometry(inner, outer, 14);
    g.rotateX(-Math.PI / 2); // 平躺，朝上飞
    return g;
  };
  return {
    bolt: new THREE.BoxGeometry(0.25, 0.25, 2.6), // 离子束：细长
    spread: new THREE.OctahedronGeometry(0.36, 0), // 散射弹：菱形
    wave: flatRing(0.42, 0.62), // 冲击波：环
    homing: new THREE.OctahedronGeometry(0.3, 0), // 追踪弹
    mini: new THREE.OctahedronGeometry(0.18, 0), // 子母弹
  };
}

/** 敌弹：小球 */
export function createEnemyBulletGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.45, 8, 6);
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
