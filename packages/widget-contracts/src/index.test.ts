import assert from "node:assert/strict";
import test from "node:test";
import type { Task } from "@pulse/domain";
import { defaultWidgetConfiguration, makeWidgetSnapshot } from "./index.ts";

test("widget snapshots are versioned, bounded, and omit completed tasks by default", () => {
  const task = (id: string, status: Task["status"]): Task => ({
    id, userId: "u", title: id, description: null, location: null, status, priority: "none",
    startAt: null, endAt: null, due: { date: null, at: null }, recurrenceRule: null,
    completedAt: null, deletedAt: null, projectId: null, parentTaskId: null, sortOrder: 0,
    revision: 1, tags: [], reminders: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  });
  const snapshot = makeWidgetSnapshot({
    configuration: { ...defaultWidgetConfiguration, maxTasks: 1 },
    title: "Today",
    tasks: [task("open", "open"), task("done", "completed")],
    now: new Date("2026-08-24T00:00:00Z"),
  });
  assert.equal(snapshot.version, 2);
  assert.deepEqual(snapshot.tasks.map(({ id }) => id), ["open"]);
  assert.equal(snapshot.totalCount, 1);
});

test("widget configuration filters project tasks, sorts priorities, and emits stable date sections", () => {
  const task = (id: string, priority: Task["priority"], projectId: string | null, dueDate: string): Task => ({
    id, userId: "u", title: id, description: null, location: "Office", status: "open", priority,
    startAt: null, endAt: null, due: { date: dueDate, at: null }, recurrenceRule: null,
    completedAt: null, deletedAt: null, projectId, parentTaskId: null, sortOrder: 0,
    revision: 1, tags: [], reminders: [], createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
  });
  const snapshot = makeWidgetSnapshot({
    configuration: { ...defaultWidgetConfiguration, view: "inbox", includeProjectTasks: false, sort: "priority", arrangement: "grouped" },
    title: "Inbox",
    tasks: [task("low", "low", null, "2026-08-25"), task("project", "urgent", "p", "2026-08-24"), task("high", "high", null, "2026-08-25")],
    dueLabel: (value) => value.due.date,
  });
  assert.deepEqual(snapshot.tasks.map(({ id }) => id), ["high", "low"]);
  assert.equal(snapshot.tasks[0].dateKey, "2026-08-25");
  assert.equal(snapshot.tasks[0].dateLabel, snapshot.tasks[1].dateLabel);
});
