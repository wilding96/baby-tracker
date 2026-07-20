"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import {
  Spherical,
  Vector2,
  Raycaster,
  Group,
  type PerspectiveCamera,
  type Mesh,
} from "three";
import { Button } from "@/components/ui/button";
import type { PuzzleBlock, TraySlot, GamePhase } from "./types";
import { playPickup, playMatch, playLevelComplete, playGameOver } from "./useGameSounds";
import {
  COLOR_PALETTE,
  CAMERA_RADIUS,
  CAMERA_RADIUS_MIN,
  CAMERA_RADIUS_MAX,
  MIN_PHI,
  MAX_PHI,
  DAMPING,
  SWIPE_SENSITIVITY,
  MAX_VELOCITY,
  BLOCK_SIZE,
  BLOCK_ROUND,
  BLOCK_GAP,
  TRAY_SIZE,
  MATCH_COUNT,
  TAP_THRESHOLD,
  REMOVE_DURATION_MS,
} from "./constants";

const uid = () => Math.random().toString(36).slice(2, 8);

function lighten(hex: string, percent: number) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + Math.round(255 * percent / 100));
  const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(255 * percent / 100));
  const b = Math.min(255, (num & 0x0000ff) + Math.round(255 * percent / 100));
  return `rgb(${r},${g},${b})`;
}

// ═══════════════════════════════════════════════════════════
// Puzzle generation
// ═══════════════════════════════════════════════════════════

function generatePuzzle(level: number, clickCount = 0): PuzzleBlock[] {
  const baseSize = Math.min(2 + Math.ceil(level / 2), 5);
  const total = baseSize * baseSize * baseSize;
  const tripletTotal = Math.floor(total / MATCH_COUNT) * MATCH_COUNT;
  const colorPool: number[] = [];

  for (let i = 0; i < tripletTotal; i += MATCH_COUNT) {
    const c = Math.floor(Math.random() * COLOR_PALETTE.length);
    colorPool.push(c, c, c);
  }
  for (let i = colorPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [colorPool[i], colorPool[j]] = [colorPool[j], colorPool[i]];
  }

  const half = (baseSize - 1) / 2;
  const blocks: PuzzleBlock[] = [];
  let idx = 0;

  gridLoop:
  for (let x = 0; x < baseSize; x++) {
    for (let y = 0; y < baseSize; y++) {
      for (let z = 0; z < baseSize; z++) {
        if (idx >= tripletTotal) break gridLoop;
        blocks.push({
          id: uid(),
          color: colorPool[idx] % COLOR_PALETTE.length,
          gridPos: [x, y, z],
          worldPos: [
            (x - half) * BLOCK_GAP,
            (y - half) * BLOCK_GAP,
            (z - half) * BLOCK_GAP,
          ],
          exposed: true,
          removed: false,
        });
        idx++;
      }
    }
  }
  return computeExposure(blocks);
}

function computeExposure(blocks: PuzzleBlock[]): PuzzleBlock[] {
  const grid = new Map<string, PuzzleBlock>();
  for (const b of blocks) {
    if (!b.removed) grid.set(b.gridPos.join(","), b);
  }
  return blocks.map((b) => {
    if (b.removed) return b;
    const [x, y, z] = b.gridPos;
    const neighbors = [
      grid.has(`${x + 1},${y},${z}`),
      grid.has(`${x - 1},${y},${z}`),
      grid.has(`${x},${y + 1},${z}`),
      grid.has(`${x},${y - 1},${z}`),
      grid.has(`${x},${y},${z + 1}`),
      grid.has(`${x},${y},${z - 1}`),
    ];
    return { ...b, exposed: neighbors.some((n) => !n) };
  });
}

function checkTrayMatch(tray: TraySlot[]): number | null {
  const count = new Map<number, TraySlot[]>();
  for (const slot of tray) {
    const arr = count.get(slot.color) || [];
    arr.push(slot);
    count.set(slot.color, arr);
    if (arr.length >= MATCH_COUNT) return slot.color;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// Camera shake
// ═══════════════════════════════════════════════════════════

const shakeOffsetRef = { x: 0, y: 0, z: 0 };
let shakeTimer = 0;
let shakeStrength = 0;

function triggerShake(strength = 0.03, duration = 80) {
  shakeStrength = strength;
  shakeTimer = duration;
}

// ═══════════════════════════════════════════════════════════
// R3F Sub-components
// ═══════════════════════════════════════════════════════════

function CameraController({
  velocityRef,
  isDraggingRef,
  radiusRef,
}: {
  velocityRef: React.MutableRefObject<{ theta: number; phi: number }>;
  isDraggingRef: React.MutableRefObject<boolean>;
  radiusRef: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const sphericalRef = useRef(new Spherical(radiusRef.current, Math.PI / 3, 0));
  const targetRadiusRef = useRef(radiusRef.current);

  useFrame((_state, delta) => {
    const vel = velocityRef.current;
    const spherical = sphericalRef.current;
    const dt = Math.min(delta, 0.1);

    spherical.radius += (targetRadiusRef.current - spherical.radius) * 0.12;
    radiusRef.current = spherical.radius;

    // Shake — smooth lerp toward zero, no random jitter
    if (shakeTimer > 0) {
      shakeTimer -= delta * 1000;
      shakeOffsetRef.x = (Math.sin(shakeTimer * 0.2)) * shakeStrength;
      shakeOffsetRef.y = (Math.cos(shakeTimer * 0.25)) * shakeStrength;
      shakeOffsetRef.z = (Math.cos(shakeTimer * 0.18)) * shakeStrength * 0.5;
    } else {
      shakeOffsetRef.x *= 0.85;
      shakeOffsetRef.y *= 0.85;
      shakeOffsetRef.z *= 0.85;
    }

    // Orbit
    spherical.theta += vel.theta * dt * 60;
    spherical.phi += vel.phi * dt * 60;

    spherical.theta = spherical.theta % (Math.PI * 2);
    spherical.phi = Math.max(MIN_PHI, Math.min(MAX_PHI, spherical.phi));

    if (!isDraggingRef.current) {
      vel.theta *= DAMPING;
      vel.phi *= DAMPING;
    }

    camera.position.setFromSpherical(spherical);
    camera.position.x += shakeOffsetRef.x;
    camera.position.y += shakeOffsetRef.y;
    camera.position.z += shakeOffsetRef.z;
    camera.lookAt(0, 0, 0);
  });

  useFrame(() => {
    targetRadiusRef.current = radiusRef.current;
  });

  return null;
}

function BlockMesh({
  block,
  isRemoving,
  meshRefCallback,
}: {
  block: PuzzleBlock;
  isRemoving: boolean;
  meshRefCallback: (id: string, mesh: Mesh | null) => void;
}) {
  const meshRef = useRef<Mesh>(null!);
  const groupRef = useRef<Group>(null!);
  const scaleRef = useRef(1);
  const breatheRef = useRef(0);

  const colorHex = COLOR_PALETTE[block.color]?.hex ?? "#FF9FB2";

  useEffect(() => {
    if (meshRef.current) meshRefCallback(block.id, meshRef.current);
    return () => meshRefCallback(block.id, null);
  }, [block.id, meshRefCallback]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (isRemoving) {
      scaleRef.current += (0 - scaleRef.current) * 0.18;
      groupRef.current.scale.setScalar(scaleRef.current);
      if (scaleRef.current < 0.05 && groupRef.current) groupRef.current.visible = false;
      return;
    }
    breatheRef.current += delta;
    const targetScale = block.exposed
      ? 1 + Math.sin(breatheRef.current * 2.0) * 0.015
      : 1;
    scaleRef.current += (targetScale - scaleRef.current) * 0.15;
    groupRef.current.scale.setScalar(scaleRef.current);
  });

  if (block.removed && !isRemoving) return null;

  return (
    <group ref={groupRef} position={block.worldPos}>
      {/* Candy glass body */}
      <RoundedBox
        ref={meshRef}
        args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]}
        radius={BLOCK_ROUND}
        smoothness={4}
      >
        <meshStandardMaterial
          color={block.exposed ? colorHex : "#c8c0b8"}
          roughness={0.28}
          metalness={0}
        />
      </RoundedBox>

      {/* Top highlight — glossy candy sheen */}
      <RoundedBox
        position={[0, BLOCK_SIZE * 0.51, 0]}
        args={[BLOCK_SIZE * 0.85, BLOCK_SIZE * 0.04, BLOCK_SIZE * 0.85]}
        radius={0.04}
        smoothness={2}
      >
        <meshBasicMaterial color="white" transparent opacity={0.15} />
      </RoundedBox>
    </group>
  );
}

function BlockStructure({
  blocks,
  removingIds,
  meshRefCallback,
}: {
  blocks: PuzzleBlock[];
  removingIds: Set<string>;
  meshRefCallback: (id: string, mesh: Mesh | null) => void;
}) {
  return (
    <group>
      {blocks.map((block) => {
        if (block.removed && !removingIds.has(block.id)) return null;
        return (
          <BlockMesh
            key={block.id}
            block={block}
            isRemoving={removingIds.has(block.id)}
            meshRefCallback={meshRefCallback}
          />
        );
      })}
    </group>
  );
}

function SceneLights() {
  return (
    <>
      {/* Warm main sunlight */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={2}
        color="#FFF1DD"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0003}
      />
      {/* Cool fill light */}
      <directionalLight
        position={[-4, 2, -4]}
        intensity={0.4}
        color="#ddeeff"
      />
      {/* Ambient */}
      <ambientLight intensity={0.5} color="#fff8f0" />
    </>
  );
}

function SoftFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]} receiveShadow>
      <circleGeometry args={[4.5, 32]} />
      <meshBasicMaterial color="#e8ddd0" transparent opacity={0.5} />
    </mesh>
  );
}

// Floating light dust particles
function FloatingDust({ count = 30 }: { count?: number }) {
  const positions = useMemo(() => {
    const pos: Float32Array = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 14;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14;
    }
    return pos;
  }, [count]);
  const ref = useRef<any>(null);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.015;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#ffffff"
        transparent
        opacity={0.2}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ═══════════════════════════════════════════════════════════
// DOM overlay components
// ═══════════════════════════════════════════════════════════

interface ScreenParticle {
  id: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  color: string;
  size: number;
}

function ParticleOverlay({ particles }: { particles: ScreenParticle[] }) {
  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full pointer-events-none z-20"
          style={{
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            "--tx": `${p.tx}px`,
            "--ty": `${p.ty}px`,
            animation: "particle-burst 600ms ease-out forwards",
          } as React.CSSProperties}
        />
      ))}
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════

export default function CubePuzzlePage() {
  const [gamePhase, setGamePhase] = useState<GamePhase>("menu");
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [totalRemoved, setTotalRemoved] = useState(0);
  const [blocks, setBlocks] = useState<PuzzleBlock[]>([]);
  const [tray, setTray] = useState<TraySlot[]>([]);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [particles, setParticles] = useState<ScreenParticle[]>([]);
  const [scorePopup, setScorePopup] = useState<{
    score: number; x: number; y: number; key: string;
  } | null>(null);
  const [trayBounce, setTrayBounce] = useState(false);
  const [matchFlash, setMatchFlash] = useState<number | null>(null);
  const [gameOverShake, setGameOverShake] = useState(false);

  const velocityRef = useRef({ theta: 0, phi: 0 });
  const isDraggingRef = useRef(false);
  const radiusRef = useRef(CAMERA_RADIUS);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const blocksRef = useRef<PuzzleBlock[]>([]);
  const meshRefMap = useRef<Map<string, Mesh>>(new Map());
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pointerDownPosRef = useRef({ x: 0, y: 0 });
  const processingRef = useRef(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const pinchStartDistRef = useRef(0);
  // Combo tracking for pitch increase
  const comboCountRef = useRef(0);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const setCameraRef = useCallback((cam: PerspectiveCamera | null) => {
    cameraRef.current = cam;
  }, []);

  const meshRefCallback = useCallback((id: string, mesh: Mesh | null) => {
    if (mesh) {
      meshRefMap.current.set(id, mesh);
    } else {
      meshRefMap.current.delete(id);
    }
  }, []);

  const handleBlockClick = useCallback((blockId: string) => {
    if (processingRef.current) return;
    const block = blocksRef.current.find((b) => b.id === blockId);
    if (!block || !block.exposed || block.removed) return;

    processingRef.current = true;
    const colorIdx = block.color;

    playPickup();
    // Camera shake on click
    triggerShake(0.025, 60);
    comboCountRef.current += 1;

    // Mark as removing — starts the scale-down + fragment animation
    setRemovingIds(new Set([blockId]));

    setTimeout(() => {
      setRemovingIds(new Set());

      setBlocks((prev) => {
        const updated = prev.map((b) =>
          b.id === blockId ? { ...b, removed: true } : b,
        );
        return computeExposure(updated);
      });
      setTotalRemoved((t) => t + 1);

      // Tray bounce
      setTrayBounce(true);
      setTimeout(() => setTrayBounce(false), 300);

      const newSlot: TraySlot = { id: uid(), color: colorIdx };
      setTray((prev) => {
        const newTray = [...prev, newSlot];
        const matchColor = checkTrayMatch(newTray);

        if (matchColor !== null) {
          playMatch();
          setMatchFlash(matchColor);

          const matchedIdxs: number[] = [];
          const kept: TraySlot[] = [];
          let count = 0;
          for (let i = newTray.length - 1; i >= 0 && count < MATCH_COUNT; i--) {
            if (newTray[i].color === matchColor) {
              matchedIdxs.push(i);
              count++;
            }
          }
          for (let i = 0; i < newTray.length; i++) {
            if (!matchedIdxs.includes(i)) kept.push(newTray[i]);
          }

          const matchScore = MATCH_COUNT * 15;
          setScore((s) => s + matchScore);
          comboCountRef.current = 0;

          if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const screenPositions = newTray
              .filter((_, i) => matchedIdxs.includes(i))
              .map((_, i) => ({
                x: rect.width / 2 + (i - 1) * 30,
                y: rect.height - 60,
              }));

            if (screenPositions.length > 0) {
              const cx = screenPositions.reduce((s, p) => s + p.x, 0) / screenPositions.length;
              const cy = screenPositions.reduce((s, p) => s + p.y, 0) / screenPositions.length;
              setScorePopup({ score: matchScore, x: cx, y: cy, key: uid() });
            }

            const newParticles: ScreenParticle[] = [];
            for (const pos of screenPositions) {
              const hex = COLOR_PALETTE[matchColor]?.hex ?? "#FF8FA3";
              const base = Math.random() * Math.PI * 2;
              for (let j = 0; j < 8; j++) {
                const a = base + (Math.PI * 2 * j) / 8;
                const d = 30 + Math.random() * 40;
                newParticles.push({
                  id: uid(),
                  x: pos.x,
                  y: pos.y,
                  tx: Math.cos(a) * d,
                  ty: Math.sin(a) * d,
                  color: hex,
                  size: 6 + Math.random() * 8,
                });
              }
            }
            setParticles(newParticles);
            setTimeout(() => setParticles([]), 700);
          }

          setTimeout(() => {
            setScorePopup(null);
            setMatchFlash(null);
          }, 800);

          setTimeout(() => {
            setBlocks((prev) => {
              const remaining = prev.filter((b) => !b.removed);
              if (remaining.length === 0) {
                playLevelComplete();
                setTimeout(() => setGamePhase("levelComplete"), 300);
              }
              return prev;
            });
            processingRef.current = false;
          }, 100);

          return kept;
        }

        if (newTray.length >= TRAY_SIZE) {
          playGameOver();
          // Game over shake
          setGameOverShake(true);
          setTimeout(() => {
            setGameOverShake(false);
            setGamePhase("gameOver");
          }, 500);
          processingRef.current = false;
        } else {
          processingRef.current = false;
        }
        return newTray;
      });
    }, REMOVE_DURATION_MS);
  }, []);

  const startGame = useCallback(() => {
    setLevel(1);
    setScore(0);
    setTotalRemoved(0);
    setBlocks(generatePuzzle(1));
    setTray([]);
    setRemovingIds(new Set());
    setGamePhase("playing");
    comboCountRef.current = 0;
  }, []);

  const nextLevel = useCallback(() => {
    const next = level + 1;
    setLevel(next);
    setTray([]);
    setRemovingIds(new Set());
    setBlocks(generatePuzzle(next));
    setGamePhase("playing");
    velocityRef.current = { theta: 0, phi: 0 };
    comboCountRef.current = 0;
  }, [level]);

  // ─── Pointer handlers ───

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const ptrs = activePointersRef.current;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.size === 2) {
      isDraggingRef.current = false;
      velocityRef.current = { theta: 0, phi: 0 };
      const pts = Array.from(ptrs.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      pinchStartDistRef.current = Math.sqrt(dx * dx + dy * dy);
    } else {
      isDraggingRef.current = true;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      velocityRef.current = { theta: 0, phi: 0 };
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const ptrs = activePointersRef.current;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ptrs.size === 2) {
      const pts = Array.from(ptrs.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (pinchStartDistRef.current > 0) {
        const ratio = dist / pinchStartDistRef.current;
        radiusRef.current = Math.max(
          CAMERA_RADIUS_MIN,
          Math.min(CAMERA_RADIUS_MAX, CAMERA_RADIUS / ratio),
        );
      }
    } else if (isDraggingRef.current) {
      const dx = e.clientX - lastPosRef.current.x;
      const dy = e.clientY - lastPosRef.current.y;
      lastPosRef.current = { x: e.clientX, y: e.clientY };
      velocityRef.current = {
        theta: Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, dx * SWIPE_SENSITIVITY)),
        phi: Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, -dy * SWIPE_SENSITIVITY)),
      };
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const ptrs = activePointersRef.current;
    ptrs.delete(e.pointerId);

    if (ptrs.size === 0) {
      if (isDraggingRef.current) {
        const dx = e.clientX - pointerDownPosRef.current.x;
        const dy = e.clientY - pointerDownPosRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < TAP_THRESHOLD && cameraRef.current && canvasContainerRef.current) {
          const rect = canvasContainerRef.current.getBoundingClientRect();
          const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          const raycaster = new Raycaster();
          raycaster.setFromCamera(new Vector2(ndcX, ndcY), cameraRef.current);

          const meshes: Mesh[] = [];
          for (const mesh of meshRefMap.current.values()) {
            if (mesh.parent) meshes.push(mesh);
          }
          const intersects = raycaster.intersectObjects(meshes);

          if (intersects.length > 0) {
            const hitMesh = intersects[0].object as Mesh;
            for (const [id, mesh] of meshRefMap.current) {
              if (mesh === hitMesh) {
                handleBlockClick(id);
                break;
              }
            }
          }
        }
      }
      isDraggingRef.current = false;
      pinchStartDistRef.current = 0;
    } else if (ptrs.size === 1) {
      const [pt] = ptrs.values();
      lastPosRef.current = { x: pt.x, y: pt.y };
      isDraggingRef.current = true;
      velocityRef.current = { theta: 0, phi: 0 };
    }
  }, [handleBlockClick]);

  const onPointerLeave = useCallback((e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size === 0) {
      isDraggingRef.current = false;
    }
  }, []);

  // ─── Render ───

  const activeBlocks = blocks.filter((b) => !b.removed || removingIds.has(b.id));

  return (
    <main
      className="min-h-screen pb-20"
      style={{
        background: "linear-gradient(160deg, #FFF5EB 0%, #fffaf3 40%, #f5ede0 100%)",
        position: "relative",
        zIndex: 1,
      }}
    >
      {/* Decorative floating blobs */}
      <div
        className="pointer-events-none fixed top-0 left-0 w-full h-full overflow-hidden z-0"
        aria-hidden
      >
        <div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.08]"
          style={{ background: "radial-gradient(circle, #FF8FA3, transparent 70%)" }}
        />
        <div
          className="absolute top-1/3 -left-16 w-48 h-48 rounded-full opacity-[0.06]"
          style={{ background: "radial-gradient(circle, #89CFF0, transparent 70%)" }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full opacity-[0.07]"
          style={{ background: "radial-gradient(circle, #9FE3C1, transparent 70%)" }}
        />
      </div>

      <div className="island-shell space-y-3 relative z-10">
        <header className="space-y-0.5">
          <p className="text-xs font-bold tracking-widest" style={{ color: "#b8a99a" }}>
            MINI GAME
          </p>
          <h1
            className="font-black tracking-tight"
            style={{ fontSize: 28, fontWeight: 700, color: "#5a4a3a" }}
          >
            方了个方
          </h1>
          <p
            className="font-normal"
            style={{ fontSize: 16, fontWeight: 400, color: "#b8a99a" }}
          >
            点击外层糖果方块，3个同色消除
          </p>
        </header>

        {/* Score card — glassmorphism */}
        <div
          className="flex items-center justify-between rounded-3xl px-5 py-3"
          style={{
            background: "rgba(255,255,255,0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(200,190,175,0.35)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-5">
            <div className="text-center">
              <span
                className="block font-black"
                style={{ fontSize: 28, lineHeight: 1, color: "#c49a6c" }}
              >
                {score}
              </span>
              <span className="text-xs" style={{ color: "#b8a99a" }}>得分</span>
            </div>
            <div className="text-center">
              <span
                className="block font-black"
                style={{ fontSize: 28, lineHeight: 1, color: "#8aaa7a" }}
              >
                {level}
              </span>
              <span className="text-xs" style={{ color: "#b8a99a" }}>关卡</span>
            </div>
            <div className="text-center">
              <span
                className="block font-black"
                style={{ fontSize: 28, lineHeight: 1, color: "#a09080" }}
              >
                {totalRemoved}
              </span>
              <span className="text-xs" style={{ color: "#b8a99a" }}>消除</span>
            </div>
          </div>
          {gamePhase === "playing" && (
            <button
              onClick={() => setGamePhase("menu")}
              className="rounded-2xl px-4 py-2 text-sm font-bold transition-all active:scale-95"
              style={{
                background: "rgba(200,190,175,0.3)",
                color: "#8a7a6a",
                border: "1px solid rgba(200,190,175,0.4)",
              }}
            >
              退出
            </button>
          )}
        </div>

        {/* 3D Canvas + Tray */}
        <div
          className="relative w-full rounded-2xl overflow-hidden"
          style={{
            height: "min(62vh, 500px)",
            background: "radial-gradient(ellipse at 50% 40%, #fff8f0 0%, #f2e8d8 50%, #e8ddd0 100%)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 0 80px rgba(255,240,220,0.3)",
            touchAction: "none",
            animation: gameOverShake ? "shake 500ms ease-out" : "none",
          }}
          ref={canvasContainerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          {/* 3D Scene */}
          {gamePhase !== "menu" && (
            <Canvas
              camera={{ position: [0, 0, CAMERA_RADIUS], fov: 45, near: 0.1, far: 100 }}
              gl={{ antialias: true, alpha: true }}
              style={{ width: "100%", height: "100%" }}
              onCreated={({ camera }) => {
                setCameraRef(camera as PerspectiveCamera);
              }}
            >
              <SceneLights />
              <SoftFloor />
              <FloatingDust count={30} />
              <BlockStructure
                blocks={activeBlocks}
                removingIds={removingIds}
                meshRefCallback={meshRefCallback}
              />
              <CameraController
                velocityRef={velocityRef}
                isDraggingRef={isDraggingRef}
                radiusRef={radiusRef}
              />
            </Canvas>
          )}

          {/* Particle effects */}
          <ParticleOverlay particles={particles} />

          {/* Score popup */}
          {scorePopup && (
            <div
              className="absolute pointer-events-none z-30 text-lg font-extrabold"
              style={{
                left: scorePopup.x,
                top: scorePopup.y,
                color: "#c49a6c",
                animation: "score-float 700ms ease-out forwards",
                textShadow: "0 1px 4px rgba(0,0,0,0.15)",
              }}
            >
              +{scorePopup.score}
            </div>
          )}

          {/* Menu */}
          {gamePhase === "menu" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20"
              style={{
                background: "rgba(255,251,245,0.82)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div className="text-center space-y-5 px-6">
                <div
                  className="mx-auto flex items-center justify-center w-20 h-20 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #FF9DB5, #B69CFF)",
                    boxShadow: "0 8px 32px rgba(182,156,255,0.35)",
                  }}
                >
                  <span style={{ fontSize: 36, filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))" }}>
                    🍬
                  </span>
                </div>
                <h2
                  className="font-black tracking-tight"
                  style={{ fontSize: 28, fontWeight: 700, color: "#5a4a3a" }}
                >
                  方了个方
                </h2>
                <p
                  className="text-sm max-w-xs leading-relaxed"
                  style={{ color: "#a09080" }}
                >
                  旋转视角，探索糖果积木雕塑
                  <br />
                  点击外层糖果块放入收集槽
                  <br />
                  集齐 3 个同色即可消除得分！
                </p>
                <button
                  onClick={startGame}
                  className="rounded-2xl px-12 py-3.5 font-black transition-all active:scale-95"
                  style={{
                    fontSize: 18,
                    background: "linear-gradient(135deg, #FF9DB5, #B69CFF)",
                    color: "#fff",
                    boxShadow: "0 6px 24px rgba(182,156,255,0.45)",
                  }}
                >
                  开始游戏
                </button>
              </div>
            </div>
          )}

          {/* Level complete */}
          {gamePhase === "levelComplete" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20"
              style={{
                background: "rgba(255,251,245,0.82)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div className="text-center space-y-4 px-6">
                <div
                  className="mx-auto flex items-center justify-center w-20 h-20 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #98E6C0, #8CCEFF)",
                    boxShadow: "0 8px 32px rgba(140,206,255,0.35)",
                  }}
                >
                  <span style={{ fontSize: 36 }}>🎉</span>
                </div>
                <h2
                  className="font-black tracking-tight"
                  style={{ fontSize: 28, fontWeight: 700, color: "#5a4a3a" }}
                >
                  第 {level} 关完成！
                </h2>
                <p className="text-sm" style={{ color: "#a09080" }}>
                  累计得分: <span style={{ color: "#c49a6c", fontWeight: 700, fontSize: 20 }}>{score}</span>
                </p>
                <button
                  onClick={nextLevel}
                  className="rounded-2xl px-12 py-3.5 font-black transition-all active:scale-95"
                  style={{
                    fontSize: 18,
                    background: "linear-gradient(135deg, #98E6C0, #8CCEFF)",
                    color: "#fff",
                    boxShadow: "0 6px 24px rgba(140,206,255,0.4)",
                  }}
                >
                  下一关 →
                </button>
              </div>
            </div>
          )}

          {/* Game over */}
          {gamePhase === "gameOver" && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center z-20"
              style={{
                background: "rgba(255,251,245,0.82)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            >
              <div className="text-center space-y-4 px-6">
                <div
                  className="mx-auto flex items-center justify-center w-20 h-20 rounded-full"
                  style={{
                    background: "linear-gradient(135deg, #FFD98E, #FF9FB2)",
                    boxShadow: "0 8px 32px rgba(255,159,178,0.35)",
                  }}
                >
                  <span style={{ fontSize: 36 }}>😅</span>
                </div>
                <h2
                  className="font-black tracking-tight"
                  style={{ fontSize: 28, fontWeight: 700, color: "#5a4a3a" }}
                >
                  收集槽满了
                </h2>
                <div className="flex items-center gap-4 justify-center text-sm" style={{ color: "#a09080" }}>
                  <span>得分 <span style={{ color: "#c49a6c", fontWeight: 700, fontSize: 18 }}>{score}</span></span>
                  <span>关卡 <span style={{ color: "#8aaa7a", fontWeight: 700, fontSize: 18 }}>{level}</span></span>
                </div>
                <button
                  onClick={startGame}
                  className="rounded-2xl px-12 py-3.5 font-black transition-all active:scale-95"
                  style={{
                    fontSize: 18,
                    background: "linear-gradient(135deg, #FF9DB5, #B69CFF)",
                    color: "#fff",
                    boxShadow: "0 6px 24px rgba(182,156,255,0.45)",
                  }}
                >
                  重新开始
                </button>
              </div>
            </div>
          )}

          {/* Tray — candy glass tray with circular capsules */}
          {gamePhase === "playing" && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
              <div
                className={`flex gap-2 px-4 py-3 pointer-events-auto transition-all duration-200 ${
                  trayBounce ? "scale-[1.04]" : "scale-100"
                } ${matchFlash !== null ? "ring-2 ring-white/50" : ""}`}
                style={{
                  background: "rgba(255,255,255,0.45)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(200,190,175,0.3)",
                  borderRadius: 999,
                  boxShadow: matchFlash !== null
                    ? `0 0 24px ${COLOR_PALETTE[matchFlash]?.hex}66`
                    : "0 4px 20px rgba(0,0,0,0.05)",
                }}
              >
                {Array.from({ length: TRAY_SIZE }).map((_, i) => {
                  const slot = tray[i];
                  return (
                    <div
                      key={i}
                      className={`transition-all duration-300 ${
                        matchFlash !== null && slot?.color === matchFlash
                          ? "animate-pulse scale-125"
                          : ""
                      }`}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        background: slot
                          ? `radial-gradient(circle at 35% 30%, ${lighten(COLOR_PALETTE[slot.color].hex, 30)}, ${COLOR_PALETTE[slot.color].hex})`
                          : "radial-gradient(circle at 35% 30%, rgba(220,210,195,0.2), rgba(200,190,175,0.1))",
                        border: slot
                          ? `2px solid ${COLOR_PALETTE[slot.color].hex}`
                          : "2px dashed rgba(200,190,175,0.2)",
                        boxShadow: slot
                          ? `0 3px 8px ${COLOR_PALETTE[slot.color].hex}44, inset 0 2px 4px rgba(255,255,255,0.4)`
                          : "inset 0 1px 2px rgba(255,255,255,0.2)",
                        transform: slot ? "scale(1)" : "scale(0.85)",
                        opacity: slot ? 1 : 0.3,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/discover">返回</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
