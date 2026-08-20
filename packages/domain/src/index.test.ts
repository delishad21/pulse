import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTaskSchedule } from "./index.ts";

test("keeps date-only due dates separate from timed due dates", () => {
  assert.deepEqual(
    normalizeTaskSchedule({ dueDate: "2026-08-20", reminderAt: "2026-08-19T09:00:00Z" }),
    {
      due: { date: "2026-08-20", at: null },
      reminderAt: "2026-08-19T09:00:00Z",
    },
  );
});

test("rejects a due date that contains a time", () => {
  assert.throws(
    () => normalizeTaskSchedule({ dueDate: "2026-08-20T09:00:00Z" }),
    /dueDate must use YYYY-MM-DD/,
  );
});

test("preserves an explicit due time and validates reminders independently", () => {
  assert.deepEqual(
    normalizeTaskSchedule({
      dueAt: "2026-08-20T09:00:00Z",
      reminderAt: "2026-08-19T09:00:00Z",
    }),
    {
      due: { date: null, at: "2026-08-20T09:00:00Z" },
      reminderAt: "2026-08-19T09:00:00Z",
    },
  );
});

for (const field of ["dueAt", "reminderAt"] as const) {
  test(`rejects an invalid ${field}`, () => {
    assert.throws(
      () => normalizeTaskSchedule({ [field]: "not-a-date" }),
      new RegExp(`${field} must be a valid ISO instant`),
    );
  });
}

test("rejects malformed date-only values", () => {
  assert.throws(
    () => normalizeTaskSchedule({ dueDate: "2026-99-99" }),
    /dueDate must be a real calendar date/,
  );
});
