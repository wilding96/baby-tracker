// ═══════════════════════════════════════════════════════════════════
// POP3D — 纸片渲染器（B 方向：60 年代波普漫画 / 丝网印刷）
// 与 3D 渲染器并行的一整套实现：固定正面视角 + 平面贴图（billboard），
// 没有透视、没有光照、没有渐变。引擎与玩法完全不用改（Renderer 接口一致）。
// 用法：?theme=paper
// ═══════════════════════════════════════════════════════════════════

import { FIELD, HEIGHT, PAL, POP, WORDS } from "../engine/config";
import type { Renderer, World } from "../engine/types";

const SPRITE_SRC = {
  player: "/game/pop3d/player.png",
  enemy: "/game/pop3d/enemy.png",
  fish: "/game/pop3d/fish.png",
} as const;

/** 世界单位 → 屏幕像素的等比映射（场地 36×64 居中铺满，留出分格边距） */
interface View {
  scale: number;
  ox: number;
  oy: number;
}

function makeView(w: number, h: number): View {
  const margin = 0.92;
  const scale = Math.min((w * margin) / (FIELD.halfW * 2), (h * margin) / (FIELD.halfH * 2));
  return { scale, ox: w / 2, oy: h / 2 };
}

export function createPaperRenderer(mount: HTMLElement): Renderer {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.display = "block";
  canvas.style.touchAction = "none";
  canvas.style.imageRendering = "auto";
  mount.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  let view = makeView(1, 1);
  let dpr = 1;
  let calls = 0;

  // ── 网点图案：离屏画一次，之后用 createPattern 平铺（等同 3D 版的网点贴图）──
  const dotTile = document.createElement("canvas");
  dotTile.width = 12;
  dotTile.height = 12;
  {
    const c = dotTile.getContext("2d")!;
    c.fillStyle = "#101010";
    for (const [x, y] of [
      [6, 6],
      [0, 0],
      [12, 0],
      [0, 12],
      [12, 12],
    ]) {
      c.beginPath();
      c.arc(x, y, 1.5, 0, Math.PI * 2);
      c.fill();
    }
  }
  const dotPattern = ctx.createPattern(dotTile, "repeat")!;

  // ── 贴图（billboard 用的精灵）──
  const sprites: Record<keyof typeof SPRITE_SRC, HTMLImageElement> = {
    player: new Image(),
    enemy: new Image(),
    fish: new Image(),
  };
  for (const key of Object.keys(SPRITE_SRC) as (keyof typeof SPRITE_SRC)[]) {
    sprites[key].src = SPRITE_SRC[key];
  }

  function resize(width: number, height: number): void {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.left = "0px";
    canvas.style.top = "0px";
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    view = makeView(width, height);
  }

  const sx = (x: number): number => view.ox + x * view.scale;
  const sy = (z: number): number => view.oy + z * view.scale;
  const len = (v: number): number => v * view.scale;

  /** 画一张精灵：以世界坐标 (x,z) 为中心，h 为屏幕高度，可选翻转/白闪 */
  function sprite(
    img: HTMLImageElement,
    x: number,
    z: number,
    h: number,
    opts: { flash?: boolean; alpha?: number; tint?: string } = {},
  ): void {
    if (!img.complete || img.naturalWidth === 0) return;
    const ph = len(h);
    const pw = ph * (img.naturalWidth / img.naturalHeight);
    ctx.save();
    ctx.globalAlpha = opts.alpha ?? 1;
    if (opts.flash && "filter" in ctx) ctx.filter = "brightness(0) saturate(0)";
    ctx.drawImage(img, sx(x) - pw / 2, sy(z) - ph / 2, pw, ph);
    ctx.filter = "none";
    if (opts.tint) {
      // 用 source-atop 给精灵叠一层纯色（保持轮廓，模拟"另一版套色"）
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = opts.tint;
      ctx.fillRect(sx(x) - pw / 2, sy(z) - ph / 2, pw, ph);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.restore();
    calls += 1;
  }

  /** 漫画式爆炸：放射星形 + 冲击环 + 白芯（程序画，风格比软粒子更对） */
  function comicBurst(x: number, z: number, k: number, scale: number): void {
    const cx = sx(x);
    const cy = sy(z);
    const R = len(2.2 * scale) * (0.6 + k * 0.9);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    const spikes = 11;
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? R : R * 0.52;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = PAL.yellow;
    ctx.fill();
    ctx.lineWidth = Math.max(2, len(0.18));
    ctx.strokeStyle = PAL.ink;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = PAL.red;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    calls += 3;
  }

  function render(world: World): void {
    calls = 0;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // ── 背景：纸白 + 网点 + 老大红块 + 粗黑分格 ──
    ctx.fillStyle = PAL.paper;
    ctx.fillRect(0, 0, w, h);

    const fieldW = len(FIELD.halfW * 2);
    const fieldH = len(FIELD.halfH * 2);
    const fx0 = sx(-FIELD.halfW);
    const fy0 = sy(-FIELD.halfH);
    ctx.save();
    ctx.beginPath();
    ctx.rect(fx0, fy0, fieldW, fieldH);
    ctx.clip();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = dotPattern;
    ctx.fillRect(fx0, fy0, fieldW, fieldH);
    ctx.globalAlpha = POP.blockAlpha;
    ctx.fillStyle = PAL.red;
    ctx.fillRect(fx0, fy0, len(FIELD.halfW * 2 * POP.blockW), fieldH);
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = dotPattern;
    ctx.fillRect(fx0, fy0, len(FIELD.halfW * 2 * POP.blockW), fieldH);
    ctx.restore();

    // 粗黑分格（漫画格）
    const g = Math.max(4, len(POP.gutter * 0.9));
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(fx0 - g, fy0 - g, fieldW + g * 2, g);
    ctx.fillRect(fx0 - g, fy0 + fieldH, fieldW + g * 2, g);
    ctx.fillRect(fx0 - g, fy0, g, fieldH);
    ctx.fillRect(fx0 + fieldW, fy0, g, fieldH);
    calls += 5;

    // ── 激光笔：一道硬边绿光束（波普不需要发光，只要硬边）──
    const beam = world.beam;
    if (world.phase === "playing" && beam.active && world.ship === "ion") {
      const bw = len(beam.halfW * 2);
      const y0 = sy(beam.z0);
      const y1 = sy(Math.min(beam.tipZ, beam.z0));
      ctx.fillStyle = PAL.laser;
      ctx.fillRect(sx(beam.x) - bw / 2, y1, bw, Math.abs(y0 - y1));
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(2, len(0.1));
      ctx.strokeRect(sx(beam.x) - bw / 2, y1, bw, Math.abs(y0 - y1));
      ctx.fillStyle = PAL.paper;
      ctx.beginPath();
      ctx.arc(sx(beam.x), y1, bw * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      calls += 4;
    }

    // ── 贴地阴影：网点圆盘（印刷感的阴影，不是柔和投影）──
    for (const set of [world.enemies]) {
      for (let i = 0; i < set.slots.capacity; i += 1) {
        if (!set.slots.alive[i]) continue;
        const e = set.items[i];
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.ellipse(sx(e.x) + len(0.4), sy(e.z) + len(0.5), len(e.r * 1.1), len(e.r * 0.5), 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = dotPattern;
        ctx.fillRect(sx(e.x) - len(3), sy(e.z) - len(3), len(6), len(6));
        ctx.restore();
      }
    }

    // ── 敌机（贴图 + 受击白闪）──
    for (let i = 0; i < world.enemies.slots.capacity; i += 1) {
      if (!world.enemies.slots.alive[i]) continue;
      const e = world.enemies.items[i];
      sprite(sprites.enemy, e.x, e.z, e.scale * 4.4, { flash: e.flash > 0 });
    }

    // ── 我方子弹：小鱼干用贴图，其它弹型用色块（先保证辨识度）──
    for (let i = 0; i < world.playerBullets.slots.capacity; i += 1) {
      if (!world.playerBullets.slots.alive[i]) continue;
      const b = world.playerBullets.items[i];
      if (b.kind === "spread") {
        sprite(sprites.fish, b.x, b.z, 1.6, {});
      } else if (b.kind === "wave") {
        ctx.strokeStyle = PAL.ink;
        ctx.lineWidth = Math.max(2, len(0.14));
        ctx.beginPath();
        ctx.arc(sx(b.x), sy(b.z), len(b.arm > 0 ? b.arm : 1.05), 0, Math.PI * 2);
        ctx.strokeStyle = PAL.bone;
        ctx.lineWidth = Math.max(3, len(0.24));
        ctx.stroke();
        calls += 1;
      } else if (b.kind === "mini") {
        ctx.fillStyle = PAL.fish;
        ctx.beginPath();
        ctx.arc(sx(b.x), sy(b.z), len(0.4), 0, Math.PI * 2);
        ctx.fill();
        calls += 1;
      } else {
        ctx.fillStyle = PAL.laser;
        ctx.fillRect(sx(b.x) - len(0.2), sy(b.z) - len(1.1), len(0.4), len(2.2));
        calls += 1;
      }
    }

    // ── 敌弹：实心黑球 + 白高光（漫画里的"实心弹"）──
    for (let i = 0; i < world.enemyBullets.slots.capacity; i += 1) {
      if (!world.enemyBullets.slots.alive[i]) continue;
      const b = world.enemyBullets.items[i];
      ctx.fillStyle = PAL.red;
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(2, len(0.12));
      ctx.beginPath();
      ctx.arc(sx(b.x), sy(b.z), len(0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      calls += 1;
    }

    // ── 僚机（贴图缩小 + 蓝色套色）──
    for (let i = 0; i < world.wingmen.slots.capacity; i += 1) {
      if (!world.wingmen.slots.alive[i]) continue;
      const m = world.wingmen.items[i];
      sprite(sprites.player, m.x, m.z, m.type === "attack" ? 2.9 : 2.4, {
        tint: m.type === "support" ? PAL.cyan : PAL.blue,
        alpha: 0.95,
      });
    }

    // ── 玩家机（护盾泡 + 无敌期用网点环表示，不闪烁）──
    const p = world.player;
    if (world.phase === "playing") {
      if (world.shield > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = PAL.cyan;
        ctx.lineWidth = Math.max(3, len(0.22));
        ctx.beginPath();
        ctx.arc(sx(p.pos.x), sy(p.pos.z), len(2.6), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        calls += 1;
      }
      sprite(sprites.player, p.pos.x, p.pos.z, 5.4, {});
      if (p.invuln > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(sx(p.pos.x), sy(p.pos.z), len(2.4), 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = dotPattern;
        ctx.fillRect(sx(p.pos.x) - len(4), sy(p.pos.z) - len(4), len(8), len(8));
        ctx.restore();
        calls += 1;
      }
    }

    // ── Boss：黑舰体 + 网点 + 黄核心 ──
    const boss = world.boss;
    if (boss.active) {
      const bw = len(19);
      const bh = len(4.2);
      ctx.fillStyle = PAL.magenta;
      ctx.strokeStyle = PAL.ink;
      ctx.lineWidth = Math.max(3, len(0.24));
      ctx.fillRect(sx(boss.x) - bw / 2, sy(boss.z) - bh / 2, bw, bh);
      ctx.strokeRect(sx(boss.x) - bw / 2, sy(boss.z) - bh / 2, bw, bh);
      ctx.save();
      ctx.globalAlpha = 0.45;
      ctx.beginPath();
      ctx.rect(sx(boss.x) - bw / 2, sy(boss.z) - bh / 2, bw, bh);
      ctx.clip();
      ctx.fillStyle = dotPattern;
      ctx.fillRect(sx(boss.x) - bw / 2, sy(boss.z) - bh / 2, bw, bh);
      ctx.restore();
      ctx.fillStyle = boss.flash > 0 ? PAL.paper : PAL.yellow;
      ctx.beginPath();
      ctx.arc(sx(boss.x), sy(boss.z), len(1.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      calls += 4;
    }

    // ── 爆点：漫画爆炸 ──
    for (let i = 0; i < world.bursts.slots.capacity; i += 1) {
      if (!world.bursts.slots.alive[i]) continue;
      const b = world.bursts.items[i];
      comicBurst(b.x, b.z, b.t / b.life, b.scale);
    }

    // ── 拟声词贴纸：粗黑描边 + 黄底 + 轻微旋转（B 板的招牌）──
    for (let i = 0; i < world.pops.slots.capacity; i += 1) {
      if (!world.pops.slots.alive[i]) continue;
      const pop = world.pops.items[i];
      const k = pop.t / pop.life;
      const size = len(1.5 * pop.scale) * (1 + k * 0.25);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      ctx.translate(sx(pop.x), sy(pop.z) - len(k * 2));
      ctx.rotate(-0.12 + (pop.word % 3) * 0.06);
      ctx.font = `900 ${size}px "Arial Black", Impact, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.lineWidth = Math.max(4, size * 0.22);
      ctx.strokeStyle = PAL.ink;
      ctx.strokeText(WORDS[pop.word] ?? "POW!", 0, 0);
      ctx.fillStyle = PAL.yellow;
      ctx.fillText(WORDS[pop.word] ?? "POW!", 0, 0);
      ctx.restore();
      calls += 2;
    }

    // ── 核弹演出：白闪 + 扩散光环 ──
    if (world.nukeFx > 0) {
      const t = 1 - world.nukeFx / 1.15;
      const k = Math.max(0, (t - 0.35) / 0.65);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.8 - k * 1.3);
      ctx.fillStyle = PAL.paper;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = Math.max(0, 0.9 - k);
      ctx.strokeStyle = PAL.yellow;
      ctx.lineWidth = Math.max(6, len(1.4 * (1 - k * 0.5)));
      ctx.beginPath();
      ctx.arc(sx(0), sy(0), len(4 + k * 48), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      calls += 3;
    }
  }

  function pointerToWorld(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: (clientX - rect.left - view.ox) / view.scale,
      z: (clientY - rect.top - view.oy) / view.scale,
    };
  }

  return {
    element: canvas,
    resize,
    render,
    drawCalls: () => calls,
    pointerToWorld,
    dispose() {
      canvas.remove();
    },
  };
}

/** 给纸片渲染器用的高度常量（保持和 3D 版一致的语义，便于共用配置） */
export const PAPER_HEIGHT = HEIGHT;
