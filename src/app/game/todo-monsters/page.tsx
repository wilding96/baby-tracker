"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Gamepad2, Plus, Smartphone, Sparkles, Sword, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallPrompt } from "@/components/InstallPrompt";
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
// Monster visual
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

const EDGE_X = 14;
const EDGE_Y = 33;

function randPose(): MonsterPose {
  const dir = Math.random() * Math.PI * 2;
  const speed = 4 + Math.random() * 9;
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
        gap: 2,
        animation: `card-float 2.8s ease-in-out ${index * 0.35}s infinite`,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 800,
          lineHeight: 1.2,
          padding: "2px 8px",
          borderRadius: 999,
          background: `linear-gradient(135deg, ${m.accent}dd, ${m.accent}99)`,
          color: m.color,
          whiteSpace: "nowrap",
          boxShadow: `0 2px 6px rgba(0,0,0,0.12), 0 0 0 1px ${m.color}22, inset 0 1px 0 rgba(255,255,255,0.5)`,
          border: `1px solid ${m.color}28`,
        }}
      >
        {m.text}
      </span>

      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 9.5,
          fontWeight: 800,
          lineHeight: 1,
          color: urgent ? "#c04040" : "#6b5e40",
          background: "rgba(255,255,255,0.85)",
          border: urgent ? "1px solid #e0a0a0" : "1px solid rgba(140,120,80,0.15)",
          borderRadius: 999,
          padding: "2px 7px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        💩 {remainMin}m
      </span>

      <div
        style={{
          width: 46,
          height: 5,
          borderRadius: 999,
          background: "rgba(200,185,150,0.35)",
          overflow: "hidden",
          boxShadow: "inset 0 1px 2px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: urgent
              ? "linear-gradient(90deg, #fbbf24, #f87171, #dc2626)"
              : "linear-gradient(90deg, #a3e635, #65a30d)",
            boxShadow: urgent
              ? "0 0 6px rgba(239,68,68,0.4)"
              : "0 0 4px rgba(132,204,22,0.3)",
            transition: "width 0.5s linear",
          }}
        />
      </div>

      <div
        className="monster-body"
        style={{
          display: "flex",
          alignItems: "center",
          transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), filter 0.18s ease",
          filter: selected
            ? "brightness(1.15) saturate(1.25) drop-shadow(0 0 10px rgba(255,200,100,0.5))"
            : "none",
        }}
      >
        <span
          className="monster-emoji"
          style={{
            fontSize: 42,
            lineHeight: 1,
            transform: `scaleX(${facing})`,
            filter: "drop-shadow(0 7px 5px rgba(0,0,0,0.25))",
            animation: `wiggle 4s ease-in-out ${index * 0.6}s infinite`,
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
// Wandering monster field
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
      for (const m of monstersRef.current) {
        const p = map.get(m.id);
        if (!p) continue;

        if (now >= p.nextTurn) {
          p.nextTurn = now + 1200 + Math.random() * 2800;
          const dir = Math.random() * Math.PI * 2;
          const speed = 4 + Math.random() * 9;
          p.vx = Math.cos(dir) * speed;
          p.vy = Math.sin(dir) * speed;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < EDGE_X) { p.x = EDGE_X; p.vx = Math.abs(p.vx); }
        if (p.x > 100 - EDGE_X) { p.x = 100 - EDGE_X; p.vx = -Math.abs(p.vx); }
        if (p.y < EDGE_Y) { p.y = EDGE_Y; p.vy = Math.abs(p.vy); }
        if (p.y > 100 - EDGE_Y) { p.y = 100 - EDGE_Y; p.vy = -Math.abs(p.vy); }

        if (p.vx > 0.05) p.facing = 1;
        else if (p.vx < -0.05) p.facing = -1;

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

  return (
    <>
      {poops.map((poop) => (
        <div
          key={poop.id}
          style={{
            position: "absolute",
            left: `${poop.x}%`,
            top: `${poop.y}%`,
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: "radial-gradient(circle at 35% 30%, #d4b060, #7a5c2e)",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(0,0,0,0.2)",
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
            zIndex: 1,
          }}
        />
      ))}

      {monsters.map((m, i) => {
        const p = poses[m.id] ?? ensurePose(posesRef.current, m.id);
        return (
          <Fragment key={m.id}>
            <div
              style={{
                position: "absolute",
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 38,
                height: 10,
                borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(80,45,10,0.28), transparent 65%)",
                filter: "blur(3px)",
                transform: "translate(-50%, -50%)",
                pointerEvents: "none",
                zIndex: 2,
              }}
            />
            <div
              className="monster-slot"
              onPointerDown={() => onSelect(m)}
              style={{
                position: "absolute",
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: 76,
                height: 110,
                marginLeft: -38,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center",
                transform: `rotateZ(${-ROT_Z}deg) rotateX(${-ROT_X}deg) translateZ(20px)`,
                transformOrigin: "center bottom",
                transformStyle: "preserve-3d",
                cursor: "pointer",
                zIndex: 10,
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<Monster | null>(null);
  const [burst, setBurst] = useState<{ m: Monster; particles: Particle[] } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── show install hint banner after a delay ──
  useEffect(() => {
    const dismissed = localStorage.getItem("todo-monsters-install-dismissed");
    if (dismissed) return;
    const t = setTimeout(() => setShowInstallBanner(true), 4000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  // auto-focus input when modal opens
  useEffect(() => {
    if (showAddModal) {
      const t = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [showAddModal]);

  const monsters = data.monsters;
  const todayDone = useMemo(
    () => data.history.filter((h) => h.completedAt && isToday(h.completedAt)).length,
    [data.history],
  );

  const deskFull = monsters.length >= MAX_MONSTERS;

  const openAddModal = () => {
    setInput("");
    setShowAddModal(true);
  };

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
    setShowAddModal(false);
    playSpawn();
  };

  const defeatMonster = (m: Monster) => {
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
    <main
      style={{
        height: "100dvh",
        overflow: "hidden",
        background: `
          radial-gradient(ellipse at 50% 0%, rgba(200,220,160,0.18) 0%, transparent 55%),
          linear-gradient(180deg, #f9f7ec 0%, #f1edda 40%, #e8e2cc 100%)
        `,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      <style>{`
        @keyframes card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes wiggle {
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
        @keyframes slide-up {
          0% { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes modal-in {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
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
        @keyframes mote-drift {
          0% { transform: translate(0, 0) scale(1); opacity: 0; }
          20% { opacity: 0.7; }
          80% { opacity: 0.3; }
          100% { transform: translate(var(--mx), var(--my)) scale(0.3); opacity: 0; }
        }
      `}</style>

      {/* ambient dust motes */}
      <div
        style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}
        aria-hidden
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${10 + i * 11}%`,
              top: `${15 + (i * 17) % 60}%`,
              width: 2 + (i % 3),
              height: 2 + (i % 3),
              borderRadius: "50%",
              background: "rgba(200,180,140,0.5)",
              animation: `mote-drift ${3 + (i % 4)}s ease-in ${i * 1.7}s infinite`,
              ["--mx" as string]: `${-10 + i * 3}px`,
              ["--my" as string]: `${-15 + i * 2}px`,
            }}
          />
        ))}
      </div>

      {/* ── Header ── */}
      <header
        style={{
          width: "min(100%, 28rem)",
          margin: "0 auto",
          padding: "16px 16px 4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "relative",
          zIndex: 5,
          flexShrink: 0,
        }}
      >
        <Link
          href="/discover"
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#fffdf5] text-[#7a6a4a] shadow-md hover:shadow-lg hover:bg-[#fff9ec] transition-all"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="flex flex-col items-center">
          <h1
            className="text-xl font-black tracking-wide"
            style={{
              background: "linear-gradient(135deg, #3d6b1e, #5a9330)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            消灭小怪兽
          </h1>
          <p className="text-xs text-[#a0936e] font-medium">把待办变成怪兽，一只只消灭</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowInstall(true)}
            aria-label="安装到桌面"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#fffdf5] text-[#7a6a4a] shadow-md hover:text-[#5a9330] hover:bg-green-50 hover:border-green-200 transition-all"
          >
            <Smartphone size={16} />
          </button>
          <button
            onClick={resetAll}
            aria-label="清空数据"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#fffdf5] text-[#a0936e] shadow-md hover:text-[#c04040] hover:bg-red-50 hover:border-red-200 transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </header>

      {/* ── Stats strip ── */}
      <div
        style={{
          width: "min(100%, 28rem)",
          margin: "0 auto",
          padding: "4px 16px 6px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          position: "relative",
          zIndex: 5,
          flexShrink: 0,
        }}
      >
        <div
          className="island-soft-panel flex items-center gap-2 px-4 py-2"
          style={{
            background: "rgba(255,253,245,0.8)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(61,52,40,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          <Sparkles size={16} className="text-[#f59e0b]" />
          <span className="text-sm font-bold" style={{ color: "#4a5e2a" }}>
            今日消灭 <span className="text-[#f59e0b]">{todayDone}</span>
          </span>
        </div>
        <div
          className="island-soft-panel flex items-center gap-2 px-4 py-2"
          style={{
            background: "rgba(255,253,245,0.8)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 4px 12px rgba(61,52,40,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          <Sword size={16} className="text-[#a855f7]" />
          <span className="text-sm font-bold" style={{ color: "#4a5e2a" }}>
            怪兽 <span className="text-[#a855f7]">{monsters.length}/{MAX_MONSTERS}</span>
          </span>
        </div>
      </div>

      {/* ── Tip hint ── */}
      {monsters.length > 0 && (
        <div
          style={{
            width: "min(100%, 28rem)",
            margin: "0 auto",
            padding: "0 16px 6px",
            display: "flex",
            justifyContent: "center",
            position: "relative",
            zIndex: 5,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#b09a6e",
              background: "rgba(255,255,255,0.5)",
              borderRadius: 999,
              padding: "2px 12px",
            }}
          >
            👆 点击小怪兽消灭已完成的任务
          </span>
        </div>
      )}

      {/* ── Desk scene ── */}
      <section
        style={{
          perspective: "950px",
          perspectiveOrigin: "50% 22%",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          position: "relative",
          zIndex: 1,
          minHeight: 0,
        }}
      >
        {/* floor rug */}
        <div
          style={{
            position: "absolute",
            top: "48%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 420,
            height: 140,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at center, rgba(120,80,30,0.14) 0%, rgba(120,80,30,0.05) 40%, transparent 70%)",
            filter: "blur(16px)",
            pointerEvents: "none",
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
                background: `
                  url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='40'%3E%3Crect width='200' height='40' fill='%23fdf6e3'/%3E%3Cline x1='0' y1='6' x2='200' y2='7' stroke='rgba(190,155,100,0.12)' stroke-width='1'/%3E%3Cline x1='0' y1='14' x2='200' y2='14.5' stroke='rgba(190,155,100,0.08)' stroke-width='0.8'/%3E%3Cline x1='0' y1='22' x2='200' y2='23' stroke='rgba(190,155,100,0.14)' stroke-width='1.2'/%3E%3Cline x1='0' y1='30' x2='200' y2='30' stroke='rgba(190,155,100,0.06)' stroke-width='0.6'/%3E%3Cline x1='0' y1='36' x2='200' y2='37.5' stroke='rgba(190,155,100,0.1)' stroke-width='0.9'/%3E%3Cellipse cx='60' cy='18' rx='4' ry='2.5' fill='rgba(170,130,70,0.08)'/%3E%3Cellipse cx='165' cy='28' rx='3' ry='2' fill='rgba(170,130,70,0.06)'/%3E%3C/svg%3E"),
                  linear-gradient(160deg, #fdf6e3 0%, #f3e5c3 55%, #ead8b0 100%)
                `,
                boxShadow:
                  "0 14px 36px rgba(120,85,35,0.28), 0 1px 0 rgba(255,255,255,0.5) inset, 0 -8px 16px rgba(160,120,60,0.15) inset",
              }}
            />
            {/* desk grid */}
            <div
              style={{
                position: "absolute",
                inset: 8,
                borderRadius: 14,
                pointerEvents: "none",
                backgroundImage:
                  "repeating-linear-gradient(0deg, rgba(140,105,55,0.06) 0 1px, transparent 1px 31px), repeating-linear-gradient(90deg, rgba(140,105,55,0.06) 0 1px, transparent 1px 31px)",
              }}
            />
            {/* desk edge */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                background: "linear-gradient(180deg, #d4b885, #b89360)",
                transform: "translateZ(-9px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 20,
                background: "linear-gradient(180deg, #c4a46a, #9a7a4a)",
                transform: "translateZ(-5px)",
              }}
            />

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

        {/* empty-state */}
        {monsters.length === 0 && !burst && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "42%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "#b09a6e",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 52, animation: "card-float 3s ease-in-out infinite" }}>
              🌱
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, marginTop: 10, marginBottom: 4, whiteSpace: "nowrap" }}>
              桌面空空，点击右下角召唤怪兽吧
            </div>
            <div style={{ fontSize: 11, opacity: 0.6 }}>
              💡 每过1小时怪兽会 💩，10分钟内消灭最佳
            </div>
          </div>
        )}

        {/* burst overlay */}
        {burst && (
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
                background: "rgba(255,255,255,0.92)",
                padding: "3px 12px",
                borderRadius: 999,
                boxShadow: "0 4px 16px rgba(0,0,0,0.1), 0 0 0 1px rgba(255,255,255,0.6) inset",
                whiteSpace: "nowrap",
                animation: "float-up 0.85s ease-out 0.1s forwards",
              }}
            >
              ✓ 消灭！
            </span>
          </div>
        )}
      </section>

      {/* ── Floating add button ── */}
      <button
        onClick={openAddModal}
        aria-label="添加待办"
        style={{
          position: "fixed",
          right: 20,
          bottom: "calc(80px + env(safe-area-inset-bottom, 16px))",
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #7cc838, #5fa81e)",
          boxShadow: "0 4px 0 #4a8a14, 0 8px 20px rgba(95,168,30,0.35)",
          border: "none",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 25,
          transition: "transform 0.15s ease, box-shadow 0.15s ease",
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.92)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 1px 0 #4a8a14, 0 4px 10px rgba(95,168,30,0.25)";
        }}
        onPointerUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
          (e.currentTarget as HTMLButtonElement).style.boxShadow =
            "0 4px 0 #4a8a14, 0 8px 20px rgba(95,168,30,0.35)";
        }}
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>

      {/* ── Floating install hint banner ── */}
      {showInstallBanner && (
        <div
          style={{
            position: "fixed",
            left: 16,
            right: 16,
            bottom: 96,
            zIndex: 35,
            maxWidth: "28rem",
            margin: "0 auto",
            animation: "slide-up 0.35s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 16,
              background: "rgba(255,253,245,0.94)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              boxShadow: "0 6px 24px rgba(60,40,20,0.12), 0 0 0 1px rgba(200,180,140,0.18)",
              border: "1px solid rgba(200,180,140,0.2)",
            }}
          >
            <span
              style={{
                flexShrink: 0,
                width: 34,
                height: 34,
                borderRadius: 12,
                background: "linear-gradient(135deg, #7cc838, #5fa81e)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 6px rgba(95,168,30,0.3)",
              }}
            >
              <Gamepad2 size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4a5e2a" }}>
                添加到桌面，随时消灭怪兽
              </div>
              <div style={{ fontSize: 10, color: "#b09a6e", marginTop: 1 }}>
                必须重新添加，桌面才有小怪兽入口
              </div>
            </div>
            <button
              onClick={() => setShowInstall(true)}
              style={{
                flexShrink: 0,
                padding: "5px 12px",
                borderRadius: 999,
                background: "linear-gradient(135deg, #7cc838, #5fa81e)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                boxShadow: "0 2px 0 #4a8a14",
              }}
            >
              添加
            </button>
            <button
              onClick={() => {
                setShowInstallBanner(false);
                localStorage.setItem("todo-monsters-install-dismissed", "1");
              }}
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                borderRadius: "50%",
                border: "1px solid rgba(150,130,100,0.15)",
                background: "rgba(255,255,255,0.5)",
                color: "#a0936e",
                fontSize: 12,
                lineHeight: "20px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Install dialog ── */}
      <InstallPrompt open={showInstall} onOpenChange={setShowInstall} />

      {/* ── Add todo modal ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-sm"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 320px)",
              margin: "0 24px",
              padding: "24px 20px 20px",
              borderRadius: 24,
              background: "rgba(255,253,245,0.9)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1.5px solid rgba(200,180,140,0.25)",
              boxShadow:
                "0 20px 60px rgba(60,40,20,0.2), 0 0 0 1px rgba(255,255,255,0.3) inset",
              animation: "modal-in 0.25s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {/* modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#4a5e2a" }}>
                🎯 召唤新怪兽
              </span>
              <button
                onClick={() => setShowAddModal(false)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  border: "1px solid rgba(150,130,100,0.2)",
                  background: "rgba(255,255,255,0.6)",
                  color: "#a0936e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* input */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 14px",
                borderRadius: 16,
                background: "rgba(255,255,255,0.7)",
                border: "1.5px solid rgba(180,160,120,0.25)",
                boxShadow: "inset 0 1px 3px rgba(0,0,0,0.04)",
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
                  fontSize: 15,
                  color: "#3f3a2e",
                  fontWeight: 500,
                  minWidth: 0,
                }}
              />
            </div>

            {/* character count */}
            <div style={{ textAlign: "right", fontSize: 10, color: "#b0a080", marginTop: 4, marginBottom: 12 }}>
              {input.length}/{TEXT_MAX_LENGTH}
            </div>

            {/* random monster preview */}
            {input.trim().length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "10px 0 14px",
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 600, color: "#b09a6e" }}>
                  即将召唤 →
                </span>
                <div style={{ fontSize: 48, lineHeight: 1, marginTop: 4, filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.15))" }}>
                  {pickVisual(input).emoji}
                </div>
              </div>
            )}

            {/* action buttons */}
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 rounded-full text-[#8a7a58] font-semibold hover:bg-[#f0ead8]"
                onClick={() => setShowAddModal(false)}
              >
                取消
              </Button>
              <Button
                className="island-action-button flex-1 rounded-full flex items-center justify-center gap-1.5"
                onClick={addMonster}
                disabled={!input.trim()}
                style={{
                  background: "linear-gradient(135deg, #7cc838, #5fa81e)",
                  boxShadow: "0 3px 0 #4a8a14, 0 4px 8px rgba(95,168,30,0.25)",
                  fontWeight: 700,
                  opacity: !input.trim() ? 0.5 : 1,
                }}
              >
                <Plus size={16} />
                召唤
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirmTarget && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setConfirmTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 300px)",
              margin: "0 24px",
              padding: "28px 24px 24px",
              borderRadius: 28,
              background: "rgba(255,253,245,0.88)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1.5px solid rgba(200,180,140,0.25)",
              boxShadow:
                "0 20px 60px rgba(60,40,20,0.18), 0 0 0 1px rgba(255,255,255,0.3) inset",
              textAlign: "center",
            }}
          >
            <div
              className="mb-2 text-6xl"
              style={{ animation: "wiggle 1.2s ease-in-out infinite", filter: "drop-shadow(0 6px 8px rgba(0,0,0,0.2))" }}
            >
              {confirmTarget.emoji}
            </div>
            <p className="text-xs text-[#a0936e] font-medium mb-3">
              完成这个待办，消灭它吗？
            </p>
            <div
              style={{
                display: "inline-block",
                padding: "4px 14px",
                borderRadius: 999,
                background: `linear-gradient(135deg, ${confirmTarget.accent}dd, ${confirmTarget.accent}99)`,
                color: confirmTarget.color,
                fontSize: 14,
                fontWeight: 800,
                boxShadow: `0 2px 8px rgba(0,0,0,0.08), 0 0 0 1px ${confirmTarget.color}18, inset 0 1px 0 rgba(255,255,255,0.4)`,
              }}
            >
              {confirmTarget.text}
            </div>
            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 rounded-full text-[#8a7a58] font-semibold hover:bg-[#f0ead8]"
                onClick={() => setConfirmTarget(null)}
              >
                先留着
              </Button>
              <Button
                className="island-action-button flex-1 rounded-full"
                onClick={() => defeatMonster(confirmTarget)}
                style={{
                  background: "linear-gradient(135deg, #7cc838, #5fa81e)",
                  boxShadow: "0 3px 0 #4a8a14, 0 4px 8px rgba(95,168,30,0.25)",
                  fontWeight: 700,
                }}
              >
                消灭它！
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
