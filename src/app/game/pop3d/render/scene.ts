// ═══════════════════════════════════════════════════════════════════
// POP3D — 每帧 GPU 提交（只做绘制，不做逻辑）
// 相机：近正交俯视 + 轻微前倾，保证"一眼看清弹幕"（§5 命门）
// 高频实体一律 InstancedMesh（§5），含描边与拟声词在内整帧 draw call 仍 < 60。
// ═══════════════════════════════════════════════════════════════════

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  BACKGROUND,
  BOSS,
  BULLET_VIS,
  BURST,
  CAMERA,
  ELEMENT_COLOR,
  ENEMY_KINDS,
  FIELD,
  FX,
  HEIGHT,
  JUICE,
  NUKE,
  PAL,
  POOL,
  POOL_WINGMEN,
  POP,
  SHIELD,
  WORDS,
  WINGMAN,
} from "../engine/config";
import type { Element, EnemyKind, Renderer, ShipType, Vec2, World } from "../engine/types";
import { PLAYER_BULLET_KINDS, bulletDef } from "../engine/bullets";
import type { PlayerBulletKind } from "../engine/bullets";
import { computeFraming, perspectiveDistance } from "../engine/framing";
import { compensatedZ, degToRad } from "../engine/projection";
import { approach, cineTarget } from "../engine/rig";
import {
  createBossMesh,
  createBurstGeometry,
  createEnemyBulletGeometry,
  createEnemyGeometry,
  createFieldBorder,
  createFieldGrid,
  createGlowGeometry,
  createGlowTexture,
  createHalftoneTexture,
  createPlayerBulletGeometries,
  createPlayerBulletOutlineGeometries,
  createPlayerMesh,
  createSupportDroneMesh,
  createTrailGeometry,
  createWingmanMesh,
} from "./assets";

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.count = 0;
  return mesh;
}

/** 贴地投影容量：玩家 1 + 僚机 4（批次 3 用）+ 敌机 48 + Boss 1 + 余量 */
const SHADOW_CAPACITY = 64;

/** 运镜插值速率（约 3/s 收敛） */
const RIG_RATE = 3;

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

export interface RendererOptions {
  /** 覆盖 bloom 开关（调试用：?bloom=0 / ?bloom=1） */
  bloom?: boolean;
  /** 逐层开关（调试用：?fx=0 全关 / ?fx=glow,trail,… 指定组合） */
  fx?: FxOptions;
  /** 主题：pop（默认）= 60 年代波普漫画（错版 + 网点 + 粗黑分格）；classic = 之前的平涂 */
  theme?: "pop" | "classic";
}

/** 表现层各图层的开关：定位"哪一层让画面变糊/变线框"用的 */
export interface FxOptions {
  /** 弹体 ink 描边壳 */
  outline?: boolean;
  /** 外圈加法辉光贴片 */
  glow?: boolean;
  /** 拖尾 */
  trail?: boolean;
  /** 背景速度线 */
  speedLines?: boolean;
  /** Bloom 后处理 */
  bloom?: boolean;
}

export function createRenderer(mount: HTMLElement, options: RendererOptions = {}): Renderer {
  const isPop = (options.theme ?? "pop") === "pop";
  const fx = {
    outline: true,
    glow: true,
    trail: true,
    speedLines: FX.speedLines,
    bloom: options.bloom ?? FX.bloom,
    ...options.fx,
  };
  // 移动端：关抗锯齿、降 DPR —— 这两项在手机 GPU 上最贵
  const isMobile =
    typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: false,
    stencil: false,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)); // §5.5
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
  let rigPitchDeg: number = CAMERA.pitchDeg;
  let rigDistMul: number = 1;

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

  // 反向补光：避免低多边形背面在俯角下死黑（§5 立体感来源）
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(30, 20, -40);
  scene.add(fill);

  const gridNear = createFieldGrid();
  scene.add(gridNear, createFieldBorder());

  // 网点贴图（波普的点阵纹理）：场地、老大红块、贴地阴影共用；块用单独一份克隆调平铺密度
  const halftoneTex = createHalftoneTexture();
  const blockTex = halftoneTex.clone();
  halftoneTex.needsUpdate = true;
  blockTex.needsUpdate = true;
  if (isPop) {
    halftoneTex.repeat.set((FIELD.halfW * 2) / POP.dotCell, (FIELD.halfH * 2) / POP.dotCell);
    blockTex.repeat.set((FIELD.halfW * 2 * POP.blockW) / POP.dotCell, (FIELD.halfH * 2) / POP.dotCell);
  }

  // ── 波普主题（B 方向）：网点场地 + 老大红块 + 粗黑分格 ──
  const fieldHalftone = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.halfW * 2, FIELD.halfH * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: halftoneTex,
      color: PAL.paper,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  fieldHalftone.position.y = 0.004;
  const redBlock = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD.halfW * 2 * POP.blockW, FIELD.halfH * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: blockTex,
      color: POP.misregRed,
      transparent: true,
      opacity: POP.blockAlpha,
      depthWrite: false,
    }),
  );
  redBlock.position.set(-FIELD.halfW * (1 - POP.blockW) * 0.5, 0.006, 0);
  // 粗黑分格：四条 gutter，只占 1 个 draw call（InstancedMesh ×4）
  const gutterGeo = new THREE.BoxGeometry(1, 0.04, 1);
  const gutterMesh = instanced(
    gutterGeo,
    new THREE.MeshBasicMaterial({ color: PAL.ink }),
    4,
  );
  const gw = FIELD.halfW * 2;
  const gh = FIELD.halfH * 2;
  const gutters: [number, number, number, number][] = [
    [0, -FIELD.halfH, gw + POP.gutter * 2, POP.gutter],
    [0, FIELD.halfH, gw + POP.gutter * 2, POP.gutter],
    [-FIELD.halfW, 0, POP.gutter, gh + POP.gutter * 2],
    [FIELD.halfW, 0, POP.gutter, gh + POP.gutter * 2],
  ];
  if (isPop) {
    const gutterDummy = new THREE.Object3D();
    for (let i = 0; i < gutters.length; i += 1) {
      const [gx, gz, sx, sz] = gutters[i];
      gutterDummy.position.set(gx, 0.03, gz);
      gutterDummy.scale.set(sx, 1, sz);
      gutterDummy.updateMatrix();
      gutterMesh.setMatrixAt(i, gutterDummy.matrix);
    }
    gutterMesh.count = 4;
    gutterMesh.instanceMatrix.needsUpdate = true;
    scene.add(fieldHalftone, redBlock, gutterMesh);
  } else {
    gutterMesh.count = 0;
  }

  // 错版层：红版 / 青版各偏移 POP.offset（玩家的整机剪影 + 敌机外壳 + Boss 舰体）
  const ghostMatRed = new THREE.MeshBasicMaterial({ color: POP.misregRed });
  const ghostMatCyan = new THREE.MeshBasicMaterial({ color: POP.misregCyan });
  const playerGhostGeo = new THREE.BoxGeometry(3.9, 0.16, 3.4);
  const playerGhostR = new THREE.Mesh(playerGhostGeo, ghostMatRed);
  const playerGhostC = new THREE.Mesh(playerGhostGeo, ghostMatCyan);
  const enemyGhostR = instanced(createEnemyGeometry(), ghostMatRed, POOL.enemies);
  const enemyGhostC = instanced(createEnemyGeometry(), ghostMatCyan, POOL.enemies);
  const bossGhostGeo = new THREE.BoxGeometry(19, 0.3, 4.2);
  const bossGhostR = new THREE.Mesh(bossGhostGeo, ghostMatRed);
  const bossGhostC = new THREE.Mesh(bossGhostGeo, ghostMatCyan);
  if (isPop) {
    playerGhostR.visible = false;
    playerGhostC.visible = false;
    bossGhostR.visible = false;
    bossGhostC.visible = false;
    scene.add(playerGhostR, playerGhostC, enemyGhostR, enemyGhostC, bossGhostR, bossGhostC);
  }

  // 远层网格：更淡、更慢，做视差
  const gridFar = new THREE.GridHelper(
    BACKGROUND.farSize,
    BACKGROUND.farDivisions,
    new THREE.Color(PAL.ink),
    new THREE.Color(PAL.ink),
  );
  gridFar.material.transparent = true;
  gridFar.material.opacity = BACKGROUND.farOpacity;
  gridFar.position.y = -0.03;
  scene.add(gridFar);

  // 纵向长线：只做"跑道"式的纵深暗示，颜色极淡
  const lanePts: number[] = [];
  for (const lx of BACKGROUND.laneXs) {
    lanePts.push(lx, 0.01, -BACKGROUND.laneHalfLength, lx, 0.01, BACKGROUND.laneHalfLength);
  }
  const laneGeo = new THREE.BufferGeometry();
  laneGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(lanePts), 3));
  const lanes = new THREE.LineSegments(
    laneGeo,
    new THREE.LineBasicMaterial({ color: PAL.ink, transparent: true, opacity: BACKGROUND.laneOpacity }),
  );
  scene.add(lanes);

  // ── 速度线：纵向细条持续向上扫，给"在前进"的速度感（全部只占 1 个 draw call）──
  const SPEED_LINE_COUNT = FX.speedLineCount;
  const speedLineSpan = FIELD.halfH * 2 + 8;
  const speedLineX: number[] = [];
  const speedLineSeed: number[] = [];
  const speedLineSpeed: number[] = [];
  const speedLineColors: THREE.Color[] = [];
  for (let i = 0; i < SPEED_LINE_COUNT; i += 1) {
    speedLineX.push((Math.random() * 2 - 1) * (FIELD.halfW + 6));
    speedLineSeed.push(Math.random() * speedLineSpan);
    speedLineSpeed.push(26 + Math.random() * 22);
    // 大多数是极淡的墨线，少数用波普色提神
    const a = Math.random();
    speedLineColors.push(new THREE.Color(a < 0.12 ? PAL.cyan : a < 0.2 ? PAL.red : PAL.ink));
  }
  const speedLineMesh = instanced(
    new THREE.BoxGeometry(0.12, 0.02, FX.speedLineLength),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: FX.speedLineOpacity,
      depthWrite: false,
    }),
    SPEED_LINE_COUNT,
  );
  scene.add(speedLineMesh);

  const player = createPlayerMesh();
  scene.add(player);

  // 无敌护盾环：取代"无敌期闪烁"——恒定亮度、慢速自转的 3/4 圆环，
  // 一眼看出在无敌，但不会一闪一闪地扎眼睛。
  const shieldRing = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.9, 28, 1, 0, Math.PI * 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: PAL.cyan,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  shieldRing.visible = false;
  scene.add(shieldRing);

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

  // 我方子弹：一颗池，按弹型分发到各自的 InstancedMesh（count=0 的不产生 draw call）
  const bulletGeos = createPlayerBulletGeometries();
  const outlineGeos = createPlayerBulletOutlineGeometries();
  const bulletMeshes = {} as Record<PlayerBulletKind, THREE.InstancedMesh>;
  const outlineMeshes = {} as Record<PlayerBulletKind, THREE.InstancedMesh>;
  const bulletCounts = {} as Record<PlayerBulletKind, number>;
  for (const k of PLAYER_BULLET_KINDS) {
    // 哑铃弹的"两瓣 + 连杆"是一块几何，所以每发只占 1 个实例
    const capacity = POOL.playerBullets;
    bulletMeshes[k] = instanced(
      bulletGeos[k],
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      capacity,
    );
    // 描边：反向外壳（几何已按 BULLET_VIS.outline 放大）
    outlineMeshes[k] = instanced(
      outlineGeos[k],
      new THREE.MeshBasicMaterial({
        color: PAL.ink,
        side: THREE.BackSide,
      }),
      capacity,
    );
    bulletMeshes[k].count = 0;
    outlineMeshes[k].count = 0;
    scene.add(outlineMeshes[k], bulletMeshes[k]);
    bulletCounts[k] = 0;
  }

  // 拖尾：所有弹型共用一条 InstancedMesh（加法混合 → 越暗越淡）
  const trailMesh = instanced(
    createTrailGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
    Math.max(1, POOL.playerBullets * 3),
  );
  scene.add(trailMesh);

  // 发光贴片：环形渐变贴图 + 抄相机朝向，1 个 draw call 覆盖所有弹
  const glowTexture = createGlowTexture();
  const glowMesh = instanced(
    createGlowGeometry(),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
    POOL.playerBullets,
  );
  scene.add(glowMesh);

  // 激光笔：一道常驻光束（外晕 + 白芯）+ 末端落点光斑，共 3 个 draw call。
  // 束宽直接用 world.beam.halfW —— 和判定是同一个数。
  const beamOuter = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshBasicMaterial({
      color: PAL.laser,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  // 芯用**不透明**的绿色：之前用白色加法混合，芯把绿晕整个盖住，看着就是一根白棍
  const beamCore = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.02, 1),
    new THREE.MeshBasicMaterial({ color: PAL.laser }),
  );
  const beamTip = new THREE.Mesh(
    createGlowGeometry(),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: PAL.laser,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  beamOuter.visible = false;
  beamCore.visible = false;
  beamTip.visible = false;
  scene.add(beamOuter, beamCore, beamTip);

  // 激光进化：末端分叉的两条短束（只在 wpnX 时显示）
  const forkGeo = new THREE.BoxGeometry(1, 0.02, 1);
  const forkMat = new THREE.MeshBasicMaterial({ color: PAL.laser });
  const beamForkL = new THREE.Mesh(forkGeo, forkMat);
  const beamForkR = new THREE.Mesh(forkGeo, forkMat);
  beamForkL.visible = false;
  beamForkR.visible = false;
  scene.add(beamForkL, beamForkR);

  // 护盾罩：跟着玩家的一层球壳（套盾时涨一圈、破盾时闪一下再消失）
  const shieldBubble = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 16, 12),
    new THREE.MeshBasicMaterial({
      color: PAL.cyan,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  shieldBubble.visible = false;
  scene.add(shieldBubble);

  // 核弹演出：一颗砸向屏幕中心的弹 + 两圈扩散光环 + 一次白闪
  const nukeBomb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1.2, 0),
    new THREE.MeshBasicMaterial({ color: PAL.yellow }),
  );
  const nukeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.86, 1.14, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: PAL.yellow,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const nukeRing2 = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.2, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: PAL.red,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const nukeFlash = new THREE.Mesh(
    createGlowGeometry(),
    new THREE.MeshBasicMaterial({
      map: glowTexture,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  nukeBomb.visible = false;
  nukeRing.visible = false;
  nukeRing2.visible = false;
  nukeFlash.visible = false;
  scene.add(nukeBomb, nukeRing, nukeRing2, nukeFlash);
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
  scene.add(enemyOutline, enemyMesh, enemyBulletMesh, burstMesh);

  // 僚机：槽位 0..3 攻击型（小飞机）、4..5 支援型（环绕卫星）。
  // 数量太小，直接放 Group；6 架的 draw call 也远小于 60 的红线。
  const wingmanMeshes: THREE.Group[] = [];
  for (let i = 0; i < POOL_WINGMEN; i += 1) {
    const m = i < WINGMAN.max ? createWingmanMesh() : createSupportDroneMesh();
    m.visible = false;
    scene.add(m);
    wingmanMeshes.push(m);
  }

  // ── 贴地投影：画在地面真实坐标上，不做位置补偿（它就是"真实位置"的标记）──
  const shadowGeo = new THREE.CircleGeometry(1, 16);
  shadowGeo.rotateX(-Math.PI / 2); // 平躺在地面
  const shadowMesh = instanced(
    shadowGeo,
    new THREE.MeshBasicMaterial(
      isPop
        ? { map: halftoneTex, color: PAL.ink, transparent: true, opacity: 0.3, depthWrite: false }
        : { color: PAL.ink, transparent: true, opacity: 0.18, depthWrite: false },
    ),
    SHADOW_CAPACITY,
  );
  scene.add(shadowMesh);

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
  /**
   * 没拿属性卡时，按**机型**上色：三件宠物道具一眼能分开。
   * 只影响渲染，不改判定/伤害（元素的克制计算仍然只看 element 卡）。
   */
  const SHIP_BULLET_COLOR: Record<ShipType, THREE.Color> = {
    ion: new THREE.Color(PAL.laser), // 激光笔：绿
    nova: new THREE.Color(PAL.fish), // 小鱼干：金棕
    pulse: new THREE.Color(PAL.bone), // 骨头：暖米白
  };
  for (let i = 0; i < POOL.enemies; i += 1) enemyMesh.setColorAt(i, ENEMY_COLOR.drone);
  for (const k of PLAYER_BULLET_KINDS) {
    for (let i = 0; i < POOL.playerBullets; i += 1) bulletMeshes[k].setColorAt(i, PLAIN_BULLET);
  }

  const dummy = new THREE.Object3D();
  /** 复用的临时颜色：每帧按弹型/属性算实例色，不产生分配 */
  const tmpColor = new THREE.Color();
  const HALF_PI = Math.PI / 2;

  /** 绘制用 z：把"抬高 h"的实体补偿回地面判定点的像素 */
  function rz(z: number, h: number): number {
    return compensatedZ(z, h, degToRad(rigPitchDeg));
  }

  let shadowCount = 0;
  /**
   * 写一个接地阴影实例；坐标为地面真实坐标（不补偿）。
   * 注意：实体已被位置补偿到"地面判定点的像素"，所以阴影会和实体重合，
   * 因此这里传的是**最终半径**（略大于实体footprint），露出一圈当作接地阴影。
   */
  function pushShadow(x: number, z: number, radius: number): void {
    if (shadowCount >= SHADOW_CAPACITY) return;
    dummy.position.set(x, HEIGHT.shadow, z);
    dummy.scale.setScalar(radius);
    dummy.rotation.set(0, 0, 0); // dummy 是共用的，朝向必须显式归零
    dummy.updateMatrix();
    shadowMesh.setMatrixAt(shadowCount, dummy.matrix);
    shadowCount += 1;
  }

  // ── 屏幕 → 地面射线 ──
  const raycaster = new THREE.Raycaster();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();

  // ── Bloom 后处理：桌面开、移动端关（?bloom=0 / ?bloom=1 可覆盖）──
  // 阈值 1.0 是这套方案的关键：只有"过曝"的加法辉光会发光，米色场地
  // （线性亮度 ≈0.94）不参与，所以背景不会糊成一片，弹芯也保持纯色。
  const bloomOn = fx.bloom && !isMobile;
  const composer = bloomOn ? new EffectComposer(renderer) : null;
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
      new UnrealBloomPass(new THREE.Vector2(256, 256), FX.bloomStrength, FX.bloomRadius, FX.bloomThreshold),
    );
    composer.addPass(new OutputPass());
    // 多 pass 下 info 必须手动 reset，否则 draw call 只会统计最后一个 pass
    renderer.info.autoReset = false;
  }

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
    composer?.setSize(f.cssW, f.cssH);

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

  let lastWorldTime = 0;

  /** 运镜：常规战斗恒为基准值，只有过场窗口偏离俯视（曲线见 engine/rig.ts） */
  function updateRig(world: World, dt: number): void {
    const k = world.cine.active ? world.cine.t / Math.max(1e-3, world.cine.dur) : 0;
    const target = cineTarget(world.cine.active ? world.cine.kind : null, k, CAMERA.pitchDeg);
    rigPitchDeg = approach(rigPitchDeg, target.pitchDeg, dt, RIG_RATE);
    rigDistMul = approach(rigDistMul, target.distMul, dt, RIG_RATE);
    placeCamera();
  }

  function render(world: World): void {
    const dt = Math.min(0.05, Math.max(0, world.time - lastWorldTime));
    lastWorldTime = world.time;
    updateRig(world, dt);

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

    // ── 双层视差滚动：制造"在前进"的速度感 ──
    const nearCell = BACKGROUND.nearSize / BACKGROUND.nearDivisions;
    const farCell = BACKGROUND.farSize / BACKGROUND.farDivisions;
    gridNear.position.z = (world.time * BACKGROUND.nearSpeed) % nearCell;
    gridFar.position.z = (world.time * BACKGROUND.nearSpeed * BACKGROUND.farSpeedMul) % farCell;

    shadowCount = 0;

    // 速度线：纯数学滚动（不改任何运行时对象、零分配）
    if (fx.speedLines) {
      for (let i = 0; i < SPEED_LINE_COUNT; i += 1) {
        const zz = ((speedLineSeed[i] + world.time * speedLineSpeed[i]) % speedLineSpan) - FIELD.halfH - 4;
        dummy.position.set(speedLineX[i], HEIGHT.border, zz);
        dummy.scale.setScalar(1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        speedLineMesh.setMatrixAt(i, dummy.matrix);
        speedLineMesh.setColorAt(i, speedLineColors[i]);
      }
      speedLineMesh.count = SPEED_LINE_COUNT;
      speedLineMesh.instanceMatrix.needsUpdate = true;
      if (speedLineMesh.instanceColor) speedLineMesh.instanceColor.needsUpdate = true;
    } else {
      speedLineMesh.count = 0;
    }

    // 玩家机：常显、不闪烁（无敌期交给护盾环），也不做"每发缩放"（高频射击下等于持续闪）
    const p = world.player;
    player.visible = world.phase === "playing";
    player.position.set(p.pos.x, HEIGHT.player, rz(p.pos.z, HEIGHT.player));
    player.scale.setScalar(1);
    pushShadow(p.pos.x, p.pos.z, 2.6); // 玩家机翼展半宽 2.3，阴影略大一圈
    if (isPop) {
      // 错版：玩家的整机剪影复制两份，向左右各偏一点 = 套色不准
      playerGhostR.visible = player.visible;
      playerGhostC.visible = player.visible;
      if (player.visible) {
        const gy = HEIGHT.player - 0.08;
        playerGhostR.position.set(p.pos.x - POP.offset, gy, rz(p.pos.z, gy));
        playerGhostC.position.set(p.pos.x + POP.offset, gy, rz(p.pos.z, gy));
      }
    }

    // 无敌护盾环：恒定亮度 + 慢转，取代闪烁
    shieldRing.visible = world.phase === "playing" && p.invuln > 0;
    if (shieldRing.visible) {
      shieldRing.position.set(p.pos.x, HEIGHT.player - 0.2, rz(p.pos.z, HEIGHT.player - 0.2));
      shieldRing.rotation.y = world.time * 0.9;
    }

    // 激光笔：常驻光束（判定与外观共用 halfW / z0 / z1）
    const beam = world.beam;
    const beamOn = world.phase === "playing" && beam.active && world.ship === "ion";
    beamOuter.visible = beamOn;
    beamCore.visible = beamOn;
    beamTip.visible = beamOn;
    if (beamOn) {
      // 光柱止于落点（world.beam.tipZ）：打到谁就停在谁身上，不再"穿过去还在飞"。
      // 两端都走投影补偿，才和敌人（同样补偿过）对齐。
      const za = rz(beam.z0, HEIGHT.bullet);
      const zb = rz(Math.min(beam.tipZ, beam.z0), HEIGHT.bullet);
      const len = Math.abs(zb - za);
      const cz = (za + zb) / 2;
      beamOuter.scale.set(beam.halfW * 2.4, 1, len);
      beamOuter.position.set(beam.x, HEIGHT.bullet, cz);
      beamCore.scale.set(beam.halfW * 0.9, 1, len);
      beamCore.position.set(beam.x, HEIGHT.bullet + 0.02, cz);
      beamTip.position.set(beam.x, HEIGHT.bullet, zb);
      beamTip.scale.setScalar(beam.halfW * 6);
      beamTip.quaternion.copy(camera.quaternion);

      // 进化（炫彩）：末端分叉的两条短束
      const forkOn = beam.forks;
      beamForkL.visible = forkOn;
      beamForkR.visible = forkOn;
      if (forkOn) {
        const forkLen = 3.2;
        beamForkL.scale.set(beam.halfW * 0.7, 1, forkLen);
        beamForkL.position.set(beam.x - 0.5, HEIGHT.bullet, zb - forkLen * 0.45);
        beamForkL.rotation.set(0, 0.3, 0);
        beamForkR.scale.set(beam.halfW * 0.7, 1, forkLen);
        beamForkR.position.set(beam.x + 0.5, HEIGHT.bullet, zb - forkLen * 0.45);
        beamForkR.rotation.set(0, -0.3, 0);
      }
    }

    // 护盾罩：套盾涨一圈、破盾闪一下（都不是"闪屏"，是状态变化的一次演出）
    const pulse = world.shieldPulse > 0 ? world.shieldPulse / SHIELD.pulseTime : 0;
    const brk = world.shieldBreak > 0 ? world.shieldBreak / SHIELD.breakTime : 0;
    const shieldOn = world.phase === "playing" && (world.shield > 0 || pulse > 0 || brk > 0);
    shieldBubble.visible = shieldOn;
    if (shieldOn) {
      shieldBubble.position.set(p.pos.x, HEIGHT.player, rz(p.pos.z, HEIGHT.player));
      shieldBubble.scale.setScalar(1 + pulse * 0.35 + brk * 0.5);
      const mat = shieldBubble.material as THREE.MeshBasicMaterial;
      const ratio = world.shieldMax > 0 ? world.shield / world.shieldMax : 0;
      mat.opacity = world.shield > 0 ? 0.1 + 0.14 * ratio : 0.4 * brk;
    }

    // 核弹演出：前 35% 砸向屏幕中心，后 65% 光环扩散 + 白闪
    const nukeOn = world.nukeFx > 0;
    nukeBomb.visible = nukeOn;
    nukeRing.visible = nukeOn;
    nukeRing2.visible = nukeOn;
    nukeFlash.visible = nukeOn;
    if (nukeOn) {
      const t = 1 - world.nukeFx / NUKE.fxTime;
      const drop = Math.min(1, t / 0.35);
      nukeBomb.position.set(0, 46 * (1 - drop), 0);
      nukeBomb.rotation.set(t * 9, t * 7, 0);
      nukeBomb.visible = drop < 1;
      const k = Math.max(0, (t - 0.35) / 0.65);
      const radius = 4 + k * 48;
      nukeRing.scale.setScalar(radius);
      nukeRing.position.set(0, HEIGHT.burst, 0);
      (nukeRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
      nukeRing2.scale.setScalar(radius * 0.62);
      nukeRing2.position.set(0, HEIGHT.burst + 0.05, 0);
      (nukeRing2.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - k);
      nukeFlash.position.set(0, HEIGHT.burst + 1, 0);
      nukeFlash.scale.setScalar(30 + k * 40);
      nukeFlash.quaternion.copy(camera.quaternion);
      (nukeFlash.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.75 - k * 1.2);
    }

    // 僚机：编队实体（数量 ≤ 4，用 Group + 贴地阴影）
    for (const m of wingmanMeshes) m.visible = false;
    const wms = world.wingmen;
    for (let i = 0; i < wms.slots.capacity; i += 1) {
      if (!wms.slots.alive[i]) continue;
      const w = wms.items[i];
      const mesh = wingmanMeshes[w.slot];
      if (!mesh) continue;
      mesh.visible = world.phase === "playing";
      if (w.type === "attack") {
        // 侧倾：按本帧横向位移倾斜，跟队列时"压一下机翼"，幅度刻意做小
        const dx = w.x - mesh.position.x;
        mesh.rotation.z = Math.max(-0.3, Math.min(0.3, -dx * 0.9));
        mesh.scale.setScalar(1); // 不做缩放脉冲：高频射击下就是持续闪
      } else {
        // 支援型：自转 + 给盾时缓慢涨一圈（0.35 秒，不是闪）
        mesh.rotation.y = world.time * 1.6;
        mesh.scale.setScalar(1 + (w.pulse > 0 ? (w.pulse / SHIELD.pulseTime) * 0.25 : 0));
      }
      mesh.position.set(w.x, HEIGHT.player, rz(w.z, HEIGHT.player));
      pushShadow(w.x, w.z, 1.3);
    }

    // 敌机（实体 + 描边外壳）
    let n = 0;
    const foes = world.enemies;
    for (let i = 0; i < foes.slots.capacity; i += 1) {
      if (!foes.slots.alive[i]) continue;
      const e = foes.items[i];
      dummy.position.set(e.x, HEIGHT.enemy, rz(e.z, HEIGHT.enemy));
      dummy.scale.setScalar(e.scale);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      enemyMesh.setMatrixAt(n, dummy.matrix);
      enemyMesh.setColorAt(n, e.flash > 0 ? FLASH_COLOR : ENEMY_COLOR[e.kind]);

      dummy.scale.setScalar(e.scale * 1.16);
      dummy.updateMatrix();
      enemyOutline.setMatrixAt(n, dummy.matrix);
      if (isPop) {
        // 错版：红版左偏、青版右偏，各画一份同样的敌机剪影
        const gy = HEIGHT.enemy - 0.07;
        dummy.scale.setScalar(e.scale);
        dummy.position.set(e.x - POP.offset, gy, rz(e.z, gy));
        dummy.updateMatrix();
        enemyGhostR.setMatrixAt(n, dummy.matrix);
        dummy.position.set(e.x + POP.offset, gy, rz(e.z, gy));
        dummy.updateMatrix();
        enemyGhostC.setMatrixAt(n, dummy.matrix);
      }
      pushShadow(e.x, e.z, e.r * 1.8);
      n += 1;
    }
    enemyMesh.count = n;
    enemyOutline.count = n;
    enemyMesh.instanceMatrix.needsUpdate = true;
    enemyOutline.instanceMatrix.needsUpdate = true;
    if (enemyMesh.instanceColor) enemyMesh.instanceColor.needsUpdate = true;
    if (isPop) {
      enemyGhostR.count = n;
      enemyGhostC.count = n;
      enemyGhostR.instanceMatrix.needsUpdate = true;
      enemyGhostC.instanceMatrix.needsUpdate = true;
    }

    // 我方子弹：辉光贴片 + 拖尾 + 描边 + 弹芯（每种弹型一个 InstancedMesh，count=0 不产生 draw call）
    for (const k of PLAYER_BULLET_KINDS) bulletCounts[k] = 0;
    let glowN = 0;
    let trailN = 0;
    const shipColor = SHIP_BULLET_COLOR[world.ship];
    const anyTrail = fx.trail;
    const pb = world.playerBullets;
    for (let i = 0; i < pb.slots.capacity; i += 1) {
      if (!pb.slots.alive[i]) continue;
      const b = pb.items[i];
      const mesh = bulletMeshes[b.kind];
      const m = bulletCounts[b.kind];
      const color = b.element ? ELEMENT_BULLET[b.element] : shipColor;
      const y = HEIGHT.bullet;

      // ── 拖尾：位置由速度反推（不存历史），加法混合下"越暗 = 越淡" ──
      const speed = Math.hypot(b.vx, b.vz) || 1;
      const ux = b.vx / speed;
      const uz = b.vz / speed;
      const px = -uz; // 速度的垂直方向，给"锯齿残影"用
      const pz = ux;
      const trailCount = anyTrail ? BULLET_VIS.trailByKind[b.kind] : 0;
      for (let t = 0; t < trailCount; t += 1) {
        const k2 = t + 1;
        const dim = Math.pow(BULLET_VIS.trailDim, k2) * BULLET_VIS.glowGain;
        let ox = -ux * BULLET_VIS.trailGap * k2;
        let oz = -uz * BULLET_VIS.trailGap * k2;
        let rot = HALF_PI - b.angle;
        let sc = 1 - k2 * 0.12;
        if (b.element === "electric") {
          // 电：左右交替的锯齿残影
          const side = t % 2 === 0 ? 1 : -1;
          ox += px * side * 0.24 * k2;
          oz += pz * side * 0.24 * k2;
        } else if (b.element === "fire") {
          // 火：拖得更长、衰减更慢 = 拖焰
          const g = BULLET_VIS.trailGap * k2 * 1.6;
          ox = -ux * g;
          oz = -uz * g;
          sc = 1 - k2 * 0.06;
        } else if (b.element === "ice") {
          // 冰：每节多转一点 = 旋转菱形
          rot += k2 * 0.5;
          sc *= t % 2 === 0 ? 1 : 0.7;
        }
        dummy.position.set(b.x + ox, y, rz(b.z + oz, y));
        dummy.scale.set(sc, 1, sc);
        dummy.rotation.set(0, rot, 0);
        dummy.updateMatrix();
        trailMesh.setMatrixAt(trailN, dummy.matrix);
        trailMesh.setColorAt(trailN, tmpColor.copy(color).multiplyScalar(dim));
        trailN += 1;
      }

      // ── 弹体：长轴都在局部 +Z，绕 Y 转 (π/2 - 朝向) 才对齐 ──
      // 哑铃弹的朝向是它的自转相位；其它弹是飞行方向。
      const chaos = bulletDef(b.kind).chaotic;
      const dir = chaos ? b.angle + b.spin * b.age : b.angle;
      dummy.position.set(b.x, y, rz(b.z, y));
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, HALF_PI - dir, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(m, dummy.matrix);
      mesh.setColorAt(m, color);

      // 描边：同矩阵，压低一点点
      if (fx.outline) {
        dummy.position.y = y - 0.03;
        dummy.updateMatrix();
        outlineMeshes[b.kind].setMatrixAt(m, dummy.matrix);
      }

      // 辉光贴片：面向相机。
      // 骨头（chaos）**不给辉光**——它两端各一个光晕会在杆中间叠加成一块死白，
      // 看起来就像"骨头中间有白底"。骨头靠 ink 描边 + 实色读出来。
      if (fx.glow && !chaos) {
        dummy.position.set(b.x, y, rz(b.z, y));
        dummy.scale.setScalar(bulletDef(b.kind).radius * 2 * BULLET_VIS.glow);
        dummy.quaternion.copy(camera.quaternion);
        dummy.updateMatrix();
        glowMesh.setMatrixAt(glowN, dummy.matrix);
        glowMesh.setColorAt(glowN, tmpColor.copy(color).multiplyScalar(BULLET_VIS.glowGain));
        glowN += 1;
      }
      bulletCounts[b.kind] = m + 1;
    }
    for (const k of PLAYER_BULLET_KINDS) {
      const mesh = bulletMeshes[k];
      mesh.count = bulletCounts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      const outline = outlineMeshes[k];
      outline.count = fx.outline ? bulletCounts[k] : 0;
      outline.instanceMatrix.needsUpdate = true;
    }
    trailMesh.count = fx.trail ? trailN : 0;
    trailMesh.instanceMatrix.needsUpdate = true;
    if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;
    glowMesh.count = fx.glow ? glowN : 0;
    glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;

    // 敌弹
    n = 0;
    const eb = world.enemyBullets;
    for (let i = 0; i < eb.slots.capacity; i += 1) {
      if (!eb.slots.alive[i]) continue;
      const b = eb.items[i];
      dummy.position.set(b.x, HEIGHT.ebullet, rz(b.z, HEIGHT.ebullet));
      dummy.scale.setScalar(1);
      dummy.rotation.set(0, 0, 0);
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
      dummy.position.set(b.x, HEIGHT.burst, rz(b.z, HEIGHT.burst));
      dummy.scale.setScalar(Math.max(0.001, k * BURST.maxScale * b.scale));
      dummy.rotation.set(0, 0, 0);
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
      sprite.position.set(pop.x, HEIGHT.pop + k * 2.4, rz(pop.z, HEIGHT.pop));
      sprite.visible = true;
      n += 1;
    }
    for (let i = n; i < popSprites.length; i += 1) popSprites[i].visible = false;

    // Boss
    const boss = world.boss;
    bossMesh.group.visible = boss.active;
    if (boss.active) {
      // Boss：组原点留在地面，高度由内部零件提供，补偿按视觉中心高度算
      bossMesh.group.position.set(boss.x, 0, rz(boss.z, HEIGHT.bossCenter));
      // 入场时从小到大弹出
      const k = Math.min(1, (boss.z + FIELD.halfH + 12) / 12);
      bossMesh.group.scale.setScalar(0.55 + 0.45 * k);
      bossMesh.core.material.color.copy(boss.flash > 0 ? FLASH_COLOR : CORE_COLOR);
      pushShadow(boss.x, boss.z, BOSS.radius * 1.2);
    }
    if (isPop) {
      bossGhostR.visible = boss.active;
      bossGhostC.visible = boss.active;
      if (boss.active) {
        const gy = 1.4;
        bossGhostR.position.set(boss.x - POP.offset, gy, rz(boss.z, HEIGHT.bossCenter));
        bossGhostC.position.set(boss.x + POP.offset, gy, rz(boss.z, HEIGHT.bossCenter));
      }
    }

    shadowMesh.count = shadowCount;
    shadowMesh.instanceMatrix.needsUpdate = true;

    if (composer) {
      renderer.info.reset();
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
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
    glowTexture.dispose();
    composer?.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { element: canvas, resize, render, drawCalls, pointerToWorld, dispose };
}
