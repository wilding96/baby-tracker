"use client";

import {
  addDays,
  addYears,
  differenceInCalendarDays,
} from "date-fns";
import { useCountUp } from "@/hooks/useCountUp";

/** 宝宝第 N 天 + 百天/一岁等纪念日倒计时 */
export default function BabyAge({ birthday }: { birthday: string | null }) {
  const today = new Date();
  const totalDays = birthday
    ? Math.max(differenceInCalendarDays(today, new Date(birthday)), 0)
    : 0;
  const daysAnimated = useCountUp(totalDays);

  if (!birthday) return null;

  const birth = new Date(birthday);
  const milestones = [
    { label: "百天", days: differenceInCalendarDays(addDays(birth, 100), today) },
    { label: "一岁生日", days: differenceInCalendarDays(addYears(birth, 1), today) },
    { label: "两岁生日", days: differenceInCalendarDays(addYears(birth, 2), today) },
  ].filter((m) => m.days >= 0);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-[#725d42]">
        宝宝已来到世界{" "}
        <span className="font-black text-[#d07044]">
          {Math.round(daysAnimated)}
        </span>{" "}
        天
      </p>
      {milestones.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {milestones.slice(0, 3).map((m) => (
            <span
              key={m.label}
              className="rounded-full bg-[#fff7dc] px-2.5 py-0.5 text-[11px] font-bold text-[#9a6a1f] ring-1 ring-[#efd28a]"
            >
              🎂 {m.label}还有 {m.days} 天
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
