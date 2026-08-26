"use client";

import type { ReactNode } from "react";
import {
  addDays,
  addYears,
  differenceInCalendarDays,
} from "date-fns";

/** 百天/一岁纪念日徽章，extraBadges 用于和统计徽章排在同一行 */
export default function BabyAge({
  birthday,
  extraBadges,
}: {
  birthday: string | null;
  extraBadges?: ReactNode;
}) {
  if (!birthday) {
    return extraBadges ? (
      <div className="mt-3 flex flex-wrap gap-2">{extraBadges}</div>
    ) : null;
  }

  const today = new Date();
  const birth = new Date(birthday);
  const milestones = [
    { label: "百天", days: differenceInCalendarDays(addDays(birth, 100), today) },
    { label: "一岁生日", days: differenceInCalendarDays(addYears(birth, 1), today) },
  ].filter((m) => m.days >= 0);

  return (
    <div className="space-y-1.5">
      {(milestones.length > 0 || extraBadges) && (
        <div className="mt-1 flex flex-wrap gap-2">
          {milestones.map((m) => (
            <span
              key={m.label}
              className="inline-flex items-center rounded-full bg-[#fff7dc] px-2.5 py-1 text-[11px] font-bold text-[#9a6a1f] ring-1 ring-[#efd28a]"
            >
              🎂 {m.label}还有 {m.days} 天
            </span>
          ))}
          {extraBadges}
        </div>
      )}
    </div>
  );
}
