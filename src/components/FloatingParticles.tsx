"use client";

import { useEffect, useRef } from "react";

// 育儿主题的漂浮元素
const EMOJIS = ["🍼", "🌙", "⭐", "💛", "☁️", "🍭"];

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number; // 上浮速度
  swayAmp: number; // 左右摆动幅度
  swayFreq: number; // 摆动频率
  opacity: number;
  emoji: string;
  phase: number;
}

/**
 * 梦幻漂浮粒子背景层。
 * - 全屏 fixed，pointer-events-none，置于内容之下（z-0）
 * - 轻盈密度，默认 18 个粒子，缓慢上浮 + 正弦摆动 + 越往上越透明
 * - 页面不可见时自动暂停，避免空转耗电
 */
export default function FloatingParticles({
  count = 18,
}: {
  count?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    let w = 0;
    let h = 0;

    const initParticles = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        size: 16 + Math.random() * 30,
        speed: 0.15 + Math.random() * 0.35,
        swayAmp: 8 + Math.random() * 22,
        swayFreq: 0.3 + Math.random() * 0.7,
        opacity: 0.14 + Math.random() * 0.32,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        phase: Math.random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      initParticles();
    };

    let last = performance.now();
    const tick = (now: number) => {
      // 归一化时间步长，保证不同刷新率下速度一致
      const dt = Math.min((now - last) / 16.67, 3);
      last = now;

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.phase += p.swayFreq * 0.02 * dt;
        p.y -= p.speed * dt;
        p.x += Math.sin(p.phase) * p.swayAmp * 0.015 * dt;

        // 越往上越淡，底部淡入
        const fade = Math.max(0, Math.min(1, p.y / (h * 0.7)));
        const alpha = p.opacity * fade;

        // 超出顶部后回收到底部
        if (p.y < -p.size) {
          p.y = h + p.size;
          p.x = Math.random() * w;
        }

        ctx.globalAlpha = alpha;
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
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
