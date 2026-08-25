"use client";

import { useRef, useState } from "react";
import { differenceInCalendarDays } from "date-fns";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getDailyQuote } from "@/lib/dailyQuote";

interface ShareCardProps {
  babyName: string;
  feedingMl: number;
  sleepHours: number;
  diaperCount: number;
  birthday: string | null;
  nextEventTitle: string | null;
  nextEventDate: string | null;
  nextEventType: string | null;
}

/** 生成「宝宝今日成长快照」分享卡片：先弹预览，满意再下载 */
export default function ShareCard({
  babyName,
  feedingMl,
  sleepHours,
  diaperCount,
  birthday,
  nextEventTitle,
  nextEventDate,
  nextEventType,
}: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const ageDays = birthday
    ? Math.max(differenceInCalendarDays(new Date(), new Date(birthday)), 0)
    : null;
  const quote = getDailyQuote();

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        skipFonts: true, // 跳过跨域字体嵌入，避免 SecurityError
        backgroundColor: "#fffdf5", // 兜底背景色
      });
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
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        📸 生成今日分享卡片
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>今日分享卡片</DialogTitle>
            <DialogDescription>
              预览效果，满意就下载图片分享给家人。
            </DialogDescription>
          </DialogHeader>

          {/* 预览卡片：正常渲染，截图直接对准它 */}
          <div
            ref={cardRef}
            className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-[#fff7dc] to-[#eef6e7] p-6 text-[#725d42]"
          >
            {/* 可爱背景元素 */}
            <span className="pointer-events-none absolute -right-2 -top-2 text-4xl opacity-20">
              🍼
            </span>
            <span className="pointer-events-none absolute -bottom-2 -left-2 text-4xl opacity-20">
              🌙
            </span>
            <span className="pointer-events-none absolute right-6 top-1/2 text-3xl opacity-15">
              ⭐
            </span>
            <span className="pointer-events-none absolute bottom-8 left-6 text-3xl opacity-15">
              💛
            </span>

            <div className="relative">
              <p className="text-xs font-bold text-[#6fba2c]">Baby Tracker</p>
              <p className="mt-1 text-xl font-black">{babyName} 的今日记录</p>
              <p className="text-xs text-[#9f927d]">
                {new Date().toLocaleDateString("zh-CN")}
              </p>

              {/* 年龄 */}
              {ageDays !== null && (
                <p className="mt-3 inline-block rounded-full bg-white/70 px-3 py-1 text-xs font-bold text-[#d07044]">
                  🎂 宝宝已来到世界 {ageDays} 天
                </p>
              )}

              {/* 喂养情况（缩小） */}
              <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-xl bg-white/70 p-2">
                  <p className="text-lg font-black">{feedingMl}</p>
                  <p className="text-[10px]">ml 奶量</p>
                </div>
                <div className="rounded-xl bg-white/70 p-2">
                  <p className="text-lg font-black">{sleepHours.toFixed(1)}</p>
                  <p className="text-[10px]">小时睡眠</p>
                </div>
                <div className="rounded-xl bg-white/70 p-2">
                  <p className="text-lg font-black">{diaperCount}</p>
                  <p className="text-[10px]">次尿布</p>
                </div>
              </div>

              {/* 下个大事件 */}
              {nextEventTitle && (
                <div className="mt-3 rounded-xl bg-white/70 p-2.5">
                  <p className="text-[10px] text-[#9f927d]">🎯 下个大事件</p>
                  <p className="text-sm font-bold">{nextEventTitle}</p>
                  {nextEventDate && (
                    <p className="text-xs text-[#9f927d]">
                      {nextEventDate}
                      {nextEventType ? ` · ${nextEventType}` : ""}
                    </p>
                  )}
                </div>
              )}

              {/* 每日一句 */}
              <p className="mt-3 text-center text-xs italic text-[#9f927d]">
                「{quote}」
              </p>

              <p className="mt-3 text-center text-[10px] text-[#9f927d]">
                记录成长每一步 ✨
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? "生成中..." : "下载图片"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
