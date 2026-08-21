import { McpServer } from "@modelcontextprotocol/server";
import {
  PulseApiClient,
  PulseApiError,
  type CreateTaskInput,
  type Task,
  type UpdateTaskInput,
} from "@pulse/api-client";
import { z } from "zod";

export type PulseMcpApi = Pick<
  PulseApiClient,
  | "getToday"
  | "getInbox"
  | "searchTasks"
  | "createTask"
  | "updateTask"
  | "completeTask"
  | "rescheduleTask"
  | "getTask"
  | "getUpcoming"
  | "getOverdue"
  | "reopenTask"
  | "cancelTask"
  | "moveTask"
  | "bulkComplete"
  | "bulkReschedule"
  | "bulkMove"
  | "listProjects"
  | "listTags"
  | "createComment"
  | "getTaskHistory"
>;

const prioritySchema = z.enum(["none", "low", "medium", "high", "urgent"]);
const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const createTaskSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().nullable().optional(),
  priority: prioritySchema.optional(),
  dueDate: dateOnlySchema.nullable().optional(),
  dueAt: z.string().nullable().optional(),
  reminderAt: z.string().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().min(1),
});

const taskIdSchema = z.object({ id: z.string().min(1) });
const moveTaskSchema = taskIdSchema.extend({
  projectId: z.string().nullable(),
  sectionId: z.string().nullable().optional(),
});
const bulkIdsSchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(1000) });
const bulkMoveSchema = bulkIdsSchema.extend({
  projectId: z.string().nullable(),
  sectionId: z.string().nullable().optional(),
});
const bulkRescheduleSchema = bulkIdsSchema.extend({
  dueDate: dateOnlySchema.nullable().optional(),
  dueAt: z.string().nullable().optional(),
  reminderAt: z.string().nullable().optional(),
});
const commentSchema = taskIdSchema.extend({ body: z.string().trim().min(1).max(10000) });

const rescheduleTaskSchema = z.object({
  id: z.string().min(1),
  dueDate: dateOnlySchema.nullable().optional(),
  dueAt: z.string().nullable().optional(),
  reminderAt: z.string().nullable().optional(),
  recurrenceRule: z.string().nullable().optional(),
});
type Structured = Record<string, unknown>;

function success(data: Structured) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown Pulse MCP error";
  const code = error instanceof PulseApiError ? error.code : "MCP_TOOL_ERROR";
  return {
    isError: true,
    content: [{ type: "text" as const, text: `${code}: ${message}` }],
  };
}

async function run(action: () => Promise<Structured>) {
  try {
    return success(await action());
  } catch (error) {
    return failure(error);
  }
}

function tasksResult(tasks: Task[]): Structured {
  return { tasks };
}
export function createPulseMcpServer(api: PulseMcpApi): McpServer {
  const server = new McpServer({ name: "pulse", version: "0.1.0" });

  server.registerTool(
    "get_today",
    {
      description: "Get the user's open tasks due today.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => run(async () => tasksResult(await api.getToday())),
  );

  server.registerTool(
    "get_inbox",
    {
      description: "Get the user's open inbox tasks.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    },
    async () => run(async () => tasksResult(await api.getInbox())),
  );

  server.registerTool(
    "search_tasks",
    {
      description: "Search Pulse tasks by text.",
      inputSchema: z.object({ query: z.string().trim().min(1) }),
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => run(async () => tasksResult(await api.searchTasks(query))),
  );

  server.registerTool(
    "create_task",
    {
      description: "Create a Pulse task. Use dueDate for date-only tasks and dueAt only for explicit times.",
      inputSchema: createTaskSchema,
    },
    async (input) => run(async () => ({ task: await api.createTask(input as CreateTaskInput) })),
  );

  server.registerTool(
    "update_task",
    {
      description: "Update fields on an existing Pulse task without changing unspecified fields.",
      inputSchema: updateTaskSchema,
    },
    async ({ id, ...input }) =>
      run(async () => ({ task: await api.updateTask(id, input as UpdateTaskInput) })),
  );

  server.registerTool(
    "complete_task",
    {
      description: "Mark an existing Pulse task completed.",
      inputSchema: z.object({ id: z.string().min(1) }),
    },
    async ({ id }) => run(async () => ({ task: await api.completeTask(id) })),
  );
  server.registerTool(
    "reschedule_task",
    {
      description: "Change due date/time, reminder, or recurrence for a task.",
      inputSchema: rescheduleTaskSchema,
    },
    async ({ id, ...input }) =>
      run(async () => ({ task: await api.rescheduleTask(id, input) })),
  );

  server.registerTool("get_task", { description: "Get one Pulse task by id.", inputSchema: taskIdSchema, annotations: { readOnlyHint: true } }, async ({ id }) => run(async () => ({ task: await api.getTask(id) })));
  server.registerTool("get_upcoming", { description: "Get upcoming open Pulse tasks.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () => run(async () => tasksResult(await api.getUpcoming())));
  server.registerTool("get_overdue", { description: "Get overdue open Pulse tasks.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () => run(async () => tasksResult(await api.getOverdue())));
  server.registerTool("reopen_task", { description: "Reopen a completed Pulse task.", inputSchema: taskIdSchema }, async ({ id }) => run(async () => ({ task: await api.reopenTask(id) })));
  server.registerTool("cancel_task", { description: "Cancel a Pulse task without hard deleting it.", inputSchema: taskIdSchema }, async ({ id }) => run(async () => ({ task: await api.cancelTask(id) })));
  server.registerTool("move_task", { description: "Move a Pulse task to a project and optional section.", inputSchema: moveTaskSchema }, async ({ id, projectId, sectionId }) => run(async () => ({ task: await api.moveTask(id, { projectId, sectionId }) })));
  server.registerTool("bulk_complete_tasks", { description: "Complete multiple Pulse tasks as one bulk operation.", inputSchema: bulkIdsSchema }, async ({ ids }) => run(async () => tasksResult(await api.bulkComplete({ ids }))));
  server.registerTool("bulk_reschedule_tasks", { description: "Reschedule multiple Pulse tasks.", inputSchema: bulkRescheduleSchema }, async ({ ids, ...schedule }) => run(async () => tasksResult(await api.bulkReschedule({ ids, ...schedule }))));
  server.registerTool("bulk_move_tasks", { description: "Move multiple Pulse tasks to a project and optional section.", inputSchema: bulkMoveSchema }, async ({ ids, projectId, sectionId }) => run(async () => tasksResult(await api.bulkMove({ ids, projectId, sectionId }))));
  server.registerTool("get_projects", { description: "List Pulse projects.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () => run(async () => ({ projects: await api.listProjects() })));
  server.registerTool("get_labels", { description: "List Pulse labels.", inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async () => run(async () => ({ labels: await api.listTags() })));
  server.registerTool("add_comment", { description: "Add a comment to a Pulse task.", inputSchema: commentSchema }, async ({ id, body }) => run(async () => ({ comment: await api.createComment(id, { body }) })));
  server.registerTool("get_task_activity", { description: "Get the activity history for a Pulse task.", inputSchema: taskIdSchema, annotations: { readOnlyHint: true } }, async ({ id }) => run(async () => ({ events: await api.getTaskHistory(id) })));

  return server;
}

export function createDefaultPulseApi(): PulseApiClient {
  const baseUrl = process.env.PULSE_API_BASE_URL ?? "http://127.0.0.1:4000";
  const token = process.env.PULSE_API_TOKEN ?? null;
  return new PulseApiClient({
    baseUrl,
    getAccessToken: token ? async () => token : undefined,
  });
}
