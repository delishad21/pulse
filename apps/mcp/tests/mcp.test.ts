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
test("lists the seven initial Pulse tools", async () => {
  const { api } = makeApi();
  const { client, server } = await connect(api);
  try {
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((tool) => tool.name).sort(),
      ["complete_task", "create_task", "get_inbox", "get_today", "reschedule_task", "search_tasks", "update_task"],
    );
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
    const inbox = await client.callTool({ name: "get_inbox", arguments: {} });
    const search = await client.callTool({ name: "search_tasks", arguments: { query: "server" } });
    assert.equal((today.structuredContent as { tasks: Task[] }).tasks[0]?.id, "task-1");
    assert.equal((inbox.structuredContent as { tasks: Task[] }).tasks[0]?.id, "inbox-1");
    assert.equal((search.structuredContent as { tasks: Task[] }).tasks[0]?.title, "server");
    assert.deepEqual(calls.map((call) => call.method), ["getToday", "getInbox", "searchTasks"]);
  } finally {
    await client.close();
    await server.close();
  }
});
test("mutation tools preserve semantic scheduling fields", async () => {
  const { api, calls } = makeApi();
  const { client, server } = await connect(api);
  try {
    await client.callTool({ name: "create_task", arguments: { title: "Build MCP", dueDate: "2026-08-22", priority: "high" } });
    await client.callTool({ name: "update_task", arguments: { id: "task-1", title: "Build Pulse MCP" } });
    await client.callTool({ name: "complete_task", arguments: { id: "task-1" } });
    await client.callTool({ name: "reschedule_task", arguments: { id: "task-1", dueAt: "2026-08-23T03:00:00.000Z", reminderAt: "2026-08-23T02:30:00.000Z" } });

    assert.deepEqual(calls, [
      { method: "createTask", args: [{ title: "Build MCP", dueDate: "2026-08-22", priority: "high" }] },
      { method: "updateTask", args: ["task-1", { title: "Build Pulse MCP" }] },
      { method: "completeTask", args: ["task-1"] },
      { method: "rescheduleTask", args: ["task-1", { dueAt: "2026-08-23T03:00:00.000Z", reminderAt: "2026-08-23T02:30:00.000Z" }] },
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
    const result = await client.callTool({
      name: "create_task",
      arguments: { title: "Bad date", dueDate: "tomorrow" },
    });
    assert.equal(result.isError, true);
    assert.equal(calls.length, 0);
  } finally {
    await client.close();
    await server.close();
  }
});