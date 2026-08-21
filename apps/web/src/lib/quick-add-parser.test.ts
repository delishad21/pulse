import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd, resolveQuickAddProjectId } from "./quick-add-parser";
import type { Project, Section, Tag } from "@pulse/api-client";

const stamp = "2026-08-21T00:00:00.000Z";
const project = { id: "p1", userId: "u1", name: "Personal", description: null, color: null, icon: null, status: "active", sortOrder: 0, createdAt: stamp, updatedAt: stamp, archivedAt: null, deletedAt: null } satisfies Project;
const work = { ...project, id: "p2", name: "Work" } satisfies Project;
const section = { id: "s1", projectId: "p1", name: "Errands", sortOrder: 0, createdAt: stamp, updatedAt: stamp, deletedAt: null } satisfies Section;
const tag = { id: "t1", userId: "u1", name: "Home", color: null, createdAt: stamp, updatedAt: stamp, deletedAt: null } satisfies Tag;

test("quick add parses project, section, tag, priority, and date-only schedule", () => {
  const input = parseQuickAdd("Buy milk #Personal @Errands +Home !2 tomorrow", {
    projects: [project, work], sections: [section], tags: [tag], now: new Date(2026, 7, 21, 10, 0),
  });
  assert.equal(input.title, "Buy milk");
  assert.equal(input.projectId, "p1");
  assert.equal(input.sectionId, "s1");
  assert.deepEqual(input.tagIds, ["t1"]);
  assert.equal(input.priority, "high");
  assert.equal(input.dueDate, "2026-08-22");
  assert.equal(input.dueAt, undefined);
});

test("quick add produces a timed due instant when a time is explicit", () => {
  const input = parseQuickAdd("Deploy next monday at 14:30", { now: new Date(2026, 7, 21, 10, 0) });
  assert.equal(input.title, "Deploy");
  assert.equal(input.dueDate, undefined);
  assert.ok(input.dueAt);
  const due = new Date(input.dueAt!);
  assert.equal(due.getDay(), 1);
  assert.equal(due.getHours(), 14);
  assert.equal(due.getMinutes(), 30);
});

test("unknown metadata tokens stay in the title rather than being silently dropped", () => {
  const input = parseQuickAdd("Call Sam #Missing +Unknown", { projects: [project], tags: [tag] });
  assert.equal(input.title, "Call Sam #Missing +Unknown");
  assert.equal(input.projectId, null);
});

test("project token resolution lets the component fetch the right section list", () => {
  assert.equal(resolveQuickAddProjectId("Thing #Work", [project, work], "p1"), "p2");
  assert.equal(resolveQuickAddProjectId("Thing", [project, work], "p1"), "p1");
});
