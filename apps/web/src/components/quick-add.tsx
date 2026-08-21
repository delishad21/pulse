"use client";

import { useMemo, useState } from "react";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects, useSections } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { parseQuickAdd, resolveQuickAddProjectId } from "@/lib/quick-add-parser";

interface QuickAddProps {
  projectId?: string;
}

export function QuickAdd({ projectId }: QuickAddProps) {
  const [value, setValue] = useState("");
  const createTask = useCreateTask();
  const { data: projects } = useProjects();
  const { data: tags } = useTags();
  const resolvedProjectId = useMemo(
    () => resolveQuickAddProjectId(value, projects, projectId),
    [value, projects, projectId],
  );
  const { data: sections } = useSections(resolvedProjectId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const input = parseQuickAdd(value, {
      projects,
      sections,
      tags,
      defaultProjectId: projectId,
    });
    if (!input.title) return;
    createTask.mutate(input, { onSuccess: () => setValue("") });
  };

  return (
    <form onSubmit={handleSubmit} className="relative" data-testid="quick-add-form">
      <label htmlFor="quick-add" className="sr-only">
        Quick add task
      </label>
      <input
        id="quick-add"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Buy milk #Personal @Errands +Home !2 tomorrow at 14:00"
        disabled={createTask.isPending}
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 pr-20 text-sm shadow-sm placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
      />
      <button
        type="submit"
        disabled={createTask.isPending || !value.trim()}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
      >
        {createTask.isPending ? "Adding…" : "Add"}
      </button>
      <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        #project · @section · +label · !1–!4 priority · today/tomorrow/next monday · at HH:MM
      </p>
    </form>
  );
}
