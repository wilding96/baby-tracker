"use client";

import Link from "next/link";
import {
  Gamepad2,
  Plane,
  Gamepad,
  Heart,
  MessageCircle,
  BarChart3,
  ChevronRight,
  Box,
} from "lucide-react";
import { Divider } from "animal-island-ui";

const gameCards = [
  {
    href: "/game",
    icon: Gamepad2,
    bg: "bg-gradient-to-br from-amber-400 to-orange-500",
    title: "快乐消消乐",
    desc: "经典三消游戏，放松心情",
    action: "去玩",
  },
  {
    href: "/game/perspective-match",
    icon: Box,
    bg: "bg-gradient-to-br from-pink-400 to-purple-500",
    title: "方了个方",
    desc: "3D糖果积木消除，转动视角找同色",
    action: "去玩",
  },
  {
    href: "/game/raiden",
    icon: Plane,
    bg: "bg-gradient-to-br from-slate-600 to-slate-800",
    title: "雷电战机",
    desc: "经典射击游戏，不登录也能玩",
    action: "去玩",
  },
  {
    href: "/game/release-day",
    icon: Gamepad,
    bg: "bg-gradient-to-br from-violet-500 to-purple-700",
    title: "下班发售日",
    desc: "叙事交互小游戏，体验下班快乐",
    action: "去玩",
  },
];

const lifeCards = [
  {
    href: "/mood",
    icon: Heart,
    bg: "bg-gradient-to-br from-rose-400 to-pink-600",
    title: "心情日记",
    desc: "记录当下的情绪与感受",
    action: "记录",
  },
  {
    href: "/board",
    icon: MessageCircle,
    bg: "bg-gradient-to-br from-sky-400 to-blue-500",
    title: "留言板",
    desc: "给家人留句话，分享温暖",
    action: "去看看",
  },
];

const toolCards = [
  {
    href: "/stats",
    icon: BarChart3,
    bg: "bg-gradient-to-br from-emerald-400 to-teal-600",
    title: "喂养数据统计",
    desc: "查看喂养、睡眠、排便趋势",
    action: "查看",
  },
];

export default function DiscoverPage() {
  return (
    <main className="island-page relative min-h-screen overflow-hidden pb-24">
      <div className="island-shell space-y-4">
        <div className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-[#8ac68a]/25 blur-3xl" />
        <div className="pointer-events-none absolute top-60 -left-10 h-28 w-28 rounded-full bg-[#f7cd67]/25 blur-3xl" />

        <header className="relative space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Explore</p>
          <h1 className="text-2xl font-black text-[#725d42] tracking-tight">
            发现更多
          </h1>
          <p className="text-xs text-[#9f927d]">
            游戏、心情、社区，放松一下
          </p>
        </header>

        {/* 游戏中心 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Gamepad2 size={16} className="text-[#9a6a1f]" />
            <span className="text-sm font-bold text-[#725d42]">游戏中心</span>
          </div>
          <div className="space-y-2.5">
            {gameCards.map((card) => (
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
                <span className="text-xs text-[#5a7f38] font-semibold flex items-center gap-0.5 shrink-0">
                  {card.action}
                  <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Divider type="wave-yellow" />

        {/* 心情 & 社区 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Heart size={16} className="text-[#d07044]" />
            <span className="text-sm font-bold text-[#725d42]">
              心情 & 社区
            </span>
          </div>
          <div className="space-y-2.5">
            {lifeCards.map((card) => (
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
                <span className="text-xs text-[#5a7f38] font-semibold flex items-center gap-0.5 shrink-0">
                  {card.action}
                  <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Divider type="wave-yellow" />

        {/* 工具 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-[#247b67]" />
            <span className="text-sm font-bold text-[#725d42]">数据工具</span>
          </div>
          <div className="space-y-2.5">
            {toolCards.map((card) => (
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
                <span className="text-xs text-[#5a7f38] font-semibold flex items-center gap-0.5 shrink-0">
                  {card.action}
                  <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
