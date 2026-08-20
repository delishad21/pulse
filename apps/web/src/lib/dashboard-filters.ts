import { isOverdue, isToday } from "./utils.ts";
import type { Task } from "@pulse/api-client";

export type DashboardFilter =
  | { type: "all" }
  | { type: "inbox" }
  | { type: "today" }
  | { type: "upcoming" }
  | { type: "project"; projectId: string }
  | { type: "search"; q: string }
  | { type: "completed" }
  | {
      type: "filters";
      status?: "open" | "completed";
      projectId?: string;
      q?: string;
    };

export function filterTasks(
  tasks: Task[],
  filter: DashboardFilter,
): Task[] {
  switch (filter.type) {
    case "all":
      return tasks.filter((t) => t.status !== "completed");
    case "inbox":
      return tasks.filter(
        (t) => t.status !== "completed" && t.projectId === null,
      );
    case "today":
      return tasks.filter(
        (t) =>
          t.status !== "completed" &&
          (isToday(t.due.date) || isOverdue(t.due.date)),
      );
    case "upcoming":
      return tasks.filter(
        (t) =>
          t.status !== "completed" &&
          t.due.date !== null &&
          !isOverdue(t.due.date) &&
          !isToday(t.due.date),
      );
    case "project":
      return tasks.filter(
        (t) => t.status !== "completed" && t.projectId === filter.projectId,
      );
    case "search":
      return tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(filter.q.toLowerCase()) ||
          (t.description ?? "")
            .toLowerCase()
            .includes(filter.q.toLowerCase()),
      );
    case "completed":
      return tasks.filter((t) => t.status === "completed");
    case "filters": {
      let result = tasks;
      if (filter.status) {
        result = result.filter((t) => t.status === filter.status);
      } else {
        result = result.filter((t) => t.status !== "completed");
      }
      if (filter.projectId) {
        result = result.filter((t) => t.projectId === filter.projectId);
      }
      if (filter.q) {
        const q = filter.q.toLowerCase();
        result = result.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.description ?? "").toLowerCase().includes(q),
        );
      }
      return result;
    }
    default:
      return tasks;
  }
}
