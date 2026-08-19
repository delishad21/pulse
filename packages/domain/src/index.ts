export type TaskId = string;
export type UserId = string;
export type TaskStatus = "open" | "completed";

export interface TaskDue {
  date: string | null; // YYYY-MM-DD, intentionally date-only
  at: string | null;   // ISO instant, only when user specified a time
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
