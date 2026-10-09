import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAngle,
  aimedAngle,
  fanAngle,
  ringAngle,
  spiralAngle,
  steerAngle,
} from "../src/app/game/pop3d/engine/patterns.ts";

const PI = Math.PI;

test("normalizeAngle 把任意角折算到 (-π, π]", () => {
  assert.ok(Math.abs(normalizeAngle(0)) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(PI) - PI) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(-PI) - PI) < 1e-12);
  // 3π 处有浮点误差（mod 2π 后略大于 π 会折回 -π），所以只断言绝对值等于 π
  assert.ok(Math.abs(Math.abs(normalizeAngle(3 * PI)) - PI) < 1e-9);
  assert.ok(Math.abs(normalizeAngle(2 * PI)) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(2.5 * PI) - 0.5 * PI) < 1e-12);
  assert.ok(Math.abs(normalizeAngle(-2.5 * PI) + 0.5 * PI) < 1e-12);
});

test("aimedAngle：0 = +X，π/2 = +Z（朝玩家）", () => {
  assert.ok(Math.abs(aimedAngle(1, 0) - 0) < 1e-12);
  assert.ok(Math.abs(aimedAngle(0, 1) - PI / 2) < 1e-12);
  assert.ok(Math.abs(aimedAngle(-1, 0) - PI) < 1e-12);
  assert.ok(Math.abs(aimedAngle(0, -1) + PI / 2) < 1e-12);
});

test("fanAngle：偶数弹以基准角为中心左右对称", () => {
  const base = PI / 2;
  const spread = 0.4;
  assert.ok(Math.abs(fanAngle(0, 5, spread, base) - (base - 0.8)) < 1e-12);
  assert.ok(Math.abs(fanAngle(2, 5, spread, base) - base) < 1e-12);
  assert.ok(Math.abs(fanAngle(4, 5, spread, base) - (base + 0.8)) < 1e-12);
  // 单发时就是基准角
  assert.ok(Math.abs(fanAngle(0, 1, spread, base) - base) < 1e-12);
});

test("ringAngle：均匀分布 + 整体相位", () => {
  const n = 4;
  assert.ok(Math.abs(ringAngle(0, n, 0) - 0) < 1e-12);
  assert.ok(Math.abs(ringAngle(1, n, 0) - PI / 2) < 1e-12);
  assert.ok(Math.abs(ringAngle(2, n, 0) - PI) < 1e-12);
  // 相位整体平移
  assert.ok(Math.abs(ringAngle(0, n, 0.3) - 0.3) < 1e-12);
  assert.ok(Math.abs(ringAngle(1, n, 0.3) - (0.3 + PI / 2)) < 1e-12);
});

test("spiralAngle：每步推进固定角度", () => {
  assert.ok(Math.abs(spiralAngle(0, 0.42) - 0.42) < 1e-12);
  assert.ok(Math.abs(spiralAngle(0.42, 0.42) - 0.84) < 1e-12);
});

test("steerAngle：单步转向不超过上限", () => {
  const maxTurn = 0.1;
  assert.ok(Math.abs(steerAngle(0, 1, maxTurn) - maxTurn) < 1e-12);
  assert.ok(Math.abs(steerAngle(0, -1, maxTurn) + maxTurn) < 1e-12);
});

test("steerAngle：角度差在范围内时直接对准目标（不过冲）", () => {
  assert.ok(Math.abs(steerAngle(0, 0.05, 0.1) - 0.05) < 1e-12);
});

test("steerAngle：跨过 ±π 边界不会绕远路", () => {
  // 当前 3.0 rad，目标 -3.0 rad：真实差值是 +0.283（走短边），不是 -6.0
  const next = steerAngle(3.0, -3.0, 0.1);
  assert.ok(next > 3.0, "应该朝 +π 方向继续走，而不是掉头");
  assert.ok(next - 3.0 <= 0.1 + 1e-12);
});

test("steerAngle：反复调用会收敛到目标", () => {
  let a = 0;
  for (let i = 0; i < 500; i += 1) a = steerAngle(a, 2.0, 0.05);
  assert.ok(Math.abs(normalizeAngle(a - 2.0)) < 0.06);
});
