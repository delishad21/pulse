"use client";

import { useState } from "react";
import { CalendarClock, Check, CheckCircle2, FolderInput, Plus, RotateCcw, RotateCw, Trash2, X } from "lucide-react";
import { useTasks, useTaskView, useBulkTasks, useBulkMoveTasks, useBulkRescheduleTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useUndo, useRedo, useHistory } from "@/hooks/use-history";
import { TaskList } from "./task-list";
import { TaskComposer } from "./task-composer";
import { Shell } from "./shell";
import { filterTasks, type DashboardFilter } from "@/lib/dashboard-filters";
import { groupTasksByDate } from "@/lib/task-dates";

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

export function Dashboard({ title, filter, header }: DashboardProps) {
  const canonicalView = filter.type === "inbox" || filter.type === "today" ? filter.type : null;
  const [showCompleted, setShowCompleted] = useState(false);
  const listQuery = useTasks(getTasksQuery(filter), canonicalView === null);
  const viewQuery = useTaskView(canonicalView ?? "inbox", canonicalView !== null, showCompleted);
  const tasksQuery = canonicalView ? viewQuery : listQuery;
  const tasks = tasksQuery.data;
  const isLoading = tasksQuery.isLoading;
  const { data: projects } = useProjects();
  const bulk = useBulkTasks();
  const bulkMove = useBulkMoveTasks();
  const bulkReschedule = useBulkRescheduleTasks();
  const undo = useUndo();
  const redo = useRedo();
  const { data: history } = useHistory();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [moveProjectId, setMoveProjectId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [composerKey, setComposerKey] = useState<string | null>(null);

  const filtered = tasks
    ? (filter.type === "inbox" || filter.type === "today")
      ? tasks
      : filterTasks(tasks, filter)
    : [];
  const project =
    filter.type === "project"
      ? projects?.find((p) => p.id === filter.projectId)
      : undefined;

  const toggleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  const runBulk = (action: "complete" | "delete") => {
    if (selectedIds.length === 0) return;
    bulk.mutate({ ids: selectedIds, action }, { onSuccess: () => setSelectedIds([]) });
  };

  const runBulkMove = () => {
    if (selectedIds.length === 0) return;
    bulkMove.mutate(
      { ids: selectedIds, projectId: moveProjectId || null },
      { onSuccess: () => setSelectedIds([]) },
    );
  };

  const runBulkReschedule = () => {
    if (selectedIds.length === 0) return;
    bulkReschedule.mutate(
      { ids: selectedIds, dueDate: bulkDueDate || null },
      { onSuccess: () => setSelectedIds([]) },
    );
  };

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
                {filtered.length}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-muted">
              {filtered.length === 0 ? "Nothing demanding your attention." : `${filtered.length} task${filtered.length === 1 ? "" : "s"} in this view`}
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-stroke bg-surface p-1 shadow-sm">
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

        {selectedIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft p-2.5 shadow-sm">
            <span className="px-2 text-sm font-semibold text-primary">{selectedIds.length} selected</span>
            <button type="button" onClick={() => runBulk("complete")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white hover:bg-primary/90">
              <Check className="size-4" /> Complete
            </button>
            <button type="button" onClick={() => runBulk("delete")} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-danger hover:bg-white/70 dark:hover:bg-surface">
              <Trash2 className="size-4" /> Delete
            </button>

            <div className="flex min-w-[230px] items-center gap-1 rounded-lg border border-primary/15 bg-surface p-1">
              <FolderInput className="ml-2 size-4 text-muted" />
              <select
                aria-label="Move selected tasks to project"
                value={moveProjectId}
                onChange={(event) => setMoveProjectId(event.target.value)}
                className="min-w-0 flex-1 bg-transparent px-1 text-sm text-ink outline-none"
              >
                <option value="">Inbox</option>
                {projects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>

              <button type="button" onClick={runBulkMove} className="rounded-md px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary-soft">Move</button>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-primary/15 bg-surface p-1">
              <CalendarClock className="ml-2 size-4 text-muted" />
              <input type="date" aria-label="Reschedule selected tasks" value={bulkDueDate} onChange={(event) => setBulkDueDate(event.target.value)} className="bg-transparent px-1 text-sm text-ink outline-none" />
              <button type="button" onClick={runBulkReschedule} className="rounded-md px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary-soft">{bulkDueDate ? "Reschedule" : "Clear due"}</button>
            </div>

            <button type="button" onClick={() => setSelectedIds([])} className="ml-auto flex size-9 items-center justify-center rounded-lg text-primary hover:bg-white/70 dark:hover:bg-surface" aria-label="Clear selection">
              <X className="size-4" />
            </button>
          </div>
        )}

        {filter.type === "inbox" ? (
          isLoading ? (
            <div className="space-y-7">{[0, 1].map((item) => <div key={item}><div className="mb-2 h-4 w-28 animate-pulse rounded bg-surface-subtle" /><div className="h-28 animate-pulse border-t border-stroke bg-surface/20" /></div>)}</div>
          ) : filtered.length ? (
            <div className="space-y-8">
              {groupTasksByDate(filtered).map((group) => {
                const key = group.key ?? "no-date";
                return <div key={key} data-date-group={key}>
                  <div className="mb-1 flex items-baseline gap-2"><h2 className="text-sm font-bold text-ink">{group.label}</h2><span className="text-xs font-medium text-muted-soft">{group.tasks.length}</span></div>
                  <div className="border-t border-stroke"><TaskList tasks={group.tasks} selectedIds={selectedIds} onSelect={toggleSelect} /></div>
                  {composerKey === key ? <TaskComposer defaultDate={group.key} onCancel={() => setComposerKey(null)} onCreated={() => setComposerKey(null)} className="mt-2" /> : <button type="button" onClick={() => setComposerKey(key)} className="mt-1 inline-flex h-9 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted hover:text-primary"><Plus className="size-4 text-primary" />Add task</button>}
                </div>;
              })}
            </div>
          ) : <EmptyTasks message="Your inbox is clear." />
        ) : filter.type === "today" ? (
          isLoading ? <div className="h-36 animate-pulse border-t border-stroke" /> : (
            <div>
              {filtered.length ? <div className="border-t border-stroke"><TaskList tasks={filtered} selectedIds={selectedIds} onSelect={toggleSelect} /></div> : <EmptyTasks message="Nothing scheduled for today." compact />}
              {composerKey === "today" ? <TaskComposer defaultDate={new Date().toLocaleDateString("en-CA")} onCancel={() => setComposerKey(null)} onCreated={() => setComposerKey(null)} className="mt-2" /> : <button type="button" onClick={() => setComposerKey("today")} className="mt-2 inline-flex h-9 items-center gap-2 rounded-md px-1 text-sm font-medium text-muted hover:text-primary"><Plus className="size-4 text-primary" />Add task</button>}
            </div>
          )
        ) : (
          <section className="overflow-hidden rounded-xl border border-stroke bg-surface shadow-card">
            {isLoading ? <div className="h-48 animate-pulse bg-surface-subtle" /> : <TaskList tasks={filtered} selectedIds={selectedIds} onSelect={toggleSelect} reorderable={filter.type === "project"} />}
          </section>
        )}
      </div>
    </Shell>
  );
}
