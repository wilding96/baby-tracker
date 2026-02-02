"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "首页",
      href: "/",
      icon: Home,
    },
    {
      name: "记录",
      href: "/record", // 中间的大按钮
      icon: Plus,
      isMain: true, 
    },
    {
      name: "设置",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t pb-safe shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
      {/* 这里的 px-8 是为了让左右两个按钮往中间靠一点，不要太散 */}
      <div className="relative flex h-16 items-center justify-between px-12">
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isMain) {
            return (
              <div key={item.href} className="relative -top-8"> 
                {/* 👆 -top-8 让它浮得更高一点 */}
                <Link
                  href={item.href}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white shadow-xl transition-transform active:scale-95 border-[4px] border-white"
                >
                  <Icon size={32} strokeWidth={3} />
                </Link>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors w-12", // 固定宽度确保对齐
                isActive ? "text-black" : "text-gray-400"
              )}
            >
              <Icon size={24} strokeWidth={isActive ? 2.5 : 2} className={cn(isActive && "fill-current/10")} />
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}