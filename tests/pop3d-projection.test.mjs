import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compensatedZ,
  screenUp,
  degToRad,
} from "../src/app/game/pop3d/engine/projection.ts";

const PITCHES = [0, 16, 32, 45, 55];
const HEIGHTS = [0, 0.5, 0.8, 1.0, 1.3, 1.5, 3.0];
const ZS = [-30, -12, 0, 7, 20, 31];

test("补偿后，抬高实体的屏幕纵向位置与地面判定点完全一致", () => {
  for (const pd of PITCHES) {
    const p = degToRad(pd);
    for (const y of HEIGHTS) {
      for (const z of ZS) {
        const a = screenUp(y, compensatedZ(z, y, p), p);
        const b = screenUp(0, z, p);
        assert.ok(
          Math.abs(a - b) < 1e-9,
          `pitch=${pd} y=${y} z=${z} 偏差 ${a - b}`,
        );
      }
    }
  }
});

test("零高度时补偿量为零（不引入无谓偏移）", () => {
  for (const pd of PITCHES) {
    assert.ok(Math.abs(compensatedZ(12.5, 0, degToRad(pd)) - 12.5) < 1e-12);
  }
});

test("俯角越大，同样的抬高需要越大的 z 补偿", () => {
  const a = compensatedZ(0, 1.5, degToRad(16));
  const b = compensatedZ(0, 1.5, degToRad(32));
  assert.ok(b > a);
});

test("degToRad 换算正确", () => {
  assert.ok(Math.abs(degToRad(180) - Math.PI) < 1e-12);
});
