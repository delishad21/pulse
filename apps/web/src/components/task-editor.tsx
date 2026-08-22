"use client";
import { useState } from "react";
import type { Priority } from "@pulse/domain";
import type { Task } from "@pulse/api-client";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { Plus, Trash2 } from "lucide-react";

interface Props { task: Task; onCancel: () => void; onSaved: () => void; }
const localDateTime = (value: string | null) => { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); };
export function TaskEditor({ task, onCancel, onSaved }: Props) {
  const updateTask = useUpdateTask(); const { data: projects } = useProjects(); const { data: tags } = useTags();
  const [title, setTitle] = useState(task.title); const [description, setDescription] = useState(task.description ?? "");
  const [startAt, setStartAt] = useState(localDateTime(task.startAt)); const [endAt, setEndAt] = useState(localDateTime(task.endAt));
  const [dueDate, setDueDate] = useState(task.due.date ?? ""); const [dueAt, setDueAt] = useState(localDateTime(task.due.at));
  const [priority, setPriority] = useState<Priority>(task.priority); const [projectId, setProjectId] = useState(task.projectId ?? "");
  const [tagIds, setTagIds] = useState(task.tags.map((tag) => tag.id)); const [recurrenceRule, setRecurrenceRule] = useState(task.recurrenceRule ?? "");
  const [reminders, setReminders] = useState(task.reminders.map((reminder) => localDateTime(reminder.remindAt)));
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); if (!title.trim()) return;
    updateTask.mutate({ id: task.id, input: {
      title: title.trim(), description: description.trim() || null, priority, projectId: projectId || null, tagIds,
      startAt: startAt ? new Date(startAt).toISOString() : null, endAt: endAt ? new Date(endAt).toISOString() : null,
      dueDate: dueAt ? null : (dueDate || null), dueAt: dueAt ? new Date(dueAt).toISOString() : null,
      recurrenceRule: recurrenceRule.trim() || null,
      reminders: reminders.filter(Boolean).map((value) => ({ remindAt: new Date(value).toISOString(), channel: "hermes_telegram" })),
    } }, { onSuccess: onSaved });
  };
  return <form onSubmit={submit} className="space-y-4">    <div><label htmlFor={`title-${task.id}`} className="text-xs font-semibold text-muted">Title</label><input id={`title-${task.id}`} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm outline-none focus:border-primary" /></div>
    <div><label htmlFor={`description-${task.id}`} className="text-xs font-semibold text-muted">Description</label><textarea id={`description-${task.id}`} value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm outline-none focus:border-primary" /></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor={`start-${task.id}`} className="text-xs font-semibold text-muted">Start</label><input id={`start-${task.id}`} type="datetime-local" value={startAt} onChange={(event) => setStartAt(event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm" /></div>
      <div><label htmlFor={`end-${task.id}`} className="text-xs font-semibold text-muted">End</label><input id={`end-${task.id}`} type="datetime-local" min={startAt || undefined} value={endAt} onChange={(event) => setEndAt(event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm" /></div>
      <div><label htmlFor={`dueDate-${task.id}`} className="text-xs font-semibold text-muted">Due date</label><input id={`dueDate-${task.id}`} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm" /></div>
      <div><label htmlFor={`dueAt-${task.id}`} className="text-xs font-semibold text-muted">Due date & time</label><input id={`dueAt-${task.id}`} type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm" /></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor={`priority-${task.id}`} className="text-xs font-semibold text-muted">Priority (^)</label><select id={`priority-${task.id}`} value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm"><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
      <div><label htmlFor={`project-${task.id}`} className="text-xs font-semibold text-muted">Project (#)</label><select id={`project-${task.id}`} value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm"><option value="">Inbox</option>{projects?.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label htmlFor={`recurrence-${task.id}`} className="text-xs font-semibold text-muted">Recurrence</label><input id={`recurrence-${task.id}`} value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value)} placeholder="FREQ=WEEKLY;INTERVAL=2" className="mt-1 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm" /><p className="mt-1 text-[11px] text-muted-soft">Examples: FREQ=DAILY;INTERVAL=10, FREQ=WEEKLY, FREQ=MONTHLY.</p></div>
      <div><label htmlFor={`labels-${task.id}`} className="text-xs font-semibold text-muted">Labels (@)</label><select id={`labels-${task.id}`} multiple value={tagIds} onChange={(event) => setTagIds([...event.target.selectedOptions].map((option) => option.value))} className="mt-1 h-24 w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm">{tags?.map((tag) => <option key={tag.id} value={tag.id}>@{tag.name}</option>)}</select></div>
    </div>
    <div>
      <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-muted">Reminders</span><button type="button" onClick={() => setReminders((all) => [...all, ""])} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-primary hover:bg-primary-soft"><Plus className="size-3.5" />Add</button></div>
      <div className="space-y-2">{reminders.map((value, index) => <div key={index} className="flex gap-2"><input type="datetime-local" aria-label={`Edit reminder ${index + 1}`} value={value} onChange={(event) => setReminders((all) => all.map((item, i) => i === index ? event.target.value : item))} className="h-10 min-w-0 flex-1 rounded-lg border border-stroke bg-surface px-3 text-sm" /><button type="button" aria-label={`Remove reminder ${index + 1}`} onClick={() => setReminders((all) => all.filter((_, i) => i !== index))} className="flex size-10 items-center justify-center rounded-lg text-muted hover:bg-red-50 hover:text-danger"><Trash2 className="size-4" /></button></div>)}</div>
    </div>
    <div className="flex justify-end gap-2"><button type="button" onClick={onCancel} className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:bg-surface-subtle">Cancel</button><button type="submit" disabled={updateTask.isPending || !title.trim()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Save</button></div>
  </form>;
}
