"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Divider } from "animal-island-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LeaderboardEntry = {
  id: string;
  nickname: string;
  score: number;
  moves: number;
  created_at: string;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("game_leaderboard")
      .select("id,nickname,score,moves,created_at")
      .order("score", { ascending: false })
      .order("moves", { ascending: true })
      .limit(50);

    if (error) {
      console.error("加载排行榜失败", error.message);
      setLoading(false);
      return;
    }

    setEntries((data || []) as LeaderboardEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <main className="island-page min-h-screen pb-24">
      <div className="island-shell space-y-4">
        <header className="space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Leaderboard</p>
          <h1 className="text-2xl font-black text-[#725d42]">排行榜</h1>
          <p className="text-sm text-[#9f927d]">
            看看谁是消消乐最强王者
          </p>
        </header>
        <Divider type="wave-yellow" />

        <Card className="island-card bg-[#fffdf5]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🏆 高分榜</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-[#9f927d]">加载中...</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-[#9f927d]">
                还没有人登记，快去玩游戏上榜首吧！
              </p>
            ) : (
              <ul className="space-y-2">
                {entries.map((entry, index) => (
                  <li
                    key={entry.id}
                    className="flex items-center gap-3 rounded-2xl border-2 p-3"
                    style={{
                      backgroundColor:
                        index === 0
                          ? "#fff7dc"
                          : index === 1
                            ? "#f0f4ff"
                            : index === 2
                              ? "#fff0ec"
                              : "#fafaf5",
                      borderColor:
                        index === 0
                          ? "#f0d992"
                          : index === 1
                            ? "#c9ddf2"
                            : index === 2
                              ? "#efc8bb"
                              : "#e8ddd0",
                    }}
                  >
                    <span className="w-8 text-center text-lg font-black text-[#725d42]">
                      {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#725d42] truncate">
                        {entry.nickname}
                      </p>
                      <p className="text-xs text-[#9f927d]">
                        {entry.moves} 步 · {new Date(entry.created_at).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <span className="text-lg font-black text-[#ff922b] shrink-0">
                      {entry.score}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-2 pt-2">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/game">🎮 继续玩</Link>
          </Button>
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">🏠 回首页</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
