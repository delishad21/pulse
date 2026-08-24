import assert from "node:assert/strict";
import test from "node:test";
import { isOverdue, isToday } from "./utils.ts";

test("today and overdue comparisons use the browser-local calendar date", () => {
  const justAfterMidnight = new Date(2026, 7, 24, 0, 30);
  assert.equal(isToday("2026-08-24", justAfterMidnight), true);
  assert.equal(isToday("2026-08-23", justAfterMidnight), false);
  assert.equal(isOverdue("2026-08-23", justAfterMidnight), true);
  assert.equal(isOverdue("2026-08-24", justAfterMidnight), false);
});
