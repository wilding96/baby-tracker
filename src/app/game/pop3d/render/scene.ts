// ═══════════════════════════════════════════════════════════════════
// POP3D — 每帧 GPU 提交（只做绘制，不做逻辑）
// 相机：近正交俯视 + 轻微前倾，保证"一眼看清弹幕"（§5 命门）
// 高频实体一律 InstancedMesh（§5），含描边与拟声词在内整帧 draw call 仍 < 60。
// ═══════════════════════════════════════════════════════════════════

import * as THREE from "three";
import {
  BURST,
  CAMERA,
  ELEMENT_COLOR,
  ENEMY_KINDS,
  FIELD,
  JUICE,
  PAL,
  POOL,
  WORDS,
} from "../engine/config";
import type { Element, EnemyKind, Renderer, Vec2, World } from "../engine/types";
import { computeFraming, perspectiveDistance } from "../engine/framing";
import { degToRad } from "../engine/projection";
import {
  createBossMesh,
  createBurstGeometry,
  createEnemyBulletGeometry,
  createEnemyGeometry,
  createFieldBorder,
  createFieldGrid,
  createPlayerBulletGeometry,
  createPlayerMesh,
} from "./assets";

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

/** 拟声词预渲染成贴图（§8.8）：运行时只查表，不再碰 canvas */
function makeWordTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const font = "900 64px 'Arial Black', Impact, sans-serif";
  let ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  canvas.width = w;
  canvas.height = 96;

  // 改尺寸会重置上下文状态，必须重新设字体
  ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = 12;
  ctx.strokeStyle = PAL.ink;
  ctx.strokeText(text, w / 2, 50);
  ctx.fillStyle = PAL.yellow;
  ctx.fillText(text, w / 2, 50);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(mount: HTMLElement): Renderer {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // §5.5
  const canvas = renderer.domElement;
  canvas.style.position = "absolute";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  mount.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAL.paper);

  // ── 相机（长焦弱透视俯视，屏幕上方 = -Z）──
  const isPersp = CAMERA.mode === "persp";
  const camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = isPersp
    ? new THREE.PerspectiveCamera(CAMERA.fovDeg, 1, CAMERA.near, CAMERA.far)
    : new THREE.OrthographicCamera(-1, 1, 1, -1, CAMERA.near, CAMERA.far);
  camera.up.set(0, 0, -1);

  const camBase = new THREE.Vector3();
  /** 透视模式下的基准距离（由 fov 反推，resize 时更新） */
  let baseDistance: number = CAMERA.orthoDistance;
  /** 运镜 rig：常规战斗恒为基准值，只有 Boss 过场会改这两个值 */
  const rigPitchDeg = CAMERA.pitchDeg;
  const rigDistMul = 1;

  function placeCamera(): void {
    const p = degToRad(rigPitchDeg);
    const d = baseDistance * rigDistMul;
    camBase.set(0, Math.cos(p) * d, Math.sin(p) * d);
    camera.position.copy(camBase);
    camera.lookAt(0, 0, 0);
  }

  // ── 光照：1 方向光 + 环境光足矣（§5）──
  scene.add(new THREE.AmbientLight(0xffffff, 1.05));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-24, 60, 36);
  scene.add(sun);

  const grid = createFieldGrid();
  scene.add(grid, createFieldBorder());

  const player = createPlayerMesh();
  scene.add(player);

  const bossMesh = createBossMesh();
  bossMesh.group.visible = false;
  scene.add(bossMesh.group);

  // 敌机：实体 + 反向外壳描边（两帧 draw call 换硬边风）
  const enemyGeo = createEnemyGeometry();
  const enemyMesh = instanced(
    enemyGeo,
    // 基色必须留白：setColorAt 的结果是"材质基色 × 实例色"，
    // 基色若带颜色，实例色会被二次相乘而失真（weaver 的绿会变黑）。
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }),
    POOL.enemies,
  );
  const enemyOutline = instanced(
    enemyGeo,
    new THREE.MeshBasicMaterial({ color: PAL.ink, side: THREE.BackSide }),
    POOL.enemies,
  );

  const playerBulletMesh = instanced(
    createPlayerBulletGeometry(),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    POOL.playerBullets,
  );
  const enemyBulletMesh = instanced(
    createEnemyBulletGeometry(),
    new THREE.MeshBasicMaterial({ color: PAL.red }),
    POOL.enemyBullets,
  );
  const burstMesh = instanced(
    createBurstGeometry(),
    new THREE.MeshBasicMaterial({ color: PAL.yellow }),
    POOL.bursts,
  );
  scene.add(enemyOutline, enemyMesh, playerBulletMesh, enemyBulletMesh, burstMesh);

  // ── 拟声词贴片池 ──
  const wordTextures = WORDS.map(makeWordTexture);
  const popSprites: THREE.Sprite[] = [];
  for (let i = 0; i < JUICE.popCap; i += 1) {
    const mat = new THREE.SpriteMaterial({
      map: wordTextures[0],
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.rotation.z = 0;
    scene.add(sprite);
    popSprites.push(sprite);
  }

  const ENEMY_COLOR: Record<EnemyKind, THREE.Color> = {
    drone: new THREE.Color(ENEMY_KINDS.drone.color),
    weaver: new THREE.Color(ENEMY_KINDS.weaver.color),
    gunner: new THREE.Color(ENEMY_KINDS.gunner.color),
  };
  const FLASH_COLOR = new THREE.Color(0xffffff);
  const CORE_COLOR = new THREE.Color(PAL.yellow);
  const PLAIN_BULLET = new THREE.Color(PAL.cyan);
  const ELEMENT_BULLET: Record<Element, THREE.Color> = {
    electric: new THREE.Color(ELEMENT_COLOR.electric),
    fire: new THREE.Color(ELEMENT_COLOR.fire),
    ice: new THREE.Color(ELEMENT_COLOR.ice),
  };
  for (let i = 0; i < POOL.enemies; i += 1) enemyMesh.setColorAt(i, ENEMY_COLOR.drone);
  for (let i = 0; i < POOL.playerBullets; i += 1) playerBulletMesh.setColorAt(i, PLAIN_BULLET);

  const dummy = new THREE.Object3D();

  // ── 屏幕 → 地面射线 ──
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();

  function resize(containerW: number, containerH: number): void {
    const f = computeFraming(containerW, containerH, {
      halfW: FIELD.halfW,
      halfH: FIELD.halfH,
      marginY: CAMERA.marginY,
      coverX: CAMERA.coverX,
      maxAspect: CAMERA.maxAspect,
    });

    canvas.style.width = `${f.cssW}px`;
    canvas.style.height = `${f.cssH}px`;
    canvas.style.left = `${Math.round((containerW - f.cssW) / 2)}px`;
    canvas.style.top = `${Math.round((containerH - f.cssH) / 2)}px`;
    renderer.setSize(f.cssW, f.cssH, false);

    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = f.aspect;
      baseDistance = perspectiveDistance(f.halfViewH, CAMERA.fovDeg);
    } else {
      camera.left = -f.halfViewW;
      camera.right = f.halfViewW;
      camera.top = f.halfViewH;
      camera.bottom = -f.halfViewH;
      baseDistance = CAMERA.orthoDistance;
    }
    camera.updateProjectionMatrix();
    placeCamera();
  }

  function render(world: World): void {
    // ── 屏幕震动：只挪相机位置，不改朝向（正交相机下等于平移画面）──
    if (world.shake > 0) {
      camera.position.set(
        camBase.x + (Math.random() - 0.5) * world.shake,
        camBase.y,
        camBase.z + (Math.random() - 0.5) * world.shake,
      );
    } else {
      camera.position.copy(camBase);
    }

    // ── 滚动网格：制造"在前进"的速度感 ──
    grid.position.z = (world.time * 7) % 2; // 网格单元 = 2 世界单位，取模后可无缝循环

    // 玩家机（无敌帧闪烁 + 枪口闪光）
    const p = world.player;
    const blink = p.invuln > 0 && Math.floor(world.time * 24) % 2 === 1;
    player.visible = world.phase === "playing" && !blink;
    player.position.set(p.pos.x, 0.6, p.pos.z);
    player.scale.setScalar(world.muzzle > 0 ? 1.12 : 1);

    // 敌机（实体 + 描边外壳）
    let n = 0;
    const foes = world.enemies;
    for (let i = 0; i < foes.slots.capacity; i += 1) {
      if (!foes.slots.alive[i]) continue;
      const e = foes.items[i];
      dummy.position.set(e.x, 1.1, e.z);
      dummy.scale.setScalar(e.scale);
      dummy.updateMatrix();
      enemyMesh.setMatrixAt(n, dummy.matrix);
      enemyMesh.setColorAt(n, e.flash > 0 ? FLASH_COLOR : ENEMY_COLOR[e.kind]);

      dummy.scale.setScalar(e.scale * 1.16);
      dummy.updateMatrix();
      enemyOutline.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    enemyMesh.count = n;
    enemyOutline.count = n;
    enemyMesh.instanceMatrix.needsUpdate = true;
    enemyOutline.instanceMatrix.needsUpdate = true;
    if (enemyMesh.instanceColor) enemyMesh.instanceColor.needsUpdate = true;

    // 我方子弹（按属性着色）
    n = 0;
    const pb = world.playerBullets;
    for (let i = 0; i < pb.slots.capacity; i += 1) {
      if (!pb.slots.alive[i]) continue;
      const b = pb.items[i];
      dummy.position.set(b.x, 0.9, b.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      playerBulletMesh.setMatrixAt(n, dummy.matrix);
      playerBulletMesh.setColorAt(n, b.element ? ELEMENT_BULLET[b.element] : PLAIN_BULLET);
      n += 1;
    }
    playerBulletMesh.count = n;
    playerBulletMesh.instanceMatrix.needsUpdate = true;
    if (playerBulletMesh.instanceColor) playerBulletMesh.instanceColor.needsUpdate = true;

    // 敌弹
    n = 0;
    const eb = world.enemyBullets;
    for (let i = 0; i < eb.slots.capacity; i += 1) {
      if (!eb.slots.alive[i]) continue;
      const b = eb.items[i];
      dummy.position.set(b.x, 0.95, b.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      enemyBulletMesh.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    enemyBulletMesh.count = n;
    enemyBulletMesh.instanceMatrix.needsUpdate = true;

    // 爆点（先大后收）
    n = 0;
    const bursts = world.bursts;
    for (let i = 0; i < bursts.slots.capacity; i += 1) {
      if (!bursts.slots.alive[i]) continue;
      const b = bursts.items[i];
      const k = Math.sin(Math.PI * (b.t / b.life));
      dummy.position.set(b.x, 1.0, b.z);
      dummy.scale.setScalar(Math.max(0.001, k * BURST.maxScale * b.scale));
      dummy.updateMatrix();
      burstMesh.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    burstMesh.count = n;
    burstMesh.instanceMatrix.needsUpdate = true;

    // 拟声词贴片
    n = 0;
    const pops = world.pops;
    for (let i = 0; i < pops.slots.capacity; i += 1) {
      if (!pops.slots.alive[i]) continue;
      const pop = pops.items[i];
      const sprite = popSprites[n];
      const k = pop.t / pop.life;
      const tex = wordTextures[pop.word] ?? wordTextures[0];
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.map = tex;
      mat.opacity = Math.max(0, 1 - k * k);
      const img = tex.image as HTMLCanvasElement;
      const hgt = 4.2 * pop.scale * (0.72 + k * 0.5); // 一眼可见的尺寸
      const wid = hgt * (img.width / img.height);
      sprite.scale.set(wid, hgt, 1);
      mat.rotation = -0.12; // 轻微倾斜，像贴纸（Sprite 的旋转走材质）
      sprite.position.set(pop.x, 2.2 + k * 2.4, pop.z);
      sprite.visible = true;
      n += 1;
    }
    for (let i = n; i < popSprites.length; i += 1) popSprites[i].visible = false;

    // Boss
    const boss = world.boss;
    bossMesh.group.visible = boss.active;
    if (boss.active) {
      bossMesh.group.position.set(boss.x, 1.2, boss.z);
      // 入场时从小到大弹出
      const k = Math.min(1, (boss.z + FIELD.halfH + 12) / 12);
      bossMesh.group.scale.setScalar(0.55 + 0.45 * k);
      bossMesh.core.material.color.copy(boss.flash > 0 ? FLASH_COLOR : CORE_COLOR);
    }

    renderer.render(scene, camera);
  }

  function pointerToWorld(clientX: number, clientY: number): Vec2 | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const p = raycaster.ray.intersectPlane(groundPlane, hit);
    if (!p) return null;
    // 震动会让相机偏移，射线求交已按当前相机计算，这里无需补偿
    return { x: p.x, z: p.z };
  }

  function drawCalls(): number {
    return renderer.info.render.calls;
  }

  function dispose(): void {
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
    wordTextures.forEach((t) => t.dispose());
    renderer.dispose();
    canvas.remove();
  }

  return { element: canvas, resize, render, drawCalls, pointerToWorld, dispose };
}
