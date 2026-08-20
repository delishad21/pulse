import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Task } from "@pulse/api-client";
import { filterTasks } from "./dashboard-filters.ts";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? crypto.randomUUID(), userId: "u", title: "Task",
    description: null, status: "open", priority: "none",
    due: { date: null, at: null }, reminderAt: null, recurrenceRule: null,
    completedAt: null, deletedAt: null, projectId: null, sectionId: null,
    parentTaskId: null, sortOrder: 0, revision: 0, tags: [],
    createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(),
    ...overrides,
  };
}

describe("filterTasks", () => {
  it("returns completed tasks", () => {
    const open = task({ title: "Open" });
    const completed = task({ title: "Done", status: "completed" });
    assert.deepEqual(filterTasks([open, completed], { type: "completed" }).map((t) => t.id), [completed.id]);
  });
  it("filters by status, project and query", () => {
    const matching = task({ title: "Client open task", projectId: "p1" });
    const wrongStatus = task({ title: "Client done", status: "completed", projectId: "p1" });
    const wrongProject = task({ title: "Client open other", projectId: "p2" });
    const result = filterTasks([matching, wrongStatus, wrongProject], { type: "filters", status: "open", projectId: "p1", q: "client" });
    assert.deepEqual(result.map((t) => t.id), [matching.id]);
  });
  it("matches query text in title or description", () => {
    const a = task({ title: "Alpha task" });
    const b = task({ title: "Beta", description: "contains alpha" });
    assert.equal(filterTasks([a, b], { type: "filters", q: "alpha" }).length, 2);
  });
});
