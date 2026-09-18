import { readdirSync } from "node:fs";
import sharp from "sharp";

const dir = "public/game/raiden";
const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();

for (const f of files) {
  const { data, info } = await sharp(`${dir}/${f}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let minX = width, minY = height, maxX = -1, maxY = -1, opaque = 0, total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * channels + 3];
      total++;
      if (a > 12) {
        opaque++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const bw = maxX - minX + 1, bh = maxY - minY + 1;
  const cov = ((opaque / total) * 100).toFixed(1);
  console.log(
    `${f.padEnd(18)} ${width}x${height}  bbox=(${minX},${minY})-(${maxX},${maxY}) ${bw}x${bh}  fill=${(bw / width * 100).toFixed(0)}%  opaque=${cov}%`
  );
}
