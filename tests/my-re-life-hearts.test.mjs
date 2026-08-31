import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOutcome, MAX_HEARTS } from "../src/app/game/my-re-life/hearts.ts";

test("risky reduces hearts by one", () => {
  assert.deepEqual(applyOutcome(5, "risky"), { hearts: 4, gameOver: false });
});

test("risky at zero triggers game over", () => {
  assert.deepEqual(applyOutcome(0, "risky"), { hearts: 0, gameOver: true });
});

test("bonus never exceeds max hearts", () => {
  assert.equal(applyOutcome(MAX_HEARTS, "bonus").hearts, MAX_HEARTS);
});

test("safe keeps hearts unchanged", () => {
  assert.deepEqual(applyOutcome(3, "safe"), { hearts: 3, gameOver: false });
});
