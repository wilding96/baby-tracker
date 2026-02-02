import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// 👇 1. 引入组件
import MobileNav from "@/components/layout/mobile-nav"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Baby Tracker",
  description: "记录宝宝成长的每一刻",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 pb-20"> {/* 👇 2. 加个 pb-20 防止内容被底部栏遮挡 */}
          {children}
        </div>
        
        {/* 👇 3. 放入底部导航 */}
        <MobileNav />
      </body>
    </html>
  );
}