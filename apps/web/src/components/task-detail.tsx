"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  ArrowLeft,
  CalendarDays,
  Clock3,
  MessageSquareText,
  Pencil,
  Plus,
  Repeat2,
  Tag,
  Trash2,
} from "lucide-react";
import { Shell } from "./shell";
import { TaskEditor } from "./task-editor";
import { useTask, useCompleteTask, useReopenTask } from "@/hooks/use-tasks";
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from "@/hooks/use-comments";
import { useCreateReminder, useDeleteReminder, useReminders } from "@/hooks/use-reminders";
import { useTaskHistory } from "@/hooks/use-activity";
import { cn } from "@/lib/utils";
import type { Comment, Task } from "@pulse/api-client";

interface TaskDetailProps { id: string; }

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-stroke bg-surface shadow-card">
      <div className="flex items-center gap-3 border-b border-stroke px-5 py-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary"><Icon className="size-[18px]" /></div>
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CommentRow({ taskId, comment }: { taskId: string; comment: Comment }) {
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(comment.body);

  const save = () => {
    const value = body.trim();
    if (!value) return;
    updateComment.mutate({ taskId, id: comment.id, body: value }, { onSuccess: () => setEditing(false) });
  };

  return (
    <li className="rounded-lg border border-stroke bg-surface-subtle p-3.5">
      {editing ? (
        <div className="space-y-2">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} className="w-full rounded-lg border border-stroke bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setBody(comment.body); setEditing(false); }} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted hover:bg-surface">Cancel</button>
            <button type="button" onClick={save} disabled={!body.trim() || updateComment.isPending} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Save</button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{comment.body}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <time className="text-xs text-muted-soft">{new Date(comment.createdAt).toLocaleString()}</time>
            <span className="flex gap-1">
              <button type="button" onClick={() => setEditing(true)} className="rounded-md px-2 py-1 text-xs font-semibold text-muted hover:bg-surface hover:text-ink">Edit</button>
              <button type="button" onClick={() => deleteComment.mutate({ taskId, id: comment.id })} className="rounded-md px-2 py-1 text-xs font-semibold text-danger hover:bg-red-50 dark:hover:bg-red-950/30">Delete</button>
            </span>
          </div>
        </>
      )}
    </li>
  );
}

function TaskDetailForm({ task }: { task: Task }) {
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const { data: comments } = useComments(task.id);
  const createComment = useCreateComment();
  const { data: reminders } = useReminders(task.id);
  const createReminder = useCreateReminder();
  const deleteReminder = useDeleteReminder(task.id);
  const { data: history } = useTaskHistory(task.id);
  const [isEditing, setIsEditing] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [reminderValue, setReminderValue] = useState("");

  const handleToggleStatus = () => {
    if (task.status === "completed") reopenTask.mutate(task.id);
    else completeTask.mutate(task.id);
  };

  const handleAddComment = (event: React.FormEvent) => {
    event.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    createComment.mutate({ taskId: task.id, input: { body: text } }, { onSuccess: () => setCommentText("") });
  };

  const handleAddReminder = (event: React.FormEvent) => {
    event.preventDefault();
    if (!reminderValue) return;
    createReminder.mutate({ taskId: task.id, remindAt: new Date(reminderValue).toISOString() }, { onSuccess: () => setReminderValue("") });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-stroke bg-surface p-5 shadow-card md:p-6">
        <div className="flex items-start gap-4">
          <input
            type="checkbox"
            checked={task.status === "completed"}
            onChange={handleToggleStatus}
            aria-label={task.status === "completed" ? "Mark as open" : "Mark as completed"}
            className="mt-1 size-6 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-soft bg-surface transition checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <TaskEditor task={task} onCancel={() => setIsEditing(false)} onSaved={() => setIsEditing(false)} />
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <button type="button" onClick={() => setIsEditing(true)} className="min-w-0 flex-1 text-left">
                    <h1 className={cn("text-[26px] font-bold leading-tight tracking-[-0.025em] text-ink", task.status === "completed" && "line-through text-muted")}>{task.title}</h1>
                    {task.description ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{task.description}</p> : null}
                  </button>
                  <button type="button" onClick={() => setIsEditing(true)} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-stroke text-muted transition hover:border-primary/30 hover:bg-surface-subtle hover:text-primary" aria-label={`Edit ${task.title}`} title="Edit task"><Pencil className="size-4" /></button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                  {task.priority !== "none" ? <span className="rounded-full bg-primary-soft px-2.5 py-1 capitalize text-primary">{task.priority} priority</span> : null}
                  {task.tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-muted"><Tag className="size-3" />@{tag.name}</span>)}
                  {task.startAt ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-muted"><Clock3 className="size-3" />{new Date(task.startAt).toLocaleString()}{task.endAt ? ` – ${new Date(task.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span> : null}
                  {task.due.date ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-muted"><CalendarDays className="size-3" />Due {task.due.date}</span> : null}
                  {task.due.at ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-muted"><Clock3 className="size-3" />{new Date(task.due.at).toLocaleString()}</span> : null}
                  {task.recurrenceRule ? <span className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2.5 py-1 text-muted"><Repeat2 className="size-3" />Recurring</span> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard icon={AlarmClock} title="Reminders">
          <form onSubmit={handleAddReminder} className="mb-4 flex flex-wrap gap-2">
            <label htmlFor="reminder-at" className="sr-only">Reminder date and time</label>
            <input id="reminder-at" type="datetime-local" value={reminderValue} onChange={(event) => setReminderValue(event.target.value)} className="h-10 min-w-0 flex-1 rounded-lg border border-stroke bg-surface px-3 text-sm text-ink outline-none focus:border-primary" />
            <button type="submit" disabled={!reminderValue || createReminder.isPending} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-semibold text-white disabled:opacity-40"><Plus className="size-4" /> Add</button>
          </form>
          {reminders?.length ? (
            <ul className="space-y-2">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="flex items-center justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2.5 text-sm text-ink">
                  <span className="min-w-0 truncate">{new Date(reminder.remindAt).toLocaleString()} <span className="text-xs text-muted-soft">({reminder.channel.replaceAll("_", " ")} · {reminder.status})</span></span>
                  <button type="button" onClick={() => deleteReminder.mutate(reminder.id)} className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/30" aria-label="Remove reminder"><Trash2 className="size-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">No reminders yet.</p>}
        </SectionCard>

        <SectionCard icon={Activity} title="Activity">
          {history?.length ? (
            <ol className="space-y-3">
              {history.slice(0, 12).map((event) => (
                <li key={event.id} className="relative pl-5 text-sm before:absolute before:left-0 before:top-1.5 before:size-2 before:rounded-full before:bg-primary">
                  <div className="font-semibold capitalize text-ink">{event.kind.replaceAll(".", " ")}</div>
                  <time className="text-xs text-muted-soft">{new Date(event.createdAt).toLocaleString()}</time>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-muted">No activity yet.</p>}
        </SectionCard>
      </div>

      <SectionCard icon={MessageSquareText} title="Comments">
        <form onSubmit={handleAddComment} className="mb-4 space-y-2">
          <label htmlFor="comment-text" className="sr-only">Add a comment</label>
          <textarea id="comment-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={3} placeholder="Add a note…" className="w-full resize-y rounded-lg border border-stroke bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-muted-soft focus:border-primary" />
          <div className="flex justify-end"><button type="submit" disabled={createComment.isPending || !commentText.trim()} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">Add comment</button></div>
        </form>
        {comments?.length ? <ul className="space-y-3">{comments.map((comment) => <CommentRow key={comment.id} taskId={task.id} comment={comment} />)}</ul> : <p className="text-sm text-muted">No comments yet.</p>}
      </SectionCard>
    </div>
  );
}

export function TaskDetail({ id }: TaskDetailProps) {
  const { data: task, isLoading, error } = useTask(id);
  if (isLoading) return <Shell><div className="mx-auto max-w-[880px] px-4 py-10 md:px-8"><div className="h-52 animate-pulse rounded-xl border border-stroke bg-surface" /></div></Shell>;
  if (error || !task) return <Shell><div className="mx-auto max-w-[880px] px-4 py-10 text-center text-muted md:px-8">{error instanceof Error ? error.message : "Task not found."}</div></Shell>;
  return (
    <Shell>
      <div className="mx-auto w-full max-w-[880px] px-4 py-8 md:px-8 md:py-10">
        <Link href="/" className="mb-5 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted transition hover:bg-surface hover:text-ink"><ArrowLeft className="size-4" /> Back to tasks</Link>
        <TaskDetailForm task={task} />
      </div>
    </Shell>
  );
}
