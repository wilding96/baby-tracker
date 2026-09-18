// ═══════════════════════════════════════════════════════════════════
// RAIDEN — low-level pixel drawing helpers
// ═══════════════════════════════════════════════════════════════════

export function drawSprite(
  ctx: CanvasRenderingContext2D,
  map: string[],
  colors: Record<string, string>,
  x: number,
  y: number,
  s: number,
) {
  const h = map.length, w = map[0].length;
  // Pass 1: black contour outline (only edge-adjacent cells)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (map[py][px] === ".") continue;
      const edge = py === 0 || py === h - 1 || px === 0 || px === w - 1 ||
        map[py - 1][px] === "." || map[py + 1][px] === "." ||
        map[py][px - 1] === "." || map[py][px + 1] === ".";
      if (edge) {
        ctx.fillStyle = "#000";
        ctx.fillRect(x + px * s, y + py * s, s, s);
      }
    }
  }
  // Pass 2: color fill (inset by 1 on edge cells for border visibility)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const ch = map[py][px];
      if (ch === ".") continue;
      const edge = py === 0 || py === h - 1 || px === 0 || px === w - 1 ||
        map[py - 1][px] === "." || map[py + 1][px] === "." ||
        map[py][px - 1] === "." || map[py][px + 1] === ".";
      ctx.fillStyle = colors[ch] ?? "#fff";
      if (edge) {
        ctx.fillRect(x + px * s + 1, y + py * s + 1, s - 2, s - 2);
      } else {
        ctx.fillRect(x + px * s, y + py * s, s, s);
      }
    }
  }
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number,
  color: string, size = 10,
  align: CanvasTextAlign = "center",
  strokeW = 2,
) {
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = strokeW;
  ctx.lineJoin = "round";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
