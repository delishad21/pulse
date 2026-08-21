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
    <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <div className="mb-3">
        <h2 className="font-medium">Labels</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Create labels for quick add (+label), filtering, and task editing.</p>
      </div>
      <form onSubmit={submit} className="mb-3 flex gap-2">
        <label htmlFor="new-label" className="sr-only">New label</label>
        <input id="new-label" value={name} onChange={(event) => setName(event.target.value)} placeholder="New label" className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900" />
        <button type="submit" disabled={!name.trim() || createTag.isPending} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950">Create</button>
      </form>
      <div className="flex flex-wrap gap-2">
        {tags?.map((tag) => (
          <span key={tag.id} className="inline-flex items-center gap-1 rounded-full border border-zinc-200 px-2.5 py-1 text-xs dark:border-zinc-700">
            +{tag.name}
            <button type="button" onClick={() => deleteTag.mutate(tag.id)} aria-label={`Delete label ${tag.name}`} className="text-zinc-400 hover:text-red-600">×</button>
          </span>
        ))}
        {!tags?.length && <span className="text-sm text-zinc-500">No labels yet.</span>}
      </div>
    </div>
  );
}
