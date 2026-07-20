"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { RoundedBox, SoftShadows } from "@react-three/drei";
import {
  Spherical,
  Vector2,
  Raycaster,
  CanvasTexture,
  type PerspectiveCamera,
  type Mesh,
} from "three";
import { Button } from "@/components/ui/button";
import type { PuzzleBlock, TraySlot, GamePhase } from "./types";
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
// Crepe cake texture — horizontal layer stripes on a canvas
// ═══════════════════════════════════════════════════════════

const crepeCache = new Map<string, CanvasTexture>();

function getCrepeTexture(hex: string): CanvasTexture {
  const cached = crepeCache.get(hex);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext("2d")!;

  // Parse base color
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Draw 10 crepe layers with alternating tones
  const layerH = 128 / 10;
  for (let i = 0; i < 10; i++) {
    const bright = i % 2 === 0 ? 1.0 : 0.9;
    ctx.fillStyle = `rgb(${Math.floor(r * bright)},${Math.floor(g * bright)},${Math.floor(b * bright)})`;
    ctx.fillRect(0, i * layerH, 64, layerH);

    // Thin cream line between layers
    if (i > 0) {
      ctx.fillStyle = "rgba(255,250,245,0.55)";
      ctx.fillRect(0, i * layerH - 2, 64, 4);
    }
  }

  // Top frosting gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 20);
  grad.addColorStop(0, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 20);

  const tex = new CanvasTexture(c);
  tex.colorSpace = "srgb";
  crepeCache.set(hex, tex);
  return tex;
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
  const scaleRef = useRef(1);
  const breatheRef = useRef(0);

  const colorHex = COLOR_PALETTE[block.color]?.hex ?? "#FFB5C2";
  const crepeTex = useMemo(() => getCrepeTexture(colorHex), [colorHex]);

  useEffect(() => {
    if (meshRef.current) meshRefCallback(block.id, meshRef.current);
    return () => meshRefCallback(block.id, null);
  }, [block.id, meshRefCallback]);

  useFrame((_, delta) => {
    if (isRemoving) {
      scaleRef.current += (0 - scaleRef.current) * 0.18;
      meshRef.current?.scale.setScalar(scaleRef.current);
      if (scaleRef.current < 0.05 && meshRef.current) meshRef.current.visible = false;
      return;
    }
    breatheRef.current += delta;
    const targetScale = block.exposed
      ? 1 + Math.sin(breatheRef.current * 2.0) * 0.015
      : 1;
    scaleRef.current += (targetScale - scaleRef.current) * 0.15;
    meshRef.current?.scale.setScalar(scaleRef.current);
  });

  if (block.removed && !isRemoving) return null;

  return (
    <group position={block.worldPos}>
      {/* Cake body — box with crepe texture on sides */}
      <RoundedBox
        ref={meshRef}
        args={[BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE]}
        radius={BLOCK_ROUND}
        smoothness={3}
        castShadow
      >
        <meshPhysicalMaterial
          map={crepeTex}
          color={block.exposed ? "#ffffff" : "#c8c0b8"}
          roughness={0.35}
          metalness={0}
          clearcoat={0.3}
          clearcoatRoughness={0.2}
        />
      </RoundedBox>

      {/* Top frosting — white creamy layer */}
      <RoundedBox
        args={[BLOCK_SIZE * 0.92, BLOCK_SIZE * 0.08, BLOCK_SIZE * 0.92]}
        radius={0.08}
        smoothness={2}
        position={[0, BLOCK_SIZE / 2 + 0.02, 0]}
      >
        <meshPhysicalMaterial
          color="#fff8f0"
          roughness={0.5}
          metalness={0}
          clearcoat={0.4}
          clearcoatRoughness={0.15}
        />
      </RoundedBox>

      {/* Cherry/strawberry on top for exposed blocks */}
      {block.exposed && (
        <group position={[0, BLOCK_SIZE / 2 + 0.1, 0]}>
          {/* Fruit body */}
          <mesh>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshPhysicalMaterial
              color="#e86070"
              roughness={0.3}
              metalness={0}
              clearcoat={0.5}
            />
          </mesh>
          {/* Highlight */}
          <mesh position={[0.03, 0.03, 0.03]}>
            <sphereGeometry args={[0.03, 6, 6]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.35} />
          </mesh>
        </group>
      )}

      {/* Cream drip around the bottom edge (exposed only) */}
      {block.exposed && (
        <mesh position={[0, -BLOCK_SIZE / 2 + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[BLOCK_SIZE * 0.44, 0.04, 6, 16]} />
          <meshPhysicalMaterial
            color="#fff8f0"
            roughness={0.6}
            metalness={0}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
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
      <SoftShadows size={8} samples={16} />
      <ambientLight intensity={0.55} color="#e8e4f0" />
      <directionalLight
        position={[5, 10, 5]}
        intensity={0.9}
        color="#ffeedd"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0005}
      />
      <directionalLight
        position={[-4, -2, -4]}
        intensity={0.25}
        color="#ddeeff"
      />
      <directionalLight
        position={[0, -6, 0]}
        intensity={0.15}
        color="#ccddff"
      />
    </>
  );
}

function SoftFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]} receiveShadow>
      <circleGeometry args={[4, 24]} />
      <meshBasicMaterial color="#c8bfb5" transparent opacity={0.4} />
    </mesh>
  );
}

// Floating light dust particles
function FloatingDust({ count = 25 }: { count?: number }) {
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
                setTimeout(() => setGamePhase("levelComplete"), 300);
              }
              return prev;
            });
            processingRef.current = false;
          }, 100);

          return kept;
        }

        if (newTray.length >= TRAY_SIZE) {
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
        background: "linear-gradient(160deg, #f5f0eb 0%, #fff8f2 40%, #f0ebe5 100%)",
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
          <h1 className="text-2xl font-black tracking-tight" style={{ color: "#5a4a3a" }}>
            糖果积木消消乐
          </h1>
          <p className="text-sm" style={{ color: "#b8a99a" }}>
            点击外层糖果方块，3个同色消除
          </p>
        </header>

        {/* Score / Level bar */}
        <div
          className="flex items-center justify-between rounded-2xl px-4 py-2.5"
          style={{
            background: "rgba(255,255,255,0.7)",
            border: "1px solid rgba(200,190,175,0.4)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold" style={{ color: "#5a4a3a" }}>
              得分 <span style={{ color: "#c49a6c" }}>{score}</span>
            </span>
            <span className="text-sm font-bold" style={{ color: "#5a4a3a" }}>
              关卡 <span style={{ color: "#8aaa7a" }}>{level}</span>
            </span>
            <span className="text-xs" style={{ color: "#b8a99a" }}>
              消除 {totalRemoved} 块
            </span>
          </div>
          {gamePhase === "playing" && (
            <button
              onClick={() => setGamePhase("menu")}
              className="rounded-xl px-3 py-1.5 text-sm font-bold transition-all active:scale-95"
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
            background: "radial-gradient(ellipse at 50% 40%, #e8e0d8 0%, #d5cdc5 60%, #c8bfb5 100%)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.5)",
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
              <FloatingDust count={25} />
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
              style={{ background: "rgba(245,240,235,0.85)", backdropFilter: "blur(6px)" }}
            >
              <div className="text-center space-y-5 px-6">
                <div className="text-5xl" style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.1))" }}>
                  🍬
                </div>
                <h2
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "#5a4a3a" }}
                >
                  糖果积木消消乐
                </h2>
                <p
                  className="text-sm max-w-xs leading-relaxed"
                  style={{ color: "#a09080" }}
                >
                  旋转糖果积木雕塑
                  <br />
                  点击外层彩色积木放入收集槽
                  <br />
                  3 个同色消除得分！
                </p>
                <button
                  onClick={startGame}
                  className="rounded-2xl px-10 py-3 text-lg font-black transition-all active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #d4c4a5, #c4b4a0)",
                    color: "#fff",
                    boxShadow: "0 4px 16px rgba(180,160,130,0.4)",
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
              style={{ background: "rgba(245,240,235,0.85)", backdropFilter: "blur(6px)" }}
            >
              <div className="text-center space-y-4 px-6">
                <div className="text-5xl">🎉</div>
                <h2
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "#5a4a3a" }}
                >
                  第 {level} 关完成！
                </h2>
                <p className="text-sm" style={{ color: "#a09080" }}>
                  累计得分: {score}
                </p>
                <button
                  onClick={nextLevel}
                  className="rounded-2xl px-10 py-3 text-lg font-black transition-all active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #9FE3C1, #7ac9a0)",
                    color: "#fff",
                    boxShadow: "0 4px 16px rgba(140,170,120,0.4)",
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
              style={{ background: "rgba(245,240,235,0.85)", backdropFilter: "blur(6px)" }}
            >
              <div className="text-center space-y-4 px-6">
                <div className="text-5xl">😅</div>
                <h2
                  className="text-2xl font-black tracking-tight"
                  style={{ color: "#5a4a3a" }}
                >
                  收集槽满了
                </h2>
                <p className="text-sm" style={{ color: "#a09080" }}>
                  得分: {score} | 关卡: {level}
                </p>
                <button
                  onClick={startGame}
                  className="rounded-2xl px-10 py-3 text-lg font-black transition-all active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #d4c4a5, #c4b4a0)",
                    color: "#fff",
                    boxShadow: "0 4px 16px rgba(180,160,130,0.4)",
                  }}
                >
                  重新开始
                </button>
              </div>
            </div>
          )}

          {/* Tray — overlay at bottom of canvas */}
          {gamePhase === "playing" && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center z-10 pointer-events-none">
              <div
                className={`flex gap-1.5 rounded-2xl px-3 py-2.5 pointer-events-auto transition-all duration-200 ${
                  trayBounce ? "scale-[1.04]" : "scale-100"
                } ${matchFlash !== null ? "ring-2 ring-white/40" : ""}`}
                style={{
                  background: "rgba(255,255,255,0.55)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(200,190,175,0.35)",
                  boxShadow: matchFlash !== null
                    ? `0 0 20px ${COLOR_PALETTE[matchFlash]?.hex}66`
                    : "0 4px 16px rgba(0,0,0,0.06)",
                }}
              >
                {Array.from({ length: TRAY_SIZE }).map((_, i) => {
                  const slot = tray[i];
                  return (
                    <div
                      key={i}
                      className={`transition-all duration-300 ${
                        matchFlash !== null && slot?.color === matchFlash
                          ? "animate-pulse scale-110"
                          : ""
                      }`}
                      style={{
                        width: 34,
                        height: 34,
                        background: slot
                          ? COLOR_PALETTE[slot.color].hex
                          : "rgba(200,190,175,0.12)",
                        border: slot
                          ? `2px solid ${COLOR_PALETTE[slot.color].hex}`
                          : "2px dashed rgba(200,190,175,0.25)",
                        borderRadius: 10,
                        transform: slot ? "scale(1)" : "scale(0.9)",
                        opacity: slot ? 1 : 0.45,
                        boxShadow: slot
                          ? `0 2px 6px ${COLOR_PALETTE[slot.color].hex}44`
                          : "none",
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
