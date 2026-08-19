import type { TaskId } from "@pulse/domain";

export interface WidgetTaskItem {
  id: TaskId;
  title: string;
  dueLabel: string | null;
  isOverdue: boolean;
}

export interface TodayWidgetSnapshot {
  generatedAt: string;
  openCount: number;
  tasks: WidgetTaskItem[];
}

export type WidgetAction =
  | { type: "complete"; taskId: TaskId }
  | { type: "open-task"; taskId: TaskId }
  | { type: "create-task" };
