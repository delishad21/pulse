"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate, isOverdue, isToday, cn } from "@/lib/utils";
import { useDeleteTask, useCompleteTask, useReopenTask } from "@/hooks/use-tasks";
import type { Task } from "@pulse/api-client";
import { TaskEditor } from "./task-editor";

interface TaskListProps {
  tasks: Task[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onEdit?: (task: Task) => void;
}

export function TaskList({ tasks, selectedIds, onSelect }: TaskListProps) {
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const deleteTask = useDeleteTask();
  const [editingId, setEditingId] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">
        No tasks here.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={cn(
            "group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors dark:border-zinc-800 dark:bg-zinc-950",
            task.status === "completed" && "opacity-60",
          )}
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(task.id)}
            onChange={(e) => onSelect(task.id, e.target.checked)}
            aria-label={`Select ${task.title}`}
            className="mt-1 h-4 w-4 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
          <input
            type="checkbox"
            checked={task.status === "completed"}
            onChange={(e) => e.target.checked ? completeTask.mutate(task.id) : reopenTask.mutate(task.id)}
            aria-label={
              task.status === "completed" ? "Mark as open" : "Mark as completed"
            }
            className="mt-1 h-4 w-4 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
          />
          <div className="min-w-0 flex-1">
            {editingId === task.id ? (
              <TaskEditor
                task={task}
                onCancel={() => setEditingId(null)}
                onSaved={() => setEditingId(null)}
              />
            ) : (
              <Link
                href={`/task/${task.id}`}
                className="block w-full text-left"
              >
                <span
                  className={cn(
                    "block truncate font-medium",
                    task.status === "completed" && "line-through",
                  )}
                >
                  {task.title}
                </span>
                {task.description && (
                  <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {task.description}
                  </span>
                )}
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {task.due.date && (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5",
                        isOverdue(task.due.date)
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : isToday(task.due.date)
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                      )}
                    >
                      {isToday(task.due.date)
                        ? "Today"
                        : formatDate(task.due.date)}
                    </span>
                  )}
                  {task.due.at && (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {new Date(task.due.at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </span>
              </Link>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setEditingId(task.id)}
              className="rounded-md p-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              aria-label={`Edit ${task.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteTask.mutate(task.id)}
              className="rounded-md p-1.5 text-xs text-zinc-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300"
              aria-label={`Delete ${task.title}`}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
