// scripts/gen-sprites.mjs
// 用阿里云百炼（通义万相）生成 2.5D 街机精灵，绿幕抠图成透明 PNG。
//
// 用法（在项目根目录）：
//   1) 先装依赖：  pnpm add -D sharp
//   2) 生成：      node scripts/gen-sprites.mjs
//
// 需要 Node 18+（内置 fetch）。图片输出到 public/game/raiden/*.png，
// 游戏会在运行时加载这些图，缺失时自动回退到像素图。

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

// ── 配置 ────────────────────────────────────────────────
const CSV_PATH = "F:/我的南京/素材/write/0915/默认业务空间-apiKey-7257160.csv"; // key 文件位置，移动了就改这里
const MODEL = "wanx2.1-t2i-turbo"; // 图像模型名；如果你的工作区部署的是别的，改这里
const SIZE = "1024*1024";
const OUT_DIR = "public/game/raiden";

// ── 读 CSV（key,value 两列） ──
function parseCsv(p) {
  const text = readFileSync(p, "utf8");
  const m = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf(",");
    if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return m;
}
const cfg = parseCsv(CSV_PATH);
const KEY = cfg.apiKey;
const BASE = (cfg.dashScope || "").replace(/\/$/, ""); // .../api/v1
if (!KEY || !BASE) {
  console.error("❌ 解析 key 失败，请检查 CSV_PATH 是否正确");
  process.exit(1);
}

// 统一风格前缀（俯视、机头朝上、左上打光、纯绿背景）
const STYLE =
  "1996 Japanese arcade shoot'em up sprite, pre-rendered 3D model, top-down view, " +
  "nose pointing up, lit from top-left, clean silhouette, high detail, " +
  "isolated on a flat solid pure green chroma-key background (#00FF00), " +
  "no environment, no space, no stars, no nebula, no background scenery, " +
  "only the single object on green, no shadow cast on background, no text, no watermark";

const SPRITES = [
  { name: "player", desc: "player fighter jet, small cyan/teal futuristic aircraft, single central fuselage" },
  { name: "fighter", desc: "small enemy fighter jet, red/crimson, single-seat interceptor" },
  { name: "bomber", desc: "wide enemy bomber, purple/violet, heavy twin-engine gunship" },
  { name: "interceptor", desc: "sleek enemy interceptor, magenta/pink, swept wings" },
  { name: "elite", desc: "large elite enemy gunship, gold/yellow, ornate heavy armor" },
  { name: "miniboss", desc: "mini boss warship, orange, wide armored battleship" },
  { name: "boss_fortress", desc: "large boss fortress, red, massive armored space fortress" },
  { name: "boss_carrier", desc: "large boss carrier, purple/violet, huge space aircraft carrier" },
  { name: "boss_eye", desc: "single giant mechanical eye boss, cyan glowing iris and pupil, the eye object alone filling the frame, isolated on green background, no surrounding environment or space" },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createTask(prompt) {
  const res = await fetch(`${BASE}/services/aigc/text2image/image-synthesis`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "X-DashScope-Async": "enable",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: { prompt }, parameters: { size: SIZE, n: 1 } }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`createTask HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json.output?.task_id;
}

async function pollTask(taskId) {
  for (let i = 0; i < 90; i++) {
    const res = await fetch(`${BASE}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const json = await res.json().catch(() => ({}));
    const st = json.output?.task_status;
    if (st === "SUCCEEDED") return json.output.results?.[0]?.url;
    if (st === "FAILED" || st === "CANCELED") throw new Error(`task ${st}: ${JSON.stringify(json)}`);
    await sleep(2000);
  }
  throw new Error("任务轮询超时");
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// 绿幕 → 透明（chroma key）
async function greenToAlpha(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * channels];
    const g = data[i * channels + 1];
    const b = data[i * channels + 2];
    if (g > 90 && g > r * 1.4 && g > b * 1.4) data[i * channels + 3] = 0;
  }
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

// 按透明区域自动裁剪（去掉四周空白）
async function cropTransparent(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1, any = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 12) { any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  if (!any) return buf;
  const m = 4;
  const left = Math.max(0, minX - m), top = Math.max(0, minY - m);
  const w = Math.min(width - left, (maxX - minX + 1) + m * 2);
  const h = Math.min(height - top, (maxY - minY + 1) + m * 2);
  return sharp(buf).extract({ left, top, width: w, height: h }).png().toBuffer();
}

async function main() {
  const filter = process.argv.slice(2);
  const list = filter.length ? SPRITES.filter((s) => filter.includes(s.name)) : SPRITES;
  if (filter.length && list.length === 0) {
    console.error("❌ 没有匹配的精灵名，可选：", SPRITES.map((s) => s.name).join(", "));
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  for (const s of list) {
    try {
      console.log(`[${s.name}] 生成中...`);
      const taskId = await createTask(`${STYLE}. ${s.desc}`);
      const url = await pollTask(taskId);
      const raw = await download(url);
      const png = await cropTransparent(await greenToAlpha(raw));
      const out = path.join(OUT_DIR, `${s.name}.png`);
      writeFileSync(out, png);
      console.log(`  ✅ ${s.name}.png  (${png.length} bytes)`);
    } catch (e) {
      console.error(`  ❌ ${s.name} 失败: ${e.message}`);
    }
  }
  console.log("完成");
}

main();
