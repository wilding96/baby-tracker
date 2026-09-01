"use client";

import Link from "next/link";
import {
  Gamepad2,
  Plane,
  Gamepad,
  Box,
  Ghost,
  Trophy,
  Crown,
  ChevronRight,
} from "lucide-react";
import { Divider } from "animal-island-ui";
import { Button } from "@/components/ui/button";

const games = [
  {
    href: "/game",
    icon: Gamepad2,
    bg: "bg-gradient-to-br from-amber-400 to-orange-500",
    title: "快乐消消乐",
    desc: "经典三消游戏，放松心情",
  },
  {
    href: "/game/perspective-match",
    icon: Box,
    bg: "bg-gradient-to-br from-pink-400 to-purple-500",
    title: "方了个方",
    desc: "3D 糖果积木消除，转动视角找同色",
  },
  {
    href: "/game/raiden",
    icon: Plane,
    bg: "bg-gradient-to-br from-slate-600 to-slate-800",
    title: "雷电战机",
    desc: "经典射击游戏，BGM + 多种 Boss",
  },
  {
    href: "/game/todo-monsters",
    icon: Ghost,
    bg: "bg-gradient-to-br from-red-400 to-rose-500",
    title: "消灭小怪兽",
    desc: "把待办变成小怪兽，一只只消灭",
  },
  {
    href: "/game/release-day",
    icon: Gamepad,
    bg: "bg-gradient-to-br from-violet-500 to-purple-700",
    title: "下班发售日",
    desc: "叙事交互小游戏，体验下班快乐",
  },
  {
    href: "/game/my-re-life",
    icon: Crown,
    bg: "bg-gradient-to-br from-fuchsia-500 to-pink-600",
    title: "这一次，换我护你",
    desc: "剧情互动游戏，重生逆袭爽文",
  },
  {
    href: "/game/leaderboard",
    icon: Trophy,
    bg: "bg-gradient-to-br from-yellow-400 to-amber-600",
    title: "排行榜",
    desc: "看看谁是消消乐最强王者",
  },
];

export default function GamesPage() {
  return (
    <main className="island-page relative min-h-screen overflow-hidden pb-24">
      <div className="island-shell space-y-4">
        <div className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-[#8ac68a]/25 blur-3xl" />
        <div className="pointer-events-none absolute top-60 -left-10 h-28 w-28 rounded-full bg-[#f7cd67]/25 blur-3xl" />

        <header className="relative space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Arcade</p>
          <h1 className="text-2xl font-black text-[#725d42] tracking-tight">
            游戏站
          </h1>
          <p className="text-xs text-[#9f927d]">
            不登录也能玩，和育儿数据互不影响
          </p>
        </header>

        <section>
          <div className="space-y-2.5">
            {games.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm border border-[#e8dcc8] active:scale-[0.98] transition-transform"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.bg} text-white shadow-md`}
                >
                  <card.icon size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#725d42]">
                    {card.title}
                  </p>
                  <p className="text-xs text-[#9f927d] mt-0.5">{card.desc}</p>
                </div>
                <ChevronRight size={14} className="text-[#9f927d] shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        <Divider type="wave-yellow" />

        <div className="flex items-center gap-2 pt-1">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/">🏠 回育儿首页</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
