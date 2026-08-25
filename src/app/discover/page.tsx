"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Heart,
  MessageCircle,
  BarChart3,
  ChevronRight,
  Lock,
  ClipboardList,
} from "lucide-react";
import { Divider } from "animal-island-ui";
import { supabase } from "@/lib/supabase";

const lifeCards = [
  {
    href: "/record",
    icon: ClipboardList,
    bg: "bg-gradient-to-br from-green-400 to-teal-500",
    title: "快速记录",
    desc: "喂养、睡眠、尿布一键记",
    action: "记录",
  },
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setIsLoggedIn(Boolean(user));
    };
    check();
  }, []);

  return (
    <main className="island-page relative min-h-screen overflow-hidden pb-24">
      <div className="island-shell space-y-4">
        <div className="pointer-events-none absolute -top-10 right-0 h-32 w-32 rounded-full bg-[#8ac68a]/25 blur-3xl" />
        <div className="pointer-events-none absolute top-60 -left-10 h-28 w-28 rounded-full bg-[#f7cd67]/25 blur-3xl" />

        <header className="relative space-y-1">
          <p className="text-xs font-bold text-[#6fba2c]">Care Tools</p>
          <h1 className="text-2xl font-black text-[#725d42] tracking-tight">
            育儿工具
          </h1>
          <p className="text-xs text-[#9f927d]">
            记录、心情、家庭留言，都在这里
          </p>
        </header>

        {/* 记录 & 心情 & 社区 */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Heart size={16} className="text-[#d07044]" />
            <span className="text-sm font-bold text-[#725d42]">
              记录 & 家庭
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
                <span className="text-xs text-[#5a7f38] font-semibold flex items-center gap-1 shrink-0">
                  {["/mood", "/board", "/record"].includes(card.href) &&
                    !isLoggedIn && (
                      <span className="flex items-center gap-0.5 text-[#9f927d]">
                        <Lock size={12} />
                        需登录
                      </span>
                    )}
                  {card.action}
                  <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <Divider type="wave-yellow" />

        {/* 数据工具 */}
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
                <span className="text-xs text-[#5a7f38] font-semibold flex items-center gap-1 shrink-0">
                  {["/stats"].includes(card.href) && !isLoggedIn && (
                    <span className="flex items-center gap-0.5 text-[#9f927d]">
                      <Lock size={12} />
                      需登录
                    </span>
                  )}
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
