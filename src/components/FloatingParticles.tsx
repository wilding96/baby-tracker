"use client";

import { useEffect, useRef } from "react";

// 白天：暖色育儿元素；夜晚：星空元素
const DAY_EMOJIS = ["🍼", "🌙", "⭐", "💛", "☁️", "🍭"];
const NIGHT_EMOJIS = ["🌙", "✨", "⭐", "🌠", "💫", "🌟"];

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  swayAmp: number;
  swayFreq: number;
  opacity: number;
  emoji: string;
  phase: number;
  vx: number; // 爆开粒子水平速度
  vy: number; // 爆开粒子垂直速度
  life: number; // -1 常驻；>0 爆开粒子剩余生命
}

/**
 * 梦幻漂浮粒子背景层。
 * - 全屏 fixed、pointer-events-none，置于内容之下
 * - 白天/夜晚自动切换元素主题
 * - 点击到粒子会「飘散」成碎片（通过 document 监听，不拦截下层点击）
 */
export default function FloatingParticles({
  count = 18,
}: {
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    // 用户系统开启「减少动效」时直接不渲染粒子，省性能
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 昼夜主题：6:00-18:00 白天，其余夜晚
    const hour = new Date().getHours();
    const emojis = hour >= 6 && hour < 18 ? DAY_EMOJIS : NIGHT_EMOJIS;

    let raf = 0;
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;

    const spawnNormal = (): Particle => ({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 16 + Math.random() * 30,
      speed: 0.15 + Math.random() * 0.35,
      swayAmp: 8 + Math.random() * 22,
      swayFreq: 0.3 + Math.random() * 0.7,
      opacity: 0.14 + Math.random() * 0.32,
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      phase: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
      life: -1,
    });

    const initParticles = () => {
      particles = Array.from({ length: count }, spawnNormal);
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    // 点击到粒子 → 飘散成碎片
    const onPointer = (clientX: number, clientY: number) => {
      let hitIndex = -1;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.life !== -1) continue;
        const dx = p.x - clientX;
        const dy = p.y - clientY;
        if (Math.hypot(dx, dy) < p.size) {
          hitIndex = i;
          break;
        }
      }
      if (hitIndex === -1) return;

      const hit = particles[hitIndex];
      particles.splice(hitIndex, 1);
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.6;
        const speed = 1.2 + Math.random() * 2;
        particles.push({
          x: hit.x,
          y: hit.y,
          size: hit.size * 0.5,
          speed: 0,
          swayAmp: 0,
          swayFreq: 0,
          opacity: 0.8,
          emoji: i % 2 === 0 ? hit.emoji : "✨",
          phase: 0,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 24 + Math.random() * 10,
        });
      }
    };

    const onClick = (e: MouseEvent) => onPointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t) onPointer(t.clientX, t.clientY);
    };

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;

      ctx.clearRect(0, 0, w, h);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.life === -1) {
          // 常驻粒子：上浮 + 摆动
          p.phase += p.swayFreq * 0.02 * dt;
          p.y -= p.speed * dt;
          p.x += Math.sin(p.phase) * p.swayAmp * 0.015 * dt;

          const fade = Math.max(0, Math.min(1, p.y / (h * 0.7)));
          ctx.globalAlpha = p.opacity * fade;

          if (p.y < -p.size) {
            p.y = h + p.size;
            p.x = Math.random() * w;
          }
        } else {
          // 爆开碎片：向外飘 + 衰减消失
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 0.06 * dt; // 轻微下坠
          p.life -= dt;
          ctx.globalAlpha = Math.max(0, p.opacity * (p.life / 30));
          if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
          }
        }

        ctx.font = `${p.size}px serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(p.emoji, p.x, p.y);
      }

      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        start();
      }
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("click", onClick);
    document.addEventListener("touchstart", onTouch, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("click", onClick);
      document.removeEventListener("touchstart", onTouch);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />
  );
}
