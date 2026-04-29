"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Settings, Plus, CalendarClock, Droplets } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const hideOnPaths = ["/login", "/welcome", "/auth/callback", "/board"];
  const shouldHide = hideOnPaths.includes(pathname);

  if (shouldHide) {
    return null;
  }

  const isHome = pathname === "/";
  const isSettings = pathname === "/settings";

  const openGrowthEvent = () => {
    setMenuOpen(false);

    if (pathname === "/") {
      window.dispatchEvent(new Event("open-growth-event"));
      return;
    }

    sessionStorage.setItem("openGrowthEvent", "1");
    router.push("/");
  };

  const openRecord = () => {
    setMenuOpen(false);
    router.push("/record");
  };

  return (
    <>
      {menuOpen && (
        <button
          type="button"
          aria-label="关闭快捷菜单"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        />
      )}

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[#d4c9b4] bg-[#fffdf5]/95 pb-safe shadow-[0_-8px_24px_rgba(61,52,40,0.10)] backdrop-blur">
        <div className="relative flex h-16 items-center justify-between px-12">
          <Link
            href="/"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors w-12",
              isHome ? "text-[#5a7f38]" : "text-[#a0936e]",
            )}
          >
            <Home
              size={24}
              strokeWidth={isHome ? 2.5 : 2}
              className={cn(isHome && "fill-current/10")}
            />
            <span className="text-[10px] font-medium">首页</span>
          </Link>

          <div className="relative -top-9">
            <div
              className={cn(
                "absolute left-1/2 top-1/2 -ml-8 -mt-8 flex flex-col items-center gap-1 transition-all duration-300 ease-out",
                menuOpen
                  ? "-translate-x-[92px] -translate-y-24 scale-100 opacity-100"
                  : "translate-x-0 translate-y-0 scale-75 opacity-0 pointer-events-none",
              )}
            >
              <button
                type="button"
                onClick={openGrowthEvent}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#f7cd67] text-[#725d42] shadow-lg"
                aria-label="记录时间事件"
              >
                <CalendarClock size={30} />
              </button>
              <span className="text-center rounded-full bg-[#fffdf5]/95 px-2 py-0.5 text-[11px] font-medium text-[#725d42] shadow-md border border-[#e8dcc8] whitespace-nowrap">
                记录事件
              </span>
            </div>

            <div
              className={cn(
                "absolute left-1/2 top-1/2 -ml-8 -mt-8 flex flex-col items-center gap-1 transition-all duration-300 ease-out",
                menuOpen
                  ? "translate-x-[92px] -translate-y-24 scale-100 opacity-100 delay-75"
                  : "translate-x-0 translate-y-0 scale-75 opacity-0 pointer-events-none",
              )}
            >
              <button
                type="button"
                onClick={openRecord}
                className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#d4c9b4] bg-[#8ac68a] text-white shadow-lg"
                aria-label="喂养记录"
              >
                <Droplets size={30} />
              </button>
              <span className="text-center rounded-full bg-[#fffdf5]/95 px-2 py-0.5 text-[11px] font-medium text-[#5a7f38] shadow-md border border-[#e8dcc8] whitespace-nowrap">
                喂养记录
              </span>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-[#725d42] text-white shadow-xl transition-transform active:scale-95 border-[5px] border-[#fffdf5]"
              aria-label="打开快捷菜单"
            >
              <Plus
                size={34}
                strokeWidth={3}
                className={cn(
                  "transition-transform duration-300 ease-out",
                  menuOpen && "rotate-45 scale-110",
                )}
              />
            </button>
          </div>

          <Link
            href="/settings"
            onClick={() => setMenuOpen(false)}
            className={cn(
              "flex flex-col items-center justify-center gap-1 transition-colors w-12",
              isSettings ? "text-[#5a7f38]" : "text-[#a0936e]",
            )}
          >
            <Settings
              size={24}
              strokeWidth={isSettings ? 2.5 : 2}
              className={cn(isSettings && "fill-current/10")}
            />
            <span className="text-[10px] font-medium">设置</span>
          </Link>
        </div>
      </div>
    </>
  );
}
