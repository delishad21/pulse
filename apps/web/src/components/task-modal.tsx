"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, MapPin, Pencil, Repeat2, Tag, X } from "lucide-react";
import type { Task } from "@pulse/api-client";
import { useCompleteTask, useReopenTask, useTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { TaskEditor } from "./task-editor";

interface TaskModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskModal({ task, onClose }: TaskModalProps) {
  const [editing, setEditing] = useState(false);
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const { data: refreshedTask } = useTask(task?.id ?? "");
  const { data: projects } = useProjects();

  useEffect(() => {
    if (!task) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [task, onClose]);

  const close = () => { setEditing(false); onClose(); };

  if (!task) return null;
  const currentTask = refreshedTask ?? task;
  const project = projects?.find((item) => item.id === currentTask.projectId);
  const toggleComplete = () => {
    if (currentTask.status === "completed") reopenTask.mutate(currentTask.id);
    else completeTask.mutate(currentTask.id, { onSuccess: close });
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[9vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby={`task-modal-label-${currentTask.id}`} className="w-full max-w-[680px] rounded-2xl border border-stroke bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-stroke px-5 py-4">
          <p id={`task-modal-label-${currentTask.id}`} className="text-xs font-bold uppercase tracking-[0.14em] text-muted">Task details</p>
          <button type="button" onClick={close} aria-label="Close task" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink"><X className="size-5" /></button>
        </div>
        <div className="p-5 md:p-6">
          {editing ? (
            <TaskEditor task={currentTask} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
          ) : (
            <div>
              <div className="flex items-start gap-4">
                <input type="checkbox" checked={currentTask.status === "completed"} onChange={toggleComplete} aria-label={currentTask.status === "completed" ? "Mark as open" : "Mark as completed"} className="mt-1 size-6 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-soft bg-surface transition checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20" />
                <div className="min-w-0 flex-1">
                  <h2 className={cn("text-2xl font-bold leading-tight tracking-[-0.02em] text-ink", currentTask.status === "completed" && "line-through text-muted")}>{currentTask.title}</h2>
                  {currentTask.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{currentTask.description}</p> : null}
                </div>
                <button type="button" onClick={() => setEditing(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-stroke px-3 text-sm font-semibold text-muted hover:border-primary/30 hover:bg-surface-subtle hover:text-primary"><Pencil className="size-3.5" /> Edit</button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                {project ? <span className="rounded-full bg-surface-subtle px-2.5 py-1.5">#{project.name}</span> : null}
                {currentTask.priority !== "none" ? <span className="rounded-full bg-primary-soft px-2.5 py-1.5 capitalize text-primary">{currentTask.priority} priority</span> : null}
                {currentTask.location ? <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5"><MapPin className="size-3.5" />{currentTask.location}</span> : null}                {currentTask.startAt ? <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5"><Clock3 className="size-3.5" />{new Date(currentTask.startAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}{currentTask.endAt ? `–${new Date(currentTask.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span> : null}
                {currentTask.due.date ? <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5"><CalendarDays className="size-3.5" />{currentTask.due.date}</span> : null}
                {currentTask.due.at ? <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5"><Clock3 className="size-3.5" />{new Date(currentTask.due.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span> : null}
                {currentTask.reminders.length ? <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5">{currentTask.reminders.length} reminder{currentTask.reminders.length === 1 ? "" : "s"}</span> : null}
                {currentTask.recurrenceRule ? <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5"><Repeat2 className="size-3.5" />Recurring</span> : null}
                {currentTask.tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1.5 font-semibold" style={{ color: tag.color ?? undefined }}><Tag className="size-3.5" />@{tag.name}</span>)}
              </div>
              <div className="mt-7 flex justify-end gap-2 border-t border-stroke pt-4">
                <button type="button" onClick={close} className="h-9 rounded-lg px-3 text-sm font-semibold text-muted hover:bg-surface-subtle hover:text-ink">Close</button>
                <button type="button" onClick={() => setEditing(true)} className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-white hover:bg-primary/90">Modify task</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
