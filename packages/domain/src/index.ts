export type TaskId = string;
export type UserId = string;
export type ProjectId = string;
export type SectionId = string | null;
export type TagId = string;
export type CommentId = string;
export type OperationId = string;
export type ReminderId = string;
export type TaskEventId = string;

export type TaskStatus = "open" | "completed" | "cancelled";
export type Priority = "none" | "low" | "medium" | "high" | "urgent";
export type ProjectStatus = "active" | "archived" | "completed";

export interface TaskDue {
  date: string | null;
  at: string | null;
}

export interface TaskScheduleInput {
  dueDate?: string | null;
  dueAt?: string | null;
  reminderAt?: string | null;
}

export interface TaskSchedule {
  due: TaskDue;
  reminderAt: string | null;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function requireValidInstant(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid ISO instant`);
  return value;
}

export function normalizeTaskSchedule(input: TaskScheduleInput): TaskSchedule {
  const dueDate = input.dueDate ?? null;
  const dueAt = input.dueAt ?? null;
  const reminderAt = input.reminderAt == null ? null : requireValidInstant(input.reminderAt, "reminderAt");
  if (dueDate !== null && !DATE_ONLY.test(dueDate)) {
    throw new Error("dueDate must use YYYY-MM-DD and must not include a time");
  }
  if (dueDate !== null) {
    const parsedDate = new Date(`${dueDate}T00:00:00Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dueDate) {
      throw new Error("dueDate must be a real calendar date");
    }
  }
  return {
    due: {
      date: dueDate,
      at: dueAt === null || dueDate !== null ? null : requireValidInstant(dueAt, "dueAt"),
    },
    reminderAt,
  };
}

export interface Tag {
  id: TagId;
  userId: UserId;
  name: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Task {
  id: TaskId;
  userId: UserId;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due: TaskDue;
  reminderAt: string | null;
  recurrenceRule: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  projectId: ProjectId | null;
  sectionId: SectionId;
  parentTaskId: TaskId | null;
  sortOrder: number;
  revision: number;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: ProjectId;
  userId: UserId;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  status: ProjectStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  deletedAt: string | null;
}

export interface Section {
  id: string;
  projectId: ProjectId;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Comment {
  id: CommentId;
  taskId: TaskId;
  userId: UserId;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Reminder {
  id: ReminderId;
  taskId: TaskId;
  userId: UserId;
  remindAt: string;
  channel: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TaskEvent {
  id: TaskEventId;
  taskId: TaskId;
  userId: UserId;
  kind: string;
  payload: unknown;
  createdAt: string;
}

export interface Operation {
  id: OperationId;
  userId: UserId;
  kind: string;
  payload: unknown;
  undoneAt: string | null;
  createdAt: string;
}

export const priorityWeight: Record<Priority, number> = {
  none: 0, low: 1, medium: 2, high: 3, urgent: 4,
};

export function compareTasksByPriority(a: Task, b: Task): number {
  return priorityWeight[b.priority] - priorityWeight[a.priority];
}

export type TaskView = "inbox" | "today" | "upcoming" | "overdue" | "completed" | "focus";

export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function zonedMidnightUtc(dateOnly: string, timezone: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  const desired = Date.UTC(year!, month! - 1, day!, 0, 0, 0, 0);
  let guess = desired;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  for (let i = 0; i < 4; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const offset = represented - guess;
    const next = desired - offset;
    if (Math.abs(next - guess) < 1000) return new Date(next);
    guess = next;
  }
  return new Date(guess);
}

export function dayBoundsInTimezone(now: Date, timezone = "UTC"): { date: string; start: Date; end: Date; nextDate: string } {
  const date = formatDateInTimezone(now, timezone);
  const start = zonedMidnightUtc(date, timezone);
  const nextProbe = new Date(start.getTime() + 36 * 60 * 60 * 1000);
  const nextDate = formatDateInTimezone(nextProbe, timezone);
  const nextStart = zonedMidnightUtc(nextDate, timezone);
  return { date, start, end: new Date(nextStart.getTime() - 1), nextDate };
}

function taskDueInstant(task: Task): Date | null {
  if (task.due.at) return new Date(task.due.at);
  if (task.due.date) return new Date(`${task.due.date}T00:00:00Z`);
  return null;
}

export function isTaskInInbox(task: Task): boolean {
  return task.status === "open" && task.projectId === null && task.deletedAt === null;
}

export function isTaskDueToday(task: Task, now: Date, timezone = "UTC"): boolean {
  if (task.status !== "open" || task.deletedAt !== null) return false;
  const bounds = dayBoundsInTimezone(now, timezone);
  if (task.due.date) return task.due.date === bounds.date;
  if (task.due.at) { const due = new Date(task.due.at); return due >= bounds.start && due <= bounds.end; }
  if (task.reminderAt) { const reminder = new Date(task.reminderAt); return reminder >= bounds.start && reminder <= bounds.end; }
  return false;
}

export function isTaskUpcoming(task: Task, now: Date, timezone = "UTC"): boolean {
  if (task.status !== "open" || task.deletedAt !== null) return false;
  const bounds = dayBoundsInTimezone(now, timezone);
  if (task.due.date) return task.due.date > bounds.date;
  if (task.due.at) return new Date(task.due.at) > bounds.end;
  if (task.reminderAt) return new Date(task.reminderAt) > bounds.end;
  return false;
}

export function isTaskOverdue(task: Task, now: Date, timezone = "UTC"): boolean {
  if (task.status !== "open" || task.deletedAt !== null) return false;
  const bounds = dayBoundsInTimezone(now, timezone);
  if (task.due.date) return task.due.date < bounds.date;
  if (task.due.at) return new Date(task.due.at) < now;
  return false;
}

export function isTaskCompleted(task: Task): boolean {
  return task.status === "completed" && task.deletedAt === null;
}

export function isTaskFocus(task: Task, now: Date, timezone = "UTC"): boolean {
  if (task.status !== "open" || task.deletedAt !== null) return false;
  return task.priority === "urgent" || task.priority === "high" || isTaskDueToday(task, now, timezone) || isTaskOverdue(task, now, timezone);
}

export function sortTasksForView(tasks: Task[], _view: Exclude<TaskView, "completed">, _now?: Date): Task[] {
  const sorted = [...tasks];
  sorted.sort((a, b) => {
    const dueA = taskDueInstant(a); const dueB = taskDueInstant(b);
    if (dueA && dueB && dueA.getTime() !== dueB.getTime()) return dueA.getTime() - dueB.getTime();
    if (dueA && !dueB) return -1; if (!dueA && dueB) return 1;
    const priorityDiff = compareTasksByPriority(a, b);
    if (priorityDiff !== 0) return priorityDiff;
    return a.sortOrder - b.sortOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  return sorted;
}

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";
export interface RecurrenceSpec {
  frequency: RecurrenceFrequency;
  interval?: number;
  byWeekday?: Weekday[];
  until?: string | null;
  count?: number | null;
}

const FREQ_TO_RRULE: Record<RecurrenceFrequency, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY" };
const RRULE_TO_FREQ: Record<string, RecurrenceFrequency> = { DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly", YEARLY: "yearly" };

export function generateRecurrenceRule(spec: RecurrenceSpec): string {
  const interval = spec.interval ?? 1;
  if (!Number.isInteger(interval) || interval < 1) throw new Error("interval must be a positive integer");
  if (spec.count != null && (!Number.isInteger(spec.count) || spec.count < 1)) throw new Error("count must be a positive integer");
  if (spec.until && Number.isNaN(Date.parse(spec.until))) throw new Error("until must be a valid ISO instant");
  const parts = [`FREQ=${FREQ_TO_RRULE[spec.frequency]}`];
  if (interval !== 1) parts.push(`INTERVAL=${interval}`);
  if (spec.byWeekday?.length) parts.push(`BYDAY=${spec.byWeekday.join(",")}`);
  if (spec.until) parts.push(`UNTIL=${new Date(spec.until).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`);
  if (spec.count != null) parts.push(`COUNT=${spec.count}`);
  return parts.join(";");
}

export function parseRecurrenceRule(rule: string): RecurrenceSpec {
  const values = Object.fromEntries(rule.split(";").map((part) => {
    const [key, ...rest] = part.split("="); return [key?.toUpperCase(), rest.join("=")];
  }));
  const frequency = RRULE_TO_FREQ[values.FREQ ?? ""];
  if (!frequency) throw new Error("RRULE must contain a supported FREQ");
  const spec: RecurrenceSpec = { frequency };
  if (values.INTERVAL) spec.interval = Number(values.INTERVAL);
  if (values.BYDAY) spec.byWeekday = values.BYDAY.split(",") as Weekday[];
  if (values.COUNT) spec.count = Number(values.COUNT);
  if (values.UNTIL) {
    const m = values.UNTIL.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
    if (!m) throw new Error("Unsupported UNTIL format");
    spec.until = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))).toISOString();
  }
  generateRecurrenceRule(spec);
  return spec;
}
