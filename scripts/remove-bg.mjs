// 从四边洪泛填充抠背景（magic-wand / 魔棒），不依赖绿幕。
// 用法：node scripts/remove-bg.mjs [文件] [阈值]
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const file = process.argv[2] || "public/game/raiden/boss_eye.png";
const threshold = Number(process.argv[3]) || 45; // 颜色距离阈值，越大吃得越狠

const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

function corner(x, y) {
  const i = (y * width + x) * channels;
  return [data[i], data[i + 1], data[i + 2]];
}
const cs = [corner(2, 2), corner(width - 3, 2), corner(2, height - 3), corner(width - 3, height - 3)];
const bg = [0, 1, 2].map((k) => Math.round(cs.reduce((s, c) => s + c[k], 0) / cs.length));
console.log("背景色:", bg, "阈值:", threshold);

const th2 = threshold * threshold;
const visited = new Uint8Array(width * height);
const queue = [];

function tryPush(x, y) {
  const idx = y * width + x;
  if (visited[idx]) return;
  visited[idx] = 1;
  const i = idx * channels;
  const a = data[i + 3];
  const dr = data[i] - bg[0], dg = data[i + 1] - bg[1], db = data[i + 2] - bg[2];
  if (a < 12 || dr * dr + dg * dg + db * db <= th2) {
    data[i + 3] = 0;
    queue.push(x, y);
  }
}

for (let x = 0; x < width; x++) { tryPush(x, 0); tryPush(x, height - 1); }
for (let y = 0; y < height; y++) { tryPush(0, y); tryPush(width - 1, y); }

let qi = 0;
while (qi < queue.length) {
  const x = queue[qi++], y = queue[qi++];
  if (x > 0) tryPush(x - 1, y);
  if (x < width - 1) tryPush(x + 1, y);
  if (y > 0) tryPush(x, y - 1);
  if (y < height - 1) tryPush(x, y + 1);
}

const buf = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
writeFileSync(file, buf);
console.log("完成:", file);
