"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { formatDate, isOverdue, isToday, cn } from "@/lib/utils";
import {
  useDeleteTask,
  useCompleteTask,
  useReopenTask,
  useReorderTasks,
} from "@/hooks/use-tasks";
import type { Task } from "@pulse/api-client";
import { TaskEditor } from "./task-editor";

interface TaskListProps {
  tasks: Task[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  reorderable?: boolean;
}

function SortableTaskRow({
  task,
  selected,
  onSelect,
  reorderable,
}: {
  task: Task;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  reorderable: boolean;
}) {
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const deleteTask = useDeleteTask();
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: !reorderable,
  });

  const handleRowKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    const target = event.target as HTMLElement;
    if (target.matches("input, textarea, select, button, a, [contenteditable='true']")) return;
    const key = event.key.toLowerCase();
    if (key === "c") {
      event.preventDefault();
      if (task.status === "completed") reopenTask.mutate(task.id);
      else completeTask.mutate(task.id);
      return;
    }
    if (["e", "d", "p", "m"].includes(key)) {
      event.preventDefault();
      setEditing(true);
      const field = key === "d" ? `dueDate-${task.id}` : key === "p" ? `priority-${task.id}` : key === "m" ? `project-${task.id}` : `title-${task.id}`;
      setTimeout(() => document.getElementById(field)?.focus(), 0);
    }
  };

  return (
    <li
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={handleRowKeyDown}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-task-id={task.id}
      className={cn(
        "group flex items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors dark:border-zinc-800 dark:bg-zinc-950",
        task.status === "completed" && "opacity-60",
        isDragging && "relative z-10 shadow-lg",
      )}
    >
      {reorderable && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${task.title}`}
          className="mt-0.5 cursor-grab touch-none rounded px-1 py-0.5 text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100 active:cursor-grabbing"
        >
          ⋮⋮
        </button>
      )}
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => onSelect(task.id, e.target.checked)}
        aria-label={`Select ${task.title}`}
        className="mt-1 h-4 w-4 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
      />
      <input
        type="checkbox"
        checked={task.status === "completed"}
        onChange={(e) =>
          e.target.checked ? completeTask.mutate(task.id) : reopenTask.mutate(task.id)
        }
        aria-label={task.status === "completed" ? "Mark as open" : "Mark as completed"}
        className="mt-1 h-4 w-4 cursor-pointer accent-zinc-900 dark:accent-zinc-100"
      />
      <div className="min-w-0 flex-1">
        {editing ? (
          <TaskEditor task={task} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : (
          <Link href={`/task/${task.id}`} className="block w-full text-left">
            <span className={cn("block truncate font-medium", task.status === "completed" && "line-through")}>{task.title}</span>
            {task.description && <span className="block truncate text-sm text-zinc-500 dark:text-zinc-400">{task.description}</span>}
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              {task.priority !== "none" && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{task.priority}</span>
              )}
              {task.tags.map((tag) => (
                <span key={tag.id} className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">+{tag.name}</span>
              ))}
              {task.due.date && (
                <span className={cn(
                  "rounded px-1.5 py-0.5",
                  isOverdue(task.due.date)
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : isToday(task.due.date)
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                )}>
                  {isToday(task.due.date) ? "Today" : formatDate(task.due.date)}
                </span>
              )}
              {task.due.at && (
                <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {new Date(task.due.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </span>
          </Link>
        )}
      </div>
      {!editing && (
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button type="button" onClick={() => setEditing(true)} className="rounded-md p-1.5 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300" aria-label={`Edit ${task.title}`}>Edit</button>
          <button type="button" onClick={() => deleteTask.mutate(task.id)} className="rounded-md p-1.5 text-xs text-zinc-400 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/30 dark:hover:text-red-300" aria-label={`Delete ${task.title}`}>Delete</button>
        </div>
      )}
    </li>
  );
}

export function TaskList({ tasks, selectedIds, onSelect, reorderable = false }: TaskListProps) {
  const orderedTasks = tasks;
  const reorder = useReorderTasks();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );


  if (tasks.length === 0) {
    return <p className="py-8 text-center text-zinc-500 dark:text-zinc-400">No tasks here.</p>;
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const oldIndex = orderedTasks.findIndex((task) => task.id === active.id);
    const newIndex = orderedTasks.findIndex((task) => task.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const activeTask = orderedTasks[oldIndex];
    const overTask = orderedTasks[newIndex];
    if (activeTask.sectionId !== overTask.sectionId) return;

    const next = arrayMove(orderedTasks, oldIndex, newIndex);
    const sameSection = next.filter((task) => task.sectionId === activeTask.sectionId);
    reorder.mutate(sameSection.map((task, index) => ({ id: task.id, sortOrder: (index + 1) * 1000 })));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedTasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <ul className="space-y-2">
          {orderedTasks.map((task) => (
            <SortableTaskRow
              key={task.id}
              task={task}
              selected={selectedIds.includes(task.id)}
              onSelect={onSelect}
              reorderable={reorderable}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
