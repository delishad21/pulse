"use client";

import { useState } from "react";
import { useCreateSection, useDeleteSection, useSections } from "@/hooks/use-projects";

export function ProjectSections({ projectId }: { projectId: string }) {
  const { data: sections } = useSections(projectId);
  const createSection = useCreateSection();
  const deleteSection = useDeleteSection();
  const [name, setName] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    createSection.mutate({ projectId, name: value }, { onSuccess: () => setName("") });
  };

  return (
    <div className="mb-5 rounded-lg border border-stroke bg-surface-subtle p-3 dark:border-stroke dark:bg-surface-subtle">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Sections</span>
        <form onSubmit={submit} className="flex gap-1.5">
          <label htmlFor={`section-name-${projectId}`} className="sr-only">New section name</label>
          <input
            id={`section-name-${projectId}`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New section"
            className="w-36 rounded-lg border border-stroke bg-surface px-2 py-1 text-xs outline-none focus:border-primary dark:border-stroke dark:bg-surface"
          />
          <button type="submit" disabled={!name.trim() || createSection.isPending} className="rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Add</button>
        </form>
      </div>
      {sections?.length ? (
        <div className="flex flex-wrap gap-2">
          {sections.map((section) => (
            <span key={section.id} className="inline-flex items-center gap-1 rounded-full border border-stroke bg-surface px-2.5 py-1 text-xs dark:border-stroke dark:bg-surface">
              {section.name}
              <button
                type="button"
                onClick={() => deleteSection.mutate({ projectId, id: section.id })}
                aria-label={`Delete section ${section.name}`}
                className="ml-0.5 text-muted-soft hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted">No sections yet. Add one, then use @section in quick add.</p>
      )}
    </div>
  );
}
