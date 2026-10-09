import { test } from "node:test";
import assert from "node:assert/strict";
import {
  UP_ANGLE,
  fanShotAngles,
  splitShotAngles,
  homingStep,
  PLAYER_BULLET_KINDS,
  bulletDef,
  SPLIT_SPREAD,
} from "../src/app/game/pop3d/engine/bullets.ts";

const PI = Math.PI;

test("UP_ANGLE 指向 -Z（屏幕上方）", () => {
  assert.ok(Math.abs(UP_ANGLE + PI / 2) < 1e-12);
});

test("fanShotAngles：单发朝正上，多发左右对称", () => {
  const one = [];
  assert.equal(fanShotAngles(1, 0.2, one), 1);
  assert.ok(Math.abs(one[0] - UP_ANGLE) < 1e-12);

  const three = [];
  assert.equal(fanShotAngles(3, 0.2, three), 3);
  assert.ok(Math.abs(three[1] - UP_ANGLE) < 1e-12);
  assert.ok(three[0] < UP_ANGLE && three[2] > UP_ANGLE);
  assert.ok(Math.abs(three[0] - (UP_ANGLE - 0.2)) < 1e-12);
});

test("fanShotAngles：写进调用方数组，不触碰未使用的槽位", () => {
  const out = [9, 9, 9];
  assert.equal(fanShotAngles(2, 0.3, out), 2);
  assert.equal(out[2], 9);
});

test("splitShotAngles：2 发左右各偏 25°，4 发为两对", () => {
  const two = [];
  assert.equal(splitShotAngles(2, UP_ANGLE, two), 2);
  assert.ok(Math.abs(two[0] - (UP_ANGLE - SPLIT_SPREAD)) < 1e-9);
  assert.ok(Math.abs(two[1] - (UP_ANGLE + SPLIT_SPREAD)) < 1e-9);

  const four = [];
  assert.equal(splitShotAngles(4, UP_ANGLE, four), 4);
  // 契约定成"升序输出"：最外圈的左弹在最前、最外圈的右弹在最后
  assert.ok(four[0] < four[1] && four[1] < UP_ANGLE && four[2] > UP_ANGLE && four[2] < four[3]);
  assert.ok(Math.abs(four[0] - (UP_ANGLE - SPLIT_SPREAD * 2)) < 1e-9);
  assert.ok(Math.abs(four[1] - (UP_ANGLE - SPLIT_SPREAD)) < 1e-9);
  assert.ok(Math.abs(four[2] - (UP_ANGLE + SPLIT_SPREAD)) < 1e-9);
  assert.ok(Math.abs(four[3] - (UP_ANGLE + SPLIT_SPREAD * 2)) < 1e-9);
});

test("homingStep：单步不超过转向速率，小角度直接对准", () => {
  const far = homingStep(0, 1.5, 0.1, 2.6);
  assert.ok(far <= 0.1 * 2.6 + 1e-12);
  const near = homingStep(0, 0.01, 0.1, 2.6);
  assert.ok(Math.abs(near - 0.01) < 1e-12);
});

test("弹型表：键完整、数值合法", () => {
  const want = ["bolt", "spread", "wave", "homing", "mini"];
  assert.deepEqual([...PLAYER_BULLET_KINDS].sort(), want.slice().sort());
  for (const k of PLAYER_BULLET_KINDS) {
    const d = bulletDef(k);
    assert.ok(d.speed > 0, `${k} 速度必须为正`);
    assert.ok(d.dmgMul > 0, `${k} 伤害倍率必须为正`);
    assert.ok(d.radius > 0, `${k} 判定半径必须为正`);
    assert.ok(d.pierce >= 0);
    assert.ok(d.life >= 0);
  }
});

test("bolt 天生贯穿 1；mini 是短命子母弹", () => {
  assert.equal(bulletDef("bolt").pierce, 1);
  assert.equal(bulletDef("mini").pierce, 0);
  assert.ok(bulletDef("mini").life > 0 && bulletDef("mini").life <= 2);
});
