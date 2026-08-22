"use client";

import { useState } from "react";
import { useCreateTag, useDeleteTag, useTags } from "@/hooks/use-tags";

export function LabelManager() {
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const deleteTag = useDeleteTag();
  const [name, setName] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    createTag.mutate({ name: value }, { onSuccess: () => setName("") });
  };

  return (
    <div className="border-t border-stroke pt-4 dark:border-stroke">
      <div className="mb-3">
        <h2 className="font-medium">Labels</h2>
        <p className="text-sm text-muted dark:text-muted-soft">Create labels for smart task text (@label), filtering, and task editing.</p>
      </div>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <label htmlFor="new-label" className="sr-only">New label</label>
        <input id="new-label" value={name} onChange={(event) => setName(event.target.value)} placeholder="New label" className="min-w-0 flex-1 rounded-lg border border-stroke px-3 py-2 text-sm outline-none focus:border-primary dark:border-stroke dark:bg-surface" />
        <button type="submit" disabled={!name.trim() || createTag.isPending} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Create</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {tags?.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-stroke px-2.5 py-1 text-xs dark:border-stroke">
            @{tag.name}
            <button type="button" onClick={() => deleteTag.mutate(tag.id)} aria-label={`Delete label ${tag.name}`} className="text-muted-soft hover:text-red-600">×</button>
          </span>
        ))}
        {!tags?.length && <span className="text-sm text-muted">No labels yet.</span>}
      </div>
    </div>
  );
}
