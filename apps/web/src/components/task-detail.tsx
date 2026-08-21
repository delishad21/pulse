"use client";

import { useState } from "react";
import Link from "next/link";
import { Shell } from "./shell";
import { TaskEditor } from "./task-editor";
import { useTask, useCompleteTask, useReopenTask } from "@/hooks/use-tasks";
import { useComments, useCreateComment, useDeleteComment, useUpdateComment } from "@/hooks/use-comments";
import { useCreateReminder, useDeleteReminder, useReminders } from "@/hooks/use-reminders";
import { useTaskHistory } from "@/hooks/use-activity";
import { cn } from "@/lib/utils";
import type { Comment, Task } from "@pulse/api-client";

interface TaskDetailProps { id: string; }

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
    <li className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      {editing ? (
        <div className="space-y-2">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setBody(comment.body); setEditing(false); }} className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
            <button type="button" onClick={save} disabled={!body.trim() || updateComment.isPending} className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950">Save</button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{comment.body}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <time className="text-xs text-zinc-400">{new Date(comment.createdAt).toLocaleString()}</time>
            <span className="flex gap-1">
              <button type="button" onClick={() => setEditing(true)} className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">Edit</button>
              <button type="button" onClick={() => deleteComment.mutate({ taskId, id: comment.id })} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>
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
    <>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={task.status === "completed"} onChange={handleToggleStatus} aria-label={task.status === "completed" ? "Mark as open" : "Mark as completed"} className="mt-1.5 h-5 w-5 cursor-pointer accent-zinc-900 dark:accent-zinc-100" />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <TaskEditor task={task} onCancel={() => setIsEditing(false)} onSaved={() => setIsEditing(false)} />
            ) : (
              <button type="button" onClick={() => setIsEditing(true)} className="w-full text-left">
                <h1 className={cn("text-xl font-semibold tracking-tight", task.status === "completed" && "line-through")}>{task.title}</h1>
                {task.description && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">{task.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                  {task.priority !== "none" && <span className="rounded bg-zinc-100 px-2 py-1 capitalize dark:bg-zinc-800">{task.priority}</span>}
                  {task.tags.map((tag) => <span key={tag.id} className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">+{tag.name}</span>)}
                  {task.due.date && <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Due {task.due.date}</span>}
                  {task.due.at && <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Due {new Date(task.due.at).toLocaleString()}</span>}
                  {task.recurrenceRule && <span className="rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-800">Recurring</span>}
                </div>
                <span className="mt-3 block text-xs text-zinc-400">Click to edit task details</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium tracking-tight">Reminders</h2>
        <form onSubmit={handleAddReminder} className="mb-3 flex flex-wrap gap-2">
          <label htmlFor="reminder-at" className="sr-only">Reminder date and time</label>
          <input id="reminder-at" type="datetime-local" value={reminderValue} onChange={(event) => setReminderValue(event.target.value)} className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" />
          <button type="submit" disabled={!reminderValue || createReminder.isPending} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950">Add reminder</button>
        </form>
        {reminders?.length ? (
          <ul className="space-y-2">
            {reminders.map((reminder) => (
              <li key={reminder.id} className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                <span>{new Date(reminder.remindAt).toLocaleString()} <span className="text-xs text-zinc-400">({reminder.status})</span></span>
                <button type="button" onClick={() => deleteReminder.mutate(reminder.id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Remove</button>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-zinc-500">No reminders.</p>}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium tracking-tight">Comments</h2>
        <form onSubmit={handleAddComment} className="mb-4 space-y-2">
          <label htmlFor="comment-text" className="sr-only">Add a comment</label>
          <textarea id="comment-text" value={commentText} onChange={(event) => setCommentText(event.target.value)} rows={3} placeholder="Add a note…" className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900" />
          <div className="flex justify-end"><button type="submit" disabled={createComment.isPending || !commentText.trim()} className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950">Add comment</button></div>
        </form>
        {comments?.length ? <ul className="space-y-3">{comments.map((comment) => <CommentRow key={comment.id} taskId={task.id} comment={comment} />)}</ul> : <p className="text-sm text-zinc-500">No comments yet.</p>}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium tracking-tight">Activity</h2>
        {history?.length ? (
          <ol className="space-y-2 border-l border-zinc-200 pl-4 dark:border-zinc-800">
            {history.slice(0, 20).map((event) => (
              <li key={event.id} className="text-sm">
                <div className="font-medium">{event.kind.replaceAll(".", " ")}</div>
                <time className="text-xs text-zinc-400">{new Date(event.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-zinc-500">No activity yet.</p>}
      </section>
    </>
  );
}

export function TaskDetail({ id }: TaskDetailProps) {
  const { data: task, isLoading, error } = useTask(id);
  if (isLoading) return <Shell><div className="mx-auto max-w-3xl"><p className="py-8 text-center text-zinc-500">Loading…</p></div></Shell>;
  if (error || !task) return <Shell><div className="mx-auto max-w-3xl"><p className="py-8 text-center text-zinc-500">{error instanceof Error ? error.message : "Task not found."}</p></div></Shell>;
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6"><Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200">← Back</Link></div>
        <TaskDetailForm task={task} />
      </div>
    </Shell>
  );
}
