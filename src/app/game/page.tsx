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

type Cell = { id: string; type: number };
type Particle = { id: string; x: number; y: number; tx: number; ty: number; color: string; size: number };
type ScorePopup = { id: string; score: number; x: number; y: number };

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((c) => ({ ...c })));
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function createCell(type?: number): Cell {
  return { id: uid(), type: type ?? rand(CANDY_TYPES.length) };
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
    if (m.size === 0) {
      addScore(scoreSoFar);
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
  }, [addScore, cellSize, spawnParticles]);

  // 执行交换
  const trySwap = useCallback((r1: number, c1: number, r2: number, c2: number) => {
    if (processingRef.current || !boardRef.current) return;
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
        setMoves((m) => m + 1);
        setTimeout(() => { setFallMap(null); cascade(current, 2, firstScore); }, 400);
      }, 350);
    }, 200);
  }, [cellSize, spawnParticles, cascade]);

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

  const onClick = useCallback((r: number, c: number) => {
    if (processingRef.current) return;
    if (!selected) { setSelected([r, c]); return; }
    const [sr, sc] = selected;
    if (sr === r && sc === c) { setSelected(null); return; }
    if (!isAdjacent(sr, sc, r, c)) { setSelected([r, c]); return; }
    setSelected(null); trySwap(sr, sc, r, c);
  }, [selected, trySwap]);

  const resetGame = useCallback(() => {
    if (processingRef.current) return;
    const b = createBoard();
    setBoard(b); boardRef.current = b;
    setSelected(null); setScore(0); setMoves(0);
    setMatchedIds(new Set()); setSwapPair(null); setFallMap(null);
    setParticles([]); setScorePopups([]); setComboDisplay(null);
    setHintCells(null); setShakeCells(new Set());
    submittedMilestones.current = new Set(); lastActionRef.current = Date.now();
  }, []);

  const isHint = (r: number, c: number) =>
    hintCells && ((hintCells.r1 === r && hintCells.c1 === c) || (hintCells.r2 === r && hintCells.c2 === c));

  const getCellTransform = (r: number, c: number) => {
    if (!swapPair) return {};
    const { r1, c1, r2, c2 } = swapPair;
    if (r === r1 && c === c1) return { transform: `translate(${(c2 - c1) * cellSize}px, ${(r2 - r1) * cellSize}px)` };
    if (r === r2 && c === c2) return { transform: `translate(${(c1 - c2) * cellSize}px, ${(r1 - r2) * cellSize}px)` };
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
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Mini Game</p>
          <h1 className="text-2xl font-black text-[#725d42]">快乐消消乐</h1>
          <p className="text-sm text-[#9f927d]">滑动或点击相邻糖果交换，三个以上相同即可消除！</p>
        </header>
        <Divider type="wave-yellow" />

        <div className="flex items-center justify-between rounded-2xl bg-[#fffdf5] border-2 border-[#e8ddd0] px-4 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-[#725d42]">
              🏆 分数 <span className="text-lg text-[#ff922b]">{score}</span>
            </span>
            <span className="text-sm font-bold text-[#725d42]">
              👆 步数 <span className="text-lg text-[#6fba2c]">{moves}</span>
            </span>
          </div>
          <button onClick={resetGame} className="rounded-xl bg-[#ffd43b] px-3 py-1.5 text-sm font-bold text-[#725d42] shadow-[0_2px_#fab005] active:shadow-none active:translate-y-0.5 transition-all">🔄 新一局</button>
        </div>

        <div className="flex justify-center">
          <div
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
            className={`relative grid gap-0.5 rounded-2xl border-2 border-[#c4b89e] bg-[#f7f3df] p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1),0_8px_20px_rgba(61,52,40,0.15)] select-none touch-none ${processingRef.current ? "opacity-60 cursor-wait" : "cursor-default"}`}
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, width: `min(calc(100vw - 2.5rem), 400px)` }}
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

                  let anim = "none";
                  if (isSh) anim = "shake 0.4s ease-in-out";
                  else if (isSel) anim = "pulse-glow 1.5s ease-in-out infinite";
                  else if (hint) anim = "hint-pulse 1.5s ease-in-out infinite";
                  else if (hasFall) anim = `bounce-drop 450ms ${fallDist! * 40}ms ease-out forwards`;

                  const boxShadow = isSel
                    ? "0 0 14px 4px rgba(255,146,43,0.5), 0 0 0 2px #ffd43b, 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)"
                    : hint
                      ? "0 0 14px 5px rgba(255,215,0,0.55)"
                      : "0 2px 4px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.3)";

                  return (
                    <button key={cell.id} data-r={r} data-c={c} onClick={() => onClick(r, c)} disabled={disabled}
                      className="aspect-square flex items-center justify-center rounded-xl text-xl sm:text-2xl select-none relative border-2 transition-all duration-150"
                      style={{
                        backgroundColor: candy?.color ?? "#eee",
                        borderColor: isSel ? "#ffd43b" : "transparent",
                        boxShadow,
                        transform: isMt ? "scale(0)" : (!hasFall ? (swapStyle.transform ?? undefined) : undefined),
                        opacity: isMt ? 0 : 1,
                        transitionDelay: isMt ? `${sd}ms` : "0ms",
                        animation: anim,
                        "--fall-offset": hasFall ? `${-cellSize * fallDist!}px` : "0px",
                      } as React.CSSProperties}
                      aria-label={`${candy?.name ?? ""}糖果`}
                    >
                      <span className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.35), transparent 70%)" }} />
                      <span className="drop-shadow-sm pointer-events-none relative z-10"
                        style={{ transition: swapPair ? "transform 200ms cubic-bezier(0.25, 0.1, 0.25, 1)" : "none" }}>
                        {candy?.emoji ?? "?"}
                      </span>
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
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1"><Link href="/game/leaderboard">🏆 排行榜</Link></Button>
          <Button asChild variant="outline" className="flex-1"><Link href="/game/release-day">🎮 下班发售日</Link></Button>
          <Button asChild variant="outline" className="flex-1"><Link href="/">🏠 回首页</Link></Button>
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
