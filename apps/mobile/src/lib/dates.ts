import type { Task } from "@pulse/domain";

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function taskDateKey(task: Task): string | null {
  const instant = task.startAt ?? task.due.at;
  if (instant) return localDateKey(new Date(instant));
  return task.due.date;
}

export function taskIsOverdue(task: Task, now = new Date()): boolean {
  if (task.status !== "open") return false;
  if (task.due.at) return new Date(task.due.at) < now;
  return Boolean(task.due.date && task.due.date < localDateKey(now));
}

export function formatTaskDate(task: Task): string | null {
  if (task.startAt || task.due.at) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(task.startAt ?? task.due.at!));
  }
  if (task.due.date) {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${task.due.date}T12:00:00Z`));
  }
  return null;
}

export function formatDayHeading(dateKey: string): string {
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" }).format(new Date(`${dateKey}T12:00:00Z`));
}

export function addDays(dateKey: string, amount: number): string {
  const value = new Date(`${dateKey}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function startOfWeek(dateKey: string): string {
  const value = new Date(`${dateKey}T12:00:00Z`);
  const mondayOffset = (value.getUTCDay() + 6) % 7;
  return addDays(dateKey, -mondayOffset);
}
