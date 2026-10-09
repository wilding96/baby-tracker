import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSpawnXs } from "../src/app/game/pop3d/engine/waves.ts";

const HALF_W = 18;
const HALF = () => 0.5;

function run(pattern, count, rng = HALF) {
  const out = [];
  const n = resolveSpawnXs(pattern, count, HALF_W, rng, out);
  return { n, xs: out.slice(0, n) };
}

test("line：横排等距、左右对称、不越界", () => {
  const { n, xs } = run("line", 4);
  assert.equal(n, 4);
  for (let i = 1; i < xs.length; i += 1) {
    assert.ok(Math.abs(xs[i] - xs[i - 1] - (xs[1] - xs[0])) < 1e-9, "间距必须相等");
  }
  assert.ok(Math.abs(xs[0] + xs[3]) < 1e-9, "必须左右对称");
  for (const x of xs) assert.ok(Math.abs(x) < HALF_W, "不得越界");
});

test("line：单架落在场地中心", () => {
  const { xs } = run("line", 1);
  assert.ok(Math.abs(xs[0]) < 1e-9);
});

test("sides：左右交替，且贴在两翼内侧", () => {
  const { n, xs } = run("sides", 3);
  assert.equal(n, 3);
  assert.ok(xs[0] < 0 && xs[1] > 0 && xs[2] < 0, "必须左右交替");
  assert.equal(xs[0], xs[2]);
  assert.ok(Math.abs(xs[0]) < HALF_W && Math.abs(xs[1]) < HALF_W);
});

test("column：同一列（横坐标完全相同）", () => {
  const { n, xs } = run("column", 3, () => 0.25);
  assert.equal(n, 3);
  assert.equal(new Set(xs).size, 1);
});

test("random：每架独立取位且都在界内", () => {
  const { n, xs } = run("random", 5, Math.random);
  assert.equal(n, 5);
  for (const x of xs) assert.ok(Math.abs(x) < HALF_W);
});

test("返回写入条数，且不会写出超过 count 个", () => {
  const out = [999, 999, 999, 999, 999];
  const n = resolveSpawnXs("line", 2, HALF_W, HALF, out);
  assert.equal(n, 2);
  assert.equal(out[2], 999, "不应触碰 count 之后的元素");
});

test("count 为 0 时返回 0", () => {
  assert.equal(resolveSpawnXs("line", 0, HALF_W, HALF, []), 0);
});

test("确定性：同一个 rng 序列得到同一组横坐标", () => {
  const a = run("random", 4, () => 0.3);
  const b = run("random", 4, () => 0.3);
  assert.deepEqual(a.xs, b.xs);
});
