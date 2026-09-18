// 边缘侵蚀：把透明区向内收缩 N 像素，削掉抠图留下的彩色光晕/残边。
// 用法：node scripts/refine-sprites.mjs [侵蚀半径，默认2]
import { readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const dir = "public/game/raiden";
const ERODE = Number(process.argv[2]) || 2;

const files = readdirSync(dir).filter((f) => f.endsWith(".png"));

for (const f of files) {
  const { data, info } = await sharp(`${dir}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const src = new Float32Array(data);
  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let mn = 255;
      for (let dy = -ERODE; dy <= ERODE; dy++) {
        for (let dx = -ERODE; dx <= ERODE; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          mn = Math.min(mn, src[(ny * width + nx) * channels + 3]);
        }
      }
      out[y * width + x] = mn;
    }
  }
  for (let i = 0; i < width * height; i++) data[i * channels + 3] = out[i];
  const buf = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
  writeFileSync(`${dir}/${f}`, buf);
  console.log(`${f}: 侵蚀 ${ERODE}px`);
}
console.log("done");
