import type {
  Comment,
  Operation,
  Priority,
  Project,
  ProjectStatus,
  Reminder,
  Tag,
  Task,
  TaskEvent,
} from "@pulse/domain";

export interface PulseApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => Promise<string | null>;
}

export interface MobileUser { id: string; name: string; username: string; }
export interface MobileSession { accessToken: string; expiresAt: string; user: MobileUser; }
export interface MobileAuthConfig { authDisabled: boolean; registrationEnabled: boolean; }

export interface TaskReminderInput { remindAt: string; channel?: string; }

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  location?: string | null;
  priority?: Priority;
  startAt?: string | null;
  endAt?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  recurrenceRule?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  tagIds?: string[];
  reminders?: TaskReminderInput[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  location?: string | null;
  priority?: Priority;
  startAt?: string | null;
  endAt?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  recurrenceRule?: string | null;
  projectId?: string | null;
  parentTaskId?: string | null;
  sortOrder?: number;
  tagIds?: string[];
  reminders?: TaskReminderInput[];
}

export interface BulkUpdateInput {
  ids: string[];
  title?: string;
  priority?: Priority;
  startAt?: string | null;
  endAt?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  recurrenceRule?: string | null;
  projectId?: string | null;
  addTagIds?: string[];
  removeTagIds?: string[];
}

export interface CreateProjectInput { name: string; description?: string | null; color?: string | null; icon?: string | null; }
export interface UpdateProjectInput extends Partial<CreateProjectInput> { status?: ProjectStatus; }
export interface CreateTagInput { name: string; color?: string | null; }
export interface UpdateTagInput { name?: string; color?: string | null; }
export interface CreateCommentInput { body: string; }
export interface UpdateCommentInput { body: string; }
export interface CreateReminderInput { remindAt: string; channel?: string; }
export interface UpdateReminderInput { remindAt?: string; channel?: string; status?: string; }

export class PulseApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}

export class PulseApiClient {
  constructor(private readonly options: PulseApiClientOptions) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.options.getAccessToken?.();
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${this.options.baseUrl}${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = typeof data.error === "string" ? { message: data.error } : data.error;
      throw new PulseApiError(response.status, error?.code ?? "UNKNOWN_ERROR", error?.message ?? `Pulse API error: ${response.status}`, error?.details);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  getMobileAuthConfig(): Promise<MobileAuthConfig> { return this.request("GET", "/api/mobile-auth/config"); }
  loginMobile(input: { username: string; password: string }): Promise<MobileSession> { return this.request("POST", "/api/mobile-auth/login", input); }
  getMobileSession(): Promise<{ user: MobileUser }> { return this.request("GET", "/api/mobile-auth/me"); }

  listTasks(params?: Record<string, string>): Promise<Task[]> {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    return this.request("GET", `/api/tasks${qs}`);
  }
  createTask(input: CreateTaskInput): Promise<Task> { return this.request("POST", "/api/tasks", input); }
  getTask(id: string): Promise<Task> { return this.request("GET", `/api/tasks/${id}`); }
  updateTask(id: string, input: UpdateTaskInput): Promise<Task> { return this.request("PATCH", `/api/tasks/${id}`, input); }
  deleteTask(id: string): Promise<void> { return this.request("DELETE", `/api/tasks/${id}`); }
  completeTask(id: string): Promise<Task> { return this.request("POST", `/api/tasks/${id}/complete`); }
  reopenTask(id: string): Promise<Task> { return this.request("POST", `/api/tasks/${id}/reopen`); }
  cancelTask(id: string): Promise<Task> { return this.request("POST", `/api/tasks/${id}/cancel`); }
  moveTask(id: string, input: { projectId: string | null }): Promise<Task> { return this.request("POST", `/api/tasks/${id}/move`, input); }
  rescheduleTask(id: string, input: Pick<UpdateTaskInput, "startAt" | "endAt" | "dueDate" | "dueAt" | "recurrenceRule" | "reminders">): Promise<Task> { return this.request("POST", `/api/tasks/${id}/reschedule`, input); }
  setTaskLabels(id: string, tagIds: string[]): Promise<Task> { return this.request("POST", `/api/tasks/${id}/labels`, { tagIds }); }
  bulkComplete(input: { ids: string[] }): Promise<Task[]> { return this.request("POST", "/api/tasks/bulk/complete", input); }
  bulkDelete(input: { ids: string[] }): Promise<void> { return this.request("POST", "/api/tasks/bulk/delete", input); }
  bulkUpdate(input: BulkUpdateInput): Promise<Task[]> { return this.request("POST", "/api/tasks/bulk/update", input); }
  bulkMove(input: { ids: string[]; projectId: string | null }): Promise<Task[]> { return this.request("POST", "/api/tasks/bulk/move", input); }
  bulkReschedule(input: { ids: string[]; startAt?: string | null; endAt?: string | null; dueDate?: string | null; dueAt?: string | null }): Promise<Task[]> { return this.request("POST", "/api/tasks/bulk/reschedule", input); }
  bulkReorder(input: { updates: Array<{ id: string; sortOrder: number }> }): Promise<Task[]> { return this.request("POST", "/api/tasks/bulk/reorder", input); }

  getInbox(includeCompleted = false): Promise<Task[]> { return this.request("GET", `/api/views/inbox${includeCompleted ? "?includeCompleted=true" : ""}`); }
  getToday(includeCompleted = false): Promise<Task[]> { return this.request("GET", `/api/views/today${includeCompleted ? "?includeCompleted=true" : ""}`); }
  getUpcoming(includeCompleted = false): Promise<Task[]> { return this.request("GET", `/api/views/upcoming${includeCompleted ? "?includeCompleted=true" : ""}`); }
  getOverdue(): Promise<Task[]> { return this.request("GET", "/api/views/overdue"); }
  getCompleted(): Promise<Task[]> { return this.request("GET", "/api/views/completed"); }
  getFocus(): Promise<Task[]> { return this.request("GET", "/api/views/focus"); }
  searchTasks(query: string): Promise<Task[]> { return this.request("GET", `/api/search/tasks?q=${encodeURIComponent(query)}`); }

  listProjects(): Promise<Project[]> { return this.request("GET", "/api/projects"); }
  createProject(input: CreateProjectInput): Promise<Project> { return this.request("POST", "/api/projects", input); }
  getProject(id: string): Promise<Project> { return this.request("GET", `/api/projects/${id}`); }
  updateProject(id: string, input: UpdateProjectInput): Promise<Project> { return this.request("PATCH", `/api/projects/${id}`, input); }
  archiveProject(id: string): Promise<Project> { return this.request("POST", `/api/projects/${id}/archive`); }
  deleteProject(id: string): Promise<void> { return this.request("DELETE", `/api/projects/${id}`); }

  listTags(): Promise<Tag[]> { return this.request("GET", "/api/tags"); }
  createTag(input: CreateTagInput): Promise<Tag> { return this.request("POST", "/api/tags", input); }
  updateTag(id: string, input: UpdateTagInput): Promise<Tag> { return this.request("PATCH", `/api/tags/${id}`, input); }
  deleteTag(id: string): Promise<void> { return this.request("DELETE", `/api/tags/${id}`); }

  listComments(taskId: string): Promise<Comment[]> { return this.request("GET", `/api/tasks/${taskId}/comments`); }
  createComment(taskId: string, input: CreateCommentInput): Promise<Comment> { return this.request("POST", `/api/tasks/${taskId}/comments`, input); }
  updateComment(taskId: string, id: string, input: UpdateCommentInput): Promise<Comment> { return this.request("PATCH", `/api/tasks/${taskId}/comments/${id}`, input); }
  deleteComment(taskId: string, id: string): Promise<void> { return this.request("DELETE", `/api/tasks/${taskId}/comments/${id}`); }

  listReminders(taskId: string): Promise<Reminder[]> { return this.request("GET", `/api/tasks/${taskId}/reminders`); }
  createReminder(taskId: string, input: CreateReminderInput): Promise<Reminder> { return this.request("POST", `/api/tasks/${taskId}/reminders`, input); }
  updateReminder(id: string, input: UpdateReminderInput): Promise<Reminder> { return this.request("PATCH", `/api/reminders/${id}`, input); }
  deleteReminder(id: string): Promise<void> { return this.request("DELETE", `/api/reminders/${id}`); }

  listOperations(): Promise<Operation[]> { return this.request("GET", "/api/operations"); }
  undoOperation(id: string): Promise<Operation> { return this.request("POST", `/api/operations/${id}/undo`); }
  undoLast(): Promise<Operation> { return this.request("POST", "/api/operations/undo-last"); }
  redoOperation(id: string): Promise<Operation> { return this.request("POST", `/api/operations/${id}/redo`); }
  redoLast(): Promise<Operation> { return this.request("POST", "/api/operations/redo-last"); }
  listActivity(): Promise<TaskEvent[]> { return this.request("GET", "/api/activity"); }
  getTaskHistory(taskId: string): Promise<TaskEvent[]> { return this.request("GET", `/api/tasks/${taskId}/history`); }
}

export type { Comment, Operation, Project, Reminder, Tag, Task, TaskEvent } from "@pulse/domain";
