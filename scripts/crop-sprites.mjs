// 把生成好的精灵图按透明区域自动裁剪（去掉四周空白），让飞船尽量占满画面。
import { readdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const dir = "public/game/raiden";
const files = readdirSync(dir).filter((f) => f.endsWith(".png"));

for (const f of files) {
  const { data, info } = await sharp(`${dir}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1, any = false;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      if (a > 12) {
        any = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!any) { console.log(`${f}: 无透明区域，跳过`); continue; }
  const m = 4; // 少量边距，避免贴边裁掉轮廓
  const left = Math.max(0, minX - m);
  const top = Math.max(0, minY - m);
  const w = Math.min(width - left, (maxX - minX + 1) + m * 2);
  const h = Math.min(height - top, (maxY - minY + 1) + m * 2);
  const buf = await sharp(`${dir}/${f}`).extract({ left, top, width: w, height: h }).png().toBuffer();
  writeFileSync(`${dir}/${f}`, buf);
  console.log(`${f}: ${width}x${height} -> ${w}x${h}`);
}
console.log("done");
