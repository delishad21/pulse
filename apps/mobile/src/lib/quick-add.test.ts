import assert from "node:assert/strict";
import test from "node:test";
import { parseQuickAdd } from "./quick-add.ts";

test("weekday detection replaces an abbreviation cleanly as the word grows", () => {
  const now = new Date("2026-08-24T08:00:00+08:00");
  const abbreviated = parseQuickAdd("Write report this wed", { now });
  const complete = parseQuickAdd("Write report this wednesday", { now });
  assert.equal(abbreviated.parameters[0]?.text, "this wed");
  assert.equal(complete.parameters[0]?.text, "this wednesday");
  assert.equal(complete.input.title, "Write report");
  assert.equal(complete.input.dueDate, "2026-08-26");
});

test("weekday recurrence starts on the next matching weekday", () => {
  const parsed = parseQuickAdd("Review every wed", { now: new Date("2026-08-24T08:00:00+08:00") });
  assert.equal(parsed.parameters[0]?.type, "recurrence");
  assert.equal(parsed.input.recurrenceRule, "FREQ=WEEKLY;BYDAY=WE");
  assert.equal(parsed.input.dueDate, "2026-08-26");
});

test("parameters use exact source spans and never consume neighboring title text", () => {
  const parsed = parseQuickAdd("Meet Alex tomorrow at 3pm ^high", { now: new Date("2026-08-24T08:00:00+08:00") });
  for (const parameter of parsed.parameters) assert.equal("Meet Alex tomorrow at 3pm ^high".slice(parameter.start, parameter.end), parameter.text);
  assert.equal(parsed.input.title, "Meet Alex");
  assert.equal(parsed.input.priority, "high");
  assert.ok(parsed.input.startAt);
});

test("matches web date, time range, recurrence, project, label, priority, and location semantics", () => {
  const now = new Date(2026, 7, 22, 14, 0, 0);
  const projects = [{ id: "p1", userId: "u", name: "Personal Projects", description: null, color: null, icon: null, status: "active" as const, sortOrder: 0, createdAt: "", updatedAt: "", archivedAt: null, deletedAt: null }];
  const tags = [{ id: "t1", userId: "u", name: "CS3219(TA)", color: null, createdAt: "", updatedAt: "", deletedAt: null }];
  const parsed = parseQuickAdd('Workshop #Personal Projects @CS3219(TA) ^urgent *"Marina Bay" 17 September 2pm-4pm every weekday', { now, projects, tags });
  assert.equal(parsed.input.title, "Workshop");
  assert.equal(parsed.input.projectId, "p1"); assert.deepEqual(parsed.input.tagIds, ["t1"]); assert.equal(parsed.input.priority, "urgent"); assert.equal(parsed.input.location, "Marina Bay");
  assert.equal(parsed.input.startAt, new Date(2026, 8, 17, 14, 0).toISOString()); assert.equal(parsed.input.endAt, new Date(2026, 8, 17, 16, 0).toISOString()); assert.equal(parsed.input.recurrenceRule, "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  for (const parameter of parsed.parameters) assert.equal('Workshop #Personal Projects @CS3219(TA) ^urgent *"Marina Bay" 17 September 2pm-4pm every weekday'.slice(parameter.start, parameter.end), parameter.text);
});

test("ignoring a detected parameter keeps the literal text in the task title", () => {
  const first = parseQuickAdd("Pay tomorrow", { now: new Date(2026, 7, 22) }); const date = first.parameters.find((parameter) => parameter.type === "date")!;
  const second = parseQuickAdd("Pay tomorrow", { now: new Date(2026, 7, 22), ignoredTokenIds: new Set([date.id]) });
  assert.equal(second.input.dueDate, undefined); assert.equal(second.input.title, "Pay tomorrow");
});
