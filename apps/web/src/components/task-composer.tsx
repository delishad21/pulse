"use client";

import { useMemo, useState } from "react";
import { AlarmClock, ArrowUp, CalendarDays, ChevronDown, Flag, Folder, MapPin, MoreHorizontal, Plus, Repeat2, Tag as TagIcon, Trash2, X } from "lucide-react";
import type { CreateTaskInput } from "@pulse/api-client";
import type { Priority } from "@pulse/domain";
import { useCreateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { parseQuickAddDetailed } from "@/lib/quick-add-parser";
import { localDateKey } from "@/lib/task-dates";
import { cn } from "@/lib/utils";
import { SmartTaskInput } from "./smart-task-input";

type Menu = "schedule" | "priority" | "reminders" | "project" | "labels" | "location" | "more" | null;
interface Props { defaultProjectId?: string | null; defaultDate?: string | null; onCancel: () => void; onCreated?: () => void; className?: string; }
const weekdays = [["MO", "Monday"], ["TU", "Tuesday"], ["WE", "Wednesday"], ["TH", "Thursday"], ["FR", "Friday"], ["SA", "Saturday"], ["SU", "Sunday"]] as const;
const priorityTone: Record<Priority, string> = { none: "#64748b", low: "#3b82f6", medium: "#f59e0b", high: "#f97316", urgent: "#ef4444" };
const toLocalTime = (value?: string | null) => value ? new Date(value).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";
const toLocalDate = (value?: string | null) => value ? localDateKey(new Date(value)) : "";
const makeInstant = (date: string, time: string) => date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return localDateKey(next); };

function recurrenceOption(rule?: string | null) {
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
}
function recurrenceRule(option: string) {
  if (option === "none") return null;
  if (option === "daily") return "FREQ=DAILY";
  if (option === "weekly") return "FREQ=WEEKLY";
  if (option === "biweekly") return "FREQ=WEEKLY;INTERVAL=2";
  if (option === "monthly") return "FREQ=MONTHLY";
  if (option === "weekdays") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
  if (option.startsWith("weekday:")) return `FREQ=WEEKLY;BYDAY=${option.slice(8)}`;
  if (option.startsWith("days:")) return `FREQ=DAILY;INTERVAL=${option.slice(5)}`;
  return null;
}

function Chip({ active, selected, icon: Icon, children, onClick }: { active?: boolean; selected?: boolean; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={cn("inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition", active ? "border-primary/40 bg-primary-soft text-primary" : selected ? "border-stroke bg-surface-subtle text-ink" : "border-stroke bg-surface text-muted hover:bg-surface-subtle hover:text-ink")}><Icon className="size-3.5 shrink-0" /><span className="truncate">{children}</span><ChevronDown className="size-3 shrink-0 opacity-55" /></button>;
}
function Panel({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 rounded-xl border border-stroke bg-surface p-3 shadow-lg">{children}</div>;
}

export function TaskComposer({ defaultProjectId = null, defaultDate = null, onCancel, onCreated, className }: Props) {
  const createTask = useCreateTask();
  const { data: projects } = useProjects();
  const { data: tags } = useTags();
  const [smartText, setSmartText] = useState("");
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const parsed = useMemo(() => parseQuickAddDetailed(smartText, { projects, tags, defaultProjectId, ignoredTokenIds: ignored }), [smartText, projects, tags, defaultProjectId, ignored]);
  const [menu, setMenu] = useState<Menu>(null);
  const [manualProject, setManualProject] = useState<string | undefined>();
  const [manualPriority, setManualPriority] = useState<Priority | undefined>();
  const [manualTags, setManualTags] = useState<string[] | undefined>();
  const [manualDate, setManualDate] = useState<string | undefined>();
  const [manualStart, setManualStart] = useState<string | undefined>();
  const [manualEnd, setManualEnd] = useState<string | undefined>();
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [manualRecurrence, setManualRecurrence] = useState<string | undefined>();
  const [manualLocation, setManualLocation] = useState<string | undefined>();
  const [reminders, setReminders] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [labelFilter, setLabelFilter] = useState("");

  const projectId = manualProject !== undefined ? (manualProject || null) : (parsed.input.projectId ?? defaultProjectId ?? null);
  const priority = manualPriority ?? parsed.input.priority ?? "none";
  const tagIds = manualTags ?? parsed.input.tagIds ?? [];
  const location = manualLocation !== undefined ? manualLocation : (parsed.input.location ?? "");
  const parsedDate = parsed.input.startAt ? toLocalDate(parsed.input.startAt) : parsed.input.dueDate ?? toLocalDate(parsed.input.dueAt);
  const taskDate = manualDate !== undefined ? manualDate : (parsedDate || defaultDate || "");
  const startTime = manualStart !== undefined ? manualStart : toLocalTime(parsed.input.startAt);
  const endTime = manualEnd !== undefined ? manualEnd : toLocalTime(parsed.input.endAt);
  const recurrence = manualRecurrence !== undefined ? manualRecurrence : recurrenceOption(parsed.input.recurrenceRule);
  const selectedProject = projects?.find((project) => project.id === projectId);
  const selectedTags = tags?.filter((tag) => tagIds.includes(tag.id)) ?? [];
  const toggleMenu = (next: Exclude<Menu, null>) => setMenu((current) => current === next ? null : next);
  const setQuickDate = (value: string) => { setManualDate(value); setMenu(null); };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed.input.title) return;
    let startAt: string | null = null;
    let endAt: string | null = null;
    if (taskDate && startTime) {
      startAt = makeInstant(taskDate, startTime);
      if (endTime) {
        endAt = makeInstant(taskDate, endTime);
        if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
          const next = new Date(endAt); next.setDate(next.getDate() + 1); endAt = next.toISOString();
        }
      }
    }
    const input: CreateTaskInput = {
      title: parsed.input.title,
      description: description.trim() || null,
      location: location.trim() || null,
      projectId, priority, tagIds, startAt, endAt,
      recurrenceRule: recurrenceRule(recurrence),
      reminders: reminders.filter(Boolean).map((value) => ({ remindAt: new Date(value).toISOString(), channel: "hermes_telegram" })),
    };
    if (deadlineDate) {
      if (deadlineTime) { input.dueAt = makeInstant(deadlineDate, deadlineTime); input.dueDate = null; }
      else { input.dueDate = deadlineDate; input.dueAt = null; }
    } else if (!startAt) { input.dueDate = taskDate || null; input.dueAt = null; }
    else { input.dueDate = null; input.dueAt = null; }
    createTask.mutate(input, { onSuccess: () => { onCreated?.(); onCancel(); } });
  };

  const scheduleLabel = startTime
    ? `${taskDate ? new Date(`${taskDate}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "Date"} ${startTime}${endTime ? `–${endTime}` : ""}`
    : taskDate ? new Date(`${taskDate}T00:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) : "Date";
  const reminderLabel = reminders.length ? `${reminders.length} reminder${reminders.length === 1 ? "" : "s"}` : "Reminders";
  const labelText = selectedTags.length ? selectedTags.map((tag) => `@${tag.name}`).join(", ") : "Labels";

  return (
    <form onSubmit={submit} className={cn("relative rounded-xl border border-stroke bg-surface p-3 shadow-float", className)}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <SmartTaskInput compact value={smartText} onChange={setSmartText} tokens={parsed.tokens} ignoredTokenIds={ignored} onIgnoreToken={(id) => setIgnored((old) => new Set(old).add(id))} tags={tags} projects={projects} placeholder="Task name · tomorrow 3pm · #project · @label · ^high · *place" />
        </div>
        <button type="button" onClick={onCancel} aria-label="Cancel add task" className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink"><X className="size-4" /></button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip icon={CalendarDays} active={menu === "schedule"} selected={Boolean(taskDate || startTime || recurrence !== "none")} onClick={() => toggleMenu("schedule")}>{scheduleLabel}</Chip>
        <Chip icon={Flag} active={menu === "priority"} selected={priority !== "none"} onClick={() => toggleMenu("priority")}>{priority === "none" ? "Priority" : priority[0]!.toUpperCase() + priority.slice(1)}</Chip>
        <Chip icon={AlarmClock} active={menu === "reminders"} selected={reminders.length > 0} onClick={() => toggleMenu("reminders")}>{reminderLabel}</Chip>
        <Chip icon={Folder} active={menu === "project"} selected={Boolean(projectId)} onClick={() => toggleMenu("project")}>{selectedProject?.name ?? "Inbox"}</Chip>
        <Chip icon={TagIcon} active={menu === "labels"} selected={selectedTags.length > 0} onClick={() => toggleMenu("labels")}>{labelText}</Chip>
        <Chip icon={MapPin} active={menu === "location"} selected={Boolean(location)} onClick={() => toggleMenu("location")}>{location || "Location"}</Chip>
        <Chip icon={MoreHorizontal} active={menu === "more"} selected={Boolean(description || deadlineDate)} onClick={() => toggleMenu("more")}>More</Chip>
        <button type="submit" aria-label="Submit task" disabled={!parsed.input.title || createTask.isPending} className="ml-auto flex size-9 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-40"><ArrowUp className="size-5" /></button>
      </div>

      {menu === "schedule" ? <Panel>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <button type="button" onClick={() => setQuickDate(localDateKey(new Date()))} className="rounded-lg bg-surface-subtle px-3 py-2 text-left font-semibold text-ink">Today</button>
          <button type="button" onClick={() => setQuickDate(addDays(new Date(), 1))} className="rounded-lg bg-surface-subtle px-3 py-2 text-left font-semibold text-ink">Tomorrow</button>
          <button type="button" onClick={() => setQuickDate(addDays(new Date(), 7))} className="rounded-lg bg-surface-subtle px-3 py-2 text-left font-semibold text-ink">Next week</button>
          <button type="button" onClick={() => setQuickDate("")} className="rounded-lg bg-surface-subtle px-3 py-2 text-left font-semibold text-muted">No date</button>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted">Date<input aria-label="Task date" type="date" value={taskDate} onChange={(event) => setManualDate(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stroke bg-surface px-2 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Start<input aria-label="Task start time" type="time" value={startTime} onChange={(event) => setManualStart(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stroke bg-surface px-2 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">End<input aria-label="Task end time" type="time" value={endTime} onChange={(event) => setManualEnd(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stroke bg-surface px-2 text-sm text-ink" /></label>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Repeat2 className="size-4 text-muted" />
          <select aria-label="Task recurrence" value={recurrence.startsWith("days:") ? "custom-days" : recurrence} onChange={(event) => setManualRecurrence(event.target.value === "custom-days" ? "days:7" : event.target.value)} className="h-9 flex-1 rounded-lg border border-stroke bg-surface px-2 text-sm text-ink">
            <option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="monthly">Monthly</option><option value="weekdays">Weekdays</option>
            {weekdays.map(([code, name]) => <option key={code} value={`weekday:${code}`}>Every {name}</option>)}<option value="custom-days">Custom day interval</option>
          </select>
          {recurrence.startsWith("days:") ? <input aria-label="Recurrence day interval" type="number" min={1} value={recurrence.slice(5)} onChange={(event) => setManualRecurrence(`days:${Math.max(1, Number(event.target.value) || 1)}`)} className="h-9 w-20 rounded-lg border border-stroke bg-surface px-2 text-sm" /> : null}
        </div>
      </Panel> : null}

      {menu === "priority" ? <Panel><div className="space-y-1">
        {(["urgent", "high", "medium", "low", "none"] as Priority[]).map((value) => <button key={value} type="button" onClick={() => { setManualPriority(value); setMenu(null); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold capitalize hover:bg-surface-subtle", priority === value && "bg-surface-subtle")}><Flag className="size-4" style={{ color: priorityTone[value] }} />{value}<span className="ml-auto text-xs text-muted">^{value}</span></button>)}
      </div></Panel> : null}

      {menu === "reminders" ? <Panel><div className="space-y-2">
        {reminders.map((value, index) => <div key={index} className="flex gap-2"><input aria-label={`Reminder ${index + 1}`} type="datetime-local" value={value} onChange={(event) => setReminders((all) => all.map((item, i) => i === index ? event.target.value : item))} className="h-9 min-w-0 flex-1 rounded-lg border border-stroke bg-surface px-2 text-sm" /><button type="button" aria-label={`Remove reminder ${index + 1}`} onClick={() => setReminders((all) => all.filter((_, i) => i !== index))} className="flex size-9 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-danger"><Trash2 className="size-4" /></button></div>)}
        <button type="button" onClick={() => setReminders((all) => [...all, ""])} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-primary-soft"><Plus className="size-3.5" />Add reminder</button>
      </div></Panel> : null}

      {menu === "project" ? <Panel><div className="max-h-52 space-y-1 overflow-y-auto">
        <button type="button" onClick={() => { setManualProject(""); setMenu(null); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-subtle", !projectId && "bg-surface-subtle font-semibold")}><Folder className="size-4 text-muted" />Inbox</button>
        {projects?.map((project) => <button key={project.id} type="button" onClick={() => { setManualProject(project.id); setMenu(null); }} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-subtle", projectId === project.id && "bg-surface-subtle font-semibold")}><span className="size-2.5 rounded-full" style={{ backgroundColor: project.color ?? "#dc4c3e" }} />{project.name}</button>)}
      </div></Panel> : null}

      {menu === "labels" ? <Panel>
        <input aria-label="Filter labels" value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)} placeholder="Filter labels…" className="mb-2 h-9 w-full rounded-lg border border-stroke bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary/50" />
        <div className="max-h-52 space-y-1 overflow-y-auto">
          {tags?.filter((tag) => tag.name.toLowerCase().includes(labelFilter.toLowerCase())).map((tag) => {
            const selected = tagIds.includes(tag.id);
            return <button key={tag.id} type="button" onClick={() => setManualTags(selected ? tagIds.filter((id) => id !== tag.id) : [...tagIds, tag.id])} className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-surface-subtle", selected && "bg-surface-subtle font-semibold")}>
              <span className="size-3 rounded-sm" style={{ backgroundColor: tag.color ?? "#64748b" }} />
              <span className="truncate">@{tag.name}</span>
              {selected ? <span className="ml-auto text-primary">✓</span> : null}
            </button>;
          })}
        </div>
      </Panel> : null}

      {menu === "location" ? <Panel>
        <label className="text-xs font-semibold text-muted">Location
          <input autoFocus aria-label="Task location" value={location} onChange={(event) => setManualLocation(event.target.value)} placeholder="e.g. Marina Bay" className="mt-1 h-9 w-full rounded-lg border border-stroke bg-surface px-2.5 text-sm text-ink outline-none focus:border-primary/50" />
        </label>
        <p className="mt-2 text-[11px] text-muted-soft">Smart syntax: *Home or *&quot;Marina Bay&quot;</p>
      </Panel> : null}

      {menu === "more" ? <Panel>
        <label className="block text-xs font-semibold text-muted">Description
          <textarea aria-label="Task description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full resize-y rounded-lg border border-stroke bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-primary/50" />
        </label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold text-muted">Deadline date<input aria-label="Deadline date" type="date" value={deadlineDate} onChange={(event) => setDeadlineDate(event.target.value)} className="mt-1 h-9 w-full rounded-lg border border-stroke bg-surface px-2 text-sm text-ink" /></label>
          <label className="text-xs font-semibold text-muted">Deadline time<input aria-label="Deadline time" type="time" value={deadlineTime} onChange={(event) => setDeadlineTime(event.target.value)} disabled={!deadlineDate} className="mt-1 h-9 w-full rounded-lg border border-stroke bg-surface px-2 text-sm text-ink disabled:opacity-45" /></label>
        </div>
      </Panel> : null}
    </form>
  );
}
