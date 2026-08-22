import type { Task } from "@pulse/api-client";

export function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function taskDateKey(task: Task): string | null {
  if (task.startAt) return localDateKey(new Date(task.startAt));
  if (task.due.at) return localDateKey(new Date(task.due.at));
  if (task.due.date) return task.due.date;
  return null;
}

export function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateHeaderLabel(key: string, now = new Date()): string {
  const today = localDateKey(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === today) return "Today";
  if (key === localDateKey(tomorrow)) return "Tomorrow";
  return parseLocalDateKey(key).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
}

export function groupTasksByDate(tasks: Task[]): Array<{ key: string | null; label: string; tasks: Task[] }> {
  const groups = new Map<string | null, Task[]>();
  for (const task of tasks) {
    const key = taskDateKey(task);
    const group = groups.get(key) ?? [];
    group.push(task);
    groups.set(key, group);
  }
  const keys = [...groups.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a.localeCompare(b);
  });
  return keys.map((key) => ({ key, label: key ? dateHeaderLabel(key) : "No date", tasks: groups.get(key) ?? [] }));
}

export function startOfCurrentWeek(now = new Date()): Date {
  const value = new Date(now);
  value.setHours(0, 0, 0, 0);
  const mondayOffset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - mondayOffset);
  return value;
}

export function weekDays(now = new Date()): Date[] {
  const monday = startOfCurrentWeek(now);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

export function monthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = startOfCurrentWeek(first);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}
