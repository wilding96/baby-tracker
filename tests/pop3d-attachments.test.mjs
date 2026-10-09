import { test } from "node:test";
import assert from "node:assert/strict";
import { wingmanSlot, orbitPos } from "../src/app/game/pop3d/engine/attachments.ts";

test("僚机编队：左右交替、第二对更靠后", () => {
  const a = wingmanSlot(0, 0, 0, 2.6, 1.2);
  const b = wingmanSlot(1, 0, 0, 2.6, 1.2);
  const c = wingmanSlot(2, 0, 0, 2.6, 1.2);
  assert.ok(a.x < 0 && b.x > 0, "必须左右交替");
  assert.ok(Math.abs(a.x + b.x) < 1e-12, "左右对称");
  assert.ok(c.z > a.z, "第二对应更靠后");
});

test("僚机编队：跟着玩家平移", () => {
  const a = wingmanSlot(0, 5, 7, 2.6, 1.2);
  const b = wingmanSlot(0, 0, 0, 2.6, 1.2);
  assert.ok(Math.abs(a.x - b.x - 5) < 1e-12);
  assert.ok(Math.abs(a.z - b.z - 7) < 1e-12);
});

test("环绕弹：落点在以玩家为心、半径 r 的圆上", () => {
  for (const ang of [0, 1, 2.5, -3]) {
    const p = orbitPos(3, -4, ang, 3.2);
    const d = Math.hypot(p.x - 3, p.z + 4);
    assert.ok(Math.abs(d - 3.2) < 1e-9);
  }
});
