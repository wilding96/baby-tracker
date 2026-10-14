import {
  addMonths,
  differenceInCalendarDays,
  differenceInMonths,
  parseISO,
} from "date-fns";

export interface BabyAgeAt {
  /** 紧凑展示用文案，例如「出生当天」「12天」「3个月12天」「1岁2个月」 */
  label: string;
  /** 出生第几天（出生当天为 0），早于出生日期时为负数 */
  days: number;
  /** 该日期早于宝宝出生日期 */
  beforeBirth: boolean;
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value);
}

/**
 * 计算某个日期时宝宝的年龄，纯前端推导，不需要额外查询数据库。
 * 生日或日期缺失/非法时返回 null，调用方按「不展示年龄」处理。
 */
export function getBabyAgeAt(
  birthday: string | Date | null | undefined,
  date: string | Date | null | undefined,
): BabyAgeAt | null {
  if (!birthday || !date) return null;

  const birth = toDate(birthday);
  const target = toDate(date);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(target.getTime())) {
    return null;
  }

  const days = differenceInCalendarDays(target, birth);

  if (days < 0) {
    return { label: `出生前 ${-days} 天`, days, beforeBirth: true };
  }
  if (days === 0) {
    return { label: "出生当天", days, beforeBirth: false };
  }

  const months = differenceInMonths(target, birth);
  if (months < 1) {
    return { label: `${days}天`, days, beforeBirth: false };
  }

  if (months < 12) {
    const restDays = differenceInCalendarDays(target, addMonths(birth, months));
    return {
      label: restDays > 0 ? `${months}个月${restDays}天` : `${months}个月`,
      days,
      beforeBirth: false,
    };
  }

  const years = Math.floor(months / 12);
  const restMonths = months % 12;
  return {
    label: restMonths > 0 ? `${years}岁${restMonths}个月` : `${years}岁`,
    days,
    beforeBirth: false,
  };
}

/** 便于直接在 JSX 里落文本；无法计算时返回 null */
export function formatBabyAgeAt(
  birthday: string | Date | null | undefined,
  date: string | Date | null | undefined,
): string | null {
  return getBabyAgeAt(birthday, date)?.label ?? null;
}
