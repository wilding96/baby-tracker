// ═══════════════════════════════════════════════════════════════════
// RAIDEN — canvas draw functions (pure: ctx + frameCount + params)
// ═══════════════════════════════════════════════════════════════════

import type { Beam, BossType, Miniboss, Monster, SlashEffect } from "../lib/types";
import { COLORS, GREEN_ORB_R, P } from "../lib/config";
import {
  BOSS_CARRIER, BOSS_EYE_CORE, BOSS_EYE_SPRITE, BOSS_FORTRESS,
  BOMBER, ELITE_SPRITE, FIGHTER, INTERCEPTOR, MINIBOSS_SPRITE,
  PLAYER, PLAYER_WING, PURPLE_WING,
} from "../lib/sprites";
import { drawSprite, drawText } from "../lib/sprite-utils";
import { drawSmartSprite, getSpriteImage } from "../lib/sprite-images";

export function drawPlayerShip(
  ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number, f: number,
) {
  const cx = x + 14, cy = y + 12;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(tilt); ctx.translate(-cx, -cy);

  // Pass 0: strong aura glow behind entire ship
  ctx.save();
  ctx.shadowColor = "#0d9488";
  ctx.shadowBlur = 24;
  const aura = ctx.createRadialGradient(cx, cy, 6, cx, cy, 34);
  aura.addColorStop(0, "rgba(94,234,212,0.25)");
  aura.addColorStop(0.5, "rgba(13,148,136,0.1)");
  aura.addColorStop(1, "rgba(13,148,136,0)");
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(cx, cy, 34, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // thrust flame (3D glow cone + bright core)
  const flameLen = 4 + Math.sin(f * 0.2) * 1.5;
  // outer bloom
  ctx.save();
  ctx.shadowColor = "#f97316";
  ctx.shadowBlur = 20;
  ctx.globalAlpha = 0.4;
  const fg = ctx.createRadialGradient(cx, y + 9*P, 0, cx, y + 9*P, 16);
  fg.addColorStop(0, "rgba(255,237,160,0.5)");
  fg.addColorStop(0.4, "rgba(251,146,60,0.3)");
  fg.addColorStop(1, "rgba(251,146,60,0)");
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(cx, y + 9*P, 16, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // flame core
  ctx.save();
  ctx.shadowColor = "#fef08a";
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.7 + Math.sin(f * 0.2) * 0.3;
  ctx.fillStyle = "#fef08a";
  ctx.fillRect(x + P + 2, y + 8*P, P, (flameLen-2) * P);
  ctx.fillRect(x + 3*P + 2, y + 8*P, P, (flameLen-2) * P);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x + P, y + 6*P, 2*P, flameLen * P);
  ctx.fillRect(x + 3*P, y + 6*P, 2*P, flameLen * P);
  ctx.restore();

  // main hull — sprite + strong edge glow
  ctx.save();
  ctx.shadowColor = "#0d9488";
  ctx.shadowBlur = 14;
  drawSmartSprite(ctx, "player", PLAYER, { h: "#5eead4", b: "#0d9488", s: "#0f766e" }, x, y, P);
  ctx.restore();

  // edge highlight — bright rim light on top and sides
  ctx.save();
  ctx.shadowColor = "#99f6e4";
  ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.25 + Math.sin(f * 0.06) * 0.1;
  const hg = ctx.createLinearGradient(x, y, x, y + 7 * P);
  hg.addColorStop(0, "rgba(255,255,255,0.5)");
  hg.addColorStop(0.3, "rgba(153,246,228,0.1)");
  hg.addColorStop(1, "rgba(15,118,110,0.4)");
  ctx.fillStyle = hg;
  ctx.fillRect(x, y, 7 * P, 7 * P);
  ctx.restore();

  // cockpit specular — bright glint
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(f * 0.07) * 0.2;
  const cg = ctx.createRadialGradient(cx - 2*P, y + P, 0, cx - 2*P, y + P, 5);
  cg.addColorStop(0, "#fff");
  cg.addColorStop(0.4, "rgba(153,246,228,0.6)");
  cg.addColorStop(1, "rgba(153,246,228,0)");
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(cx - 2*P, y + P, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // wings — only draw the pixel wings when there's no 2.5D image (the image already has wings)
  if (!getSpriteImage("player")) {
    drawSprite(ctx, PLAYER_WING, { b: "#d97706" }, x - 2 * P, y + P, P);
    drawSprite(ctx, PLAYER_WING, { b: "#d97706" }, x + 7 * P, y + P, P);
  }
  // wing tips — bright energy glow beams
  ctx.save();
  ctx.shadowColor = "#fbbf24";
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.5 + Math.sin(f * 0.12) * 0.3;
  const wg = ctx.createRadialGradient(x - P, y + 2*P, 0, x - P, y + 2*P, 6);
  wg.addColorStop(0, "rgba(255,251,235,0.7)");
  wg.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = wg;
  ctx.beginPath(); ctx.arc(x - P, y + 2*P, 6, 0, Math.PI * 2); ctx.fill();
  const wg2 = ctx.createRadialGradient(x + 8*P, y + 2*P, 0, x + 8*P, y + 2*P, 6);
  wg2.addColorStop(0, "rgba(255,251,235,0.7)");
  wg2.addColorStop(1, "rgba(251,191,36,0)");
  ctx.fillStyle = wg2;
  ctx.beginPath(); ctx.arc(x + 8*P, y + 2*P, 6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

export function drawMonsterShip(ctx: CanvasRenderingContext2D, m: Monster, x: number, y: number, f: number) {
  const hitFlash = m.flashTimer > 0;
  const flash = f % 8 < 4;
  ctx.save();

  // ── formation marker (pulsing purple aura ring + "POW" indicator) ──
  if (m.formation) {
    const auraPulse = Math.sin(f * 0.08) * 0.3 + 0.7;
    // floating indicator text
    ctx.save();
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.6 + Math.sin(f * 0.1) * 0.3;
    drawText(ctx, "POW", x + 12, y - 4, "#c084fc", 6, "center", 1.5);
    ctx.restore();
    // outer glow ring
    ctx.save();
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 15;
    ctx.globalAlpha = 0.3 * auraPulse;
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x + 12, y + 10, 16 + Math.sin(f * 0.06) * 3, 0, Math.PI * 2); ctx.stroke();
    // rotating dash arc
    ctx.globalAlpha = 0.5 * auraPulse;
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 2;
    const aStart = f * 0.04;
    const aEnd = aStart + 1.5;
    ctx.beginPath(); ctx.arc(x + 12, y + 10, 19 + Math.sin(f * 0.05) * 2, aStart, aEnd); ctx.stroke();
    ctx.restore();
  }

  const mw = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
  const mh = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;

  switch (m.type) {
    case "fighter":
      ctx.shadowColor = "#dc2626";
      ctx.shadowBlur = 10;
      drawSmartSprite(ctx, "fighter", FIGHTER, {
        h: flash ? "#fca5a5" : "#f87171",
        b: flash ? "#ef4444" : "#dc2626",
        s: flash ? "#b91c1c" : "#991b1b",
      }, x, y, P);
      // 3D highlight
      ctx.globalAlpha = 0.2;
      const fg = ctx.createLinearGradient(x, y, x, y + mh);
      fg.addColorStop(0, "rgba(255,255,255,0.3)");
      fg.addColorStop(0.5, "rgba(255,255,255,0)");
      fg.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, mw, mh);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      break;
    case "bomber":
      ctx.shadowColor = "#7c3aed";
      ctx.shadowBlur = 12;
      drawSmartSprite(ctx, "bomber", BOMBER, {
        h: flash ? "#e9d5ff" : "#c084fc",
        b: flash ? "#a855f7" : "#7c3aed",
        s: flash ? "#6b21a8" : "#581c87",
      }, x, y, P);
      ctx.globalAlpha = 0.2;
      const bg = ctx.createLinearGradient(x, y, x, y + mh);
      bg.addColorStop(0, "rgba(255,255,255,0.25)");
      bg.addColorStop(0.4, "rgba(255,255,255,0)");
      bg.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, mw, mh);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      break;
    case "interceptor":
      ctx.shadowColor = "#ec4899";
      ctx.shadowBlur = 10;
      drawSmartSprite(ctx, "interceptor", INTERCEPTOR, {
        h: flash ? "#fbcfe8" : "#f472b6",
        b: flash ? "#ec4899" : "#db2777",
        s: flash ? "#a21caf" : "#86198f",
      }, x, y, P);
      ctx.globalAlpha = 0.2;
      const ig = ctx.createLinearGradient(x, y, x, y + mh);
      ig.addColorStop(0, "rgba(255,255,255,0.25)");
      ig.addColorStop(0.4, "rgba(255,255,255,0)");
      ig.addColorStop(1, "rgba(0,0,0,0.2)");
      ctx.fillStyle = ig;
      ctx.fillRect(x, y, mw, mh);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      break;
    case "elite":
      ctx.shadowColor = "#eab308";
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.85 + Math.sin(f * 0.15) * 0.15;
      drawSmartSprite(ctx, "elite", ELITE_SPRITE, {
        h: flash ? "#fef08a" : "#facc15",
        b: flash ? "#eab308" : "#ca8a04",
        s: flash ? "#a16207" : "#854d0e",
      }, x, y, P);
      ctx.globalAlpha = 1;
      // 3D overlay
      ctx.globalAlpha = 0.15;
      const eg = ctx.createLinearGradient(x, y, x, y + mh);
      eg.addColorStop(0, "rgba(255,255,255,0.3)");
      eg.addColorStop(0.3, "rgba(255,255,255,0)");
      eg.addColorStop(1, "rgba(0,0,0,0.25)");
      ctx.fillStyle = eg;
      ctx.fillRect(x, y, mw, mh);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      break;
  }
  ctx.restore();
  // hit flash overlay — soft white glow instead of a hard block
  if (hitFlash) {
    const mw2 = m.type === "bomber" ? 28 : m.type === "elite" ? 44 : 24;
    const mh2 = m.type === "interceptor" ? 24 : m.type === "elite" ? 36 : 20;
    const fx = x + mw2 / 2, fy = y + mh2 / 2;
    const fr = Math.max(mw2, mh2) * 1.6;
    ctx.save();
    ctx.globalAlpha = 0.85;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    fg.addColorStop(0, "rgba(255,255,255,0.95)");
    fg.addColorStop(0.5, "rgba(255,255,255,0.5)");
    fg.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = fg;
    ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
    ctx.restore();
  }
}

export function drawBossShip(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  hp: number, maxHp: number, type: BossType, f: number,
) {
  const flash = f % 10 < 5;

  // boss aura with bloom
  ctx.save();
  ctx.globalAlpha = 0.1;
  const auraColor = type === "fortress" ? "#ef4444" : type === "carrier" ? "#a855f7" : "#22d3ee";
  ctx.shadowColor = auraColor;
  ctx.shadowBlur = 30;
  ctx.fillStyle = auraColor;
  ctx.beginPath(); ctx.arc(x + 22, y + 18, 38 + Math.sin(f * 0.04) * 4, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  ctx.save();
  ctx.shadowBlur = 8;
  if (type === "fortress") {
    ctx.shadowColor = "#ef4444";
    drawSmartSprite(ctx, "boss_fortress", BOSS_FORTRESS, {
      h: flash ? "#fca5a5" : "#ef4444",
      b: flash ? "#dc2626" : "#b91c1c",
      s: flash ? "#991b1b" : "#7f1d1d",
    }, x, y, P);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6 + Math.sin(f * 0.1) * 0.4;
    ctx.fillStyle = "#facc15";
    ctx.fillRect(x + 6 * P, y + 2 * P, P, P);
    ctx.fillRect(x + 15 * P, y + 2 * P, P, P);
    ctx.fillRect(x + 6 * P, y + 6 * P, P, P);
    ctx.fillRect(x + 15 * P, y + 6 * P, P, P);
    ctx.globalAlpha = 1;
  } else if (type === "carrier") {
    ctx.shadowColor = "#a855f7";
    drawSmartSprite(ctx, "boss_carrier", BOSS_CARRIER, {
      h: flash ? "#e9d5ff" : "#a855f7",
      b: flash ? "#8b5cf6" : "#6b21a8",
      s: flash ? "#6b21a8" : "#581c87",
    }, x, y, P);
    ctx.shadowBlur = 0;
    ctx.fillStyle = flash ? "#fef08a" : "#eab308";
    ctx.fillRect(x + 5 * P, y + 4 * P, P, P);
    ctx.fillRect(x + 7 * P, y + 4 * P, P, P);
    ctx.fillRect(x + 9 * P, y + 4 * P, P, P);
  } else {
    ctx.shadowColor = "#22d3ee";
    drawSmartSprite(ctx, "boss_eye", BOSS_EYE_SPRITE, {
      h: flash ? "#cffafe" : "#22d3ee",
      b: flash ? "#06b6d4" : "#0891b2",
      s: flash ? "#0e7490" : "#155e75",
    }, x, y, P);
    ctx.shadowBlur = 0;
    const pulse = Math.sin(f * 0.08) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    drawSprite(ctx, BOSS_EYE_CORE, { h: "#fef08a" }, x + 4 * P, y + 4 * P, P);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ef4444";
    const pupilOff = Math.sin(f * 0.06) * 2;
    ctx.fillRect(x + 6 * P, y + 5 * P + pupilOff, 2 * P, P);
    ctx.fillRect(x + 6 * P, y + 2 * P + pupilOff, 2 * P, P);
  }
  ctx.restore();

  const barW = type === "fortress" ? 22 * P : 12 * P;
  const bp = type === "fortress" ? x : x + 2 * P;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(bp, y - P, barW, 4);
  ctx.fillStyle = "#22c55e";
  ctx.fillRect(bp, y - P, barW * (hp / maxHp), 4);
  ctx.fillStyle = "#86efac";
  ctx.fillRect(bp, y - P, barW * (hp / maxHp), 2);
}

export function drawMinibossShip(ctx: CanvasRenderingContext2D, mb: Miniboss, x: number, y: number, f: number) {
  const flash = f % 8 < 4;

  // entrance animation: alpha ramp and vertical bounce
  const animProgress = mb.enterAnim > 0 ? Math.max(0, 1 - mb.enterAnim / 60) : 1;
  const enterBounce = mb.enterAnim > 0 ? -Math.sin((60 - mb.enterAnim) * 0.12) * 10 : 0;

  ctx.save();
  ctx.globalAlpha = animProgress;
  // 3D glow aura
  ctx.shadowColor = "#f97316";
  ctx.shadowBlur = 20;
  const ma = ctx.createRadialGradient(x + 26, y + 20, 0, x + 26, y + 20, 36);
  ma.addColorStop(0, "rgba(249,115,22,0.15)");
  ma.addColorStop(1, "rgba(249,115,22,0)");
  ctx.fillStyle = ma;
  ctx.beginPath(); ctx.arc(x + 26, y + 20, 36, 0, Math.PI * 2); ctx.fill();

  drawSmartSprite(ctx, "miniboss", MINIBOSS_SPRITE, {
    h: flash ? "#fdba74" : "#f97316",
    b: flash ? "#f97316" : "#ea580c",
    s: flash ? "#ea580c" : "#c2410c",
  }, x, y + enterBounce, P);

  // 3D top highlight
  ctx.globalAlpha = 0.2 * animProgress;
  const mg = ctx.createLinearGradient(x, y + enterBounce, x, y + enterBounce + 40);
  mg.addColorStop(0, "rgba(255,255,255,0.3)");
  mg.addColorStop(0.3, "rgba(255,255,255,0)");
  mg.addColorStop(1, "rgba(0,0,0,0.2)");
  ctx.fillStyle = mg;
  ctx.fillRect(x, y + enterBounce, 52, 40);
  ctx.globalAlpha = animProgress;

  ctx.shadowBlur = 0;
  ctx.globalAlpha = animProgress;
  ctx.fillStyle = flash ? "#fef08a" : "#fbbf24";
  ctx.fillRect(x + 3 * P, y + 2 * P + enterBounce, P, P);
  ctx.fillRect(x + 8 * P, y + 2 * P + enterBounce, P, P);
  ctx.fillRect(x + 3 * P, y + 6 * P + enterBounce, P, P);
  ctx.fillRect(x + 8 * P, y + 6 * P + enterBounce, P, P);
  ctx.globalAlpha = 1;
  ctx.restore();

  // HP bar below
  const barW = 14 * P;
  const bp = x + P;
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(bp, y + 10 * P, barW, 3);
  ctx.fillStyle = "#f97316";
  ctx.fillRect(bp, y + 10 * P, barW * (mb.hp / mb.maxHp), 3);
}

export function drawShield(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  const cx = x + 14, cy = y + 12;
  const pulse = 0.7 + Math.sin(f * 0.06) * 0.3;

  ctx.save();
  ctx.shadowColor = "#38bdf8";
  ctx.shadowBlur = 15;
  ctx.globalAlpha = 0.15 * pulse;
  const og = ctx.createRadialGradient(cx, cy, 20, cx, cy, 38);
  og.addColorStop(0, "rgba(56,189,248,0)");
  og.addColorStop(0.5, "rgba(56,189,248,0.3)");
  og.addColorStop(1, "rgba(56,189,248,0)");
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(cx, cy, 38, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 0.35 * pulse;
  ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 22 + Math.sin(f * 0.05) * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.2 * pulse;
  ctx.strokeStyle = "#7dd3fc"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 30 + Math.sin(f * 0.05 + 1) * 2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function drawMissileSprite(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  ctx.save();
  ctx.shadowColor = "#f97316";
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x, y, 3, 8);
  ctx.fillStyle = "#fef08a";
  ctx.fillRect(x, y, 3, 3);
  ctx.shadowBlur = 0;
  if (f % 4 < 2) {
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(x, y + 8, 3, 4);
  }
  ctx.restore();
}

export function drawWingmanSatellite(ctx: CanvasRenderingContext2D, x: number, y: number, f: number, color: string, isLightning: boolean) {
  ctx.save();
  const pulse = 0.85 + Math.sin(f * 0.15 + x) * 0.15;
  // outer glow
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.3 * pulse;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x + 6, y + 6, 9, 0, Math.PI * 2); ctx.fill();
  // main body — small diamond drone
  ctx.shadowBlur = 8;
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + 6, y);
  ctx.lineTo(x + 12, y + 6);
  ctx.lineTo(x + 6, y + 12);
  ctx.lineTo(x, y + 6);
  ctx.closePath();
  ctx.fill();
  // inner core
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(x + 6, y + 6, 2.5, 0, Math.PI * 2); ctx.fill();
  // engine trail for lightning variants
  if (isLightning) {
    ctx.globalAlpha = 0.4 + Math.sin(f * 0.3 + x) * 0.2;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + 6, y + 10, 2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawGreenOption(ctx: CanvasRenderingContext2D, x: number, y: number, f: number) {
  const cx = x + 8, cy = y + 8;
  ctx.save();
  // outer glow
  ctx.shadowColor = "#4ade80";
  ctx.shadowBlur = 24;
  ctx.globalAlpha = 0.3 + Math.sin(f * 0.1) * 0.1;
  const og = ctx.createRadialGradient(cx, cy, 2, cx, cy, GREEN_ORB_R + 6);
  og.addColorStop(0, "rgba(74,222,128,0.4)");
  og.addColorStop(1, "rgba(74,222,128,0)");
  ctx.fillStyle = og;
  ctx.beginPath(); ctx.arc(cx, cy, GREEN_ORB_R + 6, 0, Math.PI * 2); ctx.fill();
  // main orb (radial gradient)
  ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.95;
  const g = ctx.createRadialGradient(cx - 2, cy - 2, 0, cx, cy, GREEN_ORB_R);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.2, "#86efac");
  g.addColorStop(0.5, "#4ade80");
  g.addColorStop(0.8, "#22c55e");
  g.addColorStop(1, "#166534");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, GREEN_ORB_R, 0, Math.PI * 2); ctx.fill();
  // specular highlight
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(cx - 2, cy - 3, 2.5, 0, Math.PI * 2); ctx.fill();
  // inner energy ring
  ctx.globalAlpha = 0.4 + Math.sin(f * 0.12) * 0.2;
  ctx.strokeStyle = "#86efac";
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, 4 + Math.sin(f * 0.08) * 1, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

export function drawPurpleWingOption(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, f: number) {
  const alpha = progress; // 0→1 during transformation
  const pulse = 0.85 + Math.sin(f * 0.12) * 0.15;
  ctx.save();
  ctx.globalAlpha = alpha;
  // wing aura glow
  ctx.shadowColor = "#a855f7";
  ctx.shadowBlur = 20;
  ctx.globalAlpha = 0.2 * pulse * alpha;
  const ag = ctx.createRadialGradient(x + 8, y + 8, 0, x + 8, y + 8, 18);
  ag.addColorStop(0, "rgba(168,85,247,0.4)");
  ag.addColorStop(1, "rgba(168,85,247,0)");
  ctx.fillStyle = ag;
  ctx.beginPath(); ctx.arc(x + 8, y + 8, 18, 0, Math.PI * 2); ctx.fill();
  // main wing sprite
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 0.9 * pulse * alpha;
  drawSprite(ctx, PURPLE_WING, { p: "#c084fc", s: "#581c87" }, x, y, 2);
  // purple energy sparkles
  ctx.shadowBlur = 0;
  ctx.globalAlpha = (0.5 + Math.sin(f * 0.15 + x) * 0.3) * alpha;
  ctx.fillStyle = "#d8b4fe";
  ctx.beginPath(); ctx.arc(x + 4 + Math.sin(f * 0.09) * 2, y + 4 + Math.cos(f * 0.11) * 2, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e9d5ff";
  ctx.beginPath(); ctx.arc(x + 10 + Math.sin(f * 0.13 + 1) * 2, y + 2 + Math.cos(f * 0.07 + 1) * 2, 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#a855f7";
  ctx.beginPath(); ctx.arc(x + 7 + Math.sin(f * 0.1 + 2) * 2.5, y + 12 + Math.cos(f * 0.09 + 2) * 1.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function drawSlashEffect(ctx: CanvasRenderingContext2D, se: SlashEffect) {
  const progress = 1 - se.timer / se.maxTimer; // 0→1
  const r = se.radius * progress;
  const a = se.alpha * (1 - progress);
  ctx.save();
  // outer glow
  ctx.shadowColor = "#fff";
  ctx.shadowBlur = 30;
  ctx.globalAlpha = a * 0.4;
  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.beginPath();
  ctx.arc(se.x, se.y, r + 10, -Math.PI * 0.85, Math.PI * 0.85);
  ctx.fill();
  // main crescent
  ctx.shadowBlur = 20;
  ctx.globalAlpha = a * 0.8;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.beginPath();
  ctx.arc(se.x, se.y, r, -Math.PI * 0.8, Math.PI * 0.8);
  ctx.fill();
  // bright inner arc
  ctx.shadowBlur = 14;
  ctx.globalAlpha = a;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(se.x, se.y, r * 0.6, -Math.PI * 0.7, Math.PI * 0.7);
  ctx.stroke();
  // white line slash
  ctx.globalAlpha = a * 0.9;
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(se.x, se.y, r * 0.4, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.stroke();
  ctx.restore();
}

export function drawBeam(ctx: CanvasRenderingContext2D, beam: Beam, f: number) {
  const dx = Math.cos(beam.angle), dy = Math.sin(beam.angle);
  const ex = beam.x + dx * beam.length, ey = beam.y + dy * beam.length;
  ctx.save();
  if (beam.state === "charging") {
    // 蓄力：虚线预警 + 炮口能量球
    const pulse = 0.35 + Math.sin(f * 0.35) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = "#ff7070";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    const r = 6 + Math.sin(f * 0.4) * 3;
    const og = ctx.createRadialGradient(beam.x, beam.y, 0, beam.x, beam.y, r + 8);
    og.addColorStop(0, "#fff");
    og.addColorStop(0.4, "#ff8080");
    og.addColorStop(1, "rgba(255,64,64,0)");
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(beam.x, beam.y, r + 8, 0, Math.PI * 2); ctx.fill();
  } else {
    // 发射：多层光束 + 光晕
    ctx.lineCap = "round";
    ctx.shadowColor = "#ff2020";
    ctx.shadowBlur = 30;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#ff2020";
    ctx.lineWidth = beam.width * 2.2;
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = "#ff6060";
    ctx.lineWidth = beam.width;
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = beam.width * 0.35;
    ctx.beginPath(); ctx.moveTo(beam.x, beam.y); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.restore();
}
