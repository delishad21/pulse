import type { Comment, Operation, Project, Reminder, Tag, Task, TaskEvent, UserId } from "@pulse/domain";
import type { BulkUpdateInput, CreateCommentInput, CreateProjectInput, CreateReminderInput, CreateTagInput, CreateTaskInput, UpdateCommentInput, UpdateProjectInput, UpdateReminderInput, UpdateTagInput, UpdateTaskInput } from "@pulse/api-client";

export interface TaskFilters { status?: "open" | "completed" | "cancelled"; projectId?: string; }
export interface TaskSnapshot { taskId: string; before: Record<string, unknown>; }

export interface TaskRepository {
  list(userId: UserId, filters?: TaskFilters): Promise<Task[]>;
  create(userId: UserId, input: CreateTaskInput): Promise<Task>;
  get(userId: UserId, id: string): Promise<Task>;
  update(userId: UserId, id: string, input: UpdateTaskInput): Promise<Task>;
  delete(userId: UserId, id: string): Promise<void>;
  complete(userId: UserId, id: string, completedAt: Date): Promise<Task>;
  reopen(userId: UserId, id: string): Promise<Task>;
  cancel(userId: UserId, id: string): Promise<Task>;
  bulkComplete(userId: UserId, ids: string[], completedAt: Date): Promise<Task[]>;
  bulkDelete(userId: UserId, ids: string[]): Promise<void>;
  bulkUpdate(userId: UserId, input: BulkUpdateInput): Promise<Task[]>;
  search(userId: UserId, query: string): Promise<Task[]>;
  captureSnapshot(userId: UserId, id: string): Promise<TaskSnapshot>;
  restoreSnapshot(userId: UserId, snapshot: TaskSnapshot): Promise<void>;
}

export interface ViewRepository {
  inbox(userId: UserId, includeCompleted?: boolean): Promise<Task[]>;
  today(userId: UserId, now: Date, timezone: string, includeCompleted?: boolean): Promise<Task[]>;
  upcoming(userId: UserId, now: Date, timezone: string, includeCompleted?: boolean): Promise<Task[]>;
  overdue(userId: UserId, now: Date, timezone: string): Promise<Task[]>;
  completed(userId: UserId): Promise<Task[]>;
  focus(userId: UserId, now: Date, timezone: string): Promise<Task[]>;
}

export interface ProjectRepository {
  list(userId: UserId): Promise<Project[]>; create(userId: UserId, input: CreateProjectInput): Promise<Project>; get(userId: UserId, id: string): Promise<Project>; update(userId: UserId, id: string, input: UpdateProjectInput): Promise<Project>; archive(userId: UserId, id: string): Promise<Project>; delete(userId: UserId, id: string): Promise<void>;
}
export interface TagRepository {
  list(userId: UserId): Promise<Tag[]>; create(userId: UserId, input: CreateTagInput): Promise<Tag>; update(userId: UserId, id: string, input: UpdateTagInput): Promise<Tag>; delete(userId: UserId, id: string): Promise<void>; getByName(userId: UserId, name: string): Promise<Tag | null>; verifyBelongToUser(userId: UserId, ids: string[]): Promise<void>;
}
export interface CommentRepository {
  list(userId: UserId, taskId: string): Promise<Comment[]>; create(userId: UserId, taskId: string, input: CreateCommentInput): Promise<Comment>; update(userId: UserId, taskId: string, id: string, input: UpdateCommentInput): Promise<Comment>; delete(userId: UserId, taskId: string, id: string): Promise<void>;
}
export interface ReminderRepository {
  list(userId: UserId, taskId: string): Promise<Reminder[]>; create(userId: UserId, taskId: string, input: CreateReminderInput): Promise<Reminder>; update(userId: UserId, id: string, input: UpdateReminderInput): Promise<Reminder>; delete(userId: UserId, id: string): Promise<void>;
}
export interface EventRepository {
  list(userId: UserId, taskId?: string): Promise<TaskEvent[]>; record(userId: UserId, taskId: string, kind: string, payload?: unknown): Promise<TaskEvent>;
}
export interface OperationRepository {
  record(userId: UserId, kind: string, payload: unknown, taskId?: string): Promise<Operation>; list(userId: UserId): Promise<Operation[]>; undoLast(userId: UserId): Promise<Operation>; undo(userId: UserId, id: string): Promise<Operation>; redoLast(userId: UserId): Promise<Operation>; redo(userId: UserId, id: string): Promise<Operation>;
}
export interface PulseRepository {
  tasks: TaskRepository; views: ViewRepository; projects: ProjectRepository; tags: TagRepository; comments: CommentRepository; reminders: ReminderRepository; events: EventRepository; operations: OperationRepository; healthCheck(): Promise<{ database: "connected" | "in-memory" | "disconnected" }>;
}
