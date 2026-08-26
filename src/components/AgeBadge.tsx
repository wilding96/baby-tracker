"use client";

import {
  addMonths,
  differenceInCalendarDays,
  differenceInMonths,
} from "date-fns";
import { useCountUp } from "@/hooks/useCountUp";

/** 右侧宝宝年龄牌：天数大字 + 几个月几天小字 */
export default function AgeBadge({ birthday }: { birthday: string | null }) {
  const today = new Date();
  const birth = birthday ? new Date(birthday) : null;
  const totalDays = birth
    ? Math.max(differenceInCalendarDays(today, birth), 0)
    : 0;
  const months = birth ? Math.max(differenceInMonths(today, birth), 0) : 0;
  const remainingDays = birth
    ? Math.max(differenceInCalendarDays(today, addMonths(birth, months)), 0)
    : 0;
  const daysAnimated = useCountUp(totalDays);

  if (!birth) return null;

  return (
    <div className="absolute right-0 top-0 flex flex-col items-center rounded-2xl border-2 border-[#e8dcc8] bg-[#fffdf5] px-3 py-2 text-center shadow-sm">
      <div className="flex items-baseline gap-1">
        <span className="text-[28px] font-black leading-none text-[#d07044]">
          {Math.round(daysAnimated)}
        </span>
        <span className="text-[11px] font-bold text-[#9f927d]">天</span>
      </div>
      <span className="mt-1.5 text-[11px] font-bold text-[#725d42]">
        {months}个月{remainingDays}天
      </span>
    </div>
  );
}
