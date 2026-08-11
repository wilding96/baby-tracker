"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RotateCcw, Sparkles, Sword } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GameData, Monster, MonsterVisual, Poop } from "./types";
import {
  MONSTER_VISUALS,
  MAX_MONSTERS,
  STORAGE_KEY,
  TEXT_MAX_LENGTH,
} from "./constants";
import { playSpawn, playSelect, playDefeat, playError } from "./useSounds";

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

const ROT_X = 55;
const ROT_Z = -45;
const DESK_W = 380;
const DESK_H = 250;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return Math.abs(h);
}

function pickVisual(text: string): MonsterVisual {
  return MONSTER_VISUALS[hashStr(text) % MONSTER_VISUALS.length];
}

function isToday(ts: number) {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function loadData(): GameData {
  if (typeof window === "undefined") return { monsters: [], history: [], poops: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as GameData;
      return {
        monsters: Array.isArray(d.monsters) ? d.monsters : [],
        history: Array.isArray(d.history) ? d.history : [],
        poops: Array.isArray(d.poops) ? d.poops : [],
      };
    }
  } catch {
    /* ignore */
  }
  return { monsters: [], history: [], poops: [] };
}

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
}

// ═══════════════════════════════════════════
// Monster visual (stands upright on the desk)
// ═══════════════════════════════════════════

interface MonsterPose {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  nextTurn: number;
  lastDropped: number;
}

const EDGE_X = 14; // % margin (card is ~19% wide, needs room to bounce)
const EDGE_Y = 33; // % margin (card extends ~31% upward from anchor, keep in bounds)

function randPose(): MonsterPose {
  const dir = Math.random() * Math.PI * 2;
  const speed = 4 + Math.random() * 9; // %/sec
  return {
    x: EDGE_X + Math.random() * (100 - EDGE_X * 2),
    y: EDGE_Y + Math.random() * (100 - EDGE_Y * 2),
    vx: Math.cos(dir) * speed,
    vy: Math.sin(dir) * speed,
    facing: Math.random() < 0.5 ? 1 : -1,
    nextTurn: performance.now() + 1200 + Math.random() * 2500,
    lastDropped: 0,
  };
}

function MonsterCard({ m, index, facing, selected, now, poopsSoFar }: {
  m: Monster;
  index: number;
  facing: 1 | -1;
  selected?: boolean;
  now: number;
  poopsSoFar: number;
}) {
  const nextAt = m.createdAt + (poopsSoFar + 1) * POOP_INTERVAL_MS;
  const lastAt = m.createdAt + poopsSoFar * POOP_INTERVAL_MS;
  const pct = Math.min(100, Math.max(0, (now - lastAt) / POOP_INTERVAL_MS * 100));
  const remainMs = Math.max(0, nextAt - now);
  const remainMin = Math.ceil(remainMs / 60000);
  const urgent = remainMin <= 10;

  return (
    <div
      className="monster-card"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        animation: `float-idle 2.8s ease-in-out ${index * 0.35}s infinite`,
      }}
    >
      {/* name tag above head */}
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          lineHeight: 1.1,
          padding: "1px 7px",
          borderRadius: 999,
          background: m.accent,
          color: m.color,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          border: `1px solid ${m.color}33`,
        }}
      >
        {m.text}
      </span>

      {/* countdown to next poop */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 9.5,
          fontWeight: 800,
          lineHeight: 1,
          color: urgent ? "#c04040" : "#8a7a58",
          background: "rgba(255,255,255,0.8)",
          border: urgent ? "1px solid #e0a0a0" : "1px solid rgba(0,0,0,0.08)",
          borderRadius: 999,
          padding: "1px 6px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        }}
      >
        💩 {remainMin}m
      </span>

      {/* mini progress bar */}
      <div
        style={{
          width: 46,
          height: 4,
          borderRadius: 999,
          background: "#e7dcc0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: urgent
              ? "linear-gradient(90deg,#f87171,#dc2626)"
              : "linear-gradient(90deg,#a3e635,#84cc16)",
            transition: "width 0.5s linear",
          }}
        />
      </div>

      <div
        className="monster-body"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          transition: "transform 0.15s ease, filter 0.15s ease",
          filter: selected ? "brightness(1.15) saturate(1.2)" : "none",
        }}
      >
        <span
          className="monster-emoji"
          style={{
            fontSize: 40,
            lineHeight: 1,
            transform: `scaleX(${facing})`,
            filter: "drop-shadow(0 6px 5px rgba(0,0,0,0.22))",
            animation: `monster-wiggle 4s ease-in-out ${index * 0.6}s infinite`,
          }}
        >
          {m.emoji}
        </span>
      </div>
    </div>
  );
}

const POOP_INTERVAL_MS = 3600000;

// ═══════════════════════════════════════════
// Wandering monster field (drives movement via rAF)
// ═══════════════════════════════════════════

function ensurePose(map: Map<string, MonsterPose>, id: string): MonsterPose {
  let p = map.get(id);
  if (!p) {
    p = randPose();
    map.set(id, p);
  }
  return p;
}

function MonsterField({
  monsters,
  poops,
  selectedId,
  onSelect,
  onPoop,
}: {
  monsters: Monster[];
  poops: Poop[];
  selectedId: string | null;
  onSelect: (m: Monster) => void;
  onPoop: (monsterId: string, pose: { x: number; y: number }) => void;
}) {
  const posesRef = useRef<Map<string, MonsterPose>>(new Map());
  const [poses, setPoses] = useState<Record<string, MonsterPose>>({});
  const monstersRef = useRef(monsters);
  monstersRef.current = monsters;
  const onPoopRef = useRef(onPoop);
  onPoopRef.current = onPoop;

  useEffect(() => {
    const map = posesRef.current;
    monsters.forEach((m) => {
      if (!map.has(m.id)) map.set(m.id, randPose());
    });
    for (const id of Array.from(map.keys())) {
      if (!monsters.some((m) => m.id === id)) map.delete(id);
    }
    setPoses((prev) => {
      const next: Record<string, MonsterPose> = {};
      monsters.forEach((m) => {
        next[m.id] = map.get(m.id) ?? randPose();
      });
      return next;
    });
  }, [monsters]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let tick = 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const map = posesRef.current;
      bodies: for (const m of monstersRef.current) {
        const p = map.get(m.id);
        if (!p) continue;

        // wander
        if (now >= p.nextTurn) {
          p.nextTurn = now + 1200 + Math.random() * 2800;
          const dir = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 9;
          p.vx = Math.cos(dir) * speed;
          p.vy = Math.sin(dir) * speed;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // bounce
        if (p.x < EDGE_X) { p.x = EDGE_X; p.vx = Math.abs(p.vx); }
        if (p.x > 100 - EDGE_X) { p.x = 100 - EDGE_X; p.vx = -Math.abs(p.vx); }
        if (p.y < EDGE_Y) { p.y = EDGE_Y; p.vy = Math.abs(p.vy); }
        if (p.y > 100 - EDGE_Y) { p.y = 100 - EDGE_Y; p.vy = -Math.abs(p.vy); }

        // facing
        if (p.vx > 0.05) p.facing = 1;
        else if (p.vx < -0.05) p.facing = -1;

        // poop check: every hour boundary produces a 💩
        const hrIndex = Math.floor((now - m.createdAt) / POOP_INTERVAL_MS);
        while (p.lastDropped < hrIndex) {
          p.lastDropped++;
          onPoopRef.current?.(m.id, { x: p.x, y: p.y });
        }
      }

      if (++tick % 2 === 0) {
        setPoses((prev) => {
          const next: Record<string, MonsterPose> = {};
          for (const m of monstersRef.current) {
            const p = map.get(m.id);
            next[m.id] = p ? { ...p } : prev[m.id];
          }
          return next;
        });
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  const renderNow = Date.now();

  // Slots are *direct* 3D children of the desk — no intermediate wrapper that could flatten
  return (
    <>
      {/* poop dots (flat on the desk) */}
      {poops.map((poop) => (
        <div
          key={poop.id}
          style={{
            position: "absolute",
            left: `${poop.x}%`,
            top: `${poop.y}%`,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "radial-gradient(circle at 30% 30%, #c8a060, #6b4c2a)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}

      {monsters.map((m, i) => {
        const p = poses[m.id] ?? ensurePose(posesRef.current, m.id);
        return (
          <Fragment key={m.id}>
            {/* shadow lies flat on the desk at the anchor point */}
            <div
              style={{
                position: "absolute",
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 34,
                height: 9,
                borderRadius: "50%",
                background: "rgba(80,50,10,0.22)",
                filter: "blur(2px)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
              }}
            />
            {/* monster anchor — lifted along desk-normal then counter-rotated to stand upright */}
            <div
              className="monster-slot"
              onClick={() => onSelect(m)}
              style={{
                position: "absolute",
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 76,
                height: 0,
                marginLeft: -38,
                transform: `rotateZ(${-ROT_Z}deg) rotateX(${-ROT_X}deg) translateZ(20px)`,
                transformOrigin: "center",
                transformStyle: "preserve-3d",
                cursor: "pointer",
                pointerEvents: "auto",
              }}
            >
              {/* screen-space inner that hangs upward from the anchor */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: 76,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  transform: "translateY(-100%)",
                  pointerEvents: "none",
                }}
              >
                <MonsterCard
                  m={m}
                  index={i}
                  facing={p.facing}
                  selected={m.id === selectedId}
                  now={renderNow}
                  poopsSoFar={p.lastDropped}
                />
              </div>
            </div>
          </Fragment>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════
// Main game
// ═══════════════════════════════════════════

export default function TodoMonstersPage() {
  const [data, setData] = useState<GameData>(() => loadData());
  const [input, setInput] = useState("");
  const [confirmTarget, setConfirmTarget] = useState<Monster | null>(null);
  const [burst, setBurst] = useState<{ m: Monster; particles: Particle[] } | null>(
    null,
  );
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  const monsters = data.monsters;
  const todayDone = useMemo(
    () => data.history.filter((h) => h.completedAt && isToday(h.completedAt)).length,
    [data.history],
  );

  const deskFull = monsters.length >= MAX_MONSTERS;

  const addMonster = () => {
    const text = input.trim();
    if (!text) return;
    if (deskFull) {
      playError();
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
      return;
    }
    const visual = pickVisual(text);
    const m: Monster = {
      id: uid(),
      text: text.slice(0, TEXT_MAX_LENGTH),
      emoji: visual.emoji,
      color: visual.color,
      accent: visual.accent,
      name: visual.name,
      createdAt: Date.now(),
      completedAt: null,
    };
    setData((d) => ({ ...d, monsters: [...d.monsters, m] }));
    setInput("");
    playSpawn();
    inputRef.current?.focus();
  };

  const defeatMonster = (m: Monster) => {
    // Generate particles once, frozen across the animation
    const colors = [m.color, m.accent, "#ffd43b", "#ffffff", "#ff6b6b"];
    const particles: Particle[] = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.6;
      const dist = 50 + Math.random() * 70;
      return {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        size: 5 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
      };
    });
    setBurst({ m, particles });
    setConfirmTarget(null);
    playDefeat();
    setShaking(true);
    setTimeout(() => setShaking(false), 450);

    setTimeout(() => {
      setData((d) => ({
        monsters: d.monsters.filter((x) => x.id !== m.id),
        history: [{ ...m, completedAt: Date.now() }, ...d.history].slice(0, 200),
        poops: d.poops.filter((p) => p.monsterId !== m.id),
      }));
      setBurst(null);
    }, 650);
  };

  const resetAll = () => {
    if (!confirm("确定清空所有待办怪兽和战绩吗？")) return;
    setData({ monsters: [], history: [], poops: [] });
  };

  return (
    <main className="island-page" style={{ minHeight: "100dvh", overflowX: "hidden" }}>
      <style>{`
        @keyframes float-idle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes monster-wiggle {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes burst-fly {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--tx)), calc(-50% + var(--ty))) scale(0.2); opacity: 0; }
        }
        @keyframes float-up {
          0% { transform: translate(-50%, 0) scale(0.5); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(-50%, -46px) scale(1.25); opacity: 0; }
        }
        @keyframes spawn-pop {
          0% { transform: scale(0); }
          60% { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
        .monster-slot:hover .monster-body { transform: scale(1.12) translateY(-4px); }
        .monster-slot:active .monster-body { transform: scale(0.94); }
        .desk-shake { animation: desk-shake 0.42s ease; }
        @keyframes desk-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-6px); }
          50% { transform: translateX(6px); }
          75% { transform: translateX(-3px); }
        }
      `}</style>

      {/* ── Header ── */}
      <header className="island-shell flex items-center justify-between pt-5">
        <Link
          href="/discover"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#fffdf5] text-[#7a6a4a] shadow-sm"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex flex-col items-center">
          <h1 className="text-xl font-black tracking-wide text-[#4a6b3a]">
            消灭小怪兽
          </h1>
          <p className="text-xs text-[#a0936e]">把待办变成怪兽，一只只消灭</p>
        </div>
        <button
          onClick={resetAll}
          aria-label="清空数据"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#fffdf5] text-[#a0936e] shadow-sm hover:text-[#c04040]"
        >
          <RotateCcw size={16} />
        </button>
      </header>

      {/* ── Stats strip ── */}
      <section className="island-shell flex items-center justify-center gap-3 pb-2">
        <div className="island-soft-panel flex items-center gap-2 px-4 py-2">
          <Sparkles size={16} className="text-[#f59e0b]" />
          <span className="text-sm font-bold text-[#4a6b3a]">
            今日消灭 <span className="text-[#f59e0b]">{todayDone}</span>
          </span>
        </div>
        <div className="island-soft-panel flex items-center gap-2 px-4 py-2">
          <Sword size={16} className="text-[#a855f7]" />
          <span className="text-sm font-bold text-[#4a6b3a]">
            怪兽 <span className="text-[#a855f7]">{monsters.length}/{MAX_MONSTERS}</span>
          </span>
        </div>
      </section>

      {/* ── Desk scene ── */}
      <section
        className="desk-scene relative"
        style={{
          perspective: "950px",
          perspectiveOrigin: "50% 22%",
          height: 330,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          position: "relative",
        }}
      >
        {/* floor glow under desk */}
        <div
          style={{
            position: "absolute",
            top: 150,
            width: 360,
            height: 120,
            borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(90,60,20,0.16), transparent 70%)",
            filter: "blur(8px)",
          }}
        />

        <div
          className={shaking ? "desk-shake" : ""}
          style={{ display: "flex", justifyContent: "center" }}
        >
          <div
            style={{
              width: DESK_W,
              height: DESK_H,
              marginTop: 30,
              transform: `rotateX(${ROT_X}deg) rotateZ(${ROT_Z}deg)`,
              transformStyle: "preserve-3d",
              position: "relative",
            }}
          >
          {/* desk top surface */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              border: "3px solid #d9b98a",
              background:
                "linear-gradient(160deg, #fdf6e3 0%, #f3e5c3 55%, #ead8b0 100%)",
              boxShadow:
                "0 12px 30px rgba(120,85,35,0.3), inset 0 2px 6px rgba(255,255,255,0.6), inset 0 -6px 12px rgba(160,120,60,0.18)",
            }}
          />
          {/* desk grid overlay */}
          <div
            style={{
              position: "absolute",
              inset: 8,
              borderRadius: 14,
              pointerEvents: "none",
              backgroundImage:
                "repeating-linear-gradient(0deg, rgba(140,105,55,0.07) 0 1px, transparent 1px 31px), repeating-linear-gradient(90deg, rgba(140,105,55,0.07) 0 1px, transparent 1px 31px)",
            }}
          />
          {/* desk edge thickness (dark layer behind) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              background: "#c8a06a",
              transform: "translateZ(-8px)",
            }}
          />

          {/* wandering monsters with shadows + poops */}
          <MonsterField
            monsters={monsters}
            poops={data.poops}
            selectedId={confirmTarget?.id ?? null}
            onSelect={(m) => {
              playSelect();
              setConfirmTarget(m);
            }}
            onPoop={(monsterId, pos) => {
              setData((d) => ({
                ...d,
                poops: [
                  ...d.poops,
                  { id: uid(), monsterId, x: pos.x, y: pos.y, droppedAt: Date.now() },
                ].slice(-40),
              }));
            }}
          />
          </div>
        </div>

        {/* empty-state hint floating above desk (not tilted) */}
        {monsters.length === 0 && !burst && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "36%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "#b09a6e",
              pointerEvents: "none",
            }}
          >
            <div
              style={{ fontSize: 42, animation: "float-idle 3s ease-in-out infinite" }}
            >
              🌱
            </div>
            <div
              style={{ fontSize: 13, fontWeight: 600, marginTop: 6, whiteSpace: "nowrap" }}
            >
              桌面空空，下面召唤一只怪兽吧
            </div>
          </div>
        )}

        {/* ── Burst overlay (defeat animation) ── */}
        {burst && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
            }}
          >
            {burst.particles.map((p, i) => (
              <span
                key={i}
                style={
                  {
                    position: "absolute",
                    left: "50%",
                    top: "55%",
                    width: p.size,
                    height: p.size,
                    borderRadius: "50%",
                    background: p.color,
                    boxShadow: "0 0 8px rgba(255,255,255,0.8)",
                    animation: "burst-fly 0.6s cubic-bezier(.2,.6,.3,1) forwards",
                    "--tx": `${p.x}px`,
                    "--ty": `${p.y}px`,
                  } as React.CSSProperties
                }
              />
            ))}
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "52%",
                fontSize: 46,
                animation: "float-up 0.8s ease-out forwards",
              }}
            >
              💥
            </span>
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "38%",
                fontSize: 20,
                fontWeight: 900,
                color: "#16a34a",
                background: "rgba(255,255,255,0.9)",
                padding: "2px 10px",
                borderRadius: 999,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                whiteSpace: "nowrap",
                animation: "float-up 0.85s ease-out 0.1s forwards",
              }}
            >
              ✓ 消灭！
            </span>
          </div>
        )}
      </section>

      {/* ── Input bar ── */}
      <footer
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: "calc(18px + env(safe-area-inset-bottom))",
          padding: "0 16px 8px",
          zIndex: 30,
        }}
      >
        <div
          className="island-soft-panel"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 8px 8px 14px",
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMonster()}
            maxLength={TEXT_MAX_LENGTH}
            placeholder="写个待办，召唤一只小怪兽…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              color: "#3f3a2e",
            }}
          />
          <Button
            onClick={addMonster}
            size="sm"
            className="island-action-button flex items-center gap-1 !rounded-full px-4"
          >
            <Plus size={16} />
            召唤
          </Button>
        </div>
      </footer>

      {/* ── Confirm dialog ── */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            className="island-soft-panel w-full max-w-[300px] p-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-5xl" style={{ animation: "monster-wiggle 1.2s ease-in-out infinite" }}>
              {confirmTarget.emoji}
            </div>
            <p className="text-xs text-[#a0936e]">
              完成这个待办，消灭它吗？
            </p>
            <p
              className="mx-auto mt-2 inline-block rounded-full px-3 py-1 text-sm font-bold"
              style={{ background: confirmTarget.accent, color: confirmTarget.color }}
            >
              {confirmTarget.text}
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 rounded-full text-[#8a7a58]"
                onClick={() => setConfirmTarget(null)}
              >
                先留着
              </Button>
              <Button
                className="island-action-button flex-1 rounded-full"
                onClick={() => defeatMonster(confirmTarget)}
              >
                消灭它！
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* bottom spacer so the fixed input bar never covers content */}
      <div style={{ height: 96 }} />
    </main>
  );
}
