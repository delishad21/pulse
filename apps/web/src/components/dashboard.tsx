"use client";

import { useState } from "react";
import { CheckCircle2, Plus, RotateCcw, RotateCw } from "lucide-react";
import type { Task } from "@pulse/api-client";
import { useTasks, useTaskView } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useUndo, useRedo, useHistory } from "@/hooks/use-history";
import { TaskList } from "./task-list";
import { TaskComposer } from "./task-composer";
import { TaskCreateModal } from "./task-create-modal";
import { TaskViewFilter } from "./task-view-filter";
import { Shell } from "./shell";
import { filterTasks, type DashboardFilter } from "@/lib/dashboard-filters";
import { groupTasksByDate, localDateKey } from "@/lib/task-dates";

interface DashboardProps {
  title: string;
  filter: DashboardFilter;
  header?: React.ReactNode;
}

function getTasksQuery(filter: DashboardFilter) {
  if (filter.type === "all") return { status: "open" as const };
  if (filter.type === "project") {
    return { projectId: filter.projectId, status: "open" as const };
  }
  if (filter.type === "filters") {
    const query: {
      status?: "open" | "completed";
      projectId?: string;
    } = {};
    if (filter.status) query.status = filter.status;
    if (filter.projectId) query.projectId = filter.projectId;
    return query;
  }
  return undefined;
}

function EmptyTasks({ message, compact = false }: { message: string; compact?: boolean }) {
  return <div className={`flex flex-col items-center justify-center text-center ${compact ? "min-h-[260px]" : "min-h-[52vh]"}`}>
    <div className="relative mb-5 flex size-24 items-center justify-center rounded-full bg-primary-soft/60">
      <div className="absolute size-16 rounded-full border border-primary/15" />
      <CheckCircle2 className="size-10 text-primary/75" />
    </div>
    <p className="text-base font-semibold text-ink">All clear</p>
    <p className="mt-1 text-sm text-muted">{message}</p>
  </div>;
}

function isOverdueTask(task: Task): boolean {
  if (task.due.date) return task.due.date < localDateKey(new Date());
  return Boolean(task.due.at && new Date(task.due.at).getTime() < Date.now());
}

function OverdueSection({ tasks, onEditTask }: {
  tasks: Task[];
  onEditTask: (task: Task) => void;
}) {
  if (!tasks.length) return null;
  return <section data-testid="overdue-section" className="mb-8">
    <div className="mb-2 flex items-baseline gap-2"><h2 className="text-sm font-bold text-danger">Overdue</h2><span className="text-xs font-medium text-muted-soft">{tasks.length}</span></div>
    <div className="border-t border-danger/30"><TaskList tasks={tasks} onEditTask={onEditTask} /></div>
  </section>;
}

export function Dashboard({ title, filter, header }: DashboardProps) {
  const canonicalView = filter.type === "inbox" || filter.type === "today" ? filter.type : null;
  const [showCompleted, setShowCompleted] = useState(false);
  const [includeProjectTasks, setIncludeProjectTasks] = useState(false);
  const canFilterProjectTasks = filter.type !== "project" && !(filter.type === "filters" && Boolean(filter.projectId));
  const listQuery = useTasks(getTasksQuery(filter), canonicalView === null);
  const viewQuery = useTaskView(canonicalView ?? "inbox", canonicalView !== null, showCompleted);
  const allInboxQuery = useTasks(undefined, filter.type === "inbox" && includeProjectTasks);
  const tasksQuery = filter.type === "inbox" && includeProjectTasks ? allInboxQuery : canonicalView ? viewQuery : listQuery;
  const tasks = tasksQuery.data;
  const overdueQuery = useTaskView("overdue", filter.type === "today");
  const isLoading = tasksQuery.isLoading || (filter.type === "today" && overdueQuery.isLoading);
  const { data: projects } = useProjects();
  const undo = useUndo();
  const redo = useRedo();
  const { data: history } = useHistory();
  const [composerKey, setComposerKey] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const rawFiltered = tasks
    ? (filter.type === "inbox" || filter.type === "today")
      ? tasks
      : filterTasks(tasks, filter)
      : [];
  const filtered = filter.type === "inbox" && includeProjectTasks
    ? rawFiltered.filter((task) => task.status === "open" || (showCompleted && task.status === "completed"))
    : canFilterProjectTasks && !includeProjectTasks
      ? rawFiltered.filter((task) => task.projectId === null)
      : rawFiltered;
  const overdueTasks = filter.type === "today"
    ? (overdueQuery.data ?? []).filter((task) => includeProjectTasks || task.projectId === null)
    : filtered.filter(isOverdueTask);
  const visibleTasks = filter.type === "inbox" ? filtered.filter((task) => !isOverdueTask(task)) : filtered;
  const visibleCount = filtered.length + (filter.type === "today" ? overdueTasks.length : 0);
  const project =
    filter.type === "project"
      ? projects?.find((p) => p.id === filter.projectId)
      : undefined;

  return (
    <Shell defaultProjectId={filter.type === "project" ? filter.projectId : null}>
      <div className="mx-auto w-full max-w-[980px] px-4 py-8 md:px-8 md:py-10">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">
                {project ? project.name : title}
              </h1>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                {visibleCount}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted">
              {visibleCount === 0 ? "Nothing demanding your attention." : `${visibleCount} task${visibleCount === 1 ? "" : "s"} in this view`}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-stroke bg-surface p-1 shadow-sm">
            {canFilterProjectTasks ? <TaskViewFilter includeProjectTasks={includeProjectTasks} onIncludeProjectTasksChange={setIncludeProjectTasks} /> : null}
            {canonicalView ? <button type="button" onClick={() => setShowCompleted((value) => !value)} aria-pressed={showCompleted} className="h-9 rounded-md px-3 text-xs font-semibold text-muted transition hover:bg-surface-subtle hover:text-ink">{showCompleted ? "Hide completed" : "Show completed"}</button> : null}
            <button
              type="button"
              onClick={() => undo.mutate()}
              disabled={!history?.some((operation) => !operation.undoneAt) || undo.isPending}
              className="flex size-9 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Undo"
              title="Undo"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => redo.mutate()}
              disabled={!history?.some((operation) => operation.undoneAt) || redo.isPending}
              className="flex size-9 items-center justify-center rounded-md text-muted transition hover:bg-surface-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Redo"
              title="Redo"
            >
              <RotateCw className="size-4" />
            </button>
          </div>
        </div>

        {header ? <div className="mb-5">{header}</div> : null}

        {filter.type === "inbox" ? (
          isLoading ? (
            <div className="space-y-7">{[0, 1].map((item) => <div key={item}><div className="mb-2 h-4 w-28 animate-pulse rounded bg-surface-subtle" /><div className="h-28 animate-pulse border-t border-stroke bg-surface/20" /></div>)}</div>
          ) : visibleCount ? (
            <div className="space-y-8">
              <OverdueSection tasks={overdueTasks} onEditTask={setEditingTask} />
              {groupTasksByDate(visibleTasks).map((group) => {
                const key = group.key ?? "no-date";
                return <div key={key} data-date-group={key}>
                  <div className="mb-1 flex items-baseline gap-2"><h2 className="text-sm font-bold text-ink">{group.label}</h2><span className="text-xs font-medium text-muted-soft">{group.tasks.length}</span></div>
                  <div className="border-t border-stroke"><TaskList tasks={group.tasks} onEditTask={setEditingTask} /></div>
                  {composerKey === key ? <TaskComposer defaultDate={group.key} onCancel={() => setComposerKey(null)} onCreated={() => setComposerKey(null)} className="mt-2" /> : <button type="button" onClick={() => setComposerKey(key)} className="mt-1 inline-flex h-9 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted hover:text-primary"><Plus className="size-4 text-primary" />Add task</button>}
                </div>;
              })}
            </div>
          ) : <EmptyTasks message="Your inbox is clear." />
        ) : filter.type === "today" ? (
          isLoading ? <div className="h-36 animate-pulse border-t border-stroke" /> : (
            <div>
              <OverdueSection tasks={overdueTasks} onEditTask={setEditingTask} />
              {filtered.length ? <div className="border-t border-stroke"><TaskList tasks={filtered} onEditTask={setEditingTask} /></div> : overdueTasks.length ? null : <EmptyTasks message="Nothing scheduled for today." compact />}
              {composerKey === "today" ? <TaskComposer defaultDate={localDateKey(new Date())} onCancel={() => setComposerKey(null)} onCreated={() => setComposerKey(null)} className="mt-2" /> : <button type="button" onClick={() => setComposerKey("today")} className="mt-2 inline-flex h-9 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted hover:text-primary"><Plus className="size-4 text-primary" />Add task</button>}
            </div>
          )
        ) : (
          <section className="border-t border-stroke">
            {isLoading ? <div className="h-48 animate-pulse bg-surface-subtle" /> : <TaskList tasks={filtered} onEditTask={setEditingTask} reorderable={filter.type === "project"} />}
          </section>
        )}
      </div>
      <TaskCreateModal key={editingTask?.id ?? "closed"} open={Boolean(editingTask)} task={editingTask} onClose={() => setEditingTask(null)} />
    </Shell>
  );
}
