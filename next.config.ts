import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  // 这里的 swSrc 就是我们刚才建的文件路径
  swSrc: "src/app/sw.ts",
  // 输出路径
  swDest: "public/sw.js",
  // 开发环境禁用
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 其他配置保持不变
};

export default withSerwist(nextConfig);