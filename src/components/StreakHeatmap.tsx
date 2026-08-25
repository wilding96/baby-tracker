"use client";

import { addDays, format, subDays } from "date-fns";
import { useCountUp } from "@/hooks/useCountUp";

function calcStreak(dates: Set<string>): number {
  let streak = 0;
  let d = new Date();
  // 今天还没结束，今天没记录不算断，从昨天起算
  if (!dates.has(format(d, "yyyy-MM-dd"))) {
    d = subDays(d, 1);
  }
  while (dates.has(format(d, "yyyy-MM-dd"))) {
    streak++;
    d = subDays(d, 1);
  }
  return streak;
}

const BADGES = [
  { min: 0, emoji: "🌱", label: "刚刚起步" },
  { min: 3, emoji: "🌿", label: "在坚持" },
  { min: 7, emoji: "🌳", label: "小成习惯" },
  { min: 30, emoji: "🏆", label: "超级爸妈" },
];

/** 连续打卡天数 + 近 12 周 heatmap */
export default function StreakHeatmap({
  logDates,
}: {
  logDates: Set<string>;
}) {
  const streak = calcStreak(logDates);
  const streakAnimated = useCountUp(streak);
  const badge =
    [...BADGES].reverse().find((b) => streak >= b.min) || BADGES[0];

  // 12 周 × 7 天 heatmap，从 12 周前那周的周日开始
  const today = new Date();
  const start = subDays(today, today.getDay() + 11 * 7);
  const weeks: { key: string; has: boolean }[][] = [];
  for (let w = 0; w < 12; w++) {
    const col: { key: string; has: boolean }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const key = format(date, "yyyy-MM-dd");
      col.push({ key, has: logDates.has(key) });
    }
    weeks.push(col);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{badge.emoji}</span>
        <div>
          <p className="text-sm font-bold text-[#725d42]">
            连续记录{" "}
            <span className="font-black text-[#5a7f38]">
              {Math.round(streakAnimated)}
            </span>{" "}
            天
          </p>
          <p className="text-[11px] text-[#9f927d]">{badge.label}</p>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.key}
                title={day.key}
                className="h-3 w-3 rounded-[3px]"
                style={{
                  backgroundColor: day.has ? "#8ac68a" : "#efe9da",
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
