"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  id?: string;
}

// 模块级共享 IntersectionObserver：所有 Reveal 共用一个，避免各建一个导致开销堆积
let sharedObserver: IntersectionObserver | null = null;
const pending = new WeakMap<Element, () => void>();

function ensureObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === "undefined") return null;
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const show = pending.get(entry.target);
            if (show) {
              show();
              pending.delete(entry.target);
              sharedObserver?.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );
  }
  return sharedObserver;
}

/**
 * 滚动入场动画：元素进入视口时淡入 + 上移 + 微缩放。
 * 配合 globals.css 里的 .reveal / .reveal.is-visible。
 * delay 用于实现同一屏内多卡片的 stagger 节奏。
 */
export default function Reveal({
  children,
  delay = 0,
  className = "",
  id,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = ensureObserver();
    if (!observer) {
      setVisible(true);
      return;
    }

    pending.set(el, () => setVisible(true));
    observer.observe(el);

    return () => {
      pending.delete(el);
      observer.unobserve(el);
    };
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
