import type { Priority, Task, TaskId } from "@pulse/domain";

export const WIDGET_SNAPSHOT_VERSION = 2 as const;
export const WIDGET_MAX_TASKS = 20;

export type WidgetView = "today" | "inbox" | "upcoming" | "overdue" | "project";
export type WidgetDensity = "compact" | "comfortable" | "detailed";
export type WidgetArrangement = "grouped" | "list";
export type WidgetSort = "smart" | "due" | "priority" | "manual";
export type WidgetTheme = "system" | "light" | "dark";

export interface WidgetConfiguration {
  view: WidgetView;
  projectId?: string | null;
  maxTasks: number;
  density: WidgetDensity;
  showDue: boolean;
  showProject: boolean;
  showCompleted: boolean;
  includeProjectTasks: boolean;
  arrangement: WidgetArrangement;
  sort: WidgetSort;
  theme: WidgetTheme;
  backgroundOpacity: number;
  showPriority: boolean;
  showLabels: boolean;
  showLocation: boolean;
}

export interface WidgetTaskItem {
  id: TaskId;
  title: string;
  dueLabel: string | null;
  isOverdue: boolean;
  priority: Priority;
  projectName: string | null;
  projectColor: string | null;
  tagNames: string[];
  location: string | null;
  dateKey: string | null;
  dateLabel: string | null;
}

export interface TaskWidgetSnapshot {
  version: typeof WIDGET_SNAPSHOT_VERSION;
  view: WidgetView;
  title: string;
  generatedAt: string;
  staleAfter: string;
  openCount: number;
  totalCount: number;
  accentColor: string;
  configuration: WidgetConfiguration;
  tasks: WidgetTaskItem[];
}

/** Kept as an alias for older widget consumers. */
export type TodayWidgetSnapshot = TaskWidgetSnapshot;

export type WidgetAction =
  | { type: "complete"; taskId: TaskId }
  | { type: "open-task"; taskId: TaskId }
  | { type: "open-view"; view: WidgetView; projectId?: string | null }
  | { type: "create-task"; projectId?: string | null }
  | { type: "refresh"; view: WidgetView; projectId?: string | null };

export const defaultWidgetConfiguration: WidgetConfiguration = {
  view: "today",
  maxTasks: 6,
  density: "comfortable",
  showDue: true,
  showProject: true,
  showCompleted: false,
  includeProjectTasks: true,
  arrangement: "grouped",
  sort: "smart",
  theme: "system",
  backgroundOpacity: 1,
  showPriority: true,
  showLabels: true,
  showLocation: true,
};

const priorityRank: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
const fallbackTaskDateKey = (task: Task) => task.startAt?.slice(0, 10) ?? task.due.at?.slice(0, 10) ?? task.due.date;
const dateHeading = (key: string | null) => key ? new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`)) : null;

export function clampWidgetTaskCount(value: number): number {
  if (!Number.isFinite(value)) return defaultWidgetConfiguration.maxTasks;
  return Math.max(1, Math.min(WIDGET_MAX_TASKS, Math.floor(value)));
}

export function makeWidgetSnapshot(input: {
  configuration: WidgetConfiguration;
  title: string;
  tasks: Task[];
  projects?: Array<{ id: string; name: string; color: string | null }>;
  accentColor?: string;
  now?: Date;
  dueLabel?: (task: Task) => string | null;
  isOverdue?: (task: Task) => boolean;
  dateKey?: (task: Task) => string | null;
}): TaskWidgetSnapshot {
  const now = input.now ?? new Date();
  const projects = new Map((input.projects ?? []).map((project) => [project.id, project]));
  const dateKey = (task: Task) => input.dateKey?.(task) ?? fallbackTaskDateKey(task);
  const projectFiltered = input.configuration.projectId ? input.tasks.filter((task) => task.projectId === input.configuration.projectId) : input.tasks;
  const included = input.configuration.includeProjectTasks ? projectFiltered : projectFiltered.filter((task) => !task.projectId);
  const visible = input.configuration.showCompleted
    ? included
    : included.filter((task) => task.status === "open");
  const sorted = [...visible].sort((a, b) => {
    if (input.configuration.sort === "priority") return priorityRank[a.priority] - priorityRank[b.priority] || a.sortOrder - b.sortOrder;
    if (input.configuration.sort === "manual") return a.sortOrder - b.sortOrder;
    if (input.configuration.sort === "due") return (dateKey(a) ?? "9999-99-99").localeCompare(dateKey(b) ?? "9999-99-99") || a.sortOrder - b.sortOrder;
    return Number(Boolean(input.isOverdue?.(b))) - Number(Boolean(input.isOverdue?.(a))) || (dateKey(a) ?? "9999-99-99").localeCompare(dateKey(b) ?? "9999-99-99") || a.sortOrder - b.sortOrder;
  });

  return {
    version: WIDGET_SNAPSHOT_VERSION,
    view: input.configuration.view,
    title: input.title,
    generatedAt: now.toISOString(),
    staleAfter: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    openCount: included.filter((task) => task.status === "open").length,
    totalCount: visible.length,
    accentColor: input.accentColor ?? "#dc4c3e",
    configuration: { ...input.configuration, maxTasks: clampWidgetTaskCount(input.configuration.maxTasks), backgroundOpacity: Math.max(0, Math.min(1, input.configuration.backgroundOpacity)) },
    tasks: sorted.slice(0, clampWidgetTaskCount(input.configuration.maxTasks)).map((task) => {
      const project = task.projectId ? projects.get(task.projectId) : undefined;
      return {
        id: task.id,
        title: task.title,
        dueLabel: input.configuration.showDue ? input.dueLabel?.(task) ?? null : null,
        isOverdue: input.isOverdue?.(task) ?? false,
        priority: input.configuration.showPriority ? task.priority : "none",
        projectName: input.configuration.showProject ? project?.name ?? null : null,
        projectColor: input.configuration.showProject ? project?.color ?? null : null,
        tagNames: input.configuration.showLabels ? task.tags.map((tag) => tag.name) : [],
        location: input.configuration.showLocation ? task.location : null,
        dateKey: dateKey(task),
        dateLabel: dateHeading(dateKey(task)),
      };
    }),
  };
}
