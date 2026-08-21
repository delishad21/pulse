"use client";

import { useMemo, useState } from "react";
import { ArrowUp, CalendarDays, Hash, Tag, AtSign } from "lucide-react";
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
    <form onSubmit={handleSubmit} className="rounded-xl border border-stroke bg-surface p-2 shadow-card transition focus-within:border-primary/40 focus-within:shadow-md" data-testid="quick-add-form">
      <div className="flex items-center gap-2">
        <label htmlFor="quick-add" className="sr-only">Quick add task</label>
        <input
          id="quick-add"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What needs to get done?  Try “Review report tomorrow #Work”"
          disabled={createTask.isPending}
          className="h-11 min-w-0 flex-1 bg-transparent px-3 text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted-soft"
        />
        <button
          type="submit"
          disabled={createTask.isPending || !value.trim()}
          aria-label="Add"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ArrowUp className="size-[18px]" />
          <span className="sr-only">{createTask.isPending ? "Adding…" : "Add"}</span>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-stroke px-3 pb-1 pt-2 text-[11px] font-medium text-muted">
        <span className="inline-flex items-center gap-1"><Hash className="size-3" /> project</span>
        <span className="inline-flex items-center gap-1"><AtSign className="size-3" /> section</span>
        <span className="inline-flex items-center gap-1"><Tag className="size-3" /> label</span>
        <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" /> natural dates</span>
        <span className="ml-auto hidden sm:inline">Q to focus</span>
      </div>
    </form>
  );
}
