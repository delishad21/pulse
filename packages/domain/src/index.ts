export type TaskId = string;
export type UserId = string;
export type ProjectId = string;
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
  startAt?: string | null;
  endAt?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
}

export interface TaskSchedule {
  startAt: string | null;
  endAt: string | null;
  due: TaskDue;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function requireValidInstant(value: string, field: string): string {
  if (Number.isNaN(Date.parse(value))) throw new Error(`${field} must be a valid ISO instant`);
  return value;
}

export function requireValidDateOnly(value: string, field = "date"): string {
  if (!DATE_ONLY.test(value)) throw new Error(`${field} must use YYYY-MM-DD and must not include a time`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`${field} must be a real calendar date`);
  return value;
}

export function normalizeTaskSchedule(input: TaskScheduleInput): TaskSchedule {
  const startAt = input.startAt == null ? null : requireValidInstant(input.startAt, "startAt");
  const endAt = input.endAt == null ? null : requireValidInstant(input.endAt, "endAt");
  const dueDate = input.dueDate ?? null;
  const dueAt = input.dueAt == null ? null : requireValidInstant(input.dueAt, "dueAt");
  if (dueDate !== null) requireValidDateOnly(dueDate, "dueDate");
  if (dueDate !== null && dueAt !== null) throw new Error("Use either dueDate or dueAt, not both");
  if (endAt !== null && startAt === null) throw new Error("endAt requires startAt");
  if (startAt !== null && endAt !== null && new Date(endAt) < new Date(startAt)) throw new Error("endAt must not be before startAt");
  return { startAt, endAt, due: { date: dueDate, at: dueAt } };
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

export interface Task {
  id: TaskId;
  userId: UserId;
  title: string;
  description: string | null;
  location: string | null;
  status: TaskStatus;
  priority: Priority;
  startAt: string | null;
  endAt: string | null;
  due: TaskDue;
  recurrenceRule: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  projectId: ProjectId | null;
  parentTaskId: TaskId | null;
  sortOrder: number;
  revision: number;
  tags: Tag[];
  reminders: Reminder[];
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

export interface Comment {
  id: CommentId;
  taskId: TaskId;
  userId: UserId;
  body: string;
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

export const priorityWeight: Record<Priority, number> = { none: 0, low: 1, medium: 2, high: 3, urgent: 4 };
export const priorityLabel: Record<Priority, string> = { none: "None", low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };

export function compareTasksByPriority(a: Task, b: Task): number {
  return priorityWeight[b.priority] - priorityWeight[a.priority];
}

export type TaskView = "inbox" | "today" | "upcoming" | "overdue" | "completed" | "focus";

export function formatDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
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
    const next = desired - (represented - guess);
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

export function taskViewDate(task: Task, timezone = "UTC"): string | null {
  if (task.startAt) return formatDateInTimezone(new Date(task.startAt), timezone);
  if (task.due.at) return formatDateInTimezone(new Date(task.due.at), timezone);
  return task.due.date;
}

function taskSortInstant(task: Task): Date | null {
  if (task.startAt) return new Date(task.startAt);
  if (task.due.at) return new Date(task.due.at);
  if (task.due.date) return new Date(`${task.due.date}T00:00:00Z`);
  return null;
}

export function isTaskInInbox(task: Task): boolean {
  return task.status === "open" && task.projectId === null && task.deletedAt === null;
}

export function isTaskDueToday(task: Task, now: Date, timezone = "UTC"): boolean {
  if (task.status !== "open" || task.deletedAt !== null) return false;
  return taskViewDate(task, timezone) === dayBoundsInTimezone(now, timezone).date;
}

export function isTaskUpcoming(task: Task, now: Date, timezone = "UTC"): boolean {
  if (task.status !== "open" || task.deletedAt !== null) return false;
  const date = taskViewDate(task, timezone);
  return date !== null && date > dayBoundsInTimezone(now, timezone).date;
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
  return [...tasks].sort((a, b) => {
    const timeA = taskSortInstant(a); const timeB = taskSortInstant(b);
    if (timeA && timeB && timeA.getTime() !== timeB.getTime()) return timeA.getTime() - timeB.getTime();
    if (timeA && !timeB) return -1; if (!timeA && timeB) return 1;
    const priorityDiff = compareTasksByPriority(a, b);
    return priorityDiff || a.sortOrder - b.sortOrder || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
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
const WEEKDAY_CODES: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

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

function dateOnlyToUtc(value: string): Date {
  requireValidDateOnly(value);
  return new Date(`${value}T00:00:00Z`);
}
function utcDateOnly(value: Date): string { return value.toISOString().slice(0, 10); }
function addDays(value: string, days: number): string { const d=dateOnlyToUtc(value); d.setUTCDate(d.getUTCDate()+days); return utcDateOnly(d); }
function dayOrdinal(value: string): number { return Math.floor(dateOnlyToUtc(value).getTime() / 86_400_000); }
function monthsBetween(anchor: string, candidate: string): number { const a=dateOnlyToUtc(anchor), c=dateOnlyToUtc(candidate); return (c.getUTCFullYear()-a.getUTCFullYear())*12 + c.getUTCMonth()-a.getUTCMonth(); }
function weekday(value: string): Weekday { return WEEKDAY_CODES[dateOnlyToUtc(value).getUTCDay()]!; }
function mondayOrdinal(value: string): number { const d=dateOnlyToUtc(value); const offset=(d.getUTCDay()+6)%7; return dayOrdinal(value)-offset; }
function clampedDay(year:number, month:number, day:number): number { return Math.min(day, new Date(Date.UTC(year, month+1, 0)).getUTCDate()); }

function matchesRecurrenceDate(anchor: string, candidate: string, spec: RecurrenceSpec): boolean {
  const interval = spec.interval ?? 1;
  if (candidate <= anchor) return false;
  const diffDays = dayOrdinal(candidate) - dayOrdinal(anchor);
  if (spec.frequency === "daily") return diffDays > 0 && diffDays % interval === 0;
  if (spec.frequency === "weekly") {
    const diffWeeks = Math.floor((mondayOrdinal(candidate) - mondayOrdinal(anchor)) / 7);
    const allowed = spec.byWeekday?.length ? spec.byWeekday : [weekday(anchor)];
    return diffWeeks >= 0 && diffWeeks % interval === 0 && allowed.includes(weekday(candidate));
  }
  const a = dateOnlyToUtc(anchor), c = dateOnlyToUtc(candidate);
  if (spec.frequency === "monthly") {
    const diffMonths = monthsBetween(anchor, candidate);
    return diffMonths > 0 && diffMonths % interval === 0 && c.getUTCDate() === clampedDay(c.getUTCFullYear(), c.getUTCMonth(), a.getUTCDate());
  }
  const diffYears = c.getUTCFullYear() - a.getUTCFullYear();
  return diffYears > 0 && diffYears % interval === 0 && c.getUTCMonth() === a.getUTCMonth() && c.getUTCDate() === clampedDay(c.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
}

function recurrenceWithinUntil(candidate: Date, spec: RecurrenceSpec): boolean {
  return !spec.until || candidate.getTime() <= new Date(spec.until).getTime();
}

export function nextRecurrenceDate(anchorDate: string, rule: string, afterDate: string): string | null {
  requireValidDateOnly(anchorDate, "anchorDate"); requireValidDateOnly(afterDate, "afterDate");
  const spec = parseRecurrenceRule(rule);
  if (spec.count === 1) return null;
  let candidate = addDays(afterDate > anchorDate ? afterDate : anchorDate, 1);
  for (let i=0; i<36_600; i+=1, candidate=addDays(candidate,1)) {
    if (!matchesRecurrenceDate(anchorDate, candidate, spec)) continue;
    if (!recurrenceWithinUntil(new Date(`${candidate}T23:59:59.999Z`), spec)) return null;
    return candidate;
  }
  throw new Error("Unable to find next recurrence within 100 years");
}

export function nextRecurrenceInstant(anchorIso: string, rule: string, after: Date): string | null {
  const anchor = new Date(requireValidInstant(anchorIso, "anchorIso"));
  const spec = parseRecurrenceRule(rule);
  if (spec.count === 1) return null;
  const anchorDate = utcDateOnly(anchor);
  const afterDate = utcDateOnly(after);
  const timeMs = anchor.getUTCHours()*3_600_000 + anchor.getUTCMinutes()*60_000 + anchor.getUTCSeconds()*1000 + anchor.getUTCMilliseconds();
  let candidateDate = afterDate > anchorDate ? afterDate : anchorDate;
  for (let i=0; i<36_600; i+=1, candidateDate=addDays(candidateDate,1)) {
    if (!matchesRecurrenceDate(anchorDate, candidateDate, spec)) continue;
    const candidate = new Date(dateOnlyToUtc(candidateDate).getTime()+timeMs);
    if (candidate <= after) continue;
    if (!recurrenceWithinUntil(candidate, spec)) return null;
    return candidate.toISOString();
  }
  throw new Error("Unable to find next recurrence within 100 years");
}

export function recurrenceRuleForNextOccurrence(rule: string): string | null {
  const spec = parseRecurrenceRule(rule);
  if (spec.count == null) return rule;
  if (spec.count <= 1) return null;
  return generateRecurrenceRule({ ...spec, count: spec.count - 1 });
}
