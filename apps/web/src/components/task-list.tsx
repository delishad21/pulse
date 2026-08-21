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
import { CalendarDays, CheckCircle2, Clock3, GripVertical, Pencil, Tag, Trash2 } from "lucide-react";
import { formatDate, isOverdue, isToday, cn } from "@/lib/utils";
import { useDeleteTask, useCompleteTask, useReopenTask, useReorderTasks } from "@/hooks/use-tasks";
import type { Task } from "@pulse/api-client";
import { TaskEditor } from "./task-editor";

interface TaskListProps {
  tasks: Task[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  reorderable?: boolean;
}

function priorityClass(priority: Task["priority"]) {
  if (priority === "urgent") return "bg-danger";
  if (priority === "high") return "bg-orange-500";
  if (priority === "medium") return "bg-warning";
  if (priority === "low") return "bg-info";
  return "bg-muted-soft";
}

function SortableTaskRow({ task, selected, onSelect, reorderable }: {
  task: Task;
  selected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  reorderable: boolean;
}) {
  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const deleteTask = useDeleteTask();
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: !reorderable });

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

  const toggleCompleted = (checked: boolean) => checked ? completeTask.mutate(task.id) : reopenTask.mutate(task.id);

  return (
    <li
      ref={setNodeRef}
      tabIndex={0}
      onKeyDown={handleRowKeyDown}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-task-id={task.id}
      className={cn(
        "group relative flex min-h-[76px] items-start gap-3 border-b border-stroke px-4 py-4 transition-colors last:border-b-0 hover:bg-surface-subtle md:px-5",
        selected && "bg-primary-soft/60",
        task.status === "completed" && "opacity-65",
        isDragging && "z-10 rounded-lg border-transparent bg-surface shadow-float",
      )}
    >
      <div className="flex w-6 shrink-0 justify-center pt-0.5">
        {reorderable ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${task.title}`}
            className="cursor-grab touch-none rounded-md p-0.5 text-muted-soft opacity-30 transition hover:bg-surface hover:text-muted group-hover:opacity-100 active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        ) : null}
      </div>

      <input
        type="checkbox"
        checked={task.status === "completed"}
        onChange={(event) => toggleCompleted(event.target.checked)}
        aria-label={task.status === "completed" ? "Mark as open" : "Mark as completed"}
        className="mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-soft bg-surface transition checked:border-primary checked:bg-primary hover:border-primary focus:ring-2 focus:ring-primary/20"
      />

      <div className="min-w-0 flex-1">
        {editing ? (
          <TaskEditor task={task} onCancel={() => setEditing(false)} onSaved={() => setEditing(false)} />
        ) : (
          <Link href={`/task/${task.id}`} className="block min-w-0 rounded-md focus-visible:outline-none">
            <span className={cn("block truncate text-[15px] font-semibold leading-5 text-ink", task.status === "completed" && "line-through text-muted")}>{task.title}</span>
            {task.description ? <span className="mt-0.5 block truncate text-sm leading-5 text-muted">{task.description}</span> : null}
            <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted">
              {task.priority !== "none" ? (
                <span className="inline-flex items-center gap-1.5 capitalize"><span className={cn("size-1.5 rounded-full", priorityClass(task.priority))} />{task.priority}</span>
              ) : null}
              {task.tags.map((tag) => <span key={tag.id} className="inline-flex items-center gap-1"><Tag className="size-3" />+{tag.name}</span>)}
              {task.due.date ? (
                <span className={cn("inline-flex items-center gap-1", isOverdue(task.due.date) ? "text-danger" : isToday(task.due.date) ? "text-primary" : "text-muted")}>
                  <CalendarDays className="size-3.5" />{isToday(task.due.date) ? "Today" : formatDate(task.due.date)}
                </span>
              ) : null}
              {task.due.at ? (
                <span className="inline-flex items-center gap-1 text-muted"><Clock3 className="size-3.5" />{new Date(task.due.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              ) : null}
            </span>
          </Link>
        )}
      </div>

      {!editing ? (
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <div className="mr-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <button type="button" onClick={() => setEditing(true)} className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-surface hover:text-ink" aria-label={`Edit ${task.title}`} title="Edit"><Pencil className="size-3.5" /></button>
            <button type="button" onClick={() => deleteTask.mutate(task.id)} className="flex size-8 items-center justify-center rounded-md text-muted transition hover:bg-red-50 hover:text-danger dark:hover:bg-red-950/30" aria-label={`Delete ${task.title}`} title="Delete"><Trash2 className="size-3.5" /></button>
          </div>
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelect(task.id, event.target.checked)}
            aria-label={`Select ${task.title}`}
            className="size-4 cursor-pointer rounded border-stroke accent-primary opacity-45 transition group-hover:opacity-100 checked:opacity-100"
          />
        </div>
      ) : null}
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
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary"><CheckCircle2 className="size-6" /></div>
        <p className="text-sm font-semibold text-ink">You’re all clear</p>
        <p className="mt-1 max-w-sm text-sm text-muted">Add a task above or enjoy the rare moment where everything is handled.</p>
      </div>
    );
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
        <ul>{orderedTasks.map((task) => <SortableTaskRow key={task.id} task={task} selected={selectedIds.includes(task.id)} onSelect={onSelect} reorderable={reorderable} />)}</ul>
      </SortableContext>
    </DndContext>
  );
}
