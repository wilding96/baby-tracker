import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatBabyAgeAt,
  getBabyAgeAt,
} from "../src/lib/babyAge.ts";

const BIRTH = "2026-01-10";

test("出生当天显示「出生当天」", () => {
  const age = getBabyAgeAt(BIRTH, "2026-01-10");
  assert.equal(age?.label, "出生当天");
  assert.equal(age?.days, 0);
  assert.equal(age?.beforeBirth, false);
});

test("满月前按天数显示", () => {
  assert.equal(formatBabyAgeAt(BIRTH, "2026-01-11"), "1天");
  assert.equal(formatBabyAgeAt(BIRTH, "2026-01-22"), "12天");
});

test("满月后显示「几个月几天」", () => {
  assert.equal(formatBabyAgeAt(BIRTH, "2026-02-10"), "1个月");
  assert.equal(formatBabyAgeAt(BIRTH, "2026-04-22"), "3个月12天");
});

test("跨生日显示「几岁几个月」", () => {
  assert.equal(formatBabyAgeAt(BIRTH, "2027-01-10"), "1岁");
  assert.equal(formatBabyAgeAt(BIRTH, "2027-03-10"), "1岁2个月");
});

test("早于出生日期显示「出生前 N 天」并标记", () => {
  const age = getBabyAgeAt(BIRTH, "2026-01-05");
  assert.equal(age?.label, "出生前 5 天");
  assert.equal(age?.days, -5);
  assert.equal(age?.beforeBirth, true);
});

test("接受 Date 实例，且按日历天而非 24 小时计算", () => {
  assert.equal(formatBabyAgeAt(new Date(2026, 0, 10), new Date(2026, 0, 11)), "1天");
});

test("生日或日期缺失/非法时返回 null", () => {
  assert.equal(getBabyAgeAt(null, "2026-01-10"), null);
  assert.equal(getBabyAgeAt(BIRTH, null), null);
  assert.equal(getBabyAgeAt(undefined, ""), null);
  assert.equal(getBabyAgeAt("not-a-date", "2026-01-10"), null);
});
