import assert from "node:assert/strict";
import test from "node:test";
import { localDateKey, startOfCurrentWeek, weekDateLabel, weekDays, monthGrid } from "./task-dates.ts";

test("weeks run Monday through Sunday", () => {
  const now = new Date(2026, 7, 22, 14, 0, 0);
  assert.equal(localDateKey(startOfCurrentWeek(now)), "2026-08-17");
  assert.deepEqual(weekDays(now).map(localDateKey), ["2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23"]);
});

test("week date labels use day month, weekday order", () => {
  assert.equal(weekDateLabel(new Date(2026, 8, 17)), "17 September, Thursday");
});

test("month grid starts on Monday and contains six full weeks", () => {
  const days = monthGrid(new Date(2026, 7, 1));
  assert.equal(days.length, 42);
  assert.equal(days[0].getDay(), 1);
  assert.equal(days[41].getDay(), 0);
});
