"use client";

import { useEffect, useState } from "react";

export interface AnchorSection {
  id: string;
  label: string;
  color: string;
}

/**
 * 右侧浮动锚点导航线：竖线 + 圆点。
 * - 每个圆点用与模块呼应的颜色
 * - 滚动时高亮当前模块（以视口中线附近为准）
 * - 点击圆点平滑滚动到对应模块
 */
export default function AnchorNav({
  sections,
}: {
  sections: AnchorSection[];
}) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const scrollTo = (id: string) => {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      className="fixed right-1.5 top-1/2 z-40 -translate-y-1/2"
      aria-label="页面锚点导航"
    >
      <div className="relative flex flex-col items-center">
        {/* 竖线 */}
        <div className="absolute bottom-1 left-1/2 top-1 w-px -translate-x-1/2 bg-[#e8dcc8]" />
        <div className="relative flex flex-col items-center gap-3">
          {sections.map((s) => {
            const isActive = active === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => scrollTo(s.id)}
                aria-label={s.label}
                title={s.label}
                className="group relative flex items-center justify-center p-1.5"
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    width: isActive ? 18 : 12,
                    height: isActive ? 18 : 12,
                    backgroundColor: isActive ? s.color : "#d4c9b4",
                    boxShadow: isActive
                      ? `0 0 0 5px ${s.color}30`
                      : "none",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
