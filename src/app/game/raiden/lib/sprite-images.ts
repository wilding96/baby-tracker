// ═══════════════════════════════════════════════════════════════════
// RAIDEN — runtime sprite image loader (2.5D pre-rendered PNGs)
// Loads /game/raiden/*.png lazily; returns null when missing so the
// caller can fall back to the built-in pixel-art sprites.
// ═══════════════════════════════════════════════════════════════════

import { drawSprite as drawSpritePixel } from "./sprite-utils";

export type SpriteName =
  | "player"
  | "fighter"
  | "bomber"
  | "interceptor"
  | "elite"
  | "miniboss"
  | "boss_fortress"
  | "boss_carrier"
  | "boss_eye";

const cache = new Map<SpriteName, HTMLImageElement | null>();

// 2.5D 图显示放大倍数（相对像素 footprint）
const IMAGE_SCALE = 2;

export function getSpriteImage(name: SpriteName): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (cache.has(name)) return cache.get(name) ?? null;

  const img = new window.Image();
  cache.set(name, null); // not ready yet
  img.onload = () => cache.set(name, img);
  img.onerror = () => cache.set(name, null);
  img.src = `/game/raiden/${name}.png`;
  return null;
}

// Draw a sprite using its pre-rendered image when available, otherwise
// fall back to the pixel-art map. Keeps the same pixel footprint (map w/h × s).
export function drawSmartSprite(
  ctx: CanvasRenderingContext2D,
  name: SpriteName,
  pixelMap: string[],
  colors: Record<string, string>,
  x: number,
  y: number,
  s: number,
) {
  const img = getSpriteImage(name);
  if (img && img.complete && img.naturalWidth > 0) {
    const w0 = pixelMap[0].length * s;
    const h0 = pixelMap.length * s;
    // 2.5D 图放大 2 倍显示（相对像素 footprint），细节更清晰；保持比例、居中在机身中心
    const boxW = w0 * IMAGE_SCALE;
    const boxH = h0 * IMAGE_SCALE;
    const scale = Math.min(boxW / img.naturalWidth, boxH / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    const cx = x + w0 / 2;
    const cy = y + h0 / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    drawSpritePixel(ctx, pixelMap, colors, x, y, s);
  }
}
