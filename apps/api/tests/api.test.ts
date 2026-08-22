import assert from "node:assert/strict";
import test from "node:test";
import { PulseApiClient } from "@pulse/api-client";
import { buildApp } from "../src/server.js";
import { createMemoryRepository } from "../src/repositories/memory.js";
import { clearRepository, setRepository } from "../src/repositories/registry.js";
import * as taskService from "../src/services/task-service.js";

const TEST_USER = { id: "test_user_1", username: "test-user", name: "Test User", timezone: "UTC" };

async function createTestClient(repository = createMemoryRepository(TEST_USER.id)) {
  const app = await buildApp({ repository, defaultUser: TEST_USER });
  const baseUrl = await app.listen({ port: 0 });
  const client = new PulseApiClient({ baseUrl });

  return {
    app,
    client,
    baseUrl,
    async cleanup() {
      await app.close();
      clearRepository();
    },
  };
}

test("health endpoints are reachable", async () => {
  const { baseUrl, cleanup } = await createTestClient();
  try {
    const live = await fetch(`${baseUrl}/api/health/live`);
    assert.equal(live.status, 200);
    const ready = await fetch(`${baseUrl}/api/health/ready`);
    assert.ok(ready.status === 200 || ready.status === 503);
  } finally {
    await cleanup();
  }
});

test("production auth binds web requests to a resolved user while service auth keeps the default identity", async () => {
  const repository = createMemoryRepository(TEST_USER.id);
  const app = await buildApp({
    repository,
    defaultUser: TEST_USER,
    auth: {
      webToken: "web-secret",
      serviceToken: "service-secret",
      resolveUser: async (id) => id === TEST_USER.id ? TEST_USER : null,
    },
  });
  const baseUrl = await app.listen({ port: 0 });
  try {
    assert.equal((await fetch(`${baseUrl}/api/health/live`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/api/tasks`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/tasks`, { headers: { Authorization: "Bearer wrong-secret" } })).status, 401);

    const webWithoutIdentity = await fetch(`${baseUrl}/api/tasks`, { headers: { Authorization: "Bearer web-secret" } });
    assert.equal(webWithoutIdentity.status, 401);
    const webUnknownIdentity = await fetch(`${baseUrl}/api/tasks`, { headers: { Authorization: "Bearer web-secret", "x-pulse-user-id": "unknown" } });
    assert.equal(webUnknownIdentity.status, 401);
    const web = await fetch(`${baseUrl}/api/tasks`, { headers: { Authorization: "Bearer web-secret", "x-pulse-user-id": TEST_USER.id } });
    assert.equal(web.status, 200);
    assert.deepEqual(await web.json(), []);

    const serviceClient = new PulseApiClient({ baseUrl, getAccessToken: async () => "service-secret" });
    assert.deepEqual(await serviceClient.listTasks(), []);
  } finally {
    await app.close();
    clearRepository();
  }
});

test("task CRUD with date-only due date", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const task = await client.createTask({ title: "API test task", dueDate: "2099-01-01", priority: "high" });
    assert.equal(task.title, "API test task");
    assert.equal(task.priority, "high");
    assert.equal(task.due.date, "2099-01-01");
    assert.equal(task.due.at, null);

    const fetched = await client.getTask(task.id);
    assert.equal(fetched.id, task.id);

    const updated = await client.updateTask(task.id, { title: "API test task updated" });
    assert.equal(updated.title, "API test task updated");

    await client.deleteTask(task.id);
    await assert.rejects(() => client.getTask(task.id), /Task not found\./);
  } finally {
    await cleanup();
  }
});

test("complete and reopen task", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const task = await client.createTask({ title: "Complete me" });
    const completed = await client.completeTask(task.id);
    assert.equal(completed.status, "completed");

    const reopened = await client.reopenTask(task.id);
    assert.equal(reopened.status, "open");

    await client.deleteTask(task.id);
  } finally {
    await cleanup();
  }
});

test("projects are independent of removed sections", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const project = await client.createProject({ name: "API test project" });
    assert.equal(project.name, "API test project");
    const archived = await client.archiveProject(project.id);
    assert.equal(archived.status, "archived");
  } finally { await cleanup(); }
});

test("tags and comments", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const tagName = `api-test-${Date.now()}`;
    const tag = await client.createTag({ name: tagName });
    assert.equal(tag.name, tagName);

    const task = await client.createTask({ title: "Tagged task", tagIds: [tag.id] });
    assert.ok(task);

    const comment = await client.createComment(task.id, { body: "A comment" });
    assert.equal(comment.body, "A comment");

    const comments = await client.listComments(task.id);
    assert.ok(comments.some((c) => c.id === comment.id));

    await client.deleteTask(task.id);
  } finally {
    await cleanup();
  }
});

test("bulk complete and undo", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const t1 = await client.createTask({ title: "Bulk 1", dueDate: "2099-02-01" });
    const t2 = await client.createTask({ title: "Bulk 2", dueDate: "2099-02-02" });

    await client.bulkComplete({ ids: [t1.id, t2.id] });
    const completed = await client.getCompleted();
    assert.ok(completed.some((t) => t.id === t1.id));
    assert.ok(completed.some((t) => t.id === t2.id));

    await client.undoLast();
    const openAgain = await client.listTasks({ status: "open" });
    assert.ok(openAgain.some((t) => t.id === t1.id));
    assert.ok(openAgain.some((t) => t.id === t2.id));

    await client.deleteTask(t1.id);
    await client.deleteTask(t2.id);
  } finally {
    await cleanup();
  }
});

test("search across title and comments", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const task = await client.createTask({ title: "Findable unique query string", priority: "low" });
    await client.createComment(task.id, { body: "Another unique query mention" });

    const results = await client.searchTasks("unique query");
    assert.ok(results.some((t) => t.id === task.id));

    await client.deleteTask(task.id);
  } finally {
    await cleanup();
  }
});

test("title-only PATCH preserves schedule, reminders and undo restores original task", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const original = await client.createTask({
      title: "Scheduled task", startAt: "2099-03-04T08:00:00.000Z", endAt: "2099-03-04T09:00:00.000Z",
      dueDate: "2099-03-05", reminders: [
        { remindAt: "2099-03-04T07:30:00.000Z" }, { remindAt: "2099-03-04T07:45:00.000Z", channel: "hermes_telegram" },
      ], recurrenceRule: "FREQ=WEEKLY;INTERVAL=1",
    });
    const updated = await client.updateTask(original.id, { title: "Renamed only" });
    assert.equal(updated.title, "Renamed only"); assert.equal(updated.startAt, original.startAt); assert.equal(updated.endAt, original.endAt);
    assert.equal(updated.due.date, "2099-03-05"); assert.equal(updated.reminders.length, 2); assert.equal(updated.recurrenceRule, original.recurrenceRule);
    await client.undoLast();
    const restored = await client.getTask(original.id);
    assert.equal(restored.title, "Scheduled task"); assert.equal(restored.startAt, original.startAt); assert.equal(restored.endAt, original.endAt);
    assert.deepEqual(restored.reminders.map(r=>r.remindAt), original.reminders.map(r=>r.remindAt));
  } finally { await cleanup(); }
});

test("task sortOrder can be created and patched for persistent web ordering", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const task = await client.createTask({ title: "Ordered task", sortOrder: 1000 });
    assert.equal(task.sortOrder, 1000);
    const moved = await client.updateTask(task.id, { sortOrder: 2500 });
    assert.equal(moved.sortOrder, 2500);
    assert.equal((await client.getTask(task.id)).sortOrder, 2500);
  } finally {
    await cleanup();
  }
});

test("bulk reorder persists order as one undoable operation", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const first = await client.createTask({ title: "First", sortOrder: 1000 });
    const second = await client.createTask({ title: "Second", sortOrder: 2000 });
    const before = await client.listOperations();
    const reordered = await client.bulkReorder({ updates: [
      { id: first.id, sortOrder: 2000 },
      { id: second.id, sortOrder: 1000 },
    ] });
    assert.equal(reordered.find((task) => task.id === first.id)?.sortOrder, 2000);
    assert.equal(reordered.find((task) => task.id === second.id)?.sortOrder, 1000);
    const after = await client.listOperations();
    assert.equal(after[0]?.kind, "TASK_BULK_UPDATE");
    assert.notEqual(after[0]?.id, before[0]?.id);
    await client.undoLast();
    assert.equal((await client.getTask(first.id)).sortOrder, 1000);
    assert.equal((await client.getTask(second.id)).sortOrder, 2000);
  } finally {
    await cleanup();
  }
});

test("undo and redo restore both update and create operations", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const task = await client.createTask({ title: "Before redo" });
    await client.updateTask(task.id, { title: "After redo" });
    await client.undoLast();
    assert.equal((await client.getTask(task.id)).title, "Before redo");
    await client.redoLast();
    assert.equal((await client.getTask(task.id)).title, "After redo");

    const created = await client.createTask({ title: "Redo create" });
    await client.undoLast();
    await assert.rejects(() => client.getTask(created.id), /Task not found/);
    await client.redoLast();
    assert.equal((await client.getTask(created.id)).title, "Redo create");
  } finally {
    await cleanup();
  }
});

test("foreign project, parent and label relations are rejected", async () => {
  const foreignUser = "foreign_user";
  const repository = createMemoryRepository(TEST_USER.id, [foreignUser]);
  const foreignProject = await repository.projects.create(foreignUser, { name: "Foreign project" });
  const foreignTag = await repository.tags.create(foreignUser, { name: "foreign-tag" });
  const foreignTask = await repository.tasks.create(foreignUser, { title: "Foreign parent" });
  const { client, cleanup } = await createTestClient(repository);
  try {
    await assert.rejects(() => client.createTask({ title: "Bad project", projectId: foreignProject.id }), /Project not found\./);
    await assert.rejects(() => client.createTask({ title: "Bad parent", parentTaskId: foreignTask.id }), /Task not found\./);
    await assert.rejects(() => client.createTask({ title: "Bad label", tagIds: [foreignTag.id] }), /(labels|Tag)/i);
  } finally { await cleanup(); }
});

test("multiple reminders, labels and comments support CRUD", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const project = await client.createProject({ name: "CRUD project" });
    const tag = await client.createTag({ name: "crud-tag" });
    assert.equal((await client.updateTag(tag.id, { name: "crud-tag-updated" })).name, "crud-tag-updated");
    const task = await client.createTask({ title: "CRUD task", projectId: project.id, tagIds: [tag.id], reminders: [
      { remindAt: "2099-04-01T08:00:00.000Z" }, { remindAt: "2099-04-01T08:30:00.000Z" },
    ] });
    assert.equal(task.reminders.length, 2); assert.ok(task.reminders.every(r=>r.channel === "hermes_telegram"));
    const comment = await client.createComment(task.id, { body: "Before comment" });
    assert.equal((await client.updateComment(task.id, comment.id, { body: "After comment" })).body, "After comment");
    await client.deleteComment(task.id, comment.id); assert.equal((await client.listComments(task.id)).length, 0);
    const reminder = await client.createReminder(task.id, { remindAt: "2099-04-01T09:00:00.000Z" });
    const changed = await client.updateReminder(reminder.id, { remindAt: "2099-04-01T10:00:00.000Z", status: "sent" });
    assert.equal(changed.remindAt, "2099-04-01T10:00:00.000Z"); assert.equal(changed.status, "sent"); assert.equal(changed.channel, "hermes_telegram");
    assert.equal((await client.listReminders(task.id)).length, 3); await client.deleteReminder(reminder.id); assert.equal((await client.listReminders(task.id)).length, 2);
    await client.deleteTag(tag.id); assert.ok(!(await client.listTags()).some(t=>t.id === tag.id));
  } finally { await cleanup(); }
});

test("task defaults to none priority and partial schedule patches preserve invariants", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const task = await client.createTask({ title: "Window", startAt: "2099-04-03T08:00:00.000Z", endAt: "2099-04-03T09:00:00.000Z", dueAt: "2099-04-03T12:00:00.000Z" });
    assert.equal(task.priority, "none");
    const endOnly = await client.updateTask(task.id, { endAt: "2099-04-03T10:00:00.000Z" });
    assert.equal(endOnly.startAt, "2099-04-03T08:00:00.000Z"); assert.equal(endOnly.endAt, "2099-04-03T10:00:00.000Z");
    const dateDeadline = await client.updateTask(task.id, { dueDate: "2099-04-04" });
    assert.equal(dateDeadline.due.date, "2099-04-04"); assert.equal(dateDeadline.due.at, null);
    const timedDeadline = await client.updateTask(task.id, { dueAt: "2099-04-04T17:00:00.000Z" });
    assert.equal(timedDeadline.due.date, null); assert.equal(timedDeadline.due.at, "2099-04-04T17:00:00.000Z");
  } finally { await cleanup(); }
});

test("late recurring completion creates the next anchored occurrence", async () => {
  const repository = createMemoryRepository(TEST_USER.id); setRepository(repository);
  try {
    const original = await repository.tasks.create(TEST_USER.id, { title: "Weekly", dueDate: "2026-08-19", recurrenceRule: "FREQ=WEEKLY", reminders: [{ remindAt: "2026-08-19T08:00:00.000Z" }] });
    const result = await taskService.completeTask(TEST_USER.id, original.id, "UTC", new Date("2026-08-20T12:00:00.000Z"));
    assert.equal(result.task.status, "completed"); assert.ok(result.spawnedTask); assert.equal(result.spawnedTask?.due.date, "2026-08-26");
    assert.equal(result.spawnedTask?.reminders[0]?.remindAt, "2026-08-26T08:00:00.000Z");
  } finally { clearRepository(); }
});

test("focus, activity, task history and project-name search work", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const project = await client.createProject({ name: "Nebula Search Project" });
    const task = await client.createTask({ title: "Ordinary title", priority: "urgent", projectId: project.id });
    await client.updateTask(task.id, { description: "Changed description" });
    const focus = await client.getFocus();
    assert.ok(focus.some((t) => t.id === task.id));
    const activity = await client.listActivity();
    assert.ok(activity.some((e) => e.taskId === task.id && e.kind === "task.created"));
    const history = await client.getTaskHistory(task.id);
    assert.ok(history.some((e) => e.kind === "task.updated"));
    const search = await client.searchTasks("Nebula Search");
    assert.ok(search.some((t) => t.id === task.id));
  } finally {
    await cleanup();
  }
});

test("bulk update undo restores every task and operation history is capped at three", async () => {
  const { client, cleanup } = await createTestClient();
  try {
    const t1 = await client.createTask({ title: "Restore 1", priority: "low", dueDate: "2099-05-01" });
    const t2 = await client.createTask({ title: "Restore 2", priority: "medium", dueDate: "2099-05-02" });
    await client.bulkUpdate({ ids: [t1.id, t2.id], priority: "urgent", dueDate: "2099-06-01" });
    await client.undoLast();
    const r1 = await client.getTask(t1.id);
    const r2 = await client.getTask(t2.id);
    assert.equal(r1.priority, "low");
    assert.equal(r1.due.date, "2099-05-01");
    assert.equal(r2.priority, "medium");
    assert.equal(r2.due.date, "2099-05-02");
    await client.updateTask(t1.id, { title: "Restore 1a" });
    await client.updateTask(t1.id, { title: "Restore 1b" });
    await client.updateTask(t1.id, { title: "Restore 1c" });
    await client.updateTask(t1.id, { title: "Restore 1d" });
    assert.equal((await client.listOperations()).length, 3);
  } finally {
    await cleanup();
  }
});
