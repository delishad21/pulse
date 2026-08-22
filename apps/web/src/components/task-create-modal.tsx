"use client";
import { useEffect, useMemo, useState } from "react";
import { AlarmClock, CalendarDays, Clock3, Plus, Repeat2, Sparkles, Trash2, X } from "lucide-react";
import type { Priority } from "@pulse/domain";
import type { CreateTaskInput } from "@pulse/api-client";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { parseQuickAddDetailed } from "@/lib/quick-add-parser";
import { localDateKey } from "@/lib/task-dates";
import { SmartTaskInput } from "./smart-task-input";

interface Props { open: boolean; onClose: () => void; defaultProjectId?: string | null; }
const toLocalDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const toIso = (value: string) => value ? new Date(value).toISOString() : null;
const recurrenceOption = (rule?: string | null) => {
  if (!rule) return "none";
  if (rule === "FREQ=DAILY") return "daily";
  if (rule === "FREQ=WEEKLY") return "weekly";
  if (rule === "FREQ=WEEKLY;INTERVAL=2") return "biweekly";
  if (rule === "FREQ=MONTHLY") return "monthly";
  if (rule === "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR") return "weekdays";
  const weekday = rule.match(/^FREQ=WEEKLY;BYDAY=(MO|TU|WE|TH|FR|SA|SU)$/)?.[1];
  if (weekday) return `weekday:${weekday}`;
  const interval = rule.match(/^FREQ=DAILY;INTERVAL=(\d+)$/)?.[1];
  return interval ? `days:${interval}` : "custom";
};const recurrenceRule = (option: string) => {
  if (option === "none") return null;
  if (option === "daily") return "FREQ=DAILY";
  if (option === "weekly") return "FREQ=WEEKLY";
  if (option === "biweekly") return "FREQ=WEEKLY;INTERVAL=2";
  if (option === "monthly") return "FREQ=MONTHLY";
  if (option === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (option.startsWith("weekday:")) return `FREQ=WEEKLY;BYDAY=${option.slice(8)}`;
  if (option.startsWith("days:")) return `FREQ=DAILY;INTERVAL=${option.slice(5)}`;
  return null;
};
const weekdays = [["MO", "Monday"], ["TU", "Tuesday"], ["WE", "Wednesday"], ["TH", "Thursday"], ["FR", "Friday"], ["SA", "Saturday"], ["SU", "Sunday"]] as const;

export function TaskCreateModal({ open, onClose, defaultProjectId }: Props) {
  const createTask = useCreateTask(); const { data: projects } = useProjects(); const { data: tags } = useTags();
  const [smartText, setSmartText] = useState(""); const [description, setDescription] = useState("");
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const parsed = useMemo(() => parseQuickAddDetailed(smartText, { projects, tags, defaultProjectId, ignoredTokenIds: ignored }), [smartText, projects, tags, defaultProjectId, ignored]);
  const [manualProjectId, setManualProjectId] = useState<string | undefined>();
  const [manualPriority, setManualPriority] = useState<Priority | undefined>();
  const [manualTagIds, setManualTagIds] = useState<string[] | undefined>();
  const [manualStartAt, setManualStartAt] = useState<string | undefined>(); const [manualEndAt, setManualEndAt] = useState<string | undefined>();
  const [manualDueDate, setManualDueDate] = useState<string | undefined>(); const [manualDueTime, setManualDueTime] = useState<string | undefined>();
  const [manualRecurrence, setManualRecurrence] = useState<string | undefined>(); const [reminders, setReminders] = useState<string[]>([]);
  const projectId = manualProjectId !== undefined ? (manualProjectId || null) : (parsed.input.projectId ?? defaultProjectId ?? null);
  const priority = manualPriority ?? parsed.input.priority ?? "none"; const tagIds = manualTagIds ?? parsed.input.tagIds ?? [];
  const startAt = manualStartAt !== undefined ? manualStartAt : toLocalDateTime(parsed.input.startAt);
  const endAt = manualEndAt !== undefined ? manualEndAt : toLocalDateTime(parsed.input.endAt);
  const dueDate = manualDueDate !== undefined ? manualDueDate : (parsed.input.dueDate ?? (parsed.input.dueAt ? localDateKey(new Date(parsed.input.dueAt)) : ""));
  const dueTime = manualDueTime !== undefined ? manualDueTime : (parsed.input.dueAt ? new Date(parsed.input.dueAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
  const recurrence = manualRecurrence !== undefined ? manualRecurrence : recurrenceOption(parsed.input.recurrenceRule);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  const reset = () => {
    setSmartText(""); setDescription(""); setIgnored(new Set()); setManualProjectId(undefined); setManualPriority(undefined); setManualTagIds(undefined);
    setManualStartAt(undefined); setManualEndAt(undefined); setManualDueDate(undefined); setManualDueTime(undefined); setManualRecurrence(undefined); setReminders([]);
  };
  const close = () => { reset(); onClose(); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (!parsed.input.title) return;
    const input: CreateTaskInput = {
      title: parsed.input.title, description: description.trim() || null, projectId, priority, tagIds,
      startAt: toIso(startAt), endAt: toIso(endAt), recurrenceRule: recurrenceRule(recurrence),
      reminders: reminders.filter(Boolean).map((value) => ({ remindAt: new Date(value).toISOString(), channel: "hermes_telegram" })),
    };
    if (dueTime) {
      const date = dueDate || (startAt ? localDateKey(new Date(startAt)) : localDateKey(new Date()));
      input.dueAt = new Date(`${date}T${dueTime}:00`).toISOString(); input.dueDate = null;
    } else { input.dueDate = dueDate || null; input.dueAt = null; }
    createTask.mutate(input, { onSuccess: close });
  };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/45 px-4 py-[5vh] backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="add-task-title" className="w-full max-w-[760px] overflow-hidden rounded-2xl border border-stroke bg-surface shadow-float">
        <div className="flex items-center justify-between border-b border-stroke px-5 py-4 md:px-6">
          <div><h2 id="add-task-title" className="text-xl font-bold text-ink">Add task</h2><p className="mt-0.5 text-xs text-muted">Use #project, @label and ^priority. Backspace once after a highlight to treat it as normal text.</p></div>
          <button type="button" onClick={close} aria-label="Close add task" className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle"><X className="size-5" /></button>
        </div>
        <form onSubmit={submit}><div className="space-y-5 p-5 md:p-6">
          <div><label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted"><Sparkles className="size-3.5 text-primary" />Smart task</label>
            <SmartTaskInput value={smartText} onChange={setSmartText} tokens={parsed.tokens} ignoredTokenIds={ignored} onIgnoreToken={(id) => setIgnored((old) => new Set(old).add(id))} placeholder="e.g. Gym next Thursday 7pm-8pm #Health @routine ^high" />
          </div>
          <div><label htmlFor="new-task-description" className="text-xs font-semibold text-muted">Description</label><textarea id="new-task-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} placeholder="Optional notes" className="mt-1.5 w-full resize-y rounded-lg border border-stroke bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary/50" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="new-task-start" className="flex items-center gap-1 text-xs font-semibold text-muted"><Clock3 className="size-3.5" />Start</label><input id="new-task-start" type="datetime-local" value={startAt} onChange={(event) => setManualStartAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm" /></div>
            <div><label htmlFor="new-task-end" className="text-xs font-semibold text-muted">End</label><input id="new-task-end" type="datetime-local" min={startAt || undefined} value={endAt} onChange={(event) => setManualEndAt(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm" /></div>
            <div><label htmlFor="new-task-date" className="flex items-center gap-1 text-xs font-semibold text-muted"><CalendarDays className="size-3.5" />Due date</label><input id="new-task-date" type="date" value={dueDate} onChange={(event) => setManualDueDate(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm" /></div>
            <div><label htmlFor="new-task-time" className="text-xs font-semibold text-muted">Due time</label><input id="new-task-time" type="time" value={dueTime} onChange={(event) => setManualDueTime(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm" /></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="new-task-priority" className="text-xs font-semibold text-muted">Priority (^)</label><select id="new-task-priority" value={priority} onChange={(event) => setManualPriority(event.target.value as Priority)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm"><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label htmlFor="new-task-project" className="text-xs font-semibold text-muted">Project (#)</label><select id="new-task-project" value={projectId ?? ""} onChange={(event) => setManualProjectId(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm"><option value="">Inbox</option>{projects?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="new-task-recurrence" className="flex items-center gap-1 text-xs font-semibold text-muted"><Repeat2 className="size-3.5" />Recurrence</label>
              <select id="new-task-recurrence" value={recurrence.startsWith("days:") ? "custom-days" : recurrence} onChange={(event) => setManualRecurrence(event.target.value === "custom-days" ? "days:7" : event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-stroke bg-surface px-3 text-sm">
                <option value="none">None</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="weekdays">Weekdays</option>
                {weekdays.map(([code, name]) => <option key={code} value={`weekday:${code}`}>Every {name}</option>)}<option value="custom-days">Custom day interval</option>
              </select>
              {recurrence.startsWith("days:") ? <input type="number" min={1} aria-label="Recurrence day interval" value={recurrence.slice(5)} onChange={(event) => setManualRecurrence(`days:${Math.max(1, Number(event.target.value) || 1)}`)} className="mt-2 h-9 w-full rounded-lg border border-stroke bg-surface px-3 text-sm" /> : null}
            </div>
            <div><label htmlFor="new-task-labels" className="text-xs font-semibold text-muted">Labels (@)</label><select id="new-task-labels" multiple value={tagIds} onChange={(event) => setManualTagIds([...event.target.selectedOptions].map((option) => option.value))} className="mt-1.5 h-[88px] w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm">{tags?.map((tag) => <option key={tag.id} value={tag.id}>@{tag.name}</option>)}</select></div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between"><label className="flex items-center gap-1 text-xs font-semibold text-muted"><AlarmClock className="size-3.5" />Reminders</label><button type="button" onClick={() => setReminders((all) => [...all, ""])} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"><Plus className="size-3.5" />Add reminder</button></div>
            <div className="space-y-2">
              {reminders.length ? reminders.map((value, index) => <div key={index} className="flex gap-2"><input aria-label={`Reminder ${index + 1}`} type="datetime-local" value={value} onChange={(event) => setReminders((all) => all.map((item, i) => i === index ? event.target.value : item))} className="h-10 min-w-0 flex-1 rounded-lg border border-stroke bg-surface px-3 text-sm" /><button type="button" aria-label={`Remove reminder ${index + 1}`} onClick={() => setReminders((all) => all.filter((_, i) => i !== index))} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-danger"><Trash2 className="size-4" /></button></div>) : <p className="text-xs text-muted-soft">No reminders. They are stored for the Hermes Telegram channel; actual Telegram dispatch will be wired separately.</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-stroke bg-surface-subtle px-5 py-4 md:px-6">
          <button type="button" onClick={close} className="h-10 rounded-lg px-4 text-sm font-semibold text-muted hover:bg-surface">Cancel</button>
          <button type="submit" disabled={!parsed.input.title || createTask.isPending} className="h-10 rounded-lg bg-primary px-5 text-sm font-semibold text-white disabled:opacity-40">{createTask.isPending ? "Adding…" : "Add task"}</button>
        </div></form>
      </div>
    </div>
  );
}
