import type { Task } from "@pulse/api-client";

export type DashboardFilter =
  | { type: "all" }
  | { type: "inbox" }
  | { type: "today" }
  | { type: "project"; projectId: string }
  | {
      type: "filters";
      status?: "open" | "completed";
      projectId?: string;
    };

export function filterTasks(tasks: Task[], filter: DashboardFilter): Task[] {
  switch (filter.type) {
    case "all":
      return tasks.filter((task) => task.status === "open");
    case "inbox":
      return tasks.filter((task) => task.status === "open" && task.projectId === null);
    case "today":
      return tasks;
    case "project":
      return tasks.filter((task) => task.status === "open" && task.projectId === filter.projectId);
    case "filters": {
      let result = tasks;
      if (filter.status) result = result.filter((task) => task.status === filter.status);
      else result = result.filter((task) => task.status === "open");
      if (filter.projectId) result = result.filter((task) => task.projectId === filter.projectId);
      return result;
    }
    default:
      return tasks;
  }
}
