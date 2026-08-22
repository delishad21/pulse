"use client";

import { useState } from "react";
import { CalendarClock, Check, FolderInput, RotateCcw, RotateCw, Trash2, X } from "lucide-react";
import { useTasks, useTaskView, useBulkTasks, useBulkMoveTasks, useBulkRescheduleTasks } from "@/hooks/use-tasks";
import { useProjects, useSections } from "@/hooks/use-projects";
import { useUndo, useRedo, useHistory } from "@/hooks/use-history";
import { TaskList } from "./task-list";
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

export function Dashboard({ title, filter, header }: DashboardProps) {
  const canonicalView = filter.type === "inbox" || filter.type === "today" ? filter.type : null;
  const listQuery = useTasks(getTasksQuery(filter), canonicalView === null);
  const viewQuery = useTaskView(canonicalView ?? "inbox", canonicalView !== null);
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
  const [moveSectionId, setMoveSectionId] = useState("");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const { data: moveSections } = useSections(moveProjectId || null);

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
      { ids: selectedIds, projectId: moveProjectId || null, sectionId: moveProjectId ? (moveSectionId || null) : null },
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
                onChange={(event) => { setMoveProjectId(event.target.value); setMoveSectionId(""); }}
                className="min-w-0 flex-1 bg-transparent px-1 text-sm text-ink outline-none"
              >
                <option value="">Inbox</option>
                {projects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {moveProjectId && moveSections?.length ? (
                <select aria-label="Move selected tasks to section" value={moveSectionId} onChange={(event) => setMoveSectionId(event.target.value)} className="min-w-0 bg-transparent px-1 text-sm text-ink outline-none">
                  <option value="">No section</option>
                  {moveSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              ) : null}
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

        {filter.type === "all" || filter.type === "inbox" ? (
          isLoading ? (
            <div className="space-y-6">{[0, 1].map((item) => <div key={item}><div className="mb-2 h-4 w-28 animate-pulse rounded bg-surface-subtle" /><div className="h-40 animate-pulse rounded-xl border border-stroke bg-surface" /></div>)}</div>
          ) : filtered.length ? (
            <div className="space-y-6">
              {groupTasksByDate(filtered).map((group) => (
                <div key={group.key ?? "no-date"} data-date-group={group.key ?? "no-date"}>
                  <div className="mb-2 flex items-baseline gap-2 px-1">
                    <h2 className="text-sm font-bold text-ink">{group.label}</h2>
                    <span className="text-xs font-medium text-muted-soft">{group.tasks.length}</span>
                  </div>
                  <section className="overflow-hidden rounded-xl border border-stroke bg-surface shadow-card">
                    <TaskList tasks={group.tasks} selectedIds={selectedIds} onSelect={toggleSelect} />
                  </section>
                </div>
              ))}
            </div>
          ) : (
            <section className="rounded-xl border border-stroke bg-surface px-6 py-14 text-center shadow-card"><p className="text-sm font-semibold text-ink">You’re all clear</p><p className="mt-1 text-sm text-muted">Use Add task in the sidebar when something new comes up.</p></section>
          )
        ) : (
          <section className="overflow-hidden rounded-xl border border-stroke bg-surface shadow-card">
            {isLoading ? (
              <div className="space-y-0 divide-y divide-stroke">
                {[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-3 px-5 py-4"><div className="size-5 animate-pulse rounded-full bg-surface-subtle" /><div className="h-4 w-1/3 animate-pulse rounded bg-surface-subtle" /></div>)}
              </div>
            ) : (
              <TaskList tasks={filtered} selectedIds={selectedIds} onSelect={toggleSelect} reorderable={filter.type === "project"} />
            )}
          </section>
        )}
      </div>
    </Shell>
  );
}
