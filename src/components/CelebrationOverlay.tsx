"use client";

import { useEffect } from "react";

/** 全屏庆祝彩蛋：新增成长事件后触发，2.6s 后自动关闭 */
export default function CelebrationOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 px-6">
      <div className="animate-bounce text-center space-y-3">
        <p className="text-6xl">🎉</p>
        <p className="text-2xl font-black text-white drop-shadow-md">
          又长大一点啦！
        </p>
        <p className="text-sm text-white/80">成长的每一步，都值得被记录</p>
      </div>
    </div>
  );
}
