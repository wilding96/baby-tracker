import { test } from "node:test";
import assert from "node:assert/strict";
import { pickOffer } from "../src/app/game/pop3d/engine/offerPool.ts";

const pool = [
  { id: "a", max: 1 },
  { id: "b", max: 2 },
  { id: "c", max: 1 },
  { id: "d", max: 1 },
];

// 确定性的假随机：永远取区间内最后一个，便于断言
const last = () => 0.999999;

test("未满层的卡不足 n 张时，只发未满层的，不发满层卡", () => {
  const out = pickOffer(pool, { a: 1, c: 1, d: 1 }, 3, last);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "b");
});

test("全部满层时返回空数组", () => {
  assert.deepEqual(pickOffer(pool, { a: 1, b: 2, c: 1, d: 1 }, 3, last), []);
});

test("永远不会发出已达上限的卡", () => {
  const owned = { a: 1, b: 0, c: 1, d: 0 };
  for (let i = 0; i < 200; i += 1) {
    for (const c of pickOffer(pool, owned, 3, Math.random)) {
      assert.ok((owned[c.id] ?? 0) < c.max, `${c.id} 已满层却被发出`);
    }
  }
});

test("同一次 offer 里不出现重复卡", () => {
  const out = pickOffer(pool, {}, 3, Math.random);
  assert.equal(new Set(out.map((c) => c.id)).size, out.length);
});

test("未满层足够时发满 n 张", () => {
  assert.equal(pickOffer(pool, {}, 3, Math.random).length, 3);
});
