import type { Metadata, Viewport } from "next";
import "animal-island-ui/style";
import "./globals.css";
// 👇 引入组件
import MobileNav from "@/components/layout/mobile-nav";

// 👇 定义 Metadata，关联 manifest.json
export const metadata: Metadata = {
  title: "Baby Tracker",
  description: "记录宝宝成长的每一刻",
  manifest: "/mainfest.json",
  icons: {
    apple: "/icon-512.png",
  },
};

// 👇  定义视口 (禁止缩放 + 适配状态栏)
export const viewport: Viewport = {
  themeColor: "#FFFFFF", // 安卓状态栏颜色
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // 禁止用户缩放 (像原生App一样)
  // iOS 专属设置
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* iOS 状态栏样式：default(白底黑字) / black(黑底白字) / black-translucent(沉浸式) */}
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body>
        <div className="min-h-screen bg-[#f7f3df] pb-20 text-[#725d42]">
          {" "}
          {/* 👇 2. 加个 pb-20 防止内容被底部栏遮挡 */}
          {children}
        </div>

        {/* 👇 3. 放入底部导航 */}
        <MobileNav />
      </body>
    </html>
  );
}
