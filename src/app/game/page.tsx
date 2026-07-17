"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── 常量 ───
const CANDY_TYPES = [
  { emoji: "🍎", color: "#ff6b6b", name: "苹果" },
  { emoji: "🍊", color: "#ffa94d", name: "橘子" },
  { emoji: "🍋", color: "#ffd43b", name: "柠檬" },
  { emoji: "🍇", color: "#69db7c", name: "葡萄" },
  { emoji: "🫐", color: "#748ffc", name: "蓝莓" },
  { emoji: "🍓", color: "#da77f2", name: "草莓" },
];
const ROWS = 8;
const COLS = 8;
const uid = () => Math.random().toString(36).slice(2, 8);
const rand = (n: number) => Math.floor(Math.random() * n);

// ─── 天气 & 特殊水果 ───
type Weather = "sunny" | "rain" | "storm" | "night";
type SpecialType = "bomb" | "flame" | "lightning";

const WEATHERS: Weather[] = ["sunny", "rain", "storm", "night"];
const SPECIAL_CHANCE = 0.08;
const RAIN_INTERVAL = 3;
const STORM_INTERVAL = 4;
const LOCK_DURATION = 3;
const LOCK_COUNT = 4;
const HIDDEN_RATIO = 0.18;
const NIGHT_BONUS = 500;

type Cell = { id: string; type: number; special?: SpecialType; lockedTurns?: number };
type Particle = { id: string; x: number; y: number; tx: number; ty: number; color: string; size: number };
type ScorePopup = { id: string; score: number; x: number; y: number };

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((c) => ({ ...c })));
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function createCell(type?: number): Cell {
  const cell: Cell = { id: uid(), type: type ?? rand(CANDY_TYPES.length) };
  // 重力填充生成的新格子有概率带特殊水果
  if (type === undefined && Math.random() < SPECIAL_CHANCE) {
    const specials: SpecialType[] = ["bomb", "flame", "lightning"];
    cell.special = specials[rand(specials.length)];
  }
  return cell;
}

function createBoard(): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      let type: number;
      do {
        type = rand(CANDY_TYPES.length);
      } while (
        (r >= 2 && board[r - 1][c].type === type && board[r - 2][c].type === type) ||
        (c >= 2 && row[c - 1].type === type && row[c - 2].type === type)
      );
      row.push(createCell(type));
    }
    board.push(row);
  }
  return board;
}

function findMatches(board: Cell[][]): Set<string> {
  const matched = new Set<string>();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS - 2; c++)
      if (board[r][c].type === board[r][c + 1].type && board[r][c].type === board[r][c + 2].type)
        for (let i = 0; i < 3; i++) matched.add(board[r][c + i].id);
  for (let r = 0; r < ROWS - 2; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c].type === board[r + 1][c].type && board[r][c].type === board[r + 2][c].type)
        for (let i = 0; i < 3; i++) matched.add(board[r + i][c].id);
  return matched;
}

function findHintMove(board: Cell[][]): { r1: number; c1: number; r2: number; c2: number } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= ROWS || nc >= COLS) continue;
        const b = cloneBoard(board);
        [b[r][c], b[nr][nc]] = [b[nr][nc], b[r][c]];
        if (findMatches(b).size > 0) return { r1: r, c1: c, r2: nr, c2: nc };
      }
    }
  }
  return null;
}

function computeFallDist(oldBoard: Cell[][], newBoard: Cell[][]): Map<string, number> {
  const oldPos = new Map<string, { r: number }>();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) oldPos.set(oldBoard[r][c].id, { r });
  const fallMap = new Map<string, number>();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const id = newBoard[r][c].id;
      const old = oldPos.get(id);
      if (old) { if (r - old.r > 0) fallMap.set(id, r - old.r); }
      else { fallMap.set(id, r + 1); }
    }
  }
  return fallMap;
}

function gravityFill(board: Cell[][]): void {
  for (let c = 0; c < COLS; c++) {
    const col: Cell[] = [];
    for (let r = 0; r < ROWS; r++) if (board[r][c].type >= 0) col.push(board[r][c]);
    for (let r = ROWS - 1; r >= 0; r--) board[r][c] = col.length > 0 ? col.pop()! : createCell();
  }
}

function matchCenter(board: Cell[][], ids: Set<string>, cellSize: number): { x: number; y: number } {
  let sr = 0, sc = 0, cnt = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
    if (ids.has(board[r][c].id)) { sr += r; sc += c; cnt++; }
  if (!cnt) return { x: 0, y: 0 };
  return { x: sc / cnt * cellSize + cellSize / 2, y: sr / cnt * cellSize + cellSize / 2 };
}

// ─── 天气 & 特殊水果 工具函数 ───
function pickWeather(): Weather {
  return WEATHERS[rand(WEATHERS.length)];
}

function getEffectCells(r: number, c: number, special: SpecialType): [number, number][] {
  const cells: [number, number][] = [];
  switch (special) {
    case "bomb":
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++)
          if (r + dr >= 0 && r + dr < ROWS && c + dc >= 0 && c + dc < COLS)
            cells.push([r + dr, c + dc]);
      break;
    case "flame":
      for (let cc = 0; cc < COLS; cc++) cells.push([r, cc]);
      break;
    case "lightning":
      for (const [dr, dc] of [[0,0],[-1,0],[1,0],[0,-1],[0,1]])
        if (r + dr >= 0 && r + dr < ROWS && c + dc >= 0 && c + dc < COLS)
          cells.push([r + dr, c + dc]);
      break;
  }
  return cells;
}

function revealAdjacentHidden(
  board: Cell[][], matchedIds: Set<string>, hiddenIds: Set<string>
): { revealed: Set<string>; allRevealed: boolean } {
  const revealed = new Set<string>();
  const totalLeft = new Set(hiddenIds);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!hiddenIds.has(board[r][c].id)) continue;
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && matchedIds.has(board[nr][nc].id)) {
          revealed.add(board[r][c].id);
          break;
        }
      }
    }
  }
  for (const id of revealed) totalLeft.delete(id);
  return { revealed, allRevealed: totalLeft.size === 0 };
}

function selectHiddenCells(board: Cell[][]): Set<string> {
  const total = ROWS * COLS;
  const target = Math.max(1, Math.floor(total * HIDDEN_RATIO));
  const all: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) all.push([r, c]);
  for (let i = all.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  const hidden = new Set<string>();
  for (let i = 0; i < target && i < all.length; i++) hidden.add(board[all[i][0]][all[i][1]].id);
  return hidden;
}

function decrementLockTurns(board: Cell[][]): void {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c].lockedTurns !== undefined) {
        board[r][c].lockedTurns!--;
        if (board[r][c].lockedTurns! <= 0) board[r][c].lockedTurns = undefined;
      }
}

function lockRandomCells(board: Cell[][], count: number): void {
  const unlocked: [number, number][] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (board[r][c].lockedTurns === undefined) unlocked.push([r, c]);
  for (let i = unlocked.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [unlocked[i], unlocked[j]] = [unlocked[j], unlocked[i]];
  }
  const n = Math.min(count, unlocked.length);
  for (let i = 0; i < n; i++) {
    const [r, c] = unlocked[i];
    board[r][c].lockedTurns = LOCK_DURATION;
  }
}

function shiftBoard(board: Cell[][]): void {
  const dirs: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];
  const [dr, dc] = dirs[rand(4)];
  const newBoard: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    newBoard[r] = [];
    for (let c = 0; c < COLS; c++) {
      const nr = r - dr, nc = c - dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        newBoard[r][c] = { ...board[nr][nc] };
      } else {
        newBoard[r][c] = createCell();
      }
    }
  }
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) board[r][c] = newBoard[r][c];
}

function getSpecialIcon(special?: SpecialType): string {
  if (!special) return "";
  const icons: Record<SpecialType, string> = { bomb: "💣", flame: "🔥", lightning: "⚡" };
  return icons[special];
}

function getSpecialColor(special?: SpecialType): string {
  if (!special) return "";
  const colors: Record<SpecialType, string> = { bomb: "#ff4444", flame: "#ff8800", lightning: "#44aaff" };
  return colors[special];
}

export default function GamePage() {
  const [board, setBoard] = useState<Cell[][] | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [swapPair, setSwapPair] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const [fallMap, setFallMap] = useState<Map<string, number> | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [comboDisplay, setComboDisplay] = useState<{ combo: number; key: string } | null>(null);
  const [hintCells, setHintCells] = useState<{ r1: number; c1: number; r2: number; c2: number } | null>(null);
  const [shakeCells, setShakeCells] = useState<Set<string>>(new Set());

  // ─── 天气 & 特殊水果 状态 ───
  const [weather, setWeather] = useState<Weather>("sunny");
  const [turnCount, setTurnCount] = useState(0);
  const [hiddenCells, setHiddenCells] = useState<Set<string>>(new Set());
  const [weatherOverlay, setWeatherOverlay] = useState<Weather | null>(null);
  const [nightBonusShown, setNightBonusShown] = useState(false);

  // ─── 道具状态 ───
  const [collectedPowerups, setCollectedPowerups] = useState<SpecialType[]>([]);
  const [activePowerup, setActivePowerup] = useState<SpecialType | null>(null);

  const processingRef = useRef(false);
  const boardRef = useRef<Cell[][] | null>(null);
  const lastActionRef = useRef(Date.now());
  const hintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneScore, setMilestoneScore] = useState(0);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittedMilestones = useRef(new Set<number>());

  const cellSize = useMemo(() =>
    typeof window === "undefined" ? 40 : Math.min((window.innerWidth - 80) / COLS, 400 / COLS), []);

  useEffect(() => {
    const b = createBoard();
    setBoard(b); boardRef.current = b;
    const w = pickWeather();
    setWeather(w);
    setWeatherOverlay(w);
    setTimeout(() => setWeatherOverlay(null), 2200);
    if (w === "night") {
      const h = selectHiddenCells(b);
      setHiddenCells(h);
    }
  }, []);
  boardRef.current = board;

  useEffect(() => {
    hintTimerRef.current = setInterval(() => {
      if (processingRef.current || !boardRef.current) return;
      if (Date.now() - lastActionRef.current > 5000) {
        const h = findHintMove(boardRef.current);
        setHintCells(h ? { r1: h.r1, c1: h.c1, r2: h.r2, c2: h.c2 } : null);
      } else setHintCells(null);
    }, 1000);
    return () => { if (hintTimerRef.current) clearInterval(hintTimerRef.current); };
  }, []);

  const addScore = useCallback((add: number) => {
    setScore((prev) => {
      const next = prev + add;
      const ms = Math.floor(next / 500) * 500;
      const pm = Math.floor(prev / 500) * 500;
      if (ms > 0 && ms > pm && !submittedMilestones.current.has(ms)) {
        submittedMilestones.current.add(ms);
        setMilestoneScore(ms);
        setShowMilestone(true);
      }
      return next;
    });
  }, []);

  const submitScore = useCallback(async () => {
    if (!nickname.trim()) { alert("请输入你的大名"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("game_leaderboard")
      .insert({ nickname: nickname.trim(), score: milestoneScore, moves });
    if (error) { alert(`登记失败：${error.message}`); setSubmitting(false); return; }
    setShowMilestone(false); setNickname(""); setSubmitting(false);
  }, [nickname, milestoneScore, moves]);

  useEffect(() => { if (particles.length) { const t = setTimeout(() => setParticles([]), 800); return () => clearTimeout(t); } }, [particles]);
  useEffect(() => { if (scorePopups.length) { const t = setTimeout(() => setScorePopups([]), 800); return () => clearTimeout(t); } }, [scorePopups]);
  useEffect(() => { if (comboDisplay) { const t = setTimeout(() => setComboDisplay(null), 1200); return () => clearTimeout(t); } }, [comboDisplay]);

  const spawnParticles = useCallback((boardData: Cell[][], matchSet: Set<string>) => {
    const list: Particle[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!matchSet.has(boardData[r][c].id)) continue;
      const color = CANDY_TYPES[boardData[r][c].type]?.color ?? "#fff";
      const base = Math.random() * Math.PI * 2;
      for (let i = 0; i < 5; i++) {
        const a = base + (Math.PI * 2 * i) / 5, d = 20 + Math.random() * 25;
        list.push({ id: uid(), x: c * cellSize + cellSize / 2, y: r * cellSize + cellSize / 2, tx: Math.cos(a) * d, ty: Math.sin(a) * d, color, size: 3 + Math.random() * 5 });
      }
    }
    if (list.length) setParticles((prev) => [...prev, ...list]);
  }, [cellSize]);

  // 核心：连锁消除循环（逐轮）
  const cascade = useCallback((boardData: Cell[][], round: number, scoreSoFar: number) => {
    const m = findMatches(boardData);

    // ─── 收集匹配中的特殊水果 ───
    if (m.size > 0) {
      const collected: SpecialType[] = [];
      for (const id of m) {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (boardData[r][c].id === id && boardData[r][c].special) {
              collected.push(boardData[r][c].special!);
            }
      }
      if (collected.length > 0) {
        setCollectedPowerups((prev) => [...prev, ...collected]);
      }

      // Night 模式：揭示相邻隐藏格子
      if (weather === "night" && hiddenCells.size > 0) {
        const { revealed, allRevealed } = revealAdjacentHidden(boardData, m, hiddenCells);
        if (revealed.size > 0) {
          setHiddenCells((prev) => {
            const next = new Set(prev);
            for (const id of revealed) next.delete(id);
            return next;
          });
          if (allRevealed && !nightBonusShown) {
            setNightBonusShown(true);
            scoreSoFar += NIGHT_BONUS;
            setScorePopups((prev) => [...prev, {
              id: uid(), score: NIGHT_BONUS,
              x: cellSize * COLS / 2, y: cellSize * ROWS / 2
            }]);
          }
        }
      }
    }

    if (m.size === 0) {
      addScore(scoreSoFar);
      // ─── 天气效果在 cascade 结束时触发 ───
      const snapshot = boardRef.current;
      if (snapshot && weather !== "sunny") {
        const wb = cloneBoard(snapshot);
        if (weather === "rain" && turnCount > 0 && turnCount % RAIN_INTERVAL === 0) {
          lockRandomCells(wb, LOCK_COUNT);
          setBoard(wb);
          boardRef.current = wb;
        }
        if (weather === "storm" && turnCount > 0 && turnCount % STORM_INTERVAL === 0) {
          shiftBoard(wb);
          setBoard(wb);
          boardRef.current = wb;
          const postShift = findMatches(wb);
          if (postShift.size > 0) {
            setTimeout(() => cascade(wb, 1, 0), 400);
            return;
          }
        }
      }
      processingRef.current = false;
      return;
    }
    if (round > 1) setComboDisplay({ combo: round, key: uid() });

    const pos = matchCenter(boardData, m, cellSize);
    const roundScore = m.size * 10 * round;
    setScorePopups((prev) => [...prev, { id: uid(), score: roundScore, x: pos.x, y: pos.y }]);
    spawnParticles(boardData, m);
    setMatchedIds(m);

    setTimeout(() => {
      setMatchedIds(new Set());
      const next = cloneBoard(boardData);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
        if (m.has(next[r][c].id)) next[r][c] = { ...next[r][c], type: -1 };
      const oldClone = cloneBoard(next);
      gravityFill(next);
      const falls = computeFallDist(oldClone, next);
      setFallMap(falls);
      setBoard(next);
      boardRef.current = next;
      setTimeout(() => { setFallMap(null); cascade(next, round + 1, scoreSoFar + roundScore); }, 400);
    }, 350);
  }, [addScore, cellSize, spawnParticles, weather, hiddenCells, nightBonusShown, turnCount]);

  // 执行交换
  const trySwap = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    if (processingRef.current || !boardRef.current) return;
    if (activePowerup) return; // 道具模式下不允许交换
    const bd = boardRef.current;

    // ─── 锁定检查 ───
    const c1Locked = bd[r1][c1].lockedTurns !== undefined && bd[r1][c1].lockedTurns! > 0;
    const c2Locked = bd[r2][c2].lockedTurns !== undefined && bd[r2][c2].lockedTurns! > 0;
    if (c1Locked || c2Locked) {
      const lockShake = new Set<string>();
      if (c1Locked) lockShake.add(bd[r1][c1].id);
      if (c2Locked) lockShake.add(bd[r2][c2].id);
      setShakeCells(lockShake);
      setTimeout(() => setShakeCells(new Set()), 400);
      return;
    }

    processingRef.current = true;
    lastActionRef.current = Date.now();
    setHintCells(null);

    const originalBoard = boardRef.current;
    const b = cloneBoard(originalBoard);
    const sameType = b[r1][c1].type === b[r2][c2].type;
    setSwapPair({ r1, c1, r2, c2 });

    setTimeout(() => {
      [b[r1][c1], b[r2][c2]] = [b[r2][c2], b[r1][c1]];
      let matches = findMatches(b);
      if (matches.size === 0 && sameType) matches = new Set([b[r1][c1].id, b[r2][c2].id]);

      if (matches.size === 0) {
        // 无效抖动
        setSwapPair({ r1, c1, r2, c2 });
        const s = new Set([b[r1][c1].id, b[r2][c2].id]);
        setShakeCells(s);
        setTimeout(() => {
          setSwapPair(null); setShakeCells(new Set());
          setBoard(originalBoard); boardRef.current = originalBoard;
          processingRef.current = false;
        }, 400);
        return;
      }

      // 有效交换，先换掉原始棋盘数据，克隆提交
      const clonedBoard = cloneBoard(b);
      const firstScore = matches.size * 10;
      const pos = matchCenter(clonedBoard, matches, cellSize);
      setScorePopups((prev) => [...prev, { id: uid(), score: firstScore, x: pos.x, y: pos.y }]);
      spawnParticles(clonedBoard, matches);
      setMatchedIds(matches);

      setTimeout(() => {
        setMatchedIds(new Set());
        const current = cloneBoard(clonedBoard);
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++)
          if (matches.has(current[r][c].id)) current[r][c] = { ...current[r][c], type: -1 };
        const oldClone = cloneBoard(current);
        gravityFill(current);
        const falls = computeFallDist(oldClone, current);
        setSwapPair(null);
        setFallMap(falls);
        setBoard(current);
        boardRef.current = current;
        // ─── 回合计数 & 锁定递减 ───
        decrementLockTurns(current);
        setMoves((m) => m + 1);
        setTurnCount((t) => t + 1);
        setTimeout(() => { setFallMap(null); cascade(current, 2, firstScore); }, 400);
      }, 350);
    }, 200);
  }, [cellSize, spawnParticles, cascade, activePowerup]);

  // ─── 拖拽 ───
  const dragRef = useRef<{ sx: number; sy: number; r: number; c: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (processingRef.current) return;
    const btn = (e.target as HTMLElement).closest("[data-r]");
    if (!btn) return;
    const r = Number((btn as HTMLElement).dataset.r);
    const c = Number((btn as HTMLElement).dataset.c);
    dragRef.current = { sx: e.clientX, sy: e.clientY, r, c };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setSelected((prev) => {
      if (!prev) return [r, c];
      const [sr, sc] = prev;
      if (sr === r && sc === c) return null;
      if (!isAdjacent(sr, sc, r, c)) return [r, c];
      return prev;
    });
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || processingRef.current) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return;
    let tr = d.r, tc = d.c;
    if (Math.abs(dx) > Math.abs(dy)) tc += dx > 0 ? 1 : -1;
    else tr += dy > 0 ? 1 : -1;
    if (tr >= 0 && tr < ROWS && tc >= 0 && tc < COLS && isAdjacent(d.r, d.c, tr, tc)) {
      dragRef.current = null; setSelected(null); trySwap(d.r, d.c, tr, tc);
    }
  }, [trySwap]);

  const onPointerUp = useCallback(() => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && selected) {
      const [sr, sc] = selected;
      if (isAdjacent(sr, sc, d.r, d.c)) { setSelected(null); trySwap(sr, sc, d.r, d.c); }
    }
  }, [selected, trySwap]);

  // ─── 道具使用 ───
  const usePowerup = useCallback((r: number, c: number, powerup: SpecialType) => {
    if (processingRef.current || !boardRef.current) return;
    processingRef.current = true;
    lastActionRef.current = Date.now();
    setActivePowerup(null);
    setCollectedPowerups((prev) => {
      const idx = prev.indexOf(powerup);
      if (idx < 0) return prev;
      const next = [...prev];
      next.splice(idx, 1);
      return next;
    });

    const b = cloneBoard(boardRef.current);
    const affected = getEffectCells(r, c, powerup);
    const toRemove = new Map<string, { r: number; c: number }>();
    for (const [ar, ac] of affected) {
      toRemove.set(b[ar][ac].id, { r: ar, c: ac });
    }

    // 显示特效
    const pos = { x: c * cellSize + cellSize / 2, y: r * cellSize + cellSize / 2 };
    const firstScore = toRemove.size * 10;
    setScorePopups((prev) => [...prev, { id: uid(), score: firstScore, x: pos.x, y: pos.y }]);
    spawnParticles(b, new Set(toRemove.keys()));
    setMatchedIds(new Set(toRemove.keys()));

    setTimeout(() => {
      setMatchedIds(new Set());
      const next = cloneBoard(b);
      for (const [ar, ac] of affected) next[ar][ac] = { ...next[ar][ac], type: -1 };
      const oldClone = cloneBoard(next);
      gravityFill(next);
      const falls = computeFallDist(oldClone, next);
      setFallMap(falls);
      setBoard(next);
      boardRef.current = next;
      setMoves((m) => m + 1);
      decrementLockTurns(next);
      setTurnCount((t) => t + 1);
      setTimeout(() => { setFallMap(null); cascade(next, 2, firstScore); }, 400);
    }, 350);
  }, [cellSize, spawnParticles, cascade]);

  const onClick = useCallback((r: number, c: number) => {
    if (processingRef.current) return;
    // 道具模式：点击使用道具
    if (activePowerup) { usePowerup(r, c, activePowerup); return; }
    if (!selected) { setSelected([r, c]); return; }
    const [sr, sc] = selected;
    if (sr === r && sc === c) { setSelected(null); return; }
    if (!isAdjacent(sr, sc, r, c)) { setSelected([r, c]); return; }
    setSelected(null); trySwap(sr, sc, r, c);
  }, [selected, trySwap, activePowerup, usePowerup]);

  const resetGame = useCallback(() => {
    if (processingRef.current) return;
    const b = createBoard();
    setBoard(b); boardRef.current = b;
    setSelected(null); setScore(0); setMoves(0);
    setMatchedIds(new Set()); setSwapPair(null); setFallMap(null);
    setParticles([]); setScorePopups([]); setComboDisplay(null);
    setHintCells(null); setShakeCells(new Set());
    submittedMilestones.current = new Set(); lastActionRef.current = Date.now();
    // ─── 天气 & 道具重置 ───
    setCollectedPowerups([]);
    setActivePowerup(null);
    const w = pickWeather();
    setWeather(w);
    setTurnCount(0);
    setNightBonusShown(false);
    setWeatherOverlay(w);
    setTimeout(() => setWeatherOverlay(null), 2200);
    if (w === "night") {
      const h = selectHiddenCells(b);
      setHiddenCells(h);
    } else {
      setHiddenCells(new Set());
    }
  }, []);

  const isHint = (r: number, c: number) =>
    hintCells && ((hintCells.r1 === r && hintCells.c1 === c) || (hintCells.r2 === r && hintCells.c2 === c));

  const getCellTransform = (r: number, c: number) => {
    if (!swapPair) return {};
    const { r1, c1, r2, c2 } = swapPair;
    if (r === r1 && c === c1) return { transform: `translate3d(${(c2 - c1) * cellSize}px, ${(r2 - r1) * cellSize}px, 10px)` };
    if (r === r2 && c === c2) return { transform: `translate3d(${(c1 - c2) * cellSize}px, ${(r1 - r2) * cellSize}px, 10px)` };
    return {};
  };

  const comboText = (() => {
    if (!comboDisplay) return "";
    const c = comboDisplay.combo;
    if (c >= 7) return "INCREDIBLE!";
    if (c >= 5) return "AMAZING!";
    return `${c}x COMBO!`;
  })();

  const comboColors = ["#ff6b6b", "#ffa94d", "#ffd43b", "#69db7c", "#748ffc", "#da77f2"];
  const comboColor = comboColors[(comboDisplay?.combo ?? 1) % comboColors.length];

  return (
    <main className="island-page min-h-screen pb-24" style={{ position: "relative", zIndex: 1 }}>
      {/* ─── 天气视觉效果层 ─── */}
      <div className={`weather-layer ${weather === "rain" ? "weather-rain" : weather === "storm" ? "weather-storm" : weather === "night" ? "weather-night" : "weather-sunny"}`}>
        {/* 晴天阳光射线 */}
        {weather === "sunny" && Array.from({ length: 8 }).map((_, i) => (
          <div key={`ray-${i}`} className="sun-ray"
            style={{
              left: `${10 + i * 10}%`,
              animationName: "sun-ray",
              animationDuration: "3s",
              animationDelay: `${i * 0.3}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
              "--ray-angle": `${-15 + i * 4}deg`,
            } as React.CSSProperties} />
        ))}
        {/* 雨天雨滴 */}
        {weather === "rain" && Array.from({ length: 35 }).map((_, i) => (
          <div key={`d-${i}`} className="raindrop"
            style={{
              left: `${Math.random() * 100}%`,
              height: `${10 + Math.random() * 15}px`,
              animationName: "raindrop",
              animationDuration: `${0.6 + Math.random() * 1.2}s`,
              animationDelay: `${Math.random() * 2}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
            }} />
        ))}
        {/* 风暴风线 */}
        {weather === "storm" && Array.from({ length: 10 }).map((_, i) => (
          <div key={`w-${i}`} className="wind-line"
            style={{
              top: `${5 + i * 10}%`,
              width: `${60 + Math.random() * 40}%`,
              animationName: "wind-gust",
              animationDuration: `${2 + Math.random() * 3}s`,
              animationDelay: `${Math.random() * 4}s`,
              animationTimingFunction: "linear",
              animationIterationCount: "infinite",
            }} />
        ))}
        {/* 夜晚星星 */}
        {weather === "night" && Array.from({ length: 25 }).map((_, i) => (
          <div key={`s-${i}`} className="star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 80}%`,
              animationName: "star-twinkle",
              animationDuration: `${1.5 + Math.random() * 2}s`,
              animationDelay: `${Math.random() * 3}s`,
              animationTimingFunction: "ease-in-out",
              animationIterationCount: "infinite",
            }} />
        ))}
      </div>

      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Mini Game</p>
          <h1 className="text-2xl font-black text-[#725d42]">快乐消消乐</h1>
          <p className="text-sm text-[#9f927d]">滑动或点击相邻糖果交换，三个以上相同即可消除！</p>
          <p className="text-xs font-bold text-[#6fba2c]">
            {weather === "sunny" ? "☀️ 天气晴朗，没有特殊效果"
            : weather === "rain" ? "🌧 下雨中：每 3 回合随机锁定格子"
            : weather === "storm" ? "🌪 风暴来袭：每 4 回合水果向一个方向移动"
            : "🌙 夜幕降临：部分格子隐藏，相邻消除可揭示"}
          </p>
        </header>
        <Divider type="wave-yellow" />

        <div className="flex items-center justify-between rounded-2xl bg-[#fffdf5] border-2 border-[#e8ddd0] px-4 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-[#725d42]">
              {weather === "rain" ? "🌧 " : weather === "storm" ? "🌪 " : weather === "night" ? "🌙 " : "☀️ "}
            </span>
            <span className="text-sm font-bold text-[#725d42]">
              🏆 分数 <span className="text-lg text-[#ff922b]">{score}</span>
            </span>
            <span className="text-sm font-bold text-[#725d42]">
              👆 步数 <span className="text-lg text-[#6fba2c]">{moves}</span>
            </span>
          </div>
          <button onClick={resetGame} className="rounded-xl bg-[#ffd43b] px-3 py-1.5 text-sm font-bold text-[#725d42] shadow-[0_2px_#fab005] active:shadow-none active:translate-y-0.5 transition-all">🔄 新一局</button>
        </div>

        <div className="flex justify-center candy-board-stage relative">
          {/* 棋盘底部投影 */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-3 rounded-full bg-black/10 blur-md pointer-events-none" />
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-1/2 h-2 rounded-full bg-black/5 blur-sm pointer-events-none" />

          {/* 天气公告 Overlay */}
          {weatherOverlay && (
            <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
              <span className="text-6xl drop-shadow-lg" style={{ animation: "weather-announce 2s ease-out forwards" }}>
                {weatherOverlay === "rain" ? "🌧️" : weatherOverlay === "storm" ? "🌪️" : "🌙"}
              </span>
            </div>
          )}
          <div
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            className={`relative grid gap-1 rounded-2xl border-2 border-[#d4bc8a] bg-[#3a2e20] p-2 shadow-[inset_0_4px_16px_rgba(0,0,0,0.4),0_12px_32px_rgba(0,0,0,0.35)] select-none touch-none candy-board-3d ${processingRef.current ? "opacity-60 cursor-wait" : activePowerup ? "cursor-crosshair" : "cursor-default"}`}
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: `min(calc(100vw - 2.5rem), 400px)`, animation: weather === "storm" ? "storm-shake 3s ease-in-out infinite" : undefined }}
          >
            {!board
              ? Array.from({ length: ROWS * COLS }).map((_, i) => <div key={i} className="aspect-square rounded-xl bg-[#e8ddd0]/50" />)
              : board.map((row, r) => row.map((cell, c) => {
                  const candy = CANDY_TYPES[cell.type];
                  const isSel = selected?.[0] === r && selected?.[1] === c;
                  const isMt = matchedIds.has(cell.id);
                  const isSh = shakeCells.has(cell.id);
                  const hint = isHint(r, c);
                  const fallDist = fallMap?.get(cell.id);
                  const hasFall = fallDist != null;
                  const swapStyle = getCellTransform(r, c);
                  const disabled = processingRef.current || swapPair !== null;
                  const sd = isMt ? r * 40 + c * 20 : 0;
                  const isLocked = cell.lockedTurns !== undefined && cell.lockedTurns > 0;
                  const isHidden = weather === "night" && hiddenCells.has(cell.id);
                  const hasSpecial = cell.special !== undefined;

                  // 动画逻辑: 锁定抖动 > 抖动 > 选中脉冲 > 提示脉冲 > 掉落
                  const anim = isLocked && isSh ? "lock-rattle 0.4s ease-in-out"
                    : isSh ? "shake 0.4s ease-in-out"
                    : isSel ? "pulse-glow 1.5s ease-in-out infinite"
                    : hint ? "hint-pulse 1.5s ease-in-out infinite"
                    : hasFall ? `bounce-drop-3d 450ms ${fallDist! * 40}ms ease-out forwards`
                    : "none";

                  return (
                    <button key={cell.id} data-r={r} data-c={c} onClick={() => onClick(r, c)}
                      disabled={disabled || isLocked}
                      className={`aspect-square flex items-center justify-center rounded-xl text-xl sm:text-2xl select-none relative border-2 candy-cell ${isSel && !isLocked ? "pressed" : ""} ${isLocked ? "locked" : ""} ${isHidden ? "hidden" : ""}`}
                      style={{
                        backgroundColor: isHidden ? "#2a2a3a" : candy?.color ?? "#eee",
                        borderColor: isSel ? "#ffd43b" : isLocked ? "#555" : isHidden ? "#3a3a4a" : "rgba(0,0,0,0.15)",
                        boxShadow: isSel ? "0 0 14px 4px rgba(255,146,43,0.5), 0 0 0 2px #ffd43b, 0 4px 8px rgba(0,0,0,0.25), inset 0 2px 0 rgba(255,255,255,0.3)"
                          : hint ? "0 0 14px 5px rgba(255,215,0,0.55), 0 4px 8px rgba(0,0,0,0.2)"
                          : isHidden ? "inset 0 0 12px rgba(0,0,0,0.5)"
                          : "0 4px 8px rgba(0,0,0,0.25), 0 2px 4px rgba(0,0,0,0.15), inset 0 2px 0 rgba(255,255,255,0.3)",
                        "--special-clr": hasSpecial ? getSpecialColor(cell.special) : undefined,
                        transform: isMt ? "scale(0)" : (!hasFall ? (swapStyle.transform ?? undefined) : undefined),
                        opacity: isMt ? 0 : 1,
                        transitionDelay: isMt ? `${sd}ms` : "0ms",
                        animation: anim,
                        "--fall-offset": hasFall ? `${-cellSize * fallDist!}px` : "0px",
                        zIndex: hint ? 5 : hasSpecial ? 3 : 1,
                      } as React.CSSProperties}
                      aria-label={`${isHidden ? "隐藏" : candy?.name ?? ""}糖果${isLocked ? "(已锁定)" : ""}${hasSpecial ? `(${getSpecialIcon(cell.special)})` : ""}`}
                    >
                      {/* 特殊水果发光边框 */}
                      {hasSpecial && (
                        <span className="absolute inset-0 rounded-xl pointer-events-none z-10"
                          style={{
                            border: `2px solid ${getSpecialColor(cell.special)}`,
                            boxShadow: `0 0 10px 3px ${getSpecialColor(cell.special)}88`,
                            animation: "special-glow 1.2s ease-in-out infinite",
                          }} />
                      )}

                      {/* 锁定图标 */}
                      {isLocked && (
                        <span className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-20 bg-black/20">
                          <span className="text-lg drop-shadow-md">🔒</span>
                        </span>
                      )}

                      {/* 隐藏遮罩 (Night 模式) */}
                      {isHidden && (
                        <span className="absolute inset-0 rounded-xl flex items-center justify-center pointer-events-none z-20">
                          <span className="text-2xl opacity-30">❓</span>
                        </span>
                      )}

                      {/* 非隐藏格子: 显示内容 */}
                      {!isHidden && (
                        <>
                          {/* 高光 */}
                          <span className="absolute inset-0 rounded-xl pointer-events-none"
                            style={{ background: "radial-gradient(circle at 30% 25%, rgba(255,255,255,0.4) 0%, transparent 60%)" }} />
                          {/* 底部阴影 */}
                          <span className="absolute inset-x-1 -bottom-1 h-2 rounded-full pointer-events-none"
                            style={{ background: "rgba(0,0,0,0.15)", filter: "blur(3px)" }} />
                          {/* 左侧高光边缘 */}
                          <span className="absolute left-0.5 top-2 bottom-2 w-0.5 rounded-full pointer-events-none"
                            style={{ background: "rgba(255,255,255,0.2)" }} />
                          <span className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)] pointer-events-none relative z-10"
                            style={{ transition: swapPair ? "transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)" : "none" }}>
                            {candy?.emoji ?? "?"}
                          </span>

                          {/* 特殊水果角标 */}
                          {hasSpecial && (
                            <span className="absolute -top-1 -right-1 text-xs z-20 drop-shadow-lg pointer-events-none">
                              {getSpecialIcon(cell.special)}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                }))}

            {particles.map((p) => (
              <div key={p.id} className="absolute rounded-full pointer-events-none z-20"
                style={{ left: p.x, top: p.y, width: p.size, height: p.size, backgroundColor: p.color, "--tx": `${p.tx}px`, "--ty": `${p.ty}px`, animation: "particle-burst 600ms ease-out forwards" } as React.CSSProperties} />
            ))}
            {scorePopups.map((p) => (
              <div key={p.id} className="absolute pointer-events-none z-30 text-lg font-extrabold"
                style={{ left: p.x, top: p.y, color: "#ff922b", animation: "score-float 700ms ease-out forwards", textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
                +{p.score}
              </div>
            ))}
            {comboDisplay && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
                <span className="text-4xl font-black" style={{ color: comboColor, textShadow: "0 2px 8px rgba(0,0,0,0.3)", animation: "combo-pop 1.2s ease-out forwards" }}>{comboText}</span>
              </div>
            )}
            {/* 棋盘光晕 overlay */}
            <div className="absolute inset-0 rounded-2xl candy-board-gloss z-30" />
          </div>
        </div>

        {/* ─── 道具栏 ─── */}
        {collectedPowerups.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#725d42] mr-1">🎒</span>
              {collectedPowerups.map((p, i) => {
                const isActive = activePowerup === p && i === collectedPowerups.lastIndexOf(p);
                return (
                  <button key={`${p}-${i}`} onClick={() => setActivePowerup(isActive ? null : p)}
                    className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all powerup-btn ${isActive ? "ring-2 ring-[#ffd43b] ring-offset-2 scale-110" : ""}`}
                    style={{
                      background: p === "bomb" ? "#ff4444" : p === "flame" ? "#ff8800" : "#44aaff",
                      color: "#fff",
                      boxShadow: isActive ? "0 0 16px 4px rgba(255,212,59,0.5)" : "0 2px 4px rgba(0,0,0,0.2)",
                    }}>
                    {p === "bomb" ? "💣" : p === "flame" ? "🔥" : "⚡"}
                  </button>
                );
              })}
              {activePowerup && (
                <button onClick={() => setActivePowerup(null)} className="text-xs text-[#9f927d] underline">取消</button>
              )}
            </div>
            {activePowerup && (
              <p className="text-xs text-[#ff922b] font-bold animate-pulse">
                ✨ 点击棋盘任意位置放置道具！
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1"><Link href="/game/leaderboard">🏆 排行榜</Link></Button>
          <Button asChild variant="outline" className="flex-1"><Link href="/discover">🏠 返回</Link></Button>
        </div>
      </div>

      {showMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-[#f0d992] bg-[#fff7dc] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            <div className="text-center space-y-3">
              <p className="text-4xl">🎉</p>
              <h2 className="text-xl font-black text-[#725d42]">恭喜达到 {milestoneScore} 分！</h2>
              <p className="text-sm text-[#9f927d]">要在排行榜留下你的大名吗？</p>
            </div>
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rank-nickname">你的名字</Label>
                <Input id="rank-nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="例如：妈妈" maxLength={20} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowMilestone(false); setNickname(""); }} disabled={submitting}>算了</Button>
                <Button className="flex-1" onClick={submitScore} disabled={submitting}>{submitting ? "提交中..." : "登记！"}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
