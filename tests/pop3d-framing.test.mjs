import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFraming,
  perspectiveDistance,
} from "../src/app/game/pop3d/engine/framing.ts";

// 与 engine/config.ts 的真实场地一致
const OPTS = { halfW: 18, halfH: 32, marginY: 1.06, coverX: 1.06, maxAspect: 0.72 };

const VIEWPORTS = [
  [390, 844],   // 竖屏手机
  [430, 932],   // 大屏手机
  [768, 1024],  // 平板竖屏
  [1280, 720],  // 桌面横屏
  [1920, 1080], // 宽屏
  [800, 1200],  // 窄高
];

test("任何视口下，整个场地都在取景范围内", () => {
  for (const [w, h] of VIEWPORTS) {
    const f = computeFraming(w, h, OPTS);
    assert.ok(f.halfViewW >= OPTS.halfW, `${w}x${h} 横向裁剪了场地`);
    assert.ok(f.halfViewH >= OPTS.halfH, `${w}x${h} 纵向裁剪了场地`);
  }
});

test("取景不畸变：halfViewW / halfViewH 恒等于画布宽高比", () => {
  for (const [w, h] of VIEWPORTS) {
    const f = computeFraming(w, h, OPTS);
    assert.ok(Math.abs(f.halfViewW / f.halfViewH - f.aspect) < 1e-9);
  }
});

test("超宽窗口下画布被收成竖屏板（aspect 不超过 maxAspect）", () => {
  const f = computeFraming(1920, 1080, OPTS);
  assert.ok(f.aspect <= OPTS.maxAspect + 1e-9);
  assert.ok(f.cssW < 1920, "画布不应该铺满超宽窗口");
  assert.ok(f.cssH <= 1080);
});

test("极端尺寸不会算出 0 或 NaN", () => {
  for (const [w, h] of [[0, 0], [1, 1], [0, 900], [900, 0]]) {
    const f = computeFraming(w, h, OPTS);
    assert.ok(Number.isFinite(f.halfViewW) && f.halfViewW > 0);
    assert.ok(Number.isFinite(f.halfViewH) && f.halfViewH > 0);
    assert.ok(f.cssW >= 1 && f.cssH >= 1);
  }
});

test("透视距离按视锥半高反推：d = halfViewH / tan(fov/2)", () => {
  const fovDeg = 15;
  const d = perspectiveDistance(33.92, fovDeg);
  const expected = 33.92 / Math.tan((fovDeg * Math.PI) / 360);
  assert.ok(Math.abs(d - expected) < 1e-9);
  assert.ok(d > 200, "15° 长焦必须离得很远，否则远端会缩成一点");
});
