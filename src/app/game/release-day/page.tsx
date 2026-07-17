"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

// ─── SVG 手绘滤镜 ───
function RoughPaperFilter() {
  return (
    <svg style={{ display: "none" }}>
      <defs>
        <filter id="rough-paper" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

// ─── Canvas 粒子 ───
function triggerParticleBurst(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  canvas.width = parent.clientWidth;
  canvas.height = parent.clientHeight;
  const colors = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#F999B7"];
  const ps: { x: number; y: number; r: number; c: string; vx: number; vy: number; a: number; d: number }[] = [];
  const sx = canvas.width / 2, sy = canvas.height / 2;
  for (let i = 0; i < 150; i++) {
    ps.push({
      x: sx, y: sy, r: Math.random() * 6 + 2, c: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, a: 1, d: Math.random() * 0.015 + 0.005,
    });
  }
  function anim() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let al = false;
    for (const p of ps) {
      if (p.a <= 0) continue;
      al = true; p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.a -= p.d;
      ctx.save(); ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (al) requestAnimationFrame(anim);
  }
  anim();
}

const STAGE_NAMES: Record<number, string> = {
  1: "搬砖打工人下班中", 2: "神圣预告降临", 3: "秘密基地的连线", 4: "多巴胺自我救赎完成",
};

export default function ReleaseDayGame() {
  const [stage, setStage] = useState(1);
  const [walkCycle, setWalkCycle] = useState(0);
  const [walkDistance, setWalkDistance] = useState(0);
  const [dopamine, setDopamine] = useState(10);
  const [fadeIn, setFadeIn] = useState("opacity-100");

  const [controllerConnected, setControllerConnected] = useState(false);
  const [gameBooted, setGameBooted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [controllerOffset, setControllerOffset] = useState({ dx: 0, dy: 0 });
  const dragStartPos = useRef({ cx: 0, cy: 0, dx: 0, dy: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const portRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // 禁用滚动
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("wheel", prevent, { passive: false });
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      document.removeEventListener("wheel", prevent);
      document.removeEventListener("touchmove", prevent);
    };
  }, []);

  const bgScroll = walkDistance * 5;

  const bodyPos = useMemo(() => ({
    head: { x: 65, y: 40 } as const,
    neck: { x: 65, y: 55 } as const,
    hip: { x: 65, y: 95 } as const,
  }), []);

  const legAngles = useMemo(() => {
    const a = Math.sin(walkCycle * 1.2) * 20;
    const b = Math.sin((walkCycle + Math.PI) * 1.2) * 20;
    const hx = bodyPos.hip.x, hy = bodyPos.hip.y;
    const lk = { x: hx + Math.sin(((a - 10) * Math.PI) / 180) * 18, y: hy + Math.cos(((a - 10) * Math.PI) / 180) * 18 };
    const lf = { x: lk.x + Math.sin(((a + 10) * Math.PI) / 180) * 18, y: 130 };
    const rk = { x: hx + Math.sin(((b - 10) * Math.PI) / 180) * 18, y: hy + Math.cos(((b - 10) * Math.PI) / 180) * 18 };
    const rf = { x: rk.x + Math.sin(((b + 10) * Math.PI) / 180) * 18, y: 130 };
    return { leftLeg: { knee: lk, foot: lf }, rightLeg: { knee: rk, foot: rf } };
  }, [walkCycle, bodyPos]);

  const transitionTo = useCallback((s: number, d: number) => {
    setFadeIn("opacity-0 scale-95");
    setTimeout(() => { setStage(s); setDopamine(d); requestAnimationFrame(() => setFadeIn("opacity-100 scale-100")); }, 80);
  }, []);

  const heavySigh = () => {
    setWalkCycle((v) => v + 1);
    setWalkDistance((v) => Math.min(v + 12, 96));
    setDopamine((v) => Math.min(v + 6, 40));
  };
  const atDest = walkDistance >= 96;

  // ─── 拖拽 ───
  const startDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (gameBooted || controllerConnected) return;
    setIsDragging(true);
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartPos.current = { cx, cy, dx: controllerOffset.dx, dy: controllerOffset.dy };
  }, [gameBooted, controllerConnected, controllerOffset]);

  useEffect(() => {
    if (!isDragging) return;
    const mv = (e: MouseEvent | TouchEvent) => {
      const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
      const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
      setControllerOffset({ dx: dragStartPos.current.dx + (cx - dragStartPos.current.cx), dy: dragStartPos.current.dy + (cy - dragStartPos.current.cy) });
    };
    const up = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up);
      document.removeEventListener("touchmove", mv); document.removeEventListener("touchend", up);
    };
    document.addEventListener("mousemove", mv); document.addEventListener("mouseup", up);
    document.addEventListener("touchmove", mv, { passive: true }); document.addEventListener("touchend", up);
    return () => { document.removeEventListener("mousemove", mv); document.removeEventListener("mouseup", up); document.removeEventListener("touchmove", mv); document.removeEventListener("touchend", up); };
  }, [isDragging]);

  const checkCollision = useCallback(() => {
    const port = portRef.current;
    const ctrl = document.getElementById("game-controller");
    if (!port || !ctrl) return;
    const pr = port.getBoundingClientRect();
    const cr = ctrl.getBoundingClientRect();
    const dx = (cr.left + cr.width / 2) - (pr.left + pr.width / 2);
    const dy = (cr.top + cr.height / 2) - (pr.top + pr.height / 2);
    if (Math.abs(dx) < 45 && Math.abs(dy) < 50) {
      setControllerConnected(true); setIsDragging(false); setControllerOffset({ dx: 0, dy: 0 });
    }
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const id = requestAnimationFrame(() => checkCollision());
    return () => cancelAnimationFrame(id);
  }, [isDragging, controllerOffset, checkCollision]);

  const bootSystem = () => {
    setGameBooted(true); setDopamine(100);
    setTimeout(() => { if (canvasRef.current) triggerParticleBurst(canvasRef.current); }, 50);
    setTimeout(() => transitionTo(4, 100), 2500);
  };

  const restart = () => {
    setFadeIn("opacity-0 scale-95");
    setTimeout(() => {
      setStage(1); setWalkCycle(0); setWalkDistance(0); setDopamine(10);
      setControllerConnected(false); setGameBooted(false); setControllerOffset({ dx: 0, dy: 0 });
      requestAnimationFrame(() => setFadeIn("opacity-100 scale-100"));
    }, 100);
  };

  // 人物颜色（亮色系，在暗背景下醒目）
  const CHAR_COLOR = "#FFD93D";     // 金黄色躯干
  const CHAR_OUTLINE = "#1a1a2e";   // 深色轮廓
  const HEAD_COLOR = "#FFE8D6";     // 肤色脑袋
  const SHIRT_COLOR = "#6BCB77";    // 亮绿衣服

  return (
    <>
      <RoughPaperFilter />
      <style>{`
        html, body { overflow: hidden !important; height: 100%; overscroll-behavior: none; }
        body {
          background-color: #FAF6ED;
          background-image: radial-gradient(#E8DCC4 1px, transparent 1px), linear-gradient(#F5EAD2 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .pixel-title { font-family: 'ZCOOL KuaiLe', 'Courier New', monospace; }
        @keyframes shiver-slow {
          0% { transform: translate(0, 0) rotate(0deg); }
          25% { transform: translate(-1px, 1px) rotate(-0.3deg); }
          50% { transform: translate(0, 0) rotate(0deg); }
          75% { transform: translate(1px, -1px) rotate(0.3deg); }
          100% { transform: translate(0, 0) rotate(0deg); }
        }
        .shivering { animation: shiver-slow 1.2s ease-in-out infinite; }
        .sketch-border {
          border: 3px solid #2C3E50;
          border-radius: 255px 15px 225px 15px/15px 225px 15px 255px;
        }
        .sketch-fill {
          background: repeating-linear-gradient(45deg, #FF6B6B, #FF6B6B 10px, #FF8E8E 10px, #FF8E8E 20px);
        }
        @keyframes buzz-slow {
          0%, 90%, 100% { transform: translate(0, 0) rotate(0deg); }
          91% { transform: translate(-1px, 0.5px) rotate(-0.5deg); }
          93% { transform: translate(1px, -0.5px) rotate(0.5deg); }
          95% { transform: translate(-0.5px, -0.5px) rotate(-0.3deg); }
          97% { transform: translate(0.5px, 1px) rotate(0.3deg); }
          99% { transform: translate(0, 0) rotate(0deg); }
        }
        .vibrate { animation: buzz-slow 3s ease-in-out infinite; }
      `}</style>

      <main className="min-h-screen flex items-center justify-center p-3 select-none" style={{ height: "100dvh", overflow: "hidden" }}>
        <div ref={appRef} className="w-full max-w-4xl bg-[#FFFDF9] sketch-border p-4 sm:p-8 shadow-xl relative overflow-hidden flex flex-col justify-between"
          style={{ minHeight: "min(600px, 90dvh)", maxHeight: "90dvh", filter: "url(#rough-paper)" }}>
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

          {/* 顶部 */}
          <div className="flex justify-between items-center border-b-2 border-[#2C3E50] pb-3 mb-3">
            <div className="flex items-center gap-3">
              <Link href="/discover" className="text-xs text-[#5D6D7E] hover:text-[#2C3E50] transition-colors flex items-center gap-1 shrink-0">
                &larr; 返回
              </Link>
              <div>
                <h1 className="text-xl sm:text-3xl font-bold text-[#2C3E50] pixel-title">
                  下班发售日 <span className="text-xs sm:text-sm font-normal text-gray-500">v0.1.0</span>
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">给内心那个晕3D的网瘾少年</p>
              </div>
            </div>
            <div className="w-36 sm:w-48">
              <div className="flex justify-between text-xs font-semibold text-[#2C3E50] mb-1">
                <span>认知电量</span><span>{Math.round(dopamine)}%</span>
              </div>
              <div className="h-5 w-full bg-transparent border-2 border-[#2C3E50] rounded p-0.5 overflow-hidden">
                <div className="h-full sketch-fill rounded-sm transition-all duration-500" style={{ width: dopamine + "%" }} />
              </div>
            </div>
          </div>

          {/* 场景区 */}
          <div className="flex-grow flex flex-col justify-center items-center py-2 min-h-0 overflow-y-auto">
            <div className={`w-full transition-all duration-300 ${fadeIn}`}>

              {/* ═══════ 第一幕 ═══════ */}
              {stage === 1 && (
                <div className="w-full flex flex-col items-center">
                  <p className="text-sm sm:text-lg text-[#5D6D7E] italic mb-3 text-center leading-relaxed">
                    &ldquo;天黑了，刚写完一堆狗屁架构代码。脑子嗡嗡响，感觉世界在天旋地转...&rdquo;
                  </p>
                  <div className="w-full max-w-xs rounded-2xl sketch-border border-dashed flex items-center justify-center relative overflow-hidden"
                    style={{ height: 180, background: "linear-gradient(180deg, #1a1a2e 0%, #2d3561 30%, #e07a5f 60%, #f4a261 80%, #2C3E50 100%)" }}>
                    {/* 月亮 */}
                    <div className="absolute top-2 right-6 w-7 h-7 rounded-full bg-[#ffd93d]/90 shadow-[0_0_16px_6px_rgba(255,217,61,0.3)]" />

                    {/* 背景滚动 —— 建筑 + 树 */}
                    <div className="absolute inset-x-0 bottom-6">
                      <div className="flex transition-transform duration-[400ms] ease-out items-end" style={{ transform: `translateX(${-bgScroll}px)` }}>
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div key={`s-${i}`} className="flex-shrink-0 flex items-end gap-1" style={{ minWidth: 72 }}>
                            <svg width="24" height={35 + (i % 3) * 12} viewBox={`0 0 24 ${35 + (i % 3) * 12}`}>
                              <rect x="0" y="0" width="24" height={35 + (i % 3) * 12} fill={i % 2 === 0 ? "#3a3045" : "#2a2540"} stroke="#2C3E50" strokeWidth="1.5" />
                              <rect x="3" y="4" width="3" height="4" fill="#ffd93d" opacity="0.6" />
                              <rect x={24 - 7} y="4" width="3" height="4" fill="#ffd93d" opacity="0.6" />
                              <rect x="3" y="15" width="3" height="4" fill="#ffd93d" opacity="0.6" />
                              <rect x={24 - 7} y="15" width="3" height="4" fill="#ffd93d" opacity="0.6" />
                            </svg>
                            <svg width="18" height={24 + (i % 2) * 6} viewBox={`0 0 18 ${24 + (i % 2) * 6}`} style={{ marginBottom: -2 }}>
                              <rect x="7" y={14 + (i % 2) * 6} width="4" height="10" fill="#5c3d2e" />
                              <circle cx="9" cy={8 + (i % 2) * 2} r="8" fill="#2d5a27" stroke="#1e3d1a" strokeWidth="1.5" />
                              <circle cx="4" cy={12 + (i % 2) * 3} r="5" fill="#234820" />
                              <circle cx="14" cy={12 + (i % 2) * 3} r="5" fill="#234820" />
                            </svg>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 地面 */}
                    <div className="absolute bottom-0 inset-x-0 h-8 bg-[#2a372a] border-t-2 border-[#2C3E50]">
                      <div className="flex transition-transform duration-[400ms] ease-out" style={{ transform: `translateX(${-bgScroll}px)` }}>
                        {Array.from({ length: 30 }).map((_, i) => (
                          <div key={`g-${i}`} className="flex-shrink-0" style={{ width: 40 }}><div className="h-8 border-r border-[#1e2e1e]/30" /></div>
                        ))}
                      </div>
                    </div>

                    {/* 人物（亮色） */}
                    <div className="absolute bottom-4 z-10">
                      <svg width="120" height="90" viewBox="0 0 130 150" className="overflow-visible">
                        <g transform="scale(-1, 1) translate(-130, 0)">
                          {/* 躯干 */}
                          <line x1={bodyPos.hip.x} y1={bodyPos.hip.y} x2={bodyPos.neck.x} y2={bodyPos.neck.y} stroke={CHAR_OUTLINE} strokeWidth="5" strokeLinecap="round" />
                          <line x1={bodyPos.hip.x} y1={bodyPos.hip.y} x2={bodyPos.neck.x} y2={bodyPos.neck.y} stroke={SHIRT_COLOR} strokeWidth="3" strokeLinecap="round" />
                          {/* 脑袋 */}
                          <circle cx={bodyPos.head.x} cy={bodyPos.head.y} r="14" fill={HEAD_COLOR} stroke={CHAR_OUTLINE} strokeWidth="4" />
                          {/* 死鱼眼 */}
                          <line x1={bodyPos.head.x - 5} y1={bodyPos.head.y - 2} x2={bodyPos.head.x - 3} y2={bodyPos.head.y + 2} stroke={CHAR_OUTLINE} strokeWidth="2" />
                          <line x1={bodyPos.head.x + 1} y1={bodyPos.head.y + 2} x2={bodyPos.head.x + 3} y2={bodyPos.head.y - 2} stroke={CHAR_OUTLINE} strokeWidth="2" />
                          <line x1={bodyPos.head.x - 4} y1={bodyPos.head.y + 6} x2={bodyPos.head.x + 4} y2={bodyPos.head.y + 6} stroke={CHAR_OUTLINE} strokeWidth="2" />
                          {/* 腿 */}
                          <line x1={bodyPos.hip.x} y1={bodyPos.hip.y} x2={legAngles.leftLeg.knee.x} y2={legAngles.leftLeg.knee.y} stroke={CHAR_COLOR} strokeWidth="4" strokeLinecap="round" />
                          <line x1={legAngles.leftLeg.knee.x} y1={legAngles.leftLeg.knee.y} x2={legAngles.leftLeg.foot.x} y2={legAngles.leftLeg.foot.y} stroke={CHAR_COLOR} strokeWidth="4" strokeLinecap="round" />
                          <line x1={bodyPos.hip.x} y1={bodyPos.hip.y} x2={legAngles.rightLeg.knee.x} y2={legAngles.rightLeg.knee.y} stroke={CHAR_COLOR} strokeWidth="4" strokeLinecap="round" />
                          <line x1={legAngles.rightLeg.knee.x} y1={legAngles.rightLeg.knee.y} x2={legAngles.rightLeg.foot.x} y2={legAngles.rightLeg.foot.y} stroke={CHAR_COLOR} strokeWidth="4" strokeLinecap="round" />
                          {/* 手臂 */}
                          <line x1={bodyPos.neck.x} y1={bodyPos.neck.y} x2={bodyPos.neck.x + 5} y2={bodyPos.neck.y + 22} stroke={CHAR_COLOR} strokeWidth="3.5" strokeLinecap="round" />
                        </g>
                      </svg>
                      {walkCycle % 2 === 0 && !atDest && (
                        <span className="absolute -top-4 left-16 text-[10px] bg-white border border-[#2C3E50] rounded-full px-2 py-0.5 shivering whitespace-nowrap">唉... (叹气)</span>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center">
                    {!atDest ? (
                      <>
                        <button onClick={heavySigh} className="px-6 py-2.5 sm:px-8 sm:py-3 bg-[#FFF] text-[#2C3E50] font-bold text-base sm:text-lg sketch-border hover:bg-[#F5EAD2] active:scale-95 transition-all shivering">
                          💨 叹一口沉重的粗气 (迈步)
                        </button>
                        <p className="text-xs text-gray-400 mt-2">多叹几次气，离家就更近一步</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-[#FF6B6B] mb-3 animate-pulse">📱 口袋里的手机震个不停...</p>
                        <button onClick={() => transitionTo(2, 45)} className="px-6 py-2.5 sm:px-8 sm:py-3 bg-[#FF6B6B] text-white font-bold text-base sm:text-lg sketch-border hover:bg-[#FF4F4F] active:scale-95 transition-all shadow-lg shivering">
                          📱 查看手机
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════ 第二幕 ═══════ */}
              {stage === 2 && (
                <div className="w-full flex flex-col items-center">
                  <p className="text-sm sm:text-lg text-[#5D6D7E] italic mb-4 text-center leading-relaxed">
                    &ldquo;口袋里的手机发出暴雨般的震动，亮起的屏幕上写着...&rdquo;
                  </p>
                  <div className="w-60 sm:w-72 bg-white sketch-border p-4 sm:p-6 shadow-md relative vibrate">
                    <div className="bg-[#2C3E50] text-[#FAF6ED] rounded p-3 sm:p-4 text-center min-h-[140px] sm:min-h-[160px] flex flex-col justify-between">
                      <div className="flex justify-between items-center text-[10px] opacity-70">
                        <span>🕒 下班时间</span><span>📶 信号满格</span>
                      </div>
                      <div className="my-3 sm:my-4">
                        <p className="text-xs text-[#FF6B6B] font-bold tracking-widest animate-pulse">🔥 重磅通知 🔥</p>
                        <h3 className="text-base sm:text-lg font-bold mt-1 text-white">您预购的游戏现已解锁发售！</h3>
                      </div>
                      <div className="text-[10px] bg-red-500/20 text-[#FF8E8E] py-1 rounded">请速回家连线，拯救今日不开心</div>
                    </div>
                    <div className="w-8 h-8 rounded-full border-2 border-[#2C3E50] mx-auto mt-3 sm:mt-4 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-sm border border-[#2C3E50]" />
                    </div>
                  </div>
                  <button onClick={() => transitionTo(3, 60)} className="mt-6 px-8 py-3 sm:px-10 sm:py-4 bg-[#FF6B6B] text-white font-bold text-lg sm:text-xl sketch-border hover:bg-[#FF4F4F] active:scale-95 transition-all shadow-lg">
                    ⚡ 拔腿狂奔回家！
                  </button>
                </div>
              )}

              {/* ═══════ 第三幕 ═══════ */}
              {stage === 3 && (
                <div className="w-full flex flex-col items-center relative">
                  {!gameBooted ? (
                    <div>
                      <p className="text-sm sm:text-lg text-[#5D6D7E] italic mb-2 text-center leading-relaxed">
                        &ldquo;推开家门，温馨的灯光洒下来。&rdquo;
                      </p>
                      {!controllerConnected ? (
                        <p className="text-xs font-bold text-[#FF6B6B] text-center mb-2 animate-pulse">
                          👆 拖动手柄，将底部凹口对准主机接口槽
                        </p>
                      ) : (
                        <p className="text-xs font-bold text-green-500 text-center mb-2">
                          ✅ 手柄已对接，按下 START GAME 启动！
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-base sm:text-lg text-[#FF6B6B] font-bold mb-4 text-center animate-bounce">
                      ✨ 绚烂的多巴胺爆炸！正在链接终极快乐！
                    </p>
                  )}

                  <div className="w-full flex flex-col md:flex-row justify-center items-center gap-12 px-2">
                    {/* ── 主机 ── */}
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-48 sm:w-56 h-28 bg-[#FDFBF7] sketch-border p-3 flex flex-col items-center justify-center relative">
                        {!gameBooted && <span className="text-xs text-gray-400 mb-1">🖥️ 快乐接收终端</span>}
                        {gameBooted && <span className="text-xs text-green-500 font-bold mb-1">✅ 运行中...</span>}
                        {/* 指示灯 */}
                        <div className="flex gap-2">
                          <div className={`w-2 h-2 rounded-full ${controllerConnected ? "bg-green-400" : "bg-[#2C3E50]/30"}`} />
                          <div className={`w-2 h-2 rounded-full ${gameBooted ? "bg-green-400 animate-pulse" : "bg-[#2C3E50]/30"}`} />
                        </div>
                        {/* 接口凹口 —— 主机正面底部边中间有一个凹进的长方形槽 */}
                        <div ref={portRef} className="mt-2 relative">
                          <div className={`w-14 h-4 rounded-sm border-2 transition-colors duration-300 flex items-center justify-center ${isDragging ? "border-yellow-400 bg-yellow-100 animate-pulse" : controllerConnected ? "border-green-500 bg-green-100" : "border-[#2C3E50] bg-[#1a1a2e]"}`}>
                            <div className="flex gap-1">
                              <div className="w-1 h-1 rounded-full bg-[#888]" />
                              <div className="w-1 h-1 rounded-full bg-[#888]" />
                              <div className="w-1 h-1 rounded-full bg-[#888]" />
                            </div>
                          </div>
                          {!controllerConnected && <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[8px] text-gray-400 whitespace-nowrap">⬆ 接口槽</span>}
                        </div>
                      </div>

                      {controllerConnected && !gameBooted && (
                        <button onClick={bootSystem} className="px-6 py-3 bg-[#FF6B6B] text-white font-black text-lg sketch-border hover:bg-[#FF4F4F] active:scale-95 transition-all shadow-lg animate-pulse">
                          ⚡ START GAME ⚡
                        </button>
                      )}
                    </div>

                    {/* ── 手柄（带底部凹口）── */}
                    {!controllerConnected && !gameBooted && (
                      <div className="flex flex-col items-center gap-1 select-none">
                        <div
                          id="game-controller"
                          className="w-32 sm:w-36 bg-white sketch-border p-2 flex flex-col items-center select-none z-10 relative"
                          style={{
                            cursor: controllerConnected ? "default" : "grab",
                            transform: `translate(${controllerOffset.dx}px, ${controllerOffset.dy}px)`,
                            transition: isDragging ? "none" : "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                            opacity: controllerConnected ? 0.5 : 1,
                          }}
                          onMouseDown={startDrag}
                          onTouchStart={startDrag}
                        >
                          {/* 手柄正面按键 */}
                          <div className="flex justify-between w-full mb-1">
                            <div className="flex gap-1">
                              <div className="w-3 h-3 rounded-full bg-[#FF6B6B]" />
                              <div className="w-3 h-3 rounded-full bg-[#6BCB77]" />
                            </div>
                            <div className="w-4 h-4 rounded-full bg-[#2C3E50] flex items-center justify-center text-white text-[7px] font-bold">+</div>
                          </div>
                          <div className="flex items-center justify-between w-full px-1 mb-1">
                            <div className="w-5 h-2 rounded-sm bg-[#2C3E50]/30" />
                            <div className="w-3 h-3 rounded-full border-2 border-[#2C3E50]" />
                          </div>
                          {/* ─── 底部边中间的凹口 ───
                              这是关键：手柄是一个长方形，底部那条边的正中间
                              不是凸出来，而是向内凹进去一个缺口 */}
                          <div className="w-full flex justify-center">
                            <svg width="40" height="10" viewBox="0 0 40 10">
                              {/* 底边左段 */}
                              <rect x="0" y="0" width="12" height="3" fill="#2C3E50" rx="1" />
                              {/* 底边右段 */}
                              <rect x="28" y="0" width="12" height="3" fill="#2C3E50" rx="1" />
                              {/* 中间凹口：一个内凹的矩形槽 */}
                              <rect x="12" y="0" width="16" height="5" fill="none" stroke="#2C3E50" strokeWidth="2" rx="1" />
                              {/* 凹口内针脚 */}
                              <rect x="16" y="1.5" width="2" height="2" fill="#888" rx="0.5" />
                              <rect x="19" y="1.5" width="2" height="2" fill="#888" rx="0.5" />
                              <rect x="22" y="1.5" width="2" height="2" fill="#888" rx="0.5" />
                            </svg>
                          </div>
                        </div>
                        {!controllerConnected && (
                          <span className="text-[9px] sm:text-[10px] font-bold text-gray-400">
                            🎮 按住手柄拖到主机接口上
                          </span>
                        )}
                      </div>
                    )}

                    {/* 运行中画面 */}
                    {gameBooted && (
                      <div className="w-36 sm:w-48 h-32 sm:h-40 flex items-center justify-center bg-white sketch-border p-2 animate-pulse">
                        <svg width="120" height="100" viewBox="0 0 150 120" className="overflow-visible">
                          <rect x="10" y="10" width="130" height="80" rx="10" fill="none" stroke="#2C3E50" strokeWidth="3" />
                          <circle cx="75" cy="40" r="10" fill="none" stroke="#2C3E50" strokeWidth="3" />
                          <line x1="75" y1="50" x2="75" y2="75" stroke="#2C3E50" strokeWidth="3" />
                          <line x1="75" y1="55" x2="55" y2="35" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round" />
                          <line x1="75" y1="55" x2="95" y2="35" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round" />
                          <path d="M 55 85 Q 75 95 95 85" fill="none" stroke="#2C3E50" strokeWidth="3" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════ 第四幕 ═══════ */}
              {stage === 4 && (
                <div className="w-full flex flex-col items-center py-2">
                  <div className="max-w-md bg-white sketch-border p-5 sm:p-8 text-center relative shadow-lg shivering">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 sm:mb-6 relative">
                      <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                        <circle cx="50" cy="50" r="48" fill="#FFFDF9" stroke="#2C3E50" strokeWidth="3" />
                        <g transform="translate(10, 5) rotate(-10)">
                          <path d="M 20 40 Q 15 70 45 75 Q 75 70 70 40 Q 65 15 45 15 Q 25 15 20 40 Z" fill="#FAF6ED" stroke="#2C3E50" strokeWidth="3" />
                          <path d="M 12 25 Q 8 22 10 18 Q 14 18 12 25" fill="#FF8E8E" stroke="#2C3E50" strokeWidth="1.5" />
                          <path d="M 15 50 Q 8 52 11 58 Q 15 55 15 50" fill="#FF8E8E" stroke="#2C3E50" strokeWidth="1.5" />
                          <path d="M 28 35 Q 33 30 38 35 Q 33 40 28 35 Z" fill="none" stroke="#2C3E50" strokeWidth="2.5" />
                          <path d="M 52 35 Q 57 30 62 35 Q 57 40 52 35 Z" fill="none" stroke="#2C3E50" strokeWidth="2.5" />
                          <circle cx="33" cy="35" r="1.5" fill="#2C3E50" />
                          <circle cx="57" cy="35" r="1.5" fill="#2C3E50" />
                          <path d="M 35 55 Q 45 42 55 55 Q 45 60 35 55 Z" fill="#FF6B6B" stroke="#2C3E50" strokeWidth="2.5" />
                          <circle cx="28" cy="46" r="6" fill="#FF6B6B" opacity="0.6" />
                        </g>
                        <g transform="translate(48, 42)">
                          <path d="M 10 10 C 25 -5, 35 15, 20 25 C 10 32, -5 20, 10 10 Z" fill="#FF6B6B" stroke="#2C3E50" strokeWidth="3" />
                          <path d="M 12 5 Q 18 10 15 15" fill="none" stroke="#2C3E50" strokeWidth="2" />
                          <path d="M 8 10 Q 14 15 11 20" fill="none" stroke="#2C3E50" strokeWidth="2" />
                        </g>
                        <path d="M 40 25 L 30 15 M 65 35 L 75 30 M 55 65 L 62 75" stroke="#2C3E50" strokeWidth="2" strokeLinecap="round" />
                        <path d="M 45 35 Q 52 25 60 38" fill="none" stroke="#FF6B6B" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      <span className="absolute -bottom-2 right-0 bg-[#FF6B6B] text-white text-[10px] px-2 py-0.5 rounded-full rotate-12 font-bold">天马行空</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-[#2C3E50] mb-3 sm:mb-4 pixel-title">
                      &ldquo;短暂地享受通关的喜悦吧，你值得！&rdquo;
                    </h3>
                    <p className="text-[#5D6D7E] text-xs sm:text-sm leading-relaxed mb-4 sm:mb-6">
                      恭喜你，勇敢的父亲兼开发者。你成功击碎了今日份的&ldquo;自大嘴碎内耗魔王&rdquo;。现实的重力或许依然沉重，但这几分钟的单纯，是你无可夺走的浪漫。
                    </p>
                    <button onClick={restart} className="w-full py-3 bg-[#2C3E50] text-[#FAF6ED] font-bold rounded-lg hover:bg-black active:scale-95 transition-all">
                      🔄 再次给生活注入多巴胺 (重来)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 底部 */}
          <div className="border-t-2 border-[#2C3E50] pt-3 flex justify-between items-center text-xs text-[#5D6D7E]">
            <div className="flex gap-3">
              <span>📍 状态：<strong className="text-[#FF6B6B]">{STAGE_NAMES[stage] ?? "未知"}</strong></span>
              <span>{stage < 4 ? "🔋 蓄能阶段" : "✨ 已通关"}</span>
            </div>
            <Link href="/discover" className="italic hover:text-[#2C3E50] transition-colors">&ldquo;对方是最后的甜，代码是掌中的光。&rdquo;</Link>
          </div>
        </div>
      </main>
    </>
  );
}
