"use client";

import { format } from "date-fns";

const QUOTES = [
  "今天也辛苦啦，宝宝在悄悄长大 🌱",
  "每一次夜醒，都是爱在累积 🌙",
  "你的怀抱，是宝宝最安全的岛 🏝️",
  "记录下的每一笔，都是成长的证据 ✨",
  "慢慢来，宝宝会按自己的节奏长大 🐣",
  "累的时候看看睡着的宝宝，一切都值得 💛",
  "你记录的不是数据，是宝宝的整个童年 📖",
];

/** 按日期种子选一条，保证同一天刷新不变 */
export default function DailyQuote() {
  const todayStr = format(new Date(), "yyyyMMdd");
  let seed = 0;
  for (const ch of todayStr) {
    seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  }
  const quote = QUOTES[seed % QUOTES.length];

  return <p className="text-xs text-[#9f927d] italic">「{quote}」</p>;
}
