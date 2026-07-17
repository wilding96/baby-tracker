"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, Gamepad2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "首页", icon: Home },
  { href: "/record", label: "记录", icon: ClipboardList },
  { href: "/discover", label: "发现", icon: Gamepad2 },
  { href: "/settings", label: "我的", icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();

  const hideOnPaths = [
    "/login",
    "/welcome",
    "/auth/callback",
    "/game/raiden",
    "/game/release-day",
  ];
  const shouldHide = hideOnPaths.includes(pathname);

  if (shouldHide) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-[#d4c9b4] bg-[#fffdf5]/95 pb-safe shadow-[0_-8px_24px_rgba(61,52,40,0.10)] backdrop-blur">
      <div className="flex h-16 items-center justify-around px-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 transition-colors w-16 h-full",
                isActive ? "text-[#5a7f38]" : "text-[#a0936e]",
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-[11px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
