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
