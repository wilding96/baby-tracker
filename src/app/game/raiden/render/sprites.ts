// ═══════════════════════════════════════════════════════════════════
// POP RAIDER — 精灵光栅化
// 所有图形在初始化时一次性画进离屏 canvas，运行时只做 drawImage。
// 全文件 0 处 shadowBlur / 0 处渐变模糊。
// ═══════════════════════════════════════════════════════════════════

import { ELEMENT_COLOR, PAL, WORD_SPRITES } from "../engine/config";
import type { BossType, Element, ShipType } from "../engine/types";

export interface Sprite {
  cv: HTMLCanvasElement;
  w: number;
  h: number;
}

export interface SpriteBank {
  dpr: number;
  player: Record<ShipType, Sprite>;
  pBullet: Record<ShipType, Sprite>;
  pBulletBig: Record<ShipType, Sprite>;
  eBullet: Sprite;
  eBulletBig: Sprite;
  enemies: Sprite[];
  boss: Record<BossType, Sprite>;
  boom: Sprite[];
  words: Sprite[];
  heart: Sprite;
  frag: Sprite;
  fragBig: Sprite;
  badge: Record<Element, Sprite>;
  halftone: HTMLCanvasElement;
  tile: number;
}

const TILE = 14;
const HEAVY = '900 %Ppx Impact, "Arial Black", system-ui, sans-serif';

function makeSprite(dpr: number) {
  return (w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): Sprite => {
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(w * dpr));
    cv.height = Math.max(1, Math.round(h * dpr));
    const g = cv.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineJoin = "round";
    draw(g, w, h);
    return { cv, w, h };
  };
}

/** 描粗黑边 + 填实色：波普的唯一的画法 */
function inkFill(g: CanvasRenderingContext2D, color: string, line: number, path: (p: CanvasRenderingContext2D) => void) {
  g.beginPath();
  path(g);
  g.lineWidth = line;
  g.strokeStyle = PAL.ink;
  g.stroke();
  g.fillStyle = color;
  g.fill();
}

function textSprite(
  sprite: ReturnType<typeof makeSprite>,
  text: string,
  size: number,
  color: string,
): Sprite {
  const font = HEAVY.replace("%P", String(size));
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font;
  const w = probe.measureText(text).width + Math.max(16, size * 0.75);
  const h = size * 1.3;
  return sprite(w, h, (g) => {
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = Math.max(4, size * 0.2);
    g.strokeStyle = PAL.ink;
    g.strokeText(text, w / 2, h / 2);
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
  });
}

// ── 三架机体：轮廓不同，座舱染成各自的属性色 ──

function playerBody(ship: ShipType) {
  const accent = ELEMENT_COLOR[ship === "ion" ? "electric" : ship === "nova" ? "fire" : "ice"];
  return { accent };
}

function drawPlayer(g: CanvasRenderingContext2D, ship: ShipType) {
  const { accent } = playerBody(ship);
  if (ship === "ion") {
    inkFill(g, PAL.cyan, 2.5, (p) => {
      p.moveTo(15, 1); p.lineTo(19, 13); p.lineTo(27, 21); p.lineTo(27, 27);
      p.lineTo(19, 24); p.lineTo(19, 31); p.lineTo(15, 34); p.lineTo(11, 31);
      p.lineTo(11, 24); p.lineTo(3, 27); p.lineTo(3, 21); p.lineTo(11, 13);
      p.closePath();
    });
    inkFill(g, accent, 2, (p) => { p.moveTo(15, 7); p.lineTo(19, 17); p.lineTo(11, 17); p.closePath(); });
  } else if (ship === "nova") {
    inkFill(g, PAL.cyan, 2.5, (p) => {
      p.moveTo(17, 2); p.lineTo(21, 12); p.lineTo(33, 16); p.lineTo(33, 24);
      p.lineTo(22, 23); p.lineTo(22, 30); p.lineTo(17, 33); p.lineTo(12, 30);
      p.lineTo(12, 23); p.lineTo(1, 24); p.lineTo(1, 16); p.lineTo(13, 12);
      p.closePath();
    });
    inkFill(g, accent, 2, (p) => { p.rect(14, 9, 6, 11); });
  } else {
    inkFill(g, PAL.cyan, 2.5, (p) => {
      p.moveTo(16, 1); p.lineTo(24, 15); p.lineTo(28, 31); p.lineTo(16, 26);
      p.lineTo(4, 31); p.lineTo(8, 15); p.closePath();
    });
    inkFill(g, accent, 2, (p) => {
      p.moveTo(16, 8); p.lineTo(21, 18); p.lineTo(16, 22); p.lineTo(11, 18); p.closePath();
    });
  }
  inkFill(g, PAL.blue, 1.6, (p) => { p.rect(ship === "nova" ? 14 : 12, 26, 6, 7); });
}

// ── 玩家子弹：形状区分机型，颜色统一为波普蓝（可读性优先） ──

function drawPlayerBullet(g: CanvasRenderingContext2D, ship: ShipType, big: boolean) {
  const k = big ? 1.5 : 1;
  if (ship === "ion") {
    inkFill(g, PAL.blue, 2 * k, (p) => { p.rect(8 - 3 * k, 1, 6 * k, 18 * k); });
  } else if (ship === "nova") {
    inkFill(g, PAL.blue, 2 * k, (p) => { p.arc(7, 7, 5 * k, 0, Math.PI * 2); });
  } else {
    inkFill(g, PAL.blue, 2 * k, (p) => {
      p.moveTo(7, 0); p.lineTo(7 + 5 * k, 7); p.lineTo(7, 14 * k); p.lineTo(7 - 5 * k, 7); p.closePath();
    });
  }
}

// ── 敌弹：小=波普红，大=Boss 洋红 ──

function drawEnemyBullet(g: CanvasRenderingContext2D, color: string, r: number, big: boolean) {
  if (big) {
    inkFill(g, color, 3, (p) => {
      p.moveTo(9, 1); p.lineTo(17, 9); p.lineTo(9, 17); p.lineTo(1, 9); p.closePath();
    });
    inkFill(g, PAL.paper, 1.4, (p) => { p.rect(7, 7, 4, 4); });
  } else {
    inkFill(g, color, 2.5, (p) => { p.arc(6, 6, r, 0, Math.PI * 2); });
    inkFill(g, PAL.paper, 1.2, (p) => { p.arc(6, 6, r * 0.4, 0, Math.PI * 2); });
  }
}

// ── 敌机 ──

function drawSmall(g: CanvasRenderingContext2D) {
  inkFill(g, PAL.red, 2.5, (p) => {
    p.moveTo(12, 21); p.lineTo(4, 10); p.lineTo(0, 3); p.lineTo(6, 5);
    p.lineTo(12, 0); p.lineTo(18, 5); p.lineTo(24, 3); p.lineTo(20, 10); p.closePath();
  });
  inkFill(g, PAL.yellow, 1.5, (p) => { p.arc(12, 10, 2.6, 0, Math.PI * 2); });
}

function drawMed(g: CanvasRenderingContext2D) {
  inkFill(g, PAL.magenta, 3, (p) => {
    p.moveTo(18, 31); p.lineTo(8, 18); p.lineTo(0, 16); p.lineTo(5, 8);
    p.lineTo(13, 10); p.lineTo(18, 0); p.lineTo(23, 10); p.lineTo(31, 8);
    p.lineTo(36, 16); p.lineTo(28, 18); p.closePath();
  });
  inkFill(g, PAL.yellow, 2, (p) => { p.rect(13, 12, 10, 10); });
  inkFill(g, PAL.paper, 1.5, (p) => { p.rect(15, 14, 6, 6); });
}

function drawElite(g: CanvasRenderingContext2D) {
  inkFill(g, PAL.red, 3.5, (p) => {
    p.moveTo(24, 43); p.lineTo(10, 26); p.lineTo(0, 22); p.lineTo(6, 12);
    p.lineTo(17, 15); p.lineTo(24, 0); p.lineTo(31, 15); p.lineTo(42, 12);
    p.lineTo(48, 22); p.lineTo(38, 26); p.closePath();
  });
  inkFill(g, PAL.yellow, 2.5, (p) => {
    p.moveTo(24, 16); p.lineTo(33, 27); p.lineTo(24, 38); p.lineTo(15, 27); p.closePath();
  });
  inkFill(g, PAL.ink, 2, (p) => { p.arc(24, 27, 5, 0, Math.PI * 2); });
}

// ── Boss：三种轮廓 ──

function drawBossFortress(g: CanvasRenderingContext2D) {
  inkFill(g, PAL.red, 4, (p) => {
    p.moveTo(75, 98); p.lineTo(20, 74); p.lineTo(0, 44); p.lineTo(14, 34);
    p.lineTo(36, 40); p.lineTo(50, 6); p.lineTo(75, 0); p.lineTo(100, 6);
    p.lineTo(114, 40); p.lineTo(136, 34); p.lineTo(150, 44); p.lineTo(130, 74);
    p.closePath();
  });
  inkFill(g, PAL.yellow, 3, (p) => {
    p.moveTo(75, 26); p.lineTo(92, 46); p.lineTo(75, 66); p.lineTo(58, 46); p.closePath();
  });
  inkFill(g, PAL.ink, 2, (p) => { p.arc(75, 46, 8, 0, Math.PI * 2); });
}

function drawBossCarrier(g: CanvasRenderingContext2D) {
  inkFill(g, PAL.magenta, 4, (p) => {
    p.moveTo(75, 96); p.lineTo(30, 84); p.lineTo(6, 58); p.lineTo(6, 30);
    p.lineTo(34, 36); p.lineTo(50, 8); p.lineTo(100, 8); p.lineTo(116, 36);
    p.lineTo(144, 30); p.lineTo(144, 58); p.lineTo(120, 84); p.closePath();
  });
  inkFill(g, PAL.yellow, 3, (p) => { p.rect(44, 40, 62, 26); });
  for (let i = 0; i < 4; i++) {
    inkFill(g, PAL.ink, 1.6, (p) => { p.arc(56 + i * 13, 53, 4, 0, Math.PI * 2); });
  }
}

function drawBossEye(g: CanvasRenderingContext2D) {
  inkFill(g, PAL.cyan, 4, (p) => {
    p.moveTo(20, 20); p.lineTo(75, 4); p.lineTo(130, 20); p.lineTo(146, 60);
    p.lineTo(130, 88); p.lineTo(75, 96); p.lineTo(20, 88); p.lineTo(4, 60);
    p.closePath();
  });
  inkFill(g, PAL.paper, 3, (p) => {
    p.moveTo(34, 50); p.lineTo(75, 30); p.lineTo(116, 50); p.lineTo(75, 70); p.closePath();
  });
  inkFill(g, PAL.ink, 2.5, (p) => { p.arc(75, 50, 13, 0, Math.PI * 2); });
  inkFill(g, PAL.red, 2, (p) => { p.arc(75, 50, 6, 0, Math.PI * 2); });
}

// ── 爆炸四帧 ──

function boomFrames(sprite: ReturnType<typeof makeSprite>): Sprite[] {
  return [
    sprite(30, 30, (g) => { inkFill(g, PAL.paper, 3, (p) => { p.arc(15, 15, 11, 0, Math.PI * 2); }); }),
    sprite(34, 34, (g) => {
      inkFill(g, PAL.yellow, 3, (p) => {
        p.moveTo(17, 0); p.lineTo(23, 11); p.lineTo(34, 17); p.lineTo(23, 23);
        p.lineTo(17, 34); p.lineTo(11, 23); p.lineTo(0, 17); p.lineTo(11, 11); p.closePath();
      });
    }),
    sprite(34, 34, (g) => {
      inkFill(g, PAL.red, 3, (p) => {
        p.moveTo(17, 0); p.lineTo(23, 11); p.lineTo(34, 17); p.lineTo(23, 23);
        p.lineTo(17, 34); p.lineTo(11, 23); p.lineTo(0, 17); p.lineTo(11, 11); p.closePath();
      });
    }),
    sprite(26, 26, (g) => { inkFill(g, PAL.ink, 2, (p) => { p.arc(13, 13, 6, 0, Math.PI * 2); }); }),
  ];
}

// ═══════════════════════════════════════════════════════════════════

export function createSprites(dpr: number): SpriteBank {
  const sprite = makeSprite(dpr);

  const player = {
    ion: sprite(30, 34, (g) => drawPlayer(g, "ion")),
    nova: sprite(34, 34, (g) => drawPlayer(g, "nova")),
    pulse: sprite(32, 34, (g) => drawPlayer(g, "pulse")),
  } as Record<ShipType, Sprite>;

  const pBullet = {
    ion: sprite(14, 20, (g) => drawPlayerBullet(g, "ion", false)),
    nova: sprite(14, 14, (g) => drawPlayerBullet(g, "nova", false)),
    pulse: sprite(14, 16, (g) => drawPlayerBullet(g, "pulse", false)),
  } as Record<ShipType, Sprite>;

  const pBulletBig = {
    ion: sprite(18, 28, (g) => drawPlayerBullet(g, "ion", true)),
    nova: sprite(20, 20, (g) => drawPlayerBullet(g, "nova", true)),
    pulse: sprite(20, 22, (g) => drawPlayerBullet(g, "pulse", true)),
  } as Record<ShipType, Sprite>;

  // Ben-Day 网点瓦片
  const halftone = document.createElement("canvas");
  halftone.width = Math.round(TILE * dpr);
  halftone.height = Math.round(TILE * dpr);
  {
    const g = halftone.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = PAL.paper;
    g.fillRect(0, 0, TILE, TILE);
    g.fillStyle = "rgba(16,16,16,0.16)";
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        g.beginPath();
        g.arc(3.5 + x * 7, 3.5 + y * 7, 1.7, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  return {
    dpr,
    player,
    pBullet,
    pBulletBig,
    eBullet: sprite(12, 12, (g) => drawEnemyBullet(g, PAL.red, 4.6, false)),
    eBulletBig: sprite(18, 18, (g) => drawEnemyBullet(g, PAL.magenta, 6, true)),
    enemies: [
      sprite(24, 22, drawSmall),
      sprite(36, 32, drawMed),
      sprite(48, 44, drawElite),
    ],
    boss: {
      fortress: sprite(150, 100, drawBossFortress),
      carrier: sprite(150, 96, drawBossCarrier),
      eye: sprite(150, 100, drawBossEye),
    },
    boom: boomFrames(sprite),
    words: WORD_SPRITES.map((wd) => textSprite(sprite, wd.text, wd.size, wd.color)),
    heart: sprite(20, 20, (g) => {
      inkFill(g, PAL.red, 2.5, (p) => {
        p.moveTo(10, 18); p.lineTo(1.5, 9.5);
        p.bezierCurveTo(-1, 4, 4, 0, 10, 5);
        p.bezierCurveTo(16, 0, 21, 4, 18.5, 9.5);
        p.closePath();
      });
    }),
    frag: sprite(12, 12, (g) => {
      inkFill(g, PAL.yellow, 2, (p) => {
        p.moveTo(6, 0); p.lineTo(11, 6); p.lineTo(6, 12); p.lineTo(1, 6); p.closePath();
      });
    }),
    fragBig: sprite(18, 18, (g) => {
      inkFill(g, PAL.yellow, 2.5, (p) => {
        p.moveTo(9, 0); p.lineTo(17, 9); p.lineTo(9, 18); p.lineTo(1, 9); p.closePath();
      });
      inkFill(g, PAL.ink, 1.6, (p) => { p.arc(9, 9, 3, 0, Math.PI * 2); });
    }),
    badge: {
      electric: sprite(18, 18, (g) => badge(g, PAL.cyan, "bolt")),
      fire: sprite(18, 18, (g) => badge(g, PAL.red, "flame")),
      ice: sprite(18, 18, (g) => badge(g, PAL.blue, "flake")),
    },
    halftone,
    tile: TILE,
  };
}

function badge(g: CanvasRenderingContext2D, color: string, kind: string) {
  inkFill(g, PAL.paper, 2, (p) => { p.arc(9, 9, 7.5, 0, Math.PI * 2); });
  if (kind === "bolt") {
    inkFill(g, color, 1.4, (p) => {
      p.moveTo(10, 2); p.lineTo(5, 10); p.lineTo(9, 10); p.lineTo(7, 16);
      p.lineTo(13, 8); p.lineTo(9, 8); p.closePath();
    });
  } else if (kind === "flame") {
    inkFill(g, color, 1.4, (p) => {
      p.moveTo(9, 2); p.lineTo(13, 9); p.lineTo(9, 16); p.lineTo(5, 9); p.closePath();
    });
  } else {
    inkFill(g, color, 1.4, (p) => {
      p.moveTo(9, 2); p.lineTo(11, 8); p.lineTo(16, 9); p.lineTo(11, 11);
      p.lineTo(9, 16); p.lineTo(7, 11); p.lineTo(2, 9); p.lineTo(7, 8); p.closePath();
    });
  }
}
