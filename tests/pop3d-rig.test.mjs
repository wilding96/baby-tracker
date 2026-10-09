import { test } from "node:test";
import assert from "node:assert/strict";
import { cineTarget, approach } from "../src/app/game/pop3d/engine/rig.ts";

const BASE_PITCH = 32;

test("没有运镜时恒为基准机位（常规战斗不许偏离俯视）", () => {
  for (const k of [0, 0.5, 1]) {
    assert.deepEqual(cineTarget(null, k, BASE_PITCH), {
      pitchDeg: BASE_PITCH,
      distMul: 1,
    });
  }
});

test("intro：从低机位 55° 拉远起手，结束时回到战斗机位", () => {
  const start = cineTarget("intro", 0, BASE_PITCH);
  assert.equal(start.pitchDeg, 55);
  assert.equal(start.distMul, 1.3);

  const end = cineTarget("intro", 1, BASE_PITCH);
  assert.ok(Math.abs(end.pitchDeg - BASE_PITCH) < 1e-9);
  assert.ok(Math.abs(end.distMul - 1) < 1e-9);
});

test("intro：俯角单调下降、距离单调拉近", () => {
  let prevPitch = Infinity;
  let prevDist = Infinity;
  for (let i = 0; i <= 10; i += 1) {
    const t = cineTarget("intro", i / 10, BASE_PITCH);
    assert.ok(t.pitchDeg <= prevPitch + 1e-9, "俯角必须单调下降");
    assert.ok(t.distMul <= prevDist + 1e-9, "距离必须单调拉近");
    prevPitch = t.pitchDeg;
    prevDist = t.distMul;
  }
});

test("phase：推近到 0.85 后回到 1（正弦一次来回）", () => {
  assert.ok(Math.abs(cineTarget("phase", 0, BASE_PITCH).distMul - 1) < 1e-9);
  assert.ok(Math.abs(cineTarget("phase", 0.5, BASE_PITCH).distMul - 0.85) < 1e-9);
  assert.ok(Math.abs(cineTarget("phase", 1, BASE_PITCH).distMul - 1) < 1e-9);
  // 阶段切换只推近，不动俯角
  assert.equal(cineTarget("phase", 0.5, BASE_PITCH).pitchDeg, BASE_PITCH);
});

test("down：击破时拉远到 1.35，且不偏离俯视", () => {
  const end = cineTarget("down", 1, BASE_PITCH);
  assert.ok(Math.abs(end.distMul - 1.35) < 1e-9);
  assert.equal(end.pitchDeg, BASE_PITCH);
});

test("k 超界会被夹到 [0,1]，不会算出离谱机位", () => {
  assert.deepEqual(cineTarget("intro", 5, BASE_PITCH), cineTarget("intro", 1, BASE_PITCH));
  assert.deepEqual(cineTarget("intro", -3, BASE_PITCH), cineTarget("intro", 0, BASE_PITCH));
});

test("approach：单调逼近目标且不会过冲", () => {
  let v = 32;
  const want = 55;
  for (let i = 0; i < 200; i += 1) {
    const next = approach(v, want, 1 / 60, 3);
    assert.ok(next >= v - 1e-12, "必须单调");
    assert.ok(next <= want + 1e-9, "不得过冲");
    v = next;
  }
  assert.ok(Math.abs(v - want) < 0.01, "最终应收敛到目标");
});

test("approach：dt 为 0 时不动（暂停/冻结不抖相机）", () => {
  assert.equal(approach(32, 55, 0, 3), 32);
});
