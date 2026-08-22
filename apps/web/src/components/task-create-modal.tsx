"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CalendarDays, Clock3, Hash, Repeat2, Sparkles, Tag, X } from "lucide-react";
import type { Priority } from "@pulse/domain";
import type { CreateTaskInput } from "@pulse/api-client";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects, useSections } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { parseQuickAdd, resolveQuickAddProjectId } from "@/lib/quick-add-parser";
import { localDateKey } from "@/lib/task-dates";

interface TaskCreateModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string | null;
}

function localTimeFromIso(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function localDateFromIso(value?: string | null): string {
  return value ? localDateKey(new Date(value)) : "";
}

function recurrenceLabel(rule?: string | null): string | null {
  if (!rule) return null;
  const day = rule.match(/BYDAY=([A-Z]{2})/i)?.[1]?.toUpperCase();
  const names: Record<string, string> = { MO: "Monday", TU: "Tuesday", WE: "Wednesday", TH: "Thursday", FR: "Friday", SA: "Saturday", SU: "Sunday" };
  if (rule.includes("FREQ=WEEKLY") && day) return `Every ${names[day] ?? day}`;
  if (rule.includes("FREQ=DAILY")) return "Every day";
  if (rule.includes("FREQ=WEEKLY")) return "Every week";
  if (rule.includes("FREQ=MONTHLY")) return "Every month";
  if (rule.includes("FREQ=YEARLY")) return "Every year";
  return "Recurring";
}

export function TaskCreateModal({ open, onClose, defaultProjectId }: TaskCreateModalProps) {
  const createTask = useCreateTask();
  const { data: projects } = useProjects();
  const { data: tags } = useTags();
  const [smartText, setSmartText] = useState("");
  const [description, setDescription] = useState("");
  const [manualProjectId, setManualProjectId] = useState<string | undefined>(undefined);
  const resolvedProjectId = manualProjectId !== undefined
    ? (manualProjectId || null)
    : resolveQuickAddProjectId(smartText, projects, defaultProjectId);
  const { data: sections } = useSections(resolvedProjectId);
  const parsed = useMemo(() => parseQuickAdd(smartText, { projects, sections, tags, defaultProjectId }), [smartText, projects, sections, tags, defaultProjectId]);
  const [manualDueDate, setManualDueDate] = useState<string | undefined>(undefined);
  const [manualDueTime, setManualDueTime] = useState<string | undefined>(undefined);
  const [manualSectionId, setManualSectionId] = useState<string | undefined>(undefined);
  const [manualPriority, setManualPriority] = useState<Priority | undefined>(undefined);
  const [manualRecurrence, setManualRecurrence] = useState<string | undefined>(undefined);
  const [manualTagIds, setManualTagIds] = useState<string[] | undefined>(undefined);
  const [reminderValue, setReminderValue] = useState("");

  const effectiveProjectId = manualProjectId !== undefined ? (manualProjectId || null) : (parsed.projectId ?? defaultProjectId ?? null);
  const effectiveDueDate = manualDueDate !== undefined ? manualDueDate : (parsed.dueDate ?? localDateFromIso(parsed.dueAt));
  const effectiveDueTime = manualDueTime !== undefined ? manualDueTime : localTimeFromIso(parsed.dueAt);
  const effectiveSectionId = manualSectionId !== undefined ? manualSectionId : (parsed.sectionId ?? "");
  const effectivePriority = manualPriority ?? parsed.priority ?? "none";
  const effectiveRecurrence = manualRecurrence !== undefined ? manualRecurrence : (parsed.recurrenceRule ?? "");
  const effectiveTagIds = manualTagIds ?? parsed.tagIds ?? [];

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const reset = () => {
    setSmartText(""); setDescription(""); setManualProjectId(undefined); setManualDueDate(undefined); setManualDueTime(undefined);
    setManualSectionId(undefined); setManualPriority(undefined); setManualRecurrence(undefined); setManualTagIds(undefined); setReminderValue("");
  };

  const close = () => { reset(); onClose(); };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed.title) return;
    const input: CreateTaskInput = {
      ...parsed,
      title: parsed.title,
      description: description.trim() || null,
      projectId: effectiveProjectId,
      sectionId: effectiveProjectId ? (effectiveSectionId || null) : null,
      priority: effectivePriority,
      recurrenceRule: effectiveRecurrence || null,
      tagIds: effectiveTagIds,
      reminderAt: reminderValue ? new Date(reminderValue).toISOString() : null,
    };
    if (effectiveDueTime) {
      const dateKey = effectiveDueDate || localDateKey(new Date());
      const [year, month, day] = dateKey.split("-").map(Number);
      const [hour, minute] = effectiveDueTime.split(":").map(Number);
      input.dueAt = new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
      input.dueDate = null;
    } else {
      input.dueDate = effectiveDueDate || null;
      input.dueAt = null;
    }
    createTask.mutate(input, { onSuccess: close });
  };

  if (!open) return null;
  const recurrence = recurrenceLabel(effectiveRecurrence);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[7vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-task-title" className="w-full max-w-[720px] overflow-hidden rounded-2xl border border-stroke bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-stroke px-5 py-4 md:px-6">
          <div><h2 id="add-task-title" className="text-xl font-bold tracking-tight text-ink">Add task</h2><p className="mt-0.5 text-xs text-muted">Type naturally, then adjust anything below.</p></div>
          <button type="button" onClick={close} aria-label="Close add task" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink"><X className="size-5" /></button>
        </div>
        <form onSubmit={submit}>
          <div className="space-y-5 p-5 md:p-6">
            <div>
              <label htmlFor="smart-task-input" className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted"><Sparkles className="size-3.5 text-primary" /> Smart task</label>
              <textarea id="smart-task-input" autoFocus value={smartText} onChange={(event) => setSmartText(event.target.value)} rows={2} placeholder="e.g. Submit report next Thursday at 3pm #Work +urgent" className="w-full resize-none rounded-xl border border-stroke bg-surface-subtle px-4 py-3 text-[16px] font-medium text-ink outline-none transition placeholder:font-normal placeholder:text-muted-soft focus:border-primary/50 focus:bg-surface" />
              {smartText.trim() ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-muted">
                  {effectiveDueDate ? <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-primary"><CalendarDays className="size-3" />{effectiveDueDate}</span> : null}
                  {effectiveDueTime ? <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-primary"><Clock3 className="size-3" />{effectiveDueTime}</span> : null}
                  {recurrence ? <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-primary"><Repeat2 className="size-3" />{recurrence}</span> : null}
                  {effectiveProjectId ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1"><Hash className="size-3" />{projects?.find((item) => item.id === effectiveProjectId)?.name}</span> : null}
                  {effectiveTagIds.map((id) => <span key={id} className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1"><Tag className="size-3" />{tags?.find((item) => item.id === id)?.name}</span>)}
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="new-task-description" className="text-xs font-semibold text-muted">Description</label>
              <textarea id="new-task-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Optional notes" className="mt-1.5 w-full resize-y rounded-lg border border-stroke bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary/50" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="new-task-date" className="text-xs font-semibold text-muted">Due date</label><input id="new-task-date" type="date" value={effectiveDueDate} onChange={(event) => setManualDueDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" /></div>
              <div><label htmlFor="new-task-time" className="text-xs font-semibold text-muted">Due time</label><input id="new-task-time" type="time" value={effectiveDueTime} onChange={(event) => setManualDueTime(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" /></div>
              <div><label htmlFor="new-task-reminder" className="flex items-center gap-1 text-xs font-semibold text-muted"><AlarmClock className="size-3.5" /> Reminder</label><input id="new-task-reminder" type="datetime-local" value={reminderValue} onChange={(event) => setReminderValue(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50" /></div>
              <div><label htmlFor="new-task-priority" className="text-xs font-semibold text-muted">Priority</label><select id="new-task-priority" value={effectivePriority} onChange={(event) => setManualPriority(event.target.value as Priority)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="new-task-project" className="text-xs font-semibold text-muted">Project</label><select id="new-task-project" value={effectiveProjectId ?? ""} onChange={(event) => { setManualProjectId(event.target.value); setManualSectionId(""); }} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50"><option value="">Inbox</option>{projects?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
              <div><label htmlFor="new-task-section" className="text-xs font-semibold text-muted">Section</label><select id="new-task-section" value={effectiveSectionId} disabled={!effectiveProjectId} onChange={(event) => setManualSectionId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary/50 disabled:opacity-50"><option value="">No section</option>{sections?.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="new-task-recurrence" className="text-xs font-semibold text-muted">Recurrence</label><input id="new-task-recurrence" value={effectiveRecurrence} onChange={(event) => setManualRecurrence(event.target.value)} placeholder="FREQ=WEEKLY;BYDAY=TH" className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none placeholder:text-muted-soft focus:border-primary/50" /><p className="mt-1 text-[11px] text-muted-soft">Natural phrases such as “every Thursday” fill this automatically.</p></div>
              <div><label htmlFor="new-task-labels" className="text-xs font-semibold text-muted">Labels</label><select id="new-task-labels" multiple value={effectiveTagIds} onChange={(event) => setManualTagIds([...event.target.selectedOptions].map((option) => option.value))} className="mt-1.5 h-[76px] w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary/50">{tags?.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select></div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-stroke bg-surface-subtle px-5 py-4 md:px-6">
            <button type="button" onClick={close} className="h-10 rounded-lg px-4 text-sm font-semibold text-muted hover:bg-surface hover:text-ink">Cancel</button>
            <button type="submit" disabled={!parsed.title || createTask.isPending} className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40">{createTask.isPending ? "Adding…" : "Add task"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
