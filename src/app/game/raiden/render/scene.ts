// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 场景与 HUD 绘制
// 每帧只做 drawImage + 少量 fillRect / fillText。
// 无 shadowBlur、无逐帧路径构建、无逐帧渐变。
// ═══════════════════════════════════════════════════════════════════

import { ELEMENT_NAME, H, PAL, W } from "../engine/config";
import type { World } from "../engine/game";
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
  g.lineWidth = Math.max(3, size * 0.22);
  g.strokeStyle = PAL.ink;
  g.lineJoin = "round";
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
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

  // ── 背景：纸白 + 低对比色带 + Ben-Day 网点 ──
  g.fillStyle = PAL.paper;
  g.fillRect(0, 0, W, H);

  g.globalAlpha = 0.1;
  g.fillStyle = PAL.cyan;
  g.fillRect(0, 90, W, 46);
  g.fillStyle = PAL.yellow;
  g.fillRect(0, 300, W, 34);
  g.fillStyle = PAL.cyan;
  g.fillRect(0, 500, W, 42);
  g.globalAlpha = 1;

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
    blitC(g, bank.enemies[e.kind], e.x, e.y);
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
    blitC(g, bank.boss[B.type], B.x, B.y);
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
      if (!blink) blitC(g, bank.player[s.ship], s.player.x, s.player.y);
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
  for (let i = 0; i < w.pb.n; i++) {
    const b = w.pb.items[i];
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
    label(g, `STAGE ${s.stage}`, W - 10, 38, 10, PAL.ink, "right");

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

    // 能量条
    const bx = 12;
    const by = H - 26;
    const bw = 132;
    const bh = 12;
    g.fillStyle = PAL.paper;
    g.fillRect(bx, by, bw, bh);
    g.lineWidth = 3;
    g.strokeStyle = PAL.ink;
    g.strokeRect(bx, by, bw, bh);
    const pct = Math.max(0, Math.min(1, s.energy / s.energyNeed));
    g.fillStyle = PAL.cyan;
    g.fillRect(bx + 1.5, by + 1.5, (bw - 3) * pct, bh - 3);
    label(g, `POW Lv${s.weaponLv}`, bx, by - 6, 11, PAL.ink, "left");

    // 炸弹
    label(g, `BOMB ×${s.player.bombs}`, W - 12, by - 6, 12, PAL.ink, "right");
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

    // 复活次数
    if (s.revivesLeft > 0) {
      label(g, `REVIVE ×${s.revivesLeft}`, 12, H - 40, 10, PAL.magenta, "left");
    }

    // 帧耗时（低调的实测读数）
    label(g, `${msAvg.toFixed(1)}ms`, W - 12, H - 40, 10, "rgba(16,16,16,0.45)", "right");
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
    const a = s.announceTimer > 130 ? (150 - s.announceTimer) / 20 : s.announceTimer < 30 ? s.announceTimer / 30 : 1;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    label(g, s.announce, W / 2, H / 2 - 40, 26, PAL.red, "center");
    g.globalAlpha = 1;
  }
}
