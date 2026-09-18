// 旋转精灵图并重新裁剪透明边（修正朝向）。
// 用法：node scripts/rotate-sprite.mjs <文件> [顺时针角度，默认90]
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const file = process.argv[2];
const angle = Number(process.argv[3] || 90);
if (!file) { console.error("用法: node scripts/rotate-sprite.mjs <文件> [角度]"); process.exit(1); }

const rotated = await sharp(file).ensureAlpha().rotate(angle).png().toBuffer();

// 重新按透明区域裁剪
const { data, info } = await sharp(rotated).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
let minX = width, minY = height, maxX = -1, maxY = -1, any = false;
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  if (data[(y * width + x) * channels + 3] > 12) {
    any = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
}
if (!any) { writeFileSync(file, rotated); console.log("无透明区域，直接保存"); process.exit(0); }
const m = 4;
const left = Math.max(0, minX - m), top = Math.max(0, minY - m);
const w = Math.min(width - left, (maxX - minX + 1) + m * 2);
const h = Math.min(height - top, (maxY - minY + 1) + m * 2);
const out = await sharp(rotated).extract({ left, top, width: w, height: h }).png().toBuffer();
writeFileSync(file, out);
console.log(`旋转 ${angle}° 并裁剪 -> ${w}x${h}`);
