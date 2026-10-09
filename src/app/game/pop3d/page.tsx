"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGameAudio } from "@/hooks/useGameAudio";
import { createEngine } from "./engine/game";
import { ELEMENT_ICON, ELEMENT_NAME, META_UPGRADES, SCHOOL_COLOR, SCHOOL_NAME, SHIPS, SHIP_INFO } from "./engine/config";
import { buyUpgrade, loadMeta, saveMeta, upgradeInfo } from "./engine/meta";
import { createRenderer } from "./render/scene";
import type {
  CardDef,
  AudioAdapter,
  EngineHandle,
  FrameStats,
  HudState,
  MetaData,
  Phase,
  RunStats,
  ShipType,
} from "./engine/types";
import { EMPTY_META } from "./engine/types";

// ═══════════════════════════════════════════════════════════════════
// React 外壳：只负责低频相位与弹层。
// HUD 数字（血量 / 分数 / 能量 / 帧率）走 DOM ref 直写，绝不进 React state（§9.1）。
// ═══════════════════════════════════════════════════════════════════

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const btnMain =
  "w-full rounded-xl border-2 border-[#101010] bg-[#FF2D2D] px-4 py-2 font-bold text-[#FFF8E7] shadow-[3px_3px_0_#101010] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";
const btnGhost =
  "w-full rounded-xl border-2 border-[#101010] bg-[#FFF8E7] px-4 py-2 text-sm font-bold text-[#101010] shadow-[3px_3px_0_#101010] transition-transform active:translate-x-[2px] active:translate-y-[2px] active:shadow-none";

export default function Pop3DGame() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<EngineHandle | null>(null);

  const fpsRef = useRef<HTMLSpanElement | null>(null);
  const msRef = useRef<HTMLSpanElement | null>(null);
  const bulletsRef = useRef<HTMLSpanElement | null>(null);
  const callsRef = useRef<HTMLSpanElement | null>(null);
  const hpRef = useRef<HTMLDivElement | null>(null);
  const scoreRef = useRef<HTMLSpanElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const lvRef = useRef<HTMLSpanElement | null>(null);
  const energyRef = useRef<HTMLDivElement | null>(null);
  const elemRef = useRef<HTMLSpanElement | null>(null);
  const reviveRef = useRef<HTMLSpanElement | null>(null);
  const shieldRef = useRef<HTMLDivElement | null>(null);
  const nukeRef = useRef<HTMLButtonElement | null>(null);
  const nukeCountRef = useRef<HTMLSpanElement | null>(null);
  const bossBarRef = useRef<HTMLDivElement | null>(null);
  const bossFillRef = useRef<HTMLDivElement | null>(null);
  const bossWeakRef = useRef<HTMLSpanElement | null>(null);
  const warnRef = useRef<HTMLDivElement | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [offer, setOffer] = useState<CardDef[]>([]);
  const [ship, setShip] = useState<ShipType>("nova");
  const [meta, setMeta] = useState<MetaData>(() => ({ ...EMPTY_META, upgrades: { ...EMPTY_META.upgrades } }));
  const [stats, setStats] = useState<RunStats | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [muted, setMuted] = useState(false);
  /** 炫彩卡被选中时的额外演出（棱彩闪光） */
  const [prismatic, setPrismatic] = useState<string | null>(null);

  // ── 音频：复用 2D 版已验证的 WebAudio 实现，这里只做适配与静音闸门 ──
  const audio = useGameAudio();
  const audioRef = useRef(audio);
  const mutedRef = useRef(false);
  useEffect(() => {
    audioRef.current = audio;
  });

  const adapter = useMemo<AudioAdapter>(
    () => ({
      init: () => audioRef.current.initAudio(),
      shoot: (kind) => {
        if (mutedRef.current) return;
        if (kind === 0) audioRef.current.shootLaser();
        else if (kind === 1) audioRef.current.shootWave();
        else audioRef.current.shoot();
      },
      explosion: (big) => {
        if (mutedRef.current) return;
        if (big) audioRef.current.bossExplosion();
        else audioRef.current.explosion();
      },
      playerHit: () => {
        if (!mutedRef.current) audioRef.current.playerHit();
      },
      powerUp: () => {
        if (!mutedRef.current) audioRef.current.powerUp();
      },
      card: () => {
        if (!mutedRef.current) audioRef.current.gachaCard();
      },
      click: () => {
        if (!mutedRef.current) audioRef.current.buttonClick();
      },
      bossWarning: () => {
        if (!mutedRef.current) audioRef.current.bossWarning();
      },
      startBgm: () => {
        if (!mutedRef.current) audioRef.current.startBGM();
      },
      stopBgm: () => audioRef.current.stopBGM(),
    }),
    [],
  );

  // 引擎回调只创建一次，用 ref 拿最新 meta，避免闭包过期
  const metaRef = useRef(meta);
  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    // 存档与静音偏好只能在客户端读：服务端先给默认值、挂载后再灌入，
    // 否则首屏 HTML 与客户端不一致会触发 hydration 失败。
    /* eslint-disable react-hooks/set-state-in-effect -- 一次性读取外部存储，属于预期行为 */
    setMeta(loadMeta());
    const savedMute = window.localStorage.getItem("pop3d_muted_v1") === "1";
    mutedRef.current = savedMute;
    setMuted(savedMute);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // 根布局给所有路由套了 pb-20 的外壳，游戏页要用整屏覆盖并锁掉页面滚动，
    // 否则触控拖拽会把整页带着一起滚。
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 调试开关：?auto=1 自动寻敌；?stress=1 灌满弹幕；?skip=<秒> 跳段
    const params = new URLSearchParams(window.location.search);
    const skip = Number(params.get("skip"));
    // ?bloom=0 / ?bloom=1 覆盖默认分级（桌面开、移动端关）
    const bloomParam = params.get("bloom");
    // ?fx=0 关掉全部表现层（对照基线）；?fx=glow,trail,outline,lines,bloom 指定单层
    const fxParam = params.get("fx");
    const fx =
      fxParam === null || fxParam === "1"
        ? undefined
        : fxParam === "0"
          ? { outline: false, glow: false, trail: false, speedLines: false, bloom: false }
          : {
              outline: fxParam.includes("outline"),
              glow: fxParam.includes("glow"),
              trail: fxParam.includes("trail"),
              speedLines: fxParam.includes("lines"),
              bloom: fxParam.includes("bloom"),
            };
    const renderer = createRenderer(mount, {
      bloom: bloomParam === null ? undefined : bloomParam !== "0",
      fx,
    });
    const engine = createEngine({
      mount,
      renderer,
      audio: adapter,
      autopilot: params.has("auto"),
      stress: params.has("stress"),
      skipTo: Number.isFinite(skip) && skip > 0 ? skip : 0,
      callbacks: {
        onStats: (s: FrameStats) => {
          if (fpsRef.current) fpsRef.current.textContent = String(Math.round(s.fps));
          if (msRef.current) msRef.current.textContent = s.frameMs.toFixed(1);
          if (bulletsRef.current) bulletsRef.current.textContent = String(s.bullets);
          if (callsRef.current) callsRef.current.textContent = String(s.calls);
        },
        onHud: (h: HudState) => {
          if (hpRef.current) {
            const pct = Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100));
            hpRef.current.style.width = `${pct}%`;
          }
          if (scoreRef.current) scoreRef.current.textContent = String(h.score);
          if (timeRef.current) timeRef.current.textContent = formatTime(h.time);
          if (lvRef.current) lvRef.current.textContent = `Lv ${h.level}`;
          if (energyRef.current) energyRef.current.style.width = `${Math.round(h.energyPct * 100)}%`;
          if (elemRef.current) elemRef.current.textContent = h.element ? ELEMENT_ICON[h.element] : "—";
          if (reviveRef.current) reviveRef.current.textContent = h.revivesLeft > 0 ? `×${h.revivesLeft}` : "—";
          if (shieldRef.current) {
            const sp = h.shieldMax > 0 ? Math.max(0, Math.min(100, (h.shield / h.shieldMax) * 100)) : 0;
            shieldRef.current.style.width = `${sp}%`;
          }
          if (nukeCountRef.current) nukeCountRef.current.textContent = String(h.nukes);
          if (nukeRef.current) nukeRef.current.disabled = h.nukes <= 0;
          if (bossBarRef.current) bossBarRef.current.style.display = h.bossMaxHp > 0 ? "flex" : "none";
          if (bossFillRef.current && h.bossMaxHp > 0) {
            const pct = Math.max(0, Math.min(100, (h.bossHp / h.bossMaxHp) * 100));
            bossFillRef.current.style.width = `${pct}%`;
          }
          if (bossWeakRef.current) {
            bossWeakRef.current.textContent = h.bossWeak
              ? `弱点 ${ELEMENT_ICON[h.bossWeak]}${ELEMENT_NAME[h.bossWeak]}`
              : "";
          }
          if (warnRef.current) warnRef.current.style.display = h.warn ? "block" : "none";
        },
        onPhase: (next: Phase, nextOffer: CardDef[]) => {
          setPhase(next);
          setOffer(nextOffer);
        },
        onRunEnd: (s: RunStats) => {
          const m = metaRef.current;
          const next: MetaData = {
            stardust: m.stardust + s.stardust,
            highScore: Math.max(m.highScore, s.score),
            runs: m.runs + 1,
            upgrades: { ...m.upgrades },
          };
          metaRef.current = next;
          saveMeta(next);
          setMeta(next);
          setStats(s);
        },
      },
    });
    engineRef.current = engine;
    engine.start();

    return () => {
      document.body.style.overflow = prevOverflow;
      engine.destroy();
      engineRef.current = null;
    };
  }, [adapter]);

  const startRun = () => {
    audioRef.current.initAudio();
    setStats(null);
    setShowShop(false);
    engineRef.current?.newRun(ship, metaRef.current);
  };

  const toggleMute = () => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    window.localStorage.setItem("pop3d_muted_v1", next ? "1" : "0");
    if (next) audioRef.current.stopBGM();
    else if (engineRef.current?.world.phase === "playing") audioRef.current.startBGM();
  };

  const buy = (key: keyof MetaData["upgrades"]) => {
    setMeta((prev) => {
      const next = buyUpgrade(prev, key);
      metaRef.current = next;
      saveMeta(next);
      return next;
    });
  };

  const playing = phase === "playing";

  return (
    <main className="fixed inset-0 z-40 select-none overflow-hidden overscroll-none bg-[#101010] font-mono">
      <div ref={mountRef} className="absolute inset-0" />

      {/* 炫彩卡选中演出：棱彩光晕扫过全屏（0.9 秒，然后自己消失） */}
      {prismatic && (
        <div className="pointer-events-none absolute inset-0 z-40">
          <style>{"@keyframes prismfx{0%{opacity:0;transform:scale(.6)}25%{opacity:.95}100%{opacity:0;transform:scale(1.5)}}@keyframes prismring{0%{opacity:.9;transform:scale(.2)}100%{opacity:0;transform:scale(1.8)}}"}</style>
          <div
            className="absolute left-1/2 top-1/2 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "conic-gradient(from 0deg,#FF2D2D,#FFD400,#00A05A,#00C2FF,#E5007E,#FF2D2D)",
              mixBlendMode: "screen",
              animation: "prismfx 0.9s ease-out forwards",
            }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-[40vmin] w-[40vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-[10px] border-[#FFF8E7]"
            style={{ animation: "prismring 0.9s ease-out forwards" }}
          />
        </div>
      )}

      {/* ── 顶部 HUD（游戏内常显） ── */}
      {playing && (
        <>
          <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-3 rounded-xl border-2 border-[#101010] bg-[#FFF8E7]/95 px-3 py-1.5 font-mono text-xs text-[#101010] shadow-[3px_3px_0_#E5007E]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-70">HP</span>
              <div className="h-3 w-28 overflow-hidden rounded-full border-2 border-[#101010] bg-[#FFF8E7]">
                <div ref={hpRef} className="h-full w-full bg-[#E5007E]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] opacity-70">SH</span>
              <div className="h-3 w-20 overflow-hidden rounded-full border-2 border-[#101010] bg-[#FFF8E7]">
                <div ref={shieldRef} className="h-full w-0 bg-[#00C2FF]" />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] opacity-70">SCORE</span>
              <span ref={scoreRef} className="tabular-nums">0</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] opacity-70">TIME</span>
              <span ref={timeRef} className="tabular-nums">0:00</span>
            </div>
          </div>

          {/* 等级 / 能量 / 属性 / 备用机体 */}
          <div className="pointer-events-none absolute left-1/2 top-14 flex -translate-x-1/2 items-center gap-2 font-mono text-[10px] text-[#FFF8E7]">
            <span ref={lvRef} className="rounded-md border-2 border-[#FFF8E7] bg-[#101010] px-1.5 py-0.5">
              Lv 0
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full border-2 border-[#FFF8E7] bg-[#101010]">
              <div ref={energyRef} className="h-full w-0 bg-[#00C2FF]" />
            </div>
            <span ref={elemRef} className="rounded-md border-2 border-[#FFF8E7] bg-[#101010] px-1.5 py-0.5">
              —
            </span>
            <span className="rounded-md border-2 border-[#FFF8E7] bg-[#101010] px-1.5 py-0.5">
              备用 <span ref={reviveRef} className="tabular-nums">—</span>
            </span>
            {/* 核弹：H5 要能点，所以做成真按钮（pointer-events-auto 打开） */}
            <button
              ref={nukeRef}
              type="button"
              onClick={() => engineRef.current?.useNuke()}
              className="pointer-events-auto rounded-md border-2 border-[#FFF8E7] bg-[#101010] px-2 py-0.5 font-mono text-[10px] text-[#FFF8E7] shadow-[2px_2px_0_#E5007E] active:translate-y-[2px] active:shadow-none disabled:opacity-40"
            >
              ☢ <span ref={nukeCountRef} className="tabular-nums">0</span>
            </button>
          </div>

          {/* Boss 血条 */}
          <div
            ref={bossBarRef}
            style={{ display: "none" }}
            className="pointer-events-none absolute left-1/2 top-24 w-[min(70vw,420px)] -translate-x-1/2 items-center gap-2"
          >
            <span className="font-mono text-[10px] font-bold text-[#FFF8E7]">BOSS</span>
            <div className="h-3 flex-1 overflow-hidden rounded-full border-2 border-[#FFF8E7] bg-[#101010]">
              <div ref={bossFillRef} className="h-full w-full bg-[#FF2D2D]" />
            </div>
            <span ref={bossWeakRef} className="font-mono text-[10px] font-bold text-[#FFD400]" />
          </div>

          <div className="pointer-events-none absolute left-3 top-3 rounded-lg border-2 border-[#101010] bg-[#FFF8E7]/95 px-2 py-1 font-mono text-[10px] text-[#101010] shadow-[2px_2px_0_#0057FF]">
            <div>
              FPS <span ref={fpsRef} className="tabular-nums">–</span>
            </div>
            <div>
              <span ref={msRef} className="tabular-nums">–</span> ms
            </div>
            <div>
              弹幕 <span ref={bulletsRef} className="tabular-nums">0</span>
            </div>
            <div>
              DC <span ref={callsRef} className="tabular-nums">–</span>
            </div>
          </div>

          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-[#101010] bg-[#FFF8E7]/95 px-3 py-1 text-[11px] text-[#101010]">
            WASD / 方向键 移动 · 鼠标跟随 · 自动开火 · <kbd className="rounded border border-[#101010] bg-[#FFD400] px-1">ESC</kbd> 暂停
          </div>

          {/* BOSS 警告横幅 */}
          <div
            ref={warnRef}
            style={{ display: "none" }}
            className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 rounded-xl border-4 border-[#101010] bg-[#FF2D2D] px-6 py-2 text-2xl font-black tracking-widest text-[#FFF8E7] shadow-[5px_5px_0_#101010]"
          >
            WARNING
          </div>

          {/* 触控可用的暂停 / 静音 */}
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => engineRef.current?.setPaused(true)}
              className="rounded-lg border-2 border-[#101010] bg-[#FFF8E7]/95 px-2 py-1 text-xs font-bold text-[#101010] shadow-[2px_2px_0_#101010]"
            >
              ⏸ 暂停
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="rounded-lg border-2 border-[#101010] bg-[#FFF8E7]/95 px-2 py-1 text-xs font-bold text-[#101010] shadow-[2px_2px_0_#101010]"
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </>
      )}

      {/* ── 主菜单 ── */}
      {phase === "menu" && (
        <Veil>
          <h1 className="text-4xl font-black tracking-widest text-[#FFD400] [-webkit-text-stroke:3px_#101010] [paint-order:stroke_fill] [text-shadow:5px_5px_0_#E5007E]">
            POP3D
          </h1>
          <p className="text-xs tracking-[3px] text-[#0057FF]">3D 竖版弹幕 · M3</p>

          <div className="flex w-full gap-2">
            {SHIPS.map((s) => {
              const info = SHIP_INFO[s];
              const on = s === ship;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setShip(s)}
                  style={{ outline: on ? "3px solid #FF2D2D" : "none", outlineOffset: "-3px" }}
                  className="flex flex-1 flex-col items-center gap-0.5 rounded-lg border-2 border-[#101010] bg-[#FFF8E7] px-1 py-2"
                >
                  <span className="text-lg">{info.icon}</span>
                  <span className="text-xs font-bold text-[#101010]">{info.label}</span>
                  <span className="text-[9px] font-bold text-[#101010]/70">{info.blurb}</span>
                  {/* 属性现在是机型自带的（不进卡池），标出来才知道自己的克制关系 */}
                  <span className="text-[9px] text-[#101010]">
                    {ELEMENT_ICON[info.element]}
                    {ELEMENT_NAME[info.element]}属性
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-56">
            <button type="button" className={btnMain} onClick={startRun}>
              开始
            </button>
          </div>
          <div className="w-56">
            <button type="button" className={btnGhost} onClick={() => setShowShop((v) => !v)}>
              {showShop ? "收起养成" : "局外养成"}
            </button>
          </div>

          {showShop && <Shop meta={meta} onBuy={buy} />}

          <p className="text-[11px] text-[#E5007E]">最高分 {meta.highScore} · 星尘 ★{meta.stardust}</p>
        </Veil>
      )}

      {/* ── 三选一 ── */}
      {phase === "card" && (
        <Veil>
          <p className="text-xl font-bold tracking-[3px] text-[#101010]">选择强化</p>
          <p className="text-[11px] text-[#0057FF]">构筑你的流派</p>
          <div className="flex w-full gap-2">
            {offer.map((c) => {
              const prisma = c.tier === "prismatic";
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    if (prisma) {
                      setPrismatic(c.id);
                      window.setTimeout(() => setPrismatic(null), 900);
                    }
                    engineRef.current?.chooseCard(c.id);
                  }}
                  style={{
                    boxShadow: prisma ? "0 6px 0 #FFD400" : `0 5px 0 ${SCHOOL_COLOR[c.school]}`,
                    background: prisma
                      ? "linear-gradient(150deg,#FFF8E7 0%,#FFE7F6 40%,#E4F6FF 75%,#FFF8E7 100%)"
                      : "#FFF8E7",
                  }}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border-4 border-[#101010] px-1 pb-3 pt-0 active:translate-y-[3px] active:!shadow-none ${
                    prisma ? "ring-4 ring-[#FFD400]" : ""
                  }`}
                >
                  <span
                    className="w-full py-0.5 text-[10px] tracking-[2px] text-[#FFF8E7]"
                    style={{
                      background: prisma
                        ? "linear-gradient(90deg,#FF2D2D,#FFD400,#00A05A,#00C2FF,#E5007E)"
                        : SCHOOL_COLOR[c.school],
                    }}
                  >
                    {prisma ? "炫彩 · " : ""}
                    {SCHOOL_NAME[c.school]}
                  </span>
                  <span className="text-2xl leading-tight">{c.icon}</span>
                  <span className="text-xs font-bold text-[#101010]">{c.name}</span>
                  <span className="px-0.5 text-[10px] font-bold leading-snug text-[#101010]/80">{c.desc}</span>
                </button>
              );
            })}
          </div>
        </Veil>
      )}

      {/* ── 复活 ── */}
      {phase === "revive" && (
        <Veil>
          <h2 className="text-2xl font-black text-[#FF2D2D] [-webkit-text-stroke:2px_#101010] [paint-order:stroke_fill]">
            机体损毁
          </h2>
          <p className="text-xs tracking-[2px] text-[#0057FF]">备用机体已就绪</p>
          <div className="w-56">
            <button type="button" className={btnMain} onClick={() => engineRef.current?.useRevive()}>
              立即复活
            </button>
          </div>
          <div className="w-56">
            <button type="button" className={btnGhost} onClick={() => engineRef.current?.giveUp()}>
              放弃本局
            </button>
          </div>
        </Veil>
      )}

      {/* ── 暂停 ── */}
      {phase === "pause" && (
        <Veil>
          <h2 className="text-2xl font-black tracking-widest text-[#101010]">已暂停</h2>
          <div className="w-56">
            <button type="button" className={btnMain} onClick={() => engineRef.current?.setPaused(false)}>
              继续
            </button>
          </div>
          <div className="w-56">
            <button type="button" className={btnGhost} onClick={() => engineRef.current?.toMenu()}>
              返回主菜单
            </button>
          </div>
        </Veil>
      )}

      {/* ── 结算 ── */}
      {(phase === "gameover" || phase === "victory") && stats && (
        <Veil>
          <h2 className="text-2xl font-black tracking-widest text-[#101010]">
            {phase === "victory" ? "STAGE CLEAR" : stats.isRecord ? "新纪录！" : "本局结束"}
          </h2>
          <table className="min-w-[230px] border-2 border-[#101010] bg-[#FFF8E7] text-xs">
            <tbody>
              <Row label="得分" value={String(stats.score)} />
              <Row label="击破" value={String(stats.kills)} />
              <Row label="升级" value={`${stats.level} 次`} />
              <Row label="复活" value={`${stats.revives} 次`} />
              <Row label="存活" value={`${stats.seconds} 秒`} />
              <Row label="星尘" value={`+${stats.stardust}`} accent />
            </tbody>
          </table>
          <div className="flex w-64 gap-2">
            <button type="button" className={btnMain} onClick={startRun}>
              再来一局
            </button>
            <button type="button" className={btnGhost} onClick={() => setShowShop((v) => !v)}>
              养成
            </button>
          </div>
          {showShop && <Shop meta={meta} onBuy={buy} />}
          <div className="w-56">
            <button type="button" className={btnGhost} onClick={() => engineRef.current?.toMenu()}>
              回主菜单
            </button>
          </div>
        </Veil>
      )}
    </main>
  );
}

function Veil({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 overflow-y-auto bg-[#FFF8E7]/95 p-4 text-center">
      {children}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <tr className="border-b-2 border-[#101010]/15 last:border-b-0">
      <td className="px-3 py-1 text-left">{label}</td>
      <td className={`px-3 py-1 text-right tabular-nums ${accent ? "font-bold text-[#E5007E]" : "text-[#0057FF]"}`}>
        {value}
      </td>
    </tr>
  );
}

function Shop({ meta, onBuy }: { meta: MetaData; onBuy: (k: keyof MetaData["upgrades"]) => void }) {
  return (
    <div className="w-full max-w-[340px] rounded-xl border-4 border-[#101010] bg-[#FFF8E7] p-2">
      <div className="flex items-center justify-between border-b-2 border-[#101010] pb-1 text-xs text-[#101010]">
        <span>局外养成</span>
        <span className="text-[#E5007E]">★ {meta.stardust}</span>
      </div>
      {META_UPGRADES.map((u) => {
        const info = upgradeInfo(meta, u.key);
        return (
          <div key={u.key} className="mt-1.5 flex items-center gap-2 text-left">
            <div className="flex flex-1 flex-col">
              <span className="text-xs text-[#101010]">{info.label}</span>
              <span className="text-[10px] font-bold text-[#101010]/70">{info.desc}</span>
              <span className="text-[9px] text-[#0057FF]">
                Lv {info.lv} / {info.max}
              </span>
            </div>
            <button
              type="button"
              disabled={info.maxed || !info.affordable}
              onClick={() => onBuy(u.key)}
              className="whitespace-nowrap rounded-lg border-2 border-[#101010] bg-[#FFD400] px-2 py-1 text-xs font-bold text-[#101010] disabled:bg-[#101010]/10 disabled:text-[#101010]/40"
            >
              {info.maxed ? "已满" : `★ ${info.price}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
