"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";

/** 一键生成「宝宝今日记录」分享卡片图并下载 */
export default function ShareCard({
  babyName,
  feedingMl,
  sleepHours,
  diaperCount,
}: {
  babyName: string;
  feedingMl: number;
  sleepHours: number;
  diaperCount: number;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = `宝宝今日记录-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("生成分享卡片失败", e);
      alert("生成失败，请重试");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div>
      {/* 屏幕外渲染，供截图使用 */}
      <div
        ref={cardRef}
        className="fixed top-0 -left-[9999px] w-[400px] rounded-3xl bg-gradient-to-br from-[#fff7dc] to-[#eef6e7] p-6 text-[#725d42]"
      >
        <p className="text-xs font-bold text-[#6fba2c]">Baby Tracker</p>
        <p className="mt-1 text-xl font-black">{babyName} 的今日记录</p>
        <p className="text-xs text-[#9f927d]">
          {new Date().toLocaleDateString("zh-CN")}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-2xl font-black">{feedingMl}</p>
            <p className="text-[11px]">ml 奶量</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-2xl font-black">{sleepHours.toFixed(1)}</p>
            <p className="text-[11px]">小时睡眠</p>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <p className="text-2xl font-black">{diaperCount}</p>
            <p className="text-[11px]">次尿布</p>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-[#9f927d]">
          记录成长每一步 ✨
        </p>
      </div>

      <Button
        variant="outline"
        onClick={handleDownload}
        disabled={downloading}
        className="w-full"
      >
        {downloading ? "生成中..." : "📸 生成今日分享卡片"}
      </Button>
    </div>
  );
}
