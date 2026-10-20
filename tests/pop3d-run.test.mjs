import { test } from "node:test";
import assert from "node:assert/strict";
import { RUN, WAVES, RANK } from "../src/app/game/pop3d/engine/config.ts";
import { rankScale, cardProgress } from "../src/app/game/pop3d/engine/progression.ts";
import { normalizeMeta } from "../src/app/game/pop3d/engine/meta.ts";

/** 把 [at, until) 区间并起来，返回是否覆盖 [0, end) */
function covers(spans, end) {
  const sorted = [...spans].sort((a, b) => a[0] - b[0]);
  let reach = 0;
  for (const [from, to] of sorted) {
    if (from > reach) return false;
    reach = Math.max(reach, to);
  }
  return reach >= end;
}

test("Boss 在 62 秒内登场", () => {
  assert.ok(RUN.bossAt <= 62, `bossAt=${RUN.bossAt}`);
});

test("抽卡里程碑恰好 3 次，严格递增，且都在 Boss 之前", () => {
  assert.equal(RUN.cardAt.length, 3);
  for (let i = 1; i < RUN.cardAt.length; i += 1) {
    assert.ok(RUN.cardAt[i] > RUN.cardAt[i - 1], "里程碑必须严格递增");
  }
  assert.ok(RUN.cardAt[RUN.cardAt.length - 1] < RUN.bossAt, "最后一次抽卡必须在 Boss 前");
});

test("波次在 0–58 秒内连续覆盖，没有空档", () => {
  assert.ok(covers(WAVES.map((w) => [w.at, w.until]), 58));
});

test("档位 0 时所有缩放都是 1", () => {
  assert.deepEqual(rankScale(0), {
    enemyHp: 1,
    spawnInterval: 1,
    bulletSpeed: 1,
    bossHp: 1,
    stardust: 1,
  });
});

test("档位缩放单调递增，并在上下限处夹紧", () => {
  const low = rankScale(1);
  const mid = rankScale(5);
  const high = rankScale(20);
  assert.ok(low.enemyHp < mid.enemyHp && mid.enemyHp < high.enemyHp);
  assert.ok(high.spawnInterval >= RANK.spawnMin);
  assert.ok(high.bulletSpeed <= RANK.bulletMax);
  assert.equal(high.spawnInterval, RANK.spawnMin);
  assert.equal(high.bulletSpeed, RANK.bulletMax);
});

test("负档位按 0 处理", () => {
  assert.deepEqual(rankScale(-3), rankScale(0));
});

test("抽卡进度按里程碑分段，到点归零，最后一档填满", () => {
  assert.equal(cardProgress(0), 0);
  assert.equal(cardProgress(10), 0.5);
  assert.equal(cardProgress(20), 0);
  assert.equal(cardProgress(29), 0.5);
  assert.equal(cardProgress(58), 1);
  assert.equal(cardProgress(80), 1);
});

test("旧存档缺少 rank 时补 0", () => {
  const meta = normalizeMeta({ stardust: 120, highScore: 900, runs: 3, upgrades: { life: 1 } });
  assert.equal(meta.rank, 0);
  assert.equal(meta.stardust, 120);
  assert.equal(meta.upgrades.life, 1);
  assert.equal(meta.upgrades.power, 0);
});

test("存档里的 rank 会被保留", () => {
  const meta = normalizeMeta({ rank: 7, stardust: 5, upgrades: {} });
  assert.equal(meta.rank, 7);
});
