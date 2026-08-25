"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 数字从 0 缓动到 target（easeOutCubic），用于数据卡片 / 倒计时的 count-up 动效。
 * 返回当前值；刷新率高也不受影响，因进度按时间计算。
 */
export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const from = 0;
    const to = target;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setValue(from + (to - from) * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}
