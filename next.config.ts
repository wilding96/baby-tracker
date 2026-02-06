import type { NextConfig } from "next";
// import withPWAInit from "@ducanh2912/next-pwa";

// const withPWA = withPWAInit({
//   dest: "public", // Service Worker 输出目录
//   cacheOnFrontEndNav: true, // 前端导航缓存
//   aggressiveFrontEndNavCaching: true,
//   reloadOnOnline: true, // 网络恢复时刷新
//   disable: process.env.NODE_ENV === "development", // ⚠️ 开发环境禁用 PWA，否则会有缓存导致你改代码不生效！
//   workboxOptions: {
//     disableDevLogs: true,
//   },
// });

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// export default withPWA(nextConfig);
