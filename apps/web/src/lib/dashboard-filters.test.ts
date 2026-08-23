import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@pulse/api-client";
import { filterTasks } from "./dashboard-filters.ts";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(), userId: "u", title: "Task",
    description: null, location: null, status: "open", priority: "none",
    startAt: null, endAt: null, due: { date: null, at: null }, recurrenceRule: null,
    completedAt: null, deletedAt: null, projectId: null,
    parentTaskId: null, sortOrder: 0, revision: 0, tags: [], reminders: [],
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("filterTasks", () => {
  it("keeps only open tasks in the dashboard", () => {
    const open = task({ title: "Open" });
    const completed = task({ title: "Done", status: "completed" });
    const cancelled = task({ title: "Cancelled", status: "cancelled" });
    assert.deepEqual(filterTasks([open, completed, cancelled], { type: "all" }).map((item) => item.id), [open.id]);
  });

  it("filters by status and project", () => {
    const matching = task({ title: "Client open task", projectId: "p1" });
    const wrongStatus = task({ title: "Client done", status: "completed", projectId: "p1" });
    const wrongProject = task({ title: "Client open other", projectId: "p2" });
    const result = filterTasks([matching, wrongStatus, wrongProject], { type: "filters", status: "open", projectId: "p1" });
    assert.deepEqual(result.map((item) => item.id), [matching.id]);
  });
});
