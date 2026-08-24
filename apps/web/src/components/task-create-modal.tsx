"use client";

import { useEffect } from "react";
import type { Task } from "@pulse/api-client";
import { TaskComposer } from "./task-composer";

interface Props {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string | null;
  task?: Task | null;
}

export function TaskCreateModal({ open, onClose, defaultProjectId, task = null }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/35 px-3 py-[8vh] backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={task ? "Edit task" : "Add task"} className="w-full max-w-[720px]">
        <TaskComposer key={task?.id ?? "create"} task={task} defaultProjectId={defaultProjectId} onCancel={onClose} />
      </div>
    </div>
  );
}
