import assert from "node:assert/strict";
import test from "node:test";
import {
  compareTasksByPriority,
  normalizeTaskSchedule,
  isTaskInInbox,
  isTaskDueToday,
  isTaskUpcoming,
  isTaskOverdue,
  isTaskCompleted,
  sortTasksForView,
  generateRecurrenceRule,
  parseRecurrenceRule,
  isTaskFocus,
  type Task,
} from "./index.ts";

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

test("sorts tasks by priority descending", () => {
  const base = {
    id: "t1",
    userId: "u1",
    title: "Task",
    description: null,
    status: "open" as const,
    due: { date: null, at: null },
    reminderAt: null,
    recurrenceRule: null,
    completedAt: null,
    deletedAt: null,
    projectId: null,
    sectionId: null,
    parentTaskId: null,
    sortOrder: 0,
    revision: 0,
    tags: [],
    createdAt: "2026-08-20T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
  };
  const tasks = [
    { ...base, id: "low", priority: "low" as const },
    { ...base, id: "urgent", priority: "urgent" as const },
    { ...base, id: "none", priority: "none" as const },
  ];
  tasks.sort(compareTasksByPriority);
  assert.deepEqual(tasks.map((t) => t.id), ["urgent", "low", "none"]);
});

const baseTask: Task = {
  id: "t1",
  userId: "u1",
  title: "Task",
  description: null,
  status: "open",
  priority: "none",
  due: { date: null, at: null },
  reminderAt: null,
  recurrenceRule: null,
  completedAt: null,
  deletedAt: null,
  projectId: null,
  sectionId: null,
  parentTaskId: null,
  sortOrder: 0,
  revision: 0,
  tags: [],
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
};

test("inbox contains open tasks without a project", () => {
  assert.equal(isTaskInInbox({ ...baseTask, projectId: null, status: "open" }), true);
  assert.equal(isTaskInInbox({ ...baseTask, projectId: "p1", status: "open" }), false);
  assert.equal(isTaskInInbox({ ...baseTask, projectId: null, status: "completed" }), false);
  assert.equal(isTaskInInbox({ ...baseTask, projectId: null, deletedAt: "2026-08-20T00:00:00Z" }), false);
});

test("today view matches date-only and timed dues in UTC", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskDueToday({ ...baseTask, due: { date: "2026-08-20", at: null } }, now), true);
  assert.equal(isTaskDueToday({ ...baseTask, due: { date: "2026-08-21", at: null } }, now), false);
  assert.equal(isTaskDueToday({ ...baseTask, due: { date: null, at: "2026-08-20T15:00:00Z" } }, now), true);
  assert.equal(isTaskDueToday({ ...baseTask, due: { date: null, at: "2026-08-21T00:00:00Z" } }, now), false);
  assert.equal(isTaskDueToday({ ...baseTask, reminderAt: "2026-08-20T08:00:00Z" }, now), true);
  assert.equal(isTaskDueToday({ ...baseTask, reminderAt: "2026-08-21T08:00:00Z" }, now), false);
  assert.equal(isTaskDueToday({ ...baseTask, status: "completed" }, now), false);
});

test("today view respects user timezone for date-only dues", () => {
  // 2026-08-20 23:00 in America/New_York is 2026-08-21 03:00 UTC.
  const now = new Date("2026-08-21T03:00:00Z");
  assert.equal(isTaskDueToday({ ...baseTask, due: { date: "2026-08-20", at: null } }, now, "UTC"), false);
  assert.equal(isTaskDueToday({ ...baseTask, due: { date: "2026-08-20", at: null } }, now, "America/New_York"), true);
});

test("upcoming view excludes today and past dues", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskUpcoming({ ...baseTask, due: { date: "2026-08-21", at: null } }, now), true);
  assert.equal(isTaskUpcoming({ ...baseTask, due: { date: "2026-08-20", at: null } }, now), false);
  assert.equal(isTaskUpcoming({ ...baseTask, due: { date: null, at: "2026-08-21T00:00:00Z" } }, now), true);
  assert.equal(isTaskUpcoming({ ...baseTask, due: { date: null, at: "2026-08-20T10:00:00Z" } }, now), false);
});

test("overdue view includes only open past-due tasks", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskOverdue({ ...baseTask, due: { date: "2026-08-19", at: null } }, now), true);
  assert.equal(isTaskOverdue({ ...baseTask, due: { date: "2026-08-20", at: null } }, now), false);
  assert.equal(isTaskOverdue({ ...baseTask, due: { date: null, at: "2026-08-19T23:59:59Z" } }, now), true);
  assert.equal(isTaskOverdue({ ...baseTask, due: { date: null, at: "2026-08-20T13:00:00Z" } }, now), false);
  assert.equal(isTaskOverdue({ ...baseTask, status: "completed", due: { date: "2026-08-19", at: null } }, now), false);
});

test("completed view matches completed non-deleted tasks", () => {
  assert.equal(isTaskCompleted({ ...baseTask, status: "completed" }), true);
  assert.equal(isTaskCompleted({ ...baseTask, status: "open" }), false);
  assert.equal(isTaskCompleted({ ...baseTask, status: "completed", deletedAt: "2026-08-20T00:00:00Z" }), false);
});

test("sortTasksForView orders deterministically", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  const tasks: Task[] = [
    { ...baseTask, id: "b", due: { date: "2026-08-22", at: null }, priority: "low" },
    { ...baseTask, id: "a", due: { date: "2026-08-21", at: null }, priority: "high" },
    { ...baseTask, id: "c", due: { date: null, at: null }, priority: "urgent" },
  ];
  const sorted = sortTasksForView(tasks, "upcoming", now);
  assert.deepEqual(sorted.map((t) => t.id), ["a", "b", "c"]);
});


test("recurrence RRULE generation and parsing are deterministic", () => {
  const rule = generateRecurrenceRule({ frequency: "weekly", interval: 2, byWeekday: ["MO", "FR"], count: 5 });
  assert.equal(rule, "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;COUNT=5");
  assert.deepEqual(parseRecurrenceRule(rule), { frequency: "weekly", interval: 2, byWeekday: ["MO", "FR"], count: 5 });
});

test("focus includes high priority and due/overdue work", () => {
  const now = new Date("2026-08-20T12:00:00Z");
  assert.equal(isTaskFocus({ ...baseTask, priority: "high" }, now), true);
  assert.equal(isTaskFocus({ ...baseTask, due: { date: "2026-08-20", at: null } }, now), true);
  assert.equal(isTaskFocus({ ...baseTask, priority: "low", due: { date: "2026-08-22", at: null } }, now), false);
});
