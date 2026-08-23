"use client";

import { useState } from "react";
import { Plus, Tag, Trash2, X } from "lucide-react";
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";

const colors = [
  "#64748b", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

export function LabelManager() {
  const { data: tags } = useTags();
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const deleteTag = useDeleteTag();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(colors[0]!);

  const close = () => { setOpen(false); setName(""); setColor(colors[0]!); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    createTag.mutate({ name: value, color }, { onSuccess: close });
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-stroke pb-2">
        <div><h2 className="text-sm font-bold text-ink">Labels</h2><p className="mt-0.5 text-xs text-muted">Use @label in smart task text.</p></div>
        <button type="button" onClick={() => setOpen(true)} aria-label="Add label" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-ink"><Plus className="size-4" /></button>
      </div>
      <div className="divide-y divide-stroke">
        {tags?.map((tag) => (
          <div key={tag.id} className="group flex min-h-11 items-center gap-3 px-1 py-2">
            <Tag className="size-4" style={{ color: tag.color ?? colors[0] }} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{tag.name}</span>
            <input type="color" aria-label={`Color for ${tag.name}`} value={tag.color ?? colors[0]} onChange={(event) => updateTag.mutate({ id: tag.id, input: { color: event.target.value } })} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0 opacity-55 transition group-hover:opacity-100" />
            <button type="button" onClick={() => deleteTag.mutate(tag.id)} aria-label={`Delete label ${tag.name}`} className="flex size-7 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-red-50 hover:text-danger group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
          </div>
        ))}
        {!tags?.length ? <p className="py-5 text-sm text-muted">No labels yet.</p> : null}
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="Add label" className="w-full max-w-[480px] overflow-hidden rounded-xl border border-stroke bg-surface shadow-float">
            <div className="flex items-center justify-between border-b border-stroke px-4 py-3"><h3 className="text-base font-bold text-ink">Add label</h3><button type="button" onClick={close} aria-label="Close add label" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle"><X className="size-4" /></button></div>
            <div className="space-y-4 p-4">
              <label className="block text-xs font-bold text-ink">Name<input autoFocus aria-label="Label name" value={name} onChange={(event) => setName(event.target.value.slice(0, 60))} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary" /></label>
              <div><p className="mb-2 text-xs font-bold text-ink">Color</p><div className="grid grid-cols-8 gap-2 sm:grid-cols-10">
                {colors.map((value) => <button key={value} type="button" aria-label={`Choose color ${value}`} onClick={() => setColor(value)} className={cn("size-8 rounded-lg border-2 transition", color === value ? "border-ink scale-105" : "border-transparent")} style={{ backgroundColor: value }} />)}
              </div></div>
              <label className="flex items-center justify-between rounded-lg border border-stroke px-3 py-2 text-sm font-medium text-ink">Custom color<input aria-label="Custom label color" type="color" value={color} onChange={(event) => setColor(event.target.value)} className="size-8 cursor-pointer border-0 bg-transparent p-0" /></label>
            </div>
            <div className="flex justify-end gap-2 border-t border-stroke px-4 py-3"><button type="button" onClick={close} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-subtle">Cancel</button><button type="submit" disabled={!name.trim() || createTag.isPending} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-40">Add</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
