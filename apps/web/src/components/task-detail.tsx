"use client";

import { useState } from "react";
import Link from "next/link";
import { Shell } from "./shell";
import { useTask, useUpdateTask, useCompleteTask, useReopenTask } from "@/hooks/use-tasks";
import { useComments, useCreateComment } from "@/hooks/use-comments";
import { cn } from "@/lib/utils";
import type { Task } from "@pulse/api-client";

interface TaskDetailProps {
  id: string;
}

function TaskDetailForm({ task }: { task: Task }) {
  const updateTask = useUpdateTask();
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const { data: comments } = useComments(task.id);
  const createComment = useCreateComment();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [commentText, setCommentText] = useState("");

  const handleToggleStatus = () => {
    if (task.status === "completed") reopenTask.mutate(task.id);
    else completeTask.mutate(task.id);
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    updateTask.mutate(
      {
        id: task.id,
        input: {
          title: trimmedTitle,
          description: description.trim() || null,
        },
      },
      { onSuccess: () => setIsEditing(false) },
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    createComment.mutate(
      { taskId: task.id, input: { body: text } },
      { onSuccess: () => setCommentText("") },
    );
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={task.status === "completed"}
            onChange={handleToggleStatus}
            aria-label={
              task.status === "completed"
                ? "Mark as open"
                : "Mark as completed"
            }
            className="mt-1.5 h-5 w-5 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
          <div className="min-w-0 flex-1">
            {isEditing ? (
              <div className="space-y-3">
                <label htmlFor="task-title" className="sr-only">
                  Title
                </label>
                <input
                  id="task-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Task title"
                />
                <label htmlFor="task-description" className="sr-only">
                  Description
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
                  placeholder="Description"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={updateTask.isPending || !title.trim()}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="w-full text-left"
              >
                <h1
                  className={cn(
                    "text-xl font-semibold tracking-tight",
                    task.status === "completed" && "line-through",
                  )}
                >
                  {task.title}
                </h1>
                {task.description && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {task.description}
                  </p>
                )}
                <span className="mt-2 block text-xs text-zinc-400">
                  Click to edit
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-medium tracking-tight">Comments</h2>
        <form onSubmit={handleAddComment} className="mb-4 space-y-2">
          <label htmlFor="comment-text" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="comment-text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            rows={3}
            placeholder="Add a note…"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createComment.isPending || !commentText.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              Add comment
            </button>
          </div>
        </form>

        {comments && comments.length > 0 ? (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {comment.body}
                </p>
                <time className="mt-1 block text-xs text-zinc-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No comments yet.
          </p>
        )}
      </div>
    </>
  );
}

export function TaskDetail({ id }: TaskDetailProps) {
  const { data: task, isLoading, error } = useTask(id);

  if (isLoading) {
    return (
      <Shell>
        <div className="mx-auto max-w-3xl">
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            Loading…
          </p>
        </div>
      </Shell>
    );
  }

  if (error ?? !task) {
    return (
      <Shell>
        <div className="mx-auto max-w-3xl">
          <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
            {error instanceof Error ? error.message : "Task not found."}
          </p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            ← Back
          </Link>
        </div>
        <TaskDetailForm task={task} />
      </div>
    </Shell>
  );
}
