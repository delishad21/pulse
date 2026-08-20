export type TaskId = string;
export type UserId = string;
export type TaskStatus = "open" | "completed";

export interface TaskDue {
  date: string | null; // YYYY-MM-DD, intentionally date-only
  at: string | null;   // ISO instant, only when user specified a time
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
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${field} must be a valid ISO instant`);
  }
  return value;
}

export function normalizeTaskSchedule(input: TaskScheduleInput): TaskSchedule {
  const dueDate = input.dueDate ?? null;
  const dueAt = input.dueAt ?? null;
  const reminderAt = input.reminderAt == null
    ? null
    : requireValidInstant(input.reminderAt, "reminderAt");

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
      // A date-only task remains date-only; never synthesize midnight here.
      at: dueAt === null ? null : requireValidInstant(dueAt, "dueAt"),
    },
    reminderAt,
  };
}

export interface Task {
  id: TaskId;
  userId: UserId;
  title: string;
  description: string | null;
  status: TaskStatus;
  due: TaskDue;
  reminderAt: string | null;
  completedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
