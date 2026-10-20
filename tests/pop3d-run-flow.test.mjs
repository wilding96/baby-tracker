import { test } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../src/app/game/pop3d/engine/game.ts";
import { EMPTY_META } from "../src/app/game/pop3d/engine/types.ts";

/**
 * 无头跑整局：用假 rAF 推进固定步长，自动选卡、开自动驾驶。
 * 目的不是测渲染，而是确认「卡点时间 / Boss 时间 / 整局长度」这三条硬指标。
 */
function runHeadless({ maxFrames = 9000, invincible = false } = {}) {
  const g = globalThis;
  const prev = {
    window: g.window,
    ResizeObserver: g.ResizeObserver,
    requestAnimationFrame: g.requestAnimationFrame,
    cancelAnimationFrame: g.cancelAnimationFrame,
  };

  let pendingFrame = null;
  let now = 0;
  g.window = new EventTarget();
  g.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  g.requestAnimationFrame = (cb) => {
    pendingFrame = cb;
    return 1;
  };
  g.cancelAnimationFrame = () => {};

  const cardTimes = [];
  let pendingOffer = null;
  const audio = new Proxy({}, { get: () => () => {} });
  const renderer = {
    element: new EventTarget(),
    resize() {},
    render() {},
    drawCalls: () => 0,
    pointerToWorld: () => null,
    dispose() {},
  };
  const mount = { clientWidth: 360, clientHeight: 640 };

  let engine = null;
  try {
    engine = createEngine({
      mount,
      renderer,
      audio,
      autopilot: true,
      callbacks: {
        onPhase: (phase, offer) => {
          if (phase === "card" && offer.length > 0) {
            cardTimes.push(engine.world.time);
            pendingOffer = offer;
          }
        },
      },
    });
    engine.newRun("nova", { ...EMPTY_META, upgrades: { ...EMPTY_META.upgrades } });
    engine.start();

    let bossAt = null;
    let frames = 0;
    while (frames < maxFrames) {
      if (pendingOffer) {
        engine.chooseCard(pendingOffer[0].id);
        pendingOffer = null;
      }
      const cb = pendingFrame;
      pendingFrame = null;
      now += 1000 / 60;
      cb(now);
      frames += 1;
      // 流程测试只关心时间点，不关心生存；抬无敌避免抽卡差就测不到 Boss
      if (invincible && engine.world.phase === "playing") engine.world.player.invuln = 999;
      if (bossAt === null && engine.world.boss.active) bossAt = engine.world.time;
      if (engine.world.phase === "victory" || engine.world.phase === "gameover") break;
    }

    return {
      cardTimes,
      bossAt,
      endTime: engine.world.time,
      phase: engine.world.phase,
      level: engine.world.level,
      bossHp: engine.world.boss.hp,
      bossMaxHp: engine.world.boss.maxHp,
      bossPhase: engine.world.boss.phase,
      playerHp: engine.world.player.hp,
    };
  } finally {
    engine?.destroy();
    g.window = prev.window;
    g.ResizeObserver = prev.ResizeObserver;
    g.requestAnimationFrame = prev.requestAnimationFrame;
    g.cancelAnimationFrame = prev.cancelAnimationFrame;
  }
}

test("整局流程：三次抽卡落在 20/38/58，Boss 在 60 秒登场", () => {
  const r = runHeadless({ invincible: true });
  assert.equal(r.cardTimes.length, 3, `实际抽卡 ${r.cardTimes.length} 次`);
  assert.ok(Math.abs(r.cardTimes[0] - 20) < 0.2, `第一次 ${r.cardTimes[0]}`);
  assert.ok(Math.abs(r.cardTimes[1] - 38) < 0.2, `第二次 ${r.cardTimes[1]}`);
  assert.ok(Math.abs(r.cardTimes[2] - 58) < 0.2, `第三次 ${r.cardTimes[2]}`);
  assert.equal(r.level, 3);
  assert.ok(r.bossAt !== null, "Boss 没有登场");
  assert.ok(Math.abs(r.bossAt - 60) < 0.2, `Boss 登场 ${r.bossAt}`);
});

test("整局在 110 秒内收尾", () => {
  const r = runHeadless({ invincible: true });
  assert.equal(r.phase, "victory", `结束相位 ${r.phase}，用时 ${r.endTime.toFixed(1)} 秒`);
  assert.ok(r.endTime <= 110, `整局 ${r.endTime.toFixed(1)} 秒`);
});
