"use client";

import { useState } from "react";
import { useTasks, useTaskView, useTaskSearch, useBulkTasks, useBulkMoveTasks, useBulkRescheduleTasks } from "@/hooks/use-tasks";
import { useProjects, useSections } from "@/hooks/use-projects";
import { useUndo, useRedo, useHistory } from "@/hooks/use-history";
import { QuickAdd } from "./quick-add";
import { TaskList } from "./task-list";
import { Shell } from "./shell";
import { filterTasks, type DashboardFilter } from "@/lib/dashboard-filters";

interface DashboardProps {
  title: string;
  filter: DashboardFilter;
  header?: React.ReactNode;
}

function getTasksQuery(filter: DashboardFilter) {
  if (filter.type === "project") {
    return { projectId: filter.projectId };
  }
  if (filter.type === "filters") {
    const query: {
      status?: "open" | "completed";
      projectId?: string;
      q?: string;
    } = {};
    if (filter.status) query.status = filter.status;
    if (filter.projectId) query.projectId = filter.projectId;
    if (filter.q) query.q = filter.q;
    return query;
  }
  return undefined;
}

export function Dashboard({ title, filter, header }: DashboardProps) {
  const canonicalView = filter.type === "inbox" || filter.type === "today" || filter.type === "upcoming" || filter.type === "completed"
    ? filter.type
    : null;
  const listQuery = useTasks(getTasksQuery(filter), canonicalView === null && filter.type !== "search");
  const viewQuery = useTaskView(canonicalView ?? "inbox", canonicalView !== null);
  const searchQuery = useTaskSearch(filter.type === "search" ? filter.q : "");
  const tasksQuery = filter.type === "search" ? searchQuery : canonicalView ? viewQuery : listQuery;
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
    ? (filter.type === "inbox" || filter.type === "today" || filter.type === "upcoming" || filter.type === "completed" || filter.type === "search")
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
    <Shell>
      <div className="mx-auto max-w-3xl">
        {header}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {project ? project.name : title}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {filtered.length} task{filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => undo.mutate()}
              disabled={!history?.some((operation) => !operation.undoneAt) || undo.isPending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Undo
            </button>
            <button
              type="button"
              onClick={() => redo.mutate()}
              disabled={!history?.some((operation) => operation.undoneAt) || redo.isPending}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Redo
            </button>
            {history?.length ? <span className="text-xs text-zinc-400">{history.length} recent operations</span> : null}
          </div>
        </div>

        <div className="mb-6">
          <QuickAdd
            projectId={
              filter.type === "project"
                ? filter.projectId
                : filter.type === "filters"
                  ? filter.projectId
                  : undefined
            }
          />
        </div>

        {selectedIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="px-2 text-sm font-medium">
              {selectedIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => runBulk("complete")}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              Complete
            </button>
            <button
              type="button"
              onClick={() => runBulk("delete")}
              className="rounded-md px-2.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30"
            >
              Delete
            </button>
            <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
              <select
                aria-label="Move selected tasks to project"
                value={moveProjectId}
                onChange={(event) => { setMoveProjectId(event.target.value); setMoveSectionId(""); }}
                className="bg-transparent px-1 text-sm outline-none"
              >
                <option value="">Inbox</option>
                {projects?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {moveProjectId && moveSections?.length ? (
                <select
                  aria-label="Move selected tasks to section"
                  value={moveSectionId}
                  onChange={(event) => setMoveSectionId(event.target.value)}
                  className="bg-transparent px-1 text-sm outline-none"
                >
                  <option value="">No section</option>
                  {moveSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
                </select>
              ) : null}
              <button type="button" onClick={runBulkMove} className="rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">Move</button>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-zinc-200 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-950">
              <input
                type="date"
                aria-label="Reschedule selected tasks"
                value={bulkDueDate}
                onChange={(event) => setBulkDueDate(event.target.value)}
                className="bg-transparent px-1 text-sm outline-none"
              />
              <button type="button" onClick={runBulkReschedule} className="rounded px-2 py-1 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {bulkDueDate ? "Reschedule" : "Clear due"}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-auto rounded-md px-2.5 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Clear
            </button>
          </div>
        )}

        {isLoading ? (
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            Loading…
          </p>
        ) : (
          <TaskList
            tasks={filtered}
            selectedIds={selectedIds}
            onSelect={toggleSelect}
            reorderable={filter.type === "project"}
          />
        )}
      </div>
    </Shell>
  );
}
