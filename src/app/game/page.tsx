"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── 糖果配置 ───
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

// ─── 类型 ───
type Cell = { id: string; type: number };

// ─── 工具函数 ───
function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((c) => ({ ...c })));
}

function isAdjacent(r1: number, c1: number, r2: number, c2: number) {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}

function createCell(type?: number): Cell {
  return { id: uid(), type: type ?? rand(CANDY_TYPES.length) };
}

/** 生成无初始三消的棋盘 */
function createBoard(): Cell[][] {
  const board: Cell[][] = [];
  for (let r = 0; r < ROWS; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < COLS; c++) {
      let type: number;
      do {
        type = rand(CANDY_TYPES.length);
      } while (
        (r >= 2 &&
          board[r - 1][c].type === type &&
          board[r - 2][c].type === type) ||
        (c >= 2 &&
          row[c - 1].type === type &&
          row[c - 2].type === type)
      );
      row.push(createCell(type));
    }
    board.push(row);
  }
  return board;
}

/** 查找所有三消+ 返回匹配到的 cell id 集合 */
function findMatches(board: Cell[][]): Set<string> {
  const matched = new Set<string>();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS - 2; c++)
      if (
        board[r][c].type === board[r][c + 1].type &&
        board[r][c].type === board[r][c + 2].type
      ) {
        for (let i = 0; i < 3; i++) matched.add(board[r][c + i].id);
      }
  for (let r = 0; r < ROWS - 2; r++)
    for (let c = 0; c < COLS; c++)
      if (
        board[r][c].type === board[r + 1][c].type &&
        board[r][c].type === board[r + 2][c].type
      ) {
        for (let i = 0; i < 3; i++) matched.add(board[r + i][c].id);
      }
  return matched;
}

/** 移除匹配 → 重力下落 → 补新，循环直到无消，返回最终棋盘和分数（连击翻倍） */
function processMatches(board: Cell[][]): {
  board: Cell[][];
  score: number;
} {
  let b = cloneBoard(board);
  let totalScore = 0;
  let combo = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const matches = findMatches(b);
    if (matches.size === 0) break;
    combo++;
    // 连击翻倍：第1次×1, 第2次×2, 第3次×3, 以此类推
    totalScore += matches.size * 10 * combo;

    const matchSet = new Set(matches);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (matchSet.has(b[r][c].id)) b[r][c] = { ...b[r][c], type: -1 };

    // 每列重力下落并补新
    for (let c = 0; c < COLS; c++) {
      const col: Cell[] = [];
      for (let r = 0; r < ROWS; r++)
        if (b[r][c].type >= 0) col.push(b[r][c]);
      for (let r = ROWS - 1; r >= 0; r--)
        b[r][c] = col.length > 0 ? col.pop()! : createCell();
    }
  }

  return { board: b, score: totalScore };
}

// ─── 组件 ───
export default function GamePage() {
  const [board, setBoard] = useState<Cell[][] | null>(null);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(0);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const processingRef = useRef(false);
  const boardRef = useRef<Cell[][] | null>(null);

  // 排行榜弹窗
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneScore, setMilestoneScore] = useState(0);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // 记录已经弹窗过的档位，避免重复弹
  const submittedMilestones = useRef(new Set<number>());

  // 只在客户端初始化棋盘，避免 SSR/客户端随机数不匹配
  useEffect(() => {
    const b = createBoard();
    setBoard(b);
    boardRef.current = b;
  }, []);

  // boardRef 始终保持最新值
  boardRef.current = board;

  /** 加分并检查里程碑 */
  const addScore = useCallback((add: number) => {
    setScore((prev) => {
      const next = prev + add;
      // 检查是否跨过新的500分档位
      const milestone = Math.floor(next / 500) * 500;
      const prevMilestone = Math.floor(prev / 500) * 500;
      if (milestone > 0 && milestone > prevMilestone && !submittedMilestones.current.has(milestone)) {
        submittedMilestones.current.add(milestone);
        setMilestoneScore(milestone);
        setShowMilestone(true);
      }
      return next;
    });
  }, []);

  const handleSubmitScore = useCallback(async () => {
    if (!nickname.trim()) {
      alert("请输入你的大名");
      return;
    }
    setSubmitting(true);
    // 用 ref 取最新值
    const { error } = await supabase
      .from("game_leaderboard")
      .insert({
        nickname: nickname.trim(),
        score: milestoneScore,
        moves: moves,
      });

    if (error) {
      alert(`登记失败：${error.message}`);
      setSubmitting(false);
      return;
    }

    setShowMilestone(false);
    setNickname("");
    setSubmitting(false);
  }, [nickname, milestoneScore, moves]);

  const skipMilestone = useCallback(() => {
    setShowMilestone(false);
    setNickname("");
  }, []);

  /** 尝试交换两个格子 */
  const trySwap = useCallback(
    (r1: number, c1: number, r2: number, c2: number) => {
      if (processingRef.current || !boardRef.current) return;
      processingRef.current = true;

      const originalBoard = boardRef.current;
      const b = cloneBoard(originalBoard);
      const sameType = b[r1][c1].type === b[r2][c2].type;

      // 交换
      [b[r1][c1], b[r2][c2]] = [b[r2][c2], b[r1][c1]];

      let matches = findMatches(b);

      // 同类型交换 → 直接消除这一对，然后找连锁
      if (matches.size === 0 && sameType) {
        matches = new Set([b[r1][c1].id, b[r2][c2].id]);
      }

      if (matches.size === 0) {
        // 无效交换 — 视觉上闪一下再换回来
        setBoard(b);
        setTimeout(() => {
          setBoard(originalBoard);
          processingRef.current = false;
        }, 200);
        return;
      }

      // 有效交换
      setBoard(b);
      setMoves((m) => m + 1);
      // 第一步匹配的分数（手动标记-1后交给 processMatches 走连锁）
      let stepScore = matches.size * 10;

      // 动画：高亮匹配 → 消除
      setTimeout(() => {
        setMatchedIds(matches);

        setTimeout(() => {
          setMatchedIds(new Set());
          // 把匹配标记为-1，再走重力+连锁消除
          for (const id of matches) {
            for (let r = 0; r < ROWS; r++)
              for (let c = 0; c < COLS; c++)
                if (b[r][c].id === id) {
                  b[r][c] = { ...b[r][c], type: -1 };
                }
          }
          // 重力下落+补新
          for (let c = 0; c < COLS; c++) {
            const col: Cell[] = [];
            for (let r = 0; r < ROWS; r++)
              if (b[r][c].type >= 0) col.push(b[r][c]);
            for (let r = ROWS - 1; r >= 0; r--)
              b[r][c] = col.length > 0 ? col.pop()! : createCell();
          }
          // 检查连锁消除
          const { board: newBoard, score: chainScore } = processMatches(b);
          setBoard(newBoard);
          addScore(stepScore + chainScore);
          processingRef.current = false;
        }, 350);
      }, 150);
    },
    [],
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (processingRef.current) return;

      if (!selected) {
        setSelected([r, c]);
        return;
      }

      const [sr, sc] = selected;

      // 点同一个 → 取消选择
      if (sr === r && sc === c) {
        setSelected(null);
        return;
      }

      // 不相邻 → 切换选择
      if (!isAdjacent(sr, sc, r, c)) {
        setSelected([r, c]);
        return;
      }

      // 相邻 → 尝试交换
      setSelected(null);
      trySwap(sr, sc, r, c);
    },
    [selected, trySwap],
  );

  const resetGame = useCallback(() => {
    if (processingRef.current) return;
    const b = createBoard();
    setBoard(b);
    boardRef.current = b;
    setSelected(null);
    setScore(0);
    setMoves(0);
    setMatchedIds(new Set());
    submittedMilestones.current = new Set();
  }, []);

  return (
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        {/* HEADER */}
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Mini Game</p>
          <h1 className="text-2xl font-black text-[#725d42]">快乐消消乐</h1>
          <p className="text-sm text-[#9f927d]">
            点击两个相邻的糖果交换，三个以上相同即可消除！
          </p>
        </header>
        <Divider type="wave-yellow" />

        {/* SCORE BAR */}
        <div className="flex items-center justify-between rounded-2xl bg-[#fffdf5] border-2 border-[#e8ddd0] px-4 py-2.5">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-[#725d42]">
              🏆 分数 <span className="text-lg text-[#ff922b]">{score}</span>
            </span>
            <span className="text-sm font-bold text-[#725d42]">
              👆 步数 <span className="text-lg text-[#6fba2c]">{moves}</span>
            </span>
          </div>
          <button
            onClick={resetGame}
            className="rounded-xl bg-[#ffd43b] px-3 py-1.5 text-sm font-bold text-[#725d42] shadow-[0_2px_#fab005] active:shadow-none active:translate-y-0.5 transition-all"
          >
            🔄 新一局
          </button>
        </div>

        {/* GAME BOARD */}
        <div className="flex justify-center">
          <div
            className="grid gap-1.5 rounded-3xl border-2 border-[#c4b89e] bg-[#f7f3df] p-3 shadow-[0_4px_#d4c9b4]"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              width: `min(calc(100vw - 2.5rem), 400px)`,
            }}
          >
            {!board
              ? Array.from({ length: ROWS * COLS }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-[#e8ddd0]/50"
                  />
                ))
              : board.map((row, r) =>
                  row.map((cell, c) => {
                    const isSelected =
                      selected?.[0] === r && selected?.[1] === c;
                    const isMatched = matchedIds.has(cell.id);

                    return (
                      <button
                        key={cell.id + (isMatched ? "-m" : "")}
                        onClick={() => handleCellClick(r, c)}
                        disabled={processingRef.current}
                        className={[
                          "aspect-square flex items-center justify-center",
                          "rounded-xl text-xl sm:text-2xl",
                          "transition-all duration-150 select-none",
                          "border-2",
                          isSelected
                            ? "border-[#ff922b] shadow-[0_0_0_2px_#ffd43b] scale-105"
                            : "border-transparent",
                          isMatched
                            ? "scale-0 opacity-0 duration-300"
                            : "hover:scale-105 active:scale-95",
                          processingRef.current ? "cursor-not-allowed" : "cursor-pointer",
                        ].join(" ")}
                        style={{
                          backgroundColor: CANDY_TYPES[cell.type]?.color ?? "#eee",
                        }}
                        aria-label={`${CANDY_TYPES[cell.type]?.name ?? ""}糖果`}
                      >
                        <span className="drop-shadow-sm pointer-events-none">
                          {CANDY_TYPES[cell.type]?.emoji ?? "?"}
                        </span>
                      </button>
                    );
                  }),
                )}
          </div>
        </div>

        {/* FOOTER LINKS */}
        <div className="flex items-center gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/game/leaderboard">🏆 排行榜</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">🏠 回首页</Link>
          </Button>
        </div>
      </div>

      {/* 里程碑弹窗 */}
      {showMilestone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-3xl border-2 border-[#f0d992] bg-[#fff7dc] p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
            <div className="text-center space-y-3">
              <p className="text-4xl">🎉</p>
              <h2 className="text-xl font-black text-[#725d42]">
                恭喜达到 {milestoneScore} 分！
              </h2>
              <p className="text-sm text-[#9f927d]">
                要在排行榜留下你的大名吗？
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rank-nickname">你的名字</Label>
                <Input
                  id="rank-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="例如：妈妈"
                  maxLength={20}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={skipMilestone}
                  disabled={submitting}
                >
                  算了
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSubmitScore}
                  disabled={submitting}
                >
                  {submitting ? "提交中..." : "登记！"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
