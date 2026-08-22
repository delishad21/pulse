import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickAdd } from "./quick-add-parser.ts";

const now = new Date(2026, 7, 22, 14, 0, 0); // Saturday 22 Aug 2026

test("parses bare and next weekdays as date-only schedules", () => {
  assert.deepEqual(parseQuickAdd("Review Thursday", { now }), { title: "Review", projectId: null, dueDate: "2026-08-27" });
  assert.deepEqual(parseQuickAdd("Review next Thursday", { now }), { title: "Review", projectId: null, dueDate: "2026-08-27" });
});

test("parses weekly recurrence from every weekday phrase", () => {
  assert.deepEqual(parseQuickAdd("Gym every Thursday", { now }), {
    title: "Gym", projectId: null, dueDate: "2026-08-27", recurrenceRule: "FREQ=WEEKLY;BYDAY=TH",
  });
});

test("parses natural times with dates and preserves timed semantics", () => {
  const task = parseQuickAdd("Call Thursday at 3:30pm", { now });
  assert.equal(task.title, "Call");
  assert.equal(task.dueDate, undefined);
  assert.equal(task.dueAt, new Date(2026, 7, 27, 15, 30).toISOString());
});

test("parses named and numeric dates", () => {
  assert.equal(parseQuickAdd("Submit 31 August", { now }).dueDate, "2026-08-31");
  assert.equal(parseQuickAdd("Submit Aug 31", { now }).dueDate, "2026-08-31");
  assert.equal(parseQuickAdd("Submit 31/8", { now }).dueDate, "2026-08-31");
});

test("parses common recurrence phrases", () => {
  assert.equal(parseQuickAdd("Standup every weekday 9am", { now }).recurrenceRule, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  assert.equal(parseQuickAdd("Water plants every week", { now }).recurrenceRule, "FREQ=WEEKLY");
  assert.equal(parseQuickAdd("Budget every month", { now }).recurrenceRule, "FREQ=MONTHLY");
});
