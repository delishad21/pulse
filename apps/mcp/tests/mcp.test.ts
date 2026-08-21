import assert from "node:assert/strict";
import test from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { Task } from "@pulse/api-client";
import { createPulseMcpServer, type PulseMcpApi } from "../src/server.js";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    title: "Test task",
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
    revision: 1,
    tags: [],
    createdAt: "2026-08-21T00:00:00.000Z",
    updatedAt: "2026-08-21T00:00:00.000Z",
    ...overrides,
  };
}

function makeApi() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const api: PulseMcpApi = {
    async getToday() { calls.push({ method: "getToday", args: [] }); return [task()]; },
    async getInbox() { calls.push({ method: "getInbox", args: [] }); return [task({ id: "inbox-1" })]; },
    async searchTasks(query) { calls.push({ method: "searchTasks", args: [query] }); return [task({ title: query })]; },
    async createTask(input) { calls.push({ method: "createTask", args: [input] }); return task({ title: input.title }); },
    async updateTask(id, input) { calls.push({ method: "updateTask", args: [id, input] }); return task({ id, ...input, due: { date: input.dueDate ?? null, at: input.dueAt ?? null } }); },
    async completeTask(id) { calls.push({ method: "completeTask", args: [id] }); return task({ id, status: "completed", completedAt: "2026-08-21T01:00:00.000Z" }); },
    async rescheduleTask(id, input) { calls.push({ method: "rescheduleTask", args: [id, input] }); return task({ id, due: { date: input.dueDate ?? null, at: input.dueAt ?? null }, reminderAt: input.reminderAt ?? null, recurrenceRule: input.recurrenceRule ?? null }); },
    async getTask(id) { calls.push({ method: "getTask", args: [id] }); return task({ id }); },
    async getUpcoming() { calls.push({ method: "getUpcoming", args: [] }); return [task({ id: "upcoming-1" })]; },
    async getOverdue() { calls.push({ method: "getOverdue", args: [] }); return [task({ id: "overdue-1" })]; },
    async reopenTask(id) { calls.push({ method: "reopenTask", args: [id] }); return task({ id }); },
    async cancelTask(id) { calls.push({ method: "cancelTask", args: [id] }); return task({ id, status: "cancelled" }); },
    async moveTask(id, input) { calls.push({ method: "moveTask", args: [id, input] }); return task({ id, projectId: input.projectId, sectionId: input.sectionId ?? null }); },
    async bulkComplete(input) { calls.push({ method: "bulkComplete", args: [input] }); return input.ids.map((id) => task({ id, status: "completed" })); },
    async bulkReschedule(input) { calls.push({ method: "bulkReschedule", args: [input] }); return input.ids.map((id) => task({ id, due: { date: input.dueDate ?? null, at: input.dueAt ?? null } })); },
    async bulkMove(input) { calls.push({ method: "bulkMove", args: [input] }); return input.ids.map((id) => task({ id, projectId: input.projectId, sectionId: input.sectionId ?? null })); },
    async listProjects() { calls.push({ method: "listProjects", args: [] }); return []; },
    async listTags() { calls.push({ method: "listTags", args: [] }); return []; },
    async createComment(taskId, input) { calls.push({ method: "createComment", args: [taskId, input] }); return { id: "comment-1", taskId, userId: "user-1", body: input.body, createdAt: "2026-08-21T00:00:00.000Z", updatedAt: "2026-08-21T00:00:00.000Z", deletedAt: null }; },
    async getTaskHistory(taskId) { calls.push({ method: "getTaskHistory", args: [taskId] }); return []; },
  };
  return { api, calls };
}
async function connect(api: PulseMcpApi) {
  const server = createPulseMcpServer(api);
  const client = new Client({ name: "pulse-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return { client, server };
}

test("lists the Pulse MCP tool surface", async () => {
  const { api } = makeApi();
  const { client, server } = await connect(api);
  try {
    const result = await client.listTools();
    const expected = [
      "add_comment", "bulk_complete_tasks", "bulk_move_tasks", "bulk_reschedule_tasks",
      "cancel_task", "complete_task", "create_task", "get_inbox", "get_labels",
      "get_overdue", "get_projects", "get_task", "get_task_activity", "get_today",
      "get_upcoming", "move_task", "reopen_task", "reschedule_task", "search_tasks", "update_task",
    ].sort();
    assert.deepEqual(result.tools.map((tool) => tool.name).sort(), expected);
  } finally {
    await client.close();
    await server.close();
  }
});
test("read tools use the typed Pulse API boundary", async () => {
  const { api, calls } = makeApi();
  const { client, server } = await connect(api);
  try {
    const today = await client.callTool({ name: "get_today", arguments: {} });
    const taskResult = await client.callTool({ name: "get_task", arguments: { id: "task-42" } });
    const upcoming = await client.callTool({ name: "get_upcoming", arguments: {} });
    const overdue = await client.callTool({ name: "get_overdue", arguments: {} });
    assert.equal((today.structuredContent as { tasks: Task[] }).tasks[0]?.id, "task-1");
    assert.equal((taskResult.structuredContent as { task: Task }).task.id, "task-42");
    assert.equal((upcoming.structuredContent as { tasks: Task[] }).tasks[0]?.id, "upcoming-1");
    assert.equal((overdue.structuredContent as { tasks: Task[] }).tasks[0]?.id, "overdue-1");
    assert.deepEqual(calls.map((call) => call.method), ["getToday", "getTask", "getUpcoming", "getOverdue"]);
  } finally {
    await client.close();
    await server.close();
  }
});

test("task mutations preserve semantic scheduling fields", async () => {
  const { api, calls } = makeApi();
  const { client, server } = await connect(api);
  try {
    await client.callTool({ name: "create_task", arguments: { title: "Build MCP", dueDate: "2026-08-22", priority: "high" } });
    await client.callTool({ name: "update_task", arguments: { id: "task-1", title: "Build Pulse MCP" } });
    await client.callTool({ name: "reschedule_task", arguments: { id: "task-1", dueAt: "2026-08-23T03:00:00.000Z", reminderAt: "2026-08-23T02:30:00.000Z" } });
    await client.callTool({ name: "move_task", arguments: { id: "task-1", projectId: "project-1", sectionId: "section-1" } });
    await client.callTool({ name: "complete_task", arguments: { id: "task-1" } });
    await client.callTool({ name: "reopen_task", arguments: { id: "task-1" } });
    await client.callTool({ name: "cancel_task", arguments: { id: "task-1" } });

    assert.deepEqual(calls, [
      { method: "createTask", args: [{ title: "Build MCP", dueDate: "2026-08-22", priority: "high" }] },
      { method: "updateTask", args: ["task-1", { title: "Build Pulse MCP" }] },
      { method: "rescheduleTask", args: ["task-1", { dueAt: "2026-08-23T03:00:00.000Z", reminderAt: "2026-08-23T02:30:00.000Z" }] },
      { method: "moveTask", args: ["task-1", { projectId: "project-1", sectionId: "section-1" }] },
      { method: "completeTask", args: ["task-1"] },
      { method: "reopenTask", args: ["task-1"] },
      { method: "cancelTask", args: ["task-1"] },
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});
test("bulk and collaboration tools use semantic API calls", async () => {
  const { api, calls } = makeApi();
  const { client, server } = await connect(api);
  try {
    await client.callTool({ name: "bulk_complete_tasks", arguments: { ids: ["a", "b"] } });
    await client.callTool({ name: "bulk_reschedule_tasks", arguments: { ids: ["a", "b"], dueDate: "2026-08-24" } });
    await client.callTool({ name: "bulk_move_tasks", arguments: { ids: ["a", "b"], projectId: "project-2" } });
    await client.callTool({ name: "get_projects", arguments: {} });
    await client.callTool({ name: "get_labels", arguments: {} });
    await client.callTool({ name: "add_comment", arguments: { id: "a", body: "From Hermes" } });
    await client.callTool({ name: "get_task_activity", arguments: { id: "a" } });
    assert.deepEqual(calls.map((call) => call.method), [
      "bulkComplete", "bulkReschedule", "bulkMove", "listProjects", "listTags", "createComment", "getTaskHistory",
    ]);
  } finally {
    await client.close();
    await server.close();
  }
});

test("invalid date-only input is rejected before the API call", async () => {
  const { api, calls } = makeApi();
  const { client, server } = await connect(api);
  try {
    const result = await client.callTool({ name: "create_task", arguments: { title: "Bad date", dueDate: "tomorrow" } });
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  } finally {
    await client.close();
    await server.close();
  }
});
