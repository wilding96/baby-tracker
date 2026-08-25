"use client";

import { getDailyQuote } from "@/lib/dailyQuote";

/** 每日一句：按日期种子选一条，同一天刷新不变 */
export default function DailyQuote() {
  const quote = getDailyQuote();

  return <p className="text-xs text-[#9f927d] italic">「{quote}」</p>;
}
