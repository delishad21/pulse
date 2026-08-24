"use client";

import { Filter, X } from "lucide-react";
import { useEffect, useState } from "react";

interface TaskViewFilterProps {
  includeProjectTasks: boolean;
  onIncludeProjectTasksChange: (value: boolean) => void;
}

export function TaskViewFilter({ includeProjectTasks, onIncludeProjectTasksChange }: TaskViewFilterProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-muted transition hover:bg-surface-subtle hover:text-ink"
    >
      <Filter className="size-3.5" />
      Filter{includeProjectTasks ? " · Projects" : ""}
    </button>
    {open ? <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-[12vh] backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section role="dialog" aria-modal="true" aria-label="Task filters" className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-stroke bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-stroke px-5 py-4">
          <div><h2 className="text-base font-bold text-ink">Task filters</h2><p className="mt-0.5 text-xs text-muted">Choose what this view includes.</p></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close task filters" className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink"><X className="size-4" /></button>
        </div>
        <div className="p-5">
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stroke p-3 transition hover:bg-surface-subtle">
            <input type="checkbox" checked={includeProjectTasks} onChange={(event) => onIncludeProjectTasksChange(event.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span><span className="block text-sm font-semibold text-ink">Include project tasks</span><span className="mt-0.5 block text-xs leading-5 text-muted">By default, tasks assigned to a project stay out of the main task views.</span></span>
          </label>
        </div>
        <div className="flex justify-end border-t border-stroke px-5 py-3">
          <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90">Done</button>
        </div>
      </section>
    </div> : null}
  </>;
}
