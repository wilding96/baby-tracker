"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, Gamepad2, Plus, Smartphone, Sparkles, Sword, Trash2, X } from "lucide-react";
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

const EDGE_X = 13;
const EDGE_Y = 14;

/** subtle pseudo-depth: top=y0=far/small, bottom=y100=near/large */
function scaleFromY(y: number) {
  return 0.96 + (y / 100) * 0.10;
}

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
  const rawRemainMs = nextAt - now;
  const overdue = rawRemainMs < 0;
  const remainMs = Math.max(0, rawRemainMs);
  const remainMin = Math.ceil(remainMs / 60000);
  const urgent = !overdue && rawRemainMs > 0 && rawRemainMs <= URGENT_WINDOW_MS;

  return (
    <div
      className="monster-card"
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
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
          color: overdue ? "#5a1a1a" : urgent ? "#c04040" : "#6b5e40",
          background: overdue ? "rgba(90,26,26,0.12)" : "rgba(255,255,255,0.85)",
          border: overdue
            ? "1px solid #7a202a"
            : urgent
              ? "1px solid #e0a0a0"
              : "1px solid rgba(140,120,80,0.15)",
          borderRadius: 999,
          padding: "2px 7px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        💩 {overdue ? "超时" : `${remainMin}m`}
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
            background: overdue
              ? "linear-gradient(90deg, #b91c1c, #7a202a)"
              : urgent
                ? "linear-gradient(90deg, #fbbf24, #f87171, #dc2626)"
                : "linear-gradient(90deg, #a3e635, #65a30d)",
            boxShadow: overdue
              ? "0 0 6px rgba(122,32,42,0.5)"
              : urgent
                ? "0 0 6px rgba(239,68,68,0.4)"
                : "0 0 4px rgba(132,204,22,0.3)",
            transition: "width 0.5s linear",
          }}
        />
      </div>

      {/* emoji body with self-lighting glow */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* monster glow halo */}
        <div
          style={{
            position: "absolute",
            width: overdue ? 58 : urgent ? 52 : 46,
            height: overdue ? 58 : urgent ? 52 : 46,
            borderRadius: "50%",
            background: overdue
              ? "radial-gradient(circle, rgba(70,12,34,0.55) 0%, rgba(70,12,34,0.22) 45%, transparent 72%)"
              : urgent
                ? "radial-gradient(circle, rgba(255,140,66,0.5) 0%, rgba(255,140,66,0.22) 45%, transparent 72%)"
                : `radial-gradient(circle, ${m.color}44 0%, ${m.color}18 40%, transparent 70%)`,
            filter: `blur(9px)`,
            opacity: selected ? 1 : 0.7,
            transition: "opacity 0.3s ease",
          }}
        />
        <div
          className="monster-body"
          style={{
            display: "flex",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
            transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), filter 0.18s ease",
            filter: overdue
              ? selected
                ? "grayscale(0.4) brightness(0.75) saturate(0.55) drop-shadow(0 0 12px rgba(180,90,90,0.5))"
                : "grayscale(0.4) brightness(0.6) saturate(0.45)"
              : selected
                ? "brightness(1.15) saturate(1.25) drop-shadow(0 0 10px rgba(255,200,100,0.5))"
                : "none",
          }}
        >
          <span
            className="monster-emoji"
            style={{
              fontSize: overdue ? 50 : 42,
              lineHeight: 1,
              transform: `scaleX(${facing})`,
              filter: overdue
                ? "drop-shadow(0 5px 3px rgba(0,0,0,0.35)) drop-shadow(0 0 12px rgba(70,10,30,0.5))"
                : `drop-shadow(0 7px 5px rgba(0,0,0,0.25)) drop-shadow(0 0 12px ${m.color}44)`,
              animation: `wiggle ${overdue ? "0.7s" : "4s"} ease-in-out ${index * 0.6}s infinite`,
            }}
          >
            {m.emoji}
          </span>
        </div>
      </div>
    </div>
  );
}

const POOP_INTERVAL_MS = 60000; // 1分钟拉一坨屎（测试用，正式改回 3600000）
const URGENT_WINDOW_MS = 20_000; // 剩余20秒进入着急态（测试用，正式改回 10*60000）

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

        const hrIndex = Math.floor((Date.now() - m.createdAt) / POOP_INTERVAL_MS);
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
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            lineHeight: 1,
            filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))",
            pointerEvents: "none",
            zIndex: 5,
            animation: "poop-drop 0.35s cubic-bezier(.34,1.56,.64,1) forwards",
          }}
        >
          💩
        </div>
      ))}

      {monsters.map((m, i) => {
        const p = poses[m.id] ?? ensurePose(posesRef.current, m.id);
        const rawRemain = m.createdAt + (p.lastDropped + 1) * POOP_INTERVAL_MS - renderNow;
        const overdue = rawRemain < 0;
        const urgent = !overdue && rawRemain > 0 && rawRemain <= URGENT_WINDOW_MS;
        const stateScale = overdue ? 1.24 : urgent ? 1.1 : 1;
        return (
          <div
            key={m.id}
            className="monster-slot"
            onPointerDown={() => onSelect(m)}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: 76,
              height: 112,
              transform: `translate(-50%, -100%) scale(${scaleFromY(p.y) * stateScale})`,
              transformOrigin: "bottom center",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              cursor: "pointer",
              zIndex: 10,
            }}
          >
            {/* ground shadow — pinned to landing spot, never floats */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: 34 * stateScale,
                height: 9 * stateScale,
                borderRadius: "50%",
                background: overdue
                  ? "radial-gradient(ellipse, rgba(15,25,10,0.42) 0%, rgba(15,25,10,0.18) 60%, transparent 74%)"
                  : "radial-gradient(ellipse, rgba(30,60,25,0.30) 0%, rgba(30,60,25,0.12) 60%, transparent 72%)",
                filter: "blur(1.5px)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />
            {/* card-only float animation — shadow stays grounded */}
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                animation: `card-float 3.2s ease-in-out ${i * 0.4}s infinite`,
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
  const [showBestiary, setShowBestiary] = useState(false);
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

  // bestiary groups: one entry per species, with count + most recent task text
  const bestiary = useMemo(
    () =>
      MONSTER_VISUALS.map((visual) => {
        const caught = data.history
          .filter((h) => h.name === visual.name)
          .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));
        return {
          ...visual,
          count: caught.length,
          latestText: caught[0]?.text ?? null,
          caughtAt: caught[0]?.completedAt ?? null,
        };
      }).filter((s) => s.count > 0),
    [data.history],
  );
  const totalCaught = data.history.length;
  const speciesCaught = bestiary.length;

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
        .garden-shake { animation: garden-shake 0.42s ease; }
        @keyframes garden-shake {
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
        @keyframes poop-drop {
          0%   { opacity: 0; transform: translate(-50%, -120%) scale(0.3); }
          55%  { opacity: 1; transform: translate(-50%, -55%)  scale(1.15); }
          100% { transform: translate(-50%, -50%)  scale(1); }
        }
      `}</style>

      {/* SVG defs for scene textures */}
      <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
        <defs>
          <filter id="scene-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.03" />
            </feComponentTransfer>
          </filter>
        </defs>
      </svg>

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
          href="/games"
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
          <p className="text-xs text-[#a0936e] font-medium">把待办变成怪兽，一只只收服</p>
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
            今日收服 <span className="text-[#f59e0b]">{todayDone}</span>
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
        <button
          onClick={() => setShowBestiary(true)}
          aria-label="收服图鉴"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            borderRadius: 20,
            background: "rgba(255,253,245,0.8)",
            backdropFilter: "blur(8px)",
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(61,52,40,0.06), 0 0 0 1px rgba(255,255,255,0.5) inset",
          }}
        >
          <BookOpen size={15} style={{ color: "#8b5cf6" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#4a5e2a" }}>
            {speciesCaught || 0}/{MONSTER_VISUALS.length}
          </span>
        </button>
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
            👆 点击小怪兽收服已完成的任务
          </span>
        </div>
      )}

      {/* ── Garden scene ── */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
          minHeight: 0,
          padding: "4px 16px 8px",
        }}
      >
        <div
          className={shaking ? "garden-shake" : ""}
          style={{
            width: "100%",
            maxWidth: "26rem",
            aspectRatio: "5 / 4",
            maxHeight: "100%",
            position: "relative",
            borderRadius: 22,
            overflow: "hidden",
            border: "2.5px solid #9daf7a",
            boxShadow: `
              0 7px 30px rgba(35,55,15,0.20),
              0 0 0 5px #d4c9a2,
              0 0 0 7px #b8a070,
              inset 0 2px 24px rgba(0,0,0,0.06)
            `,
          }}
        >
          {/* grass base — layered green gradient */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(170deg, #cde39e 0%, #b4d076 28%, #9fc160 55%, #90b450 82%, #87a948 100%)",
            }}
            aria-hidden
          />

          {/* sun / light dapples */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `
                radial-gradient(circle at 18% 22%, rgba(255,252,220,0.22) 0%, transparent 28%),
                radial-gradient(circle at 72% 32%, rgba(235,250,200,0.18) 0%, transparent 24%),
                radial-gradient(circle at 30% 68%, rgba(210,240,160,0.16) 0%, transparent 30%),
                radial-gradient(circle at 62% 78%, rgba(180,220,130,0.20) 0%, transparent 32%),
                radial-gradient(circle at 85% 55%, rgba(200,235,150,0.14) 0%, transparent 28%),
                radial-gradient(circle at 48% 14%, rgba(220,240,180,0.18) 0%, transparent 24%)
              `,
            }}
            aria-hidden
          />

          {/* grass-blade texture — subtle individual blades */}
          <div style={{ position: "absolute", inset: 0, opacity: 0.10 }} aria-hidden>
            {Array.from({ length: 50 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${(i * 7 + 3) % 97}%`,
                  top: `${(i * 11 + 5) % 94}%`,
                  width: 1.5,
                  height: 4 + ((i * 3) % 7),
                  background: `rgba(${35 + (i % 25)},${80 + (i % 35)},${25 + (i % 18)},0.55)`,
                  transform: `rotate(${i * 19}deg)`,
                  borderRadius: "40% 40% 0 0",
                }}
              />
            ))}
          </div>

          {/* decorative flowers — scattered pops of color */}
          {[
            { x: 10, y: 14, c: "#f2a0c8", s: 5.5 },
            { x: 84, y: 12, c: "#fad068", s: 6 },
            { x: 6, y: 72, c: "#d4a0f0", s: 4.5 },
            { x: 92, y: 68, c: "#f2a0c8", s: 5 },
            { x: 48, y: 90, c: "#fad068", s: 6.5 },
            { x: 68, y: 6, c: "#d4a0f0", s: 4 },
            { x: 22, y: 86, c: "#f8c0d8", s: 4 },
            { x: 80, y: 84, c: "#a0d8f2", s: 5 },
            { x: 38, y: 4, c: "#fad068", s: 4.5 },
            { x: 56, y: 92, c: "#f2a0c8", s: 5 },
          ].map((f, i) => (
            <div
              key={`flower-${i}`}
              style={{
                position: "absolute",
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: f.s,
                height: f.s,
                borderRadius: "50%",
                background: f.c,
                boxShadow: `0 0 3px ${f.c}88, 0 0 6px ${f.c}44`,
                pointerEvents: "none",
              }}
              aria-hidden
            />
          ))}

          {/* small stones */}
          {[
            { x: 24, y: 28, w: 11, h: 7, bg: "radial-gradient(ellipse at 40% 35%, #d8d0c0, #a8a090)" },
            { x: 72, y: 42, w: 9, h: 6, bg: "radial-gradient(ellipse at 40% 35%, #ddd5c5, #b0a898)" },
            { x: 42, y: 68, w: 8, h: 5.5, bg: "radial-gradient(ellipse at 40% 35%, #d2caba, #a09888)" },
            { x: 14, y: 52, w: 10, h: 6.5, bg: "radial-gradient(ellipse at 40% 35%, #dcd4c4, #a8a090)" },
            { x: 86, y: 32, w: 8, h: 5, bg: "radial-gradient(ellipse at 40% 35%, #d5cdbd, #a49c8c)" },
          ].map((s, i) => (
            <div
              key={`stone-${i}`}
              style={{
                position: "absolute",
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.w,
                height: s.h,
                borderRadius: "45% 55% 50% 50%",
                background: s.bg,
                boxShadow: "0 1px 2px rgba(0,0,0,0.10)",
                pointerEvents: "none",
              }}
              aria-hidden
            />
          ))}

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

        {/* empty-state */}
        {monsters.length === 0 && !burst && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "45%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: "#6a8a4a",
              pointerEvents: "none",
            }}
          >
            <div style={{ fontSize: 52, animation: "card-float 3s ease-in-out infinite" }}>
              🌱
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                marginTop: 10,
                marginBottom: 4,
                whiteSpace: "nowrap",
              }}
            >
              花园里静悄悄的，点击右下角召唤怪兽吧
            </div>
            <div style={{ fontSize: 11, opacity: 0.7 }}>
              💡 每过1分钟怪兽会 💩，20秒内收服最佳
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
              ✓ 收服了！
            </span>
          </div>
        )}

        {/* subtle film grain — works fine on garden */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 0,
            opacity: 0.5,
            filter: "url(#scene-grain)",
          }}
          aria-hidden
        />
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
          boxShadow: "0 4px 0 #4a8a14, 0 8px 24px rgba(124,200,56,0.45)",
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
            "0 1px 0 #4a8a14, 0 4px 10px rgba(124,200,56,0.35)";
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
                添加到桌面，随时收服怪兽
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

      {/* ── Bestiary modal ── */}
      {showBestiary && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 backdrop-blur-sm"
          onClick={() => setShowBestiary(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(100%, 340px)",
              margin: "0 24px",
              maxHeight: "70vh",
              overflowY: "auto",
              padding: "24px 20px 20px",
              borderRadius: 24,
              background: "rgba(255,253,245,0.92)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1.5px solid rgba(200,180,140,0.25)",
              boxShadow:
                "0 20px 60px rgba(60,40,20,0.2), 0 0 0 1px rgba(255,255,255,0.3) inset",
              animation: "modal-in 0.25s cubic-bezier(.34,1.56,.64,1)",
            }}
          >
            {/* header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#4a5e2a" }}>
                📖 收服图鉴
              </span>
              <button
                onClick={() => setShowBestiary(false)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: "1px solid rgba(150,130,100,0.2)",
                  background: "rgba(255,255,255,0.6)", color: "#a0936e",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            </div>

            {/* stats row */}
            <div
              style={{
                display: "flex", gap: 10, marginBottom: 16,
                padding: "10px 14px", borderRadius: 14,
                background: "rgba(220,240,180,0.15)",
                border: "1px solid rgba(160,200,130,0.2)",
              }}
            >
              {[
                { label: "总收服", value: totalCaught, color: "#f59e0b" },
                { label: "品种", value: `${speciesCaught}/${MONSTER_VISUALS.length}`, color: "#8b5cf6" },
                { label: "今日", value: todayDone, color: "#22c55e" },
              ].map((stat) => (
                <div key={stat.label} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 900, color: stat.color, lineHeight: 1.2 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 9.5, fontWeight: 600, color: "#8a7a58", marginTop: 2 }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* species list */}
            {bestiary.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px 0", color: "#b09a6e" }}>
                <div style={{ fontSize: 44, marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>还没有收服任何怪兽哦～</div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
                  完成待办就能收服第一只！
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {bestiary.map((species) => (
                  <div
                    key={species.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.6)",
                      border: `1px solid ${species.accent}44`,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}
                  >
                    <span style={{ fontSize: 32, lineHeight: 1, filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.15))" }}>
                      {species.emoji}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: species.color }}>
                        {species.name}
                      </div>
                      {species.latestText && (
                        <div
                          style={{
                            fontSize: 11, color: "#8a7a58", marginTop: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}
                        >
                          「{species.latestText}」
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        flexShrink: 0,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: `${species.color}18`,
                        color: species.color,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      ×{species.count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
                  boxShadow: "0 3px 0 #4a8a14, 0 6px 18px rgba(124,200,56,0.4)",
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
              完成这个待办，收服它吗？
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
                  boxShadow: "0 3px 0 #4a8a14, 0 6px 18px rgba(124,200,56,0.4)",
                  fontWeight: 700,
                }}
              >
                收服它！
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
