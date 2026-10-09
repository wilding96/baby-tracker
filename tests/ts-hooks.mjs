import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 把无扩展名的相对导入解析到 .ts / .tsx / index.ts，
// 让 node:test 能直接 import 引擎模块（Next 的 bundler 解析对 Node 不生效）。
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const ext of [".ts", ".tsx", "/index.ts"]) {
      const cand = new URL(base.href + ext);
      if (existsSync(fileURLToPath(cand))) return nextResolve(base.href + ext, context);
    }
  }
  return nextResolve(specifier, context);
}
