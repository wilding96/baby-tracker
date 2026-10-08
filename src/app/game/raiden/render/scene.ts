// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 场景与 HUD 绘制
// 每帧只做 drawImage + 少量 fillRect / fillText。
// 无 shadowBlur、无逐帧路径构建、无逐帧渐变。
// ═══════════════════════════════════════════════════════════════════

import { ELEMENT_NAME, H, PAL, W, WING_X, WING_Y } from "../engine/config";
import type { World } from "../engine/game";
import { getPopImage } from "./sprites";
import type { Sprite, SpriteBank } from "./sprites";

const HEAVY = '900 %Ppx Impact, "Arial Black", system-ui, sans-serif';

let pat: CanvasPattern | null = null;
let patSrc: HTMLCanvasElement | null = null;

function blit(g: CanvasRenderingContext2D, s: Sprite, x: number, y: number) {
  g.drawImage(s.cv, x, y, s.w, s.h);
}

function blitC(g: CanvasRenderingContext2D, s: Sprite, cx: number, cy: number) {
  g.drawImage(s.cv, cx - s.w / 2, cy - s.h / 2, s.w, s.h);
}

// 位图精灵的显示尺寸（逻辑像素）。
// 矢量精灵紧贴包围盒，生成图四周留了约 10% 白边，
// 所以要按更大的尺寸画，观感才和原来一致。
const ENEMY_ART = ["enemy_small", "enemy_med", "enemy_elite"] as const;
const ENEMY_SIZE = [36, 52, 70];
const PLAYER_SIZE = 54;
const BOSS_SIZE = 156;

/** 有生成图就用图（居中、正方铺开），没有就回退到矢量精灵 */
function blitArt(
  g: CanvasRenderingContext2D,
  key: string,
  fallback: Sprite,
  cx: number,
  cy: number,
  size: number,
) {
  const im = getPopImage(key);
  if (im && im.complete && im.naturalWidth > 0) {
    g.drawImage(im, cx - size / 2, cy - size / 2, size, size);
  } else {
    blitC(g, fallback, cx, cy);
  }
}

function label(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
) {
  g.font = HEAVY.replace("%P", String(size));
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.lineJoin = "round";

  // 描边粗细随字号缩放：小字配粗描边会糊成一团
  const outline = Math.max(1.5, Math.min(4, size * 0.16));

  // 波普硬投影只给大号字。小字叠一层偏移的墨黑会直接糊掉，
  // 而且墨黑本色的标签再描墨黑的边，只会变成一块黑斑。
  if (size >= 16) {
    g.lineWidth = outline;
    g.strokeStyle = PAL.ink;
    g.fillStyle = PAL.ink;
    g.strokeText(text, x + 2, y + 2);
    g.fillText(text, x + 2, y + 2);
  }

  // 本体：只有非墨黑的字才描黑边
  if (color !== PAL.ink) {
    g.lineWidth = outline;
    g.strokeStyle = PAL.ink;
    g.strokeText(text, x, y);
  }
  g.fillStyle = color;
  g.fillText(text, x, y);
}

/**
 * 波普标签底板：纸白 + 墨黑粗框。
 * 角标压在 Ben-Day 网点上时，纯黑字会和网点糊在一起，套个底板才读得清。
 */
function chip(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = "left",
) {
  g.font = HEAVY.replace("%P", String(size));
  const padX = 7;
  const w = g.measureText(text).width + padX * 2;
  const h = size + 9;
  const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
  const top = y - size - 3;
  g.fillStyle = PAL.paper;
  g.fillRect(left, top, w, h);
  g.lineWidth = 2.5;
  g.strokeStyle = PAL.ink;
  g.strokeRect(left, top, w, h);
  label(g, text, left + padX, y, size, PAL.ink, "left");
}

export function drawWorld(
  g: CanvasRenderingContext2D,
  bank: SpriteBank,
  w: World,
  dpr: number,
  msAvg: number,
) {
  const s = w.s;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = true;

  // ── 背景：纸白 → 大几何色块 → Ben-Day 网点 ──
  // 顺序是关键：网点必须叠在色块之上。网点瓦片只有点、没有底，
  // 所以它既能给色块加印刷质感，又不会把色块盖掉。
  // 所有背景元素都压在 0.20 透明度以下，前景（机与弹）永远比背景抢眼。
  g.fillStyle = PAL.paper;
  g.fillRect(0, 0, W, H);

  const sc = s.bgScroll;

  // 大色带：三条印刷色，慢速下滚（周期都落在屏幕之外，接缝看不见）
  g.globalAlpha = 0.16;
  g.fillStyle = PAL.cyan;
  g.fillRect(-40, ((70 + sc * 0.12) % (H + 260)) - 200, W + 80, 92);
  g.fillStyle = PAL.yellow;
  g.fillRect(-40, ((360 + sc * 0.12) % (H + 260)) - 200, W + 80, 56);
  g.fillStyle = PAL.cyan;
  g.fillRect(-40, ((620 + sc * 0.12) % (H + 260)) - 200, W + 80, 40);

  // 大圆：波普的圆形母题，与色带错开速度，形成视差
  g.globalAlpha = 0.13;
  g.fillStyle = PAL.red;
  g.beginPath();
  g.arc(70, ((180 + sc * 0.2) % (H + 340)) - 170, 76, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PAL.blue;
  g.beginPath();
  g.arc(300, ((540 + sc * 0.2) % (H + 340)) - 170, 98, 0, Math.PI * 2);
  g.fill();

  // 速度线：细墨条快速下滚，给纵向的速度感
  g.globalAlpha = 0.09;
  g.fillStyle = PAL.ink;
  for (let i = 0; i < 7; i++) {
    const lx = 16 + i * 49;
    const ly = ((i * 137 + sc * 3.6) % (H + 160)) - 80;
    g.fillRect(lx, ly, 2, 56);
  }
  g.globalAlpha = 1;

  // Ben-Day 网点
  if (!pat || patSrc !== bank.halftone) {
    pat = g.createPattern(bank.halftone, "repeat");
    patSrc = bank.halftone;
    if (pat && pat.setTransform && typeof DOMMatrix !== "undefined") {
      pat.setTransform(new DOMMatrix().scale(1 / dpr));
    }
  }
  if (pat) {
    const off = s.bgScroll % bank.tile;
    g.save();
    g.translate(0, off);
    g.fillStyle = pat;
    g.fillRect(0, -bank.tile * 2, W, H + bank.tile * 3);
    g.restore();
  }

  const sx = s.shake > 1 ? (Math.random() - 0.5) * s.shake : 0;
  const sy = s.shake > 1 ? (Math.random() - 0.5) * s.shake : 0;
  g.save();
  g.translate(sx, sy);

  // ── 敌机 ──
  for (let i = 0; i < w.en.n; i++) {
    const e = w.en.items[i];
    blitArt(g, ENEMY_ART[e.kind], bank.enemies[e.kind], e.x, e.y, ENEMY_SIZE[e.kind]);
    if (e.flash > 0) {
      g.globalAlpha = 0.7;
      blitC(g, bank.boom[1], e.x, e.y);
      g.globalAlpha = 1;
    }
    if (e.slow > 0) {
      g.globalAlpha = 0.35;
      blitC(g, bank.boom[0], e.x, e.y);
      g.globalAlpha = 1;
    }
  }

  // ── Boss ──
  const B = s.boss;
  if (B) {
    blitArt(g, "boss_" + B.type, bank.boss[B.type], B.x, B.y, BOSS_SIZE);
    if (B.flash > 0) {
      g.globalAlpha = 0.6;
      blitC(g, bank.boom[1], B.x, B.y);
      g.globalAlpha = 1;
    }
  }

  // ── 玩家 ──
  if (s.phase === "playing" || s.phase === "card" || s.phase === "revive" || s.phase === "countdown") {
    if (s.player.hp > 0) {
      const blink = s.player.invuln > 0 && (s.player.invuln >> 2) % 2 === 0;
      if (!blink) blitArt(g, "player_" + s.ship, bank.player[s.ship], s.player.x, s.player.y, PLAYER_SIZE);
      // 枪口闪光
      if (s.muzzle > 0) {
        g.globalAlpha = Math.min(1, s.muzzle / 4);
        blitC(g, bank.muzzle, s.player.x, s.player.y - 24);
        g.globalAlpha = 1;
      }
      // 僚机：卡片等级决定挂几台，坐标和开火位置共用 WING_X / WING_Y
      const wings = s.cards["wings"] ?? 0;
      for (let k = 1; k <= wings && k < WING_X.length; k++) {
        const off = WING_X[k];
        blitC(g, bank.wingman, s.player.x - off, s.player.y + WING_Y);
        blitC(g, bank.wingman, s.player.x + off, s.player.y + WING_Y);
      }
    }
  }

  // ── 敌弹 ──
  for (let i = 0; i < w.eb.n; i++) {
    const b = w.eb.items[i];
    blitC(g, b.big ? bank.eBulletBig : bank.eBullet, b.x, b.y);
  }

  // ── 玩家子弹 ──
  const pb = bank.pBullet[s.ship];
  const pbb = bank.pBulletBig[s.ship];
  g.fillStyle = PAL.blue;
  for (let i = 0; i < w.pb.n; i++) {
    const b = w.pb.items[i];
    // 僚机子弹用琥珀色菱形，和本机的蓝色区分开
    if (b.wing) {
      blitC(g, bank.pBulletWing, b.x, b.y);
      continue;
    }
    // 拖尾：一条比子弹更长更淡的同色条，给纵向速度感
    g.globalAlpha = 0.35;
    g.fillRect(b.x - 1, b.y + 3, 2, 12);
    g.globalAlpha = 1;
    blitC(g, b.big ? pbb : pb, b.x, b.y);
  }

  // ── 能量碎片 ──
  for (let i = 0; i < w.fr.n; i++) {
    const f = w.fr.items[i];
    blitC(g, f.value >= 25 ? bank.fragBig : bank.frag, f.x, f.y);
  }

  // ── 爆炸粒子 ──
  for (let i = 0; i < w.pt.n; i++) {
    const p = w.pt.items[i];
    blitC(g, bank.boom[Math.min(3, p.t)], p.x, p.y);
  }

  // ── 击破爆炸：一次击杀一朵，5 帧播完后消散 ──
  for (let i = 0; i < w.bl.n; i++) {
    const b = w.bl.items[i];
    const f = Math.min(4, (b.t / 2) | 0);
    blitArt(g, "boom" + f, bank.boom[Math.min(3, f)], b.x, b.y, b.size * (0.75 + f * 0.09));
  }

  // ── 连锁闪电：墨黑描边 + 青色内芯的折线，8 帧内淡出 ──
  for (let i = 0; i < w.z.n; i++) {
    const z = w.z.items[i];
    const dx = z.x2 - z.x1;
    const dy = z.y2 - z.y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    g.globalAlpha = 1 - z.t / 8;
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      g.moveTo(z.x1, z.y1);
      for (let k = 1; k < 5; k++) {
        const t = k / 5;
        const off = Math.sin(z.seed + k * 2.3) * 7;
        g.lineTo(z.x1 + dx * t + nx * off, z.y1 + dy * t + ny * off);
      }
      g.lineTo(z.x2, z.y2);
      g.lineWidth = pass === 0 ? 4 : 2;
      g.strokeStyle = pass === 0 ? PAL.ink : PAL.cyan;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // ── 拟声词 ──
  for (let i = 0; i < w.ft.n; i++) {
    const f = w.ft.items[i];
    const a = f.t < 8 ? f.t / 8 : f.t > f.life - 14 ? (f.life - f.t) / 14 : 1;
    const sp = bank.words[f.sprite];
    if (!sp) continue;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.drawImage(sp.cv, f.x - (sp.w * f.scale) / 2, f.y - (sp.h * f.scale) / 2, sp.w * f.scale, sp.h * f.scale);
    g.globalAlpha = 1;
  }

  g.restore();

  // ── 全屏闪光：爆炸 / 炸弹用纸白，受击用危险红 ──
  if (s.flash > 0) {
    g.globalAlpha = Math.min(0.42, s.flash / 20);
    g.fillStyle = s.flashRed ? PAL.red : PAL.paper;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }

  drawHud(g, bank, w, msAvg);
}

// ═══════════════════════════════════════════════════════════════════
// HUD —— 全部画在画布上，绝不进 React
// ═══════════════════════════════════════════════════════════════════

function drawHud(g: CanvasRenderingContext2D, bank: SpriteBank, w: World, msAvg: number) {
  const s = w.s;
  const showPlay = s.phase !== "menu";

  if (showPlay) {
    // 分数
    label(g, String(s.score).padStart(6, "0"), W - 10, 24, 20, PAL.yellow, "right");
    chip(g, `STAGE ${s.stage} · ${msAvg.toFixed(1)}ms`, W - 10, 44, 10, "right");

    // 生命
    for (let i = 0; i < s.player.maxHp; i++) {
      const x = 12 + i * 20;
      if (i < s.player.hp) blit(g, bank.heart, x, 10);
      else {
        g.globalAlpha = 0.22;
        blit(g, bank.heart, x, 10);
        g.globalAlpha = 1;
      }
    }

    // 复活次数
    if (s.revivesLeft > 0) chip(g, `REVIVE ×${s.revivesLeft}`, 12, 50, 10, "left");

    // 能量条
    const bx = 12;
    const by = H - 24;
    const bw = 132;
    const bh = 12;
    chip(g, `POW Lv${s.weaponLv}`, bx, by - 6, 11, "left");
    g.fillStyle = PAL.paper;
    g.fillRect(bx, by, bw, bh);
    const pct = Math.max(0, Math.min(1, s.energy / s.energyNeed));
    g.fillStyle = PAL.cyan;
    g.fillRect(bx + 2, by + 2, (bw - 4) * pct, bh - 4);
    g.lineWidth = 3;
    g.strokeStyle = PAL.ink;
    g.strokeRect(bx, by, bw, bh);

    // 炸弹
    chip(g, `BOMB ×${s.player.bombs}`, W - 12, by - 6, 12, "right");
    for (let i = 0; i < Math.min(s.player.bombs, 5); i++) {
      const x = W - 20 - i * 16;
      g.fillStyle = PAL.red;
      g.beginPath();
      g.arc(x, by + bh / 2, 5, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = PAL.ink;
      g.stroke();
    }
  }

  // ── Boss 血条 + 属性弱点提示 ──
  const B = s.boss;
  if (B && B.y > 0) {
    const bw = W - 40;
    const bx = 20;
    const by = 54;
    g.fillStyle = PAL.paper;
    g.fillRect(bx, by, bw, 14);
    g.lineWidth = 3;
    g.strokeStyle = PAL.ink;
    g.strokeRect(bx, by, bw, 14);
    const hpw = Math.max(0, (bw - 3) * (B.hp / B.maxHp));
    g.fillStyle = B.phase >= 2 ? PAL.red : B.phase === 1 ? PAL.magenta : PAL.blue;
    g.fillRect(bx + 1.5, by + 1.5, hpw, 11);

    // 弱点 / 抗性徽章：让「属性克制」这件事在屏幕上说得出口
    if (B.weak) {
      blit(g, bank.badge[B.weak], bx - 2, by + 20);
      label(g, "弱点", bx + 18, by + 33, 10, PAL.ink, "left");
    }
    if (B.resist) {
      blit(g, bank.badge[B.resist], bx + 52, by + 20);
      label(g, "抗性", bx + 72, by + 33, 10, PAL.ink, "left");
    }
    label(g, ELEMENT_NAME[B.element], W - 22, by + 33, 11, PAL.ink, "right");
  }

  // ── 关卡公告 ──
  if (s.announceTimer > 0 && s.announce) {
    // 淡入按真实起始帧数算。之前写死 150，导致 3 秒的倒计时公告前 30 帧完全不可见。
    const elapsed = s.announceMax - s.announceTimer;
    const a = Math.min(1, elapsed / 10) * (s.announceTimer < 24 ? s.announceTimer / 24 : 1);
    g.globalAlpha = Math.max(0, a);
    label(g, s.announce, W / 2, H / 2 - 40, 26, PAL.red, "center");
    g.globalAlpha = 1;
  }

  // ── 开局倒计时：3 / 2 / 1，每一秒由大变小、由亮变暗 ──
  if (s.phase === "countdown" && s.countdown > 0) {
    const n = Math.ceil(s.countdown / 60);
    const frac = 1 - (s.countdown % 60) / 60;
    const size = 46 + frac * 30;
    g.globalAlpha = 0.35 + frac * 0.65;
    label(g, String(n), W / 2, H / 2 + size * 0.34, size, PAL.yellow, "center");
    g.globalAlpha = 1;
  }
}
