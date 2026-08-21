"use client";

import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useProjects, useSections } from "@/hooks/use-projects";
import { useTags } from "@/hooks/use-tags";
import { cn } from "@/lib/utils";
import type { Task } from "@pulse/api-client";
import { parseRecurrenceRule } from "@pulse/domain";

const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .nullable()
    .optional(),
  dueAt: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  sectionId: z.string().nullable().optional(),
  priority: z.enum(["none", "low", "medium", "high", "urgent"]),
  recurrenceRule: z.string().nullable().optional().refine((value) => {
    if (!value?.trim()) return true;
    try { parseRecurrenceRule(value.trim()); return true; } catch { return false; }
  }, "Use a valid RRULE, for example FREQ=WEEKLY;INTERVAL=1"),
  tagIds: z.array(z.string()),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskEditorProps {
  task: Task;
  onCancel: () => void;
  onSaved: () => void;
}

function toLocalDateTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function TaskEditor({ task, onCancel, onSaved }: TaskEditorProps) {
  const updateTask = useUpdateTask();
  const { data: projects } = useProjects();
  const { data: tags } = useTags();

  const resolver: Resolver<TaskFormValues> = zodResolver(taskSchema);
  const form = useForm<TaskFormValues>({
    resolver,
    defaultValues: {
      title: task.title,
      description: task.description,
      dueDate: task.due.date,
      dueAt: toLocalDateTime(task.due.at),
      projectId: task.projectId ?? null,
      sectionId: task.sectionId ?? null,
      priority: task.priority,
      recurrenceRule: task.recurrenceRule,
      tagIds: task.tags.map((tag) => tag.id),
    },
  });

  const selectedProjectId = useWatch({ control: form.control, name: "projectId" });
  const selectedProject = projects?.find((p) => p.id === selectedProjectId);
  const { data: sections } = useSections(selectedProjectId);

  const onSubmit = (values: TaskFormValues) => {
    updateTask.mutate(
      {
        id: task.id,
        input: {
          title: values.title,
          description: values.description,
          dueDate: values.dueAt ? null : (values.dueDate || null),
          dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : null,
          projectId: values.projectId || null,
          sectionId: values.projectId ? (values.sectionId || null) : null,
          priority: values.priority,
          recurrenceRule: values.recurrenceRule?.trim() || null,
          tagIds: values.tagIds,
        },
      },
      { onSuccess: onSaved },
    );
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div>
        <label htmlFor={`title-${task.id}`} className="sr-only">
          Title
        </label>
        <input
          id={`title-${task.id}`}
          {...form.register("title")}
          className="w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface"
          placeholder="Task title"
        />
        {form.formState.errors.title && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {form.formState.errors.title.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`description-${task.id}`} className="sr-only">
          Description
        </label>
        <textarea
          id={`description-${task.id}`}
          {...form.register("description")}
          rows={2}
          className="w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface"
          placeholder="Description"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`dueDate-${task.id}`}
            className="block text-xs font-medium text-muted dark:text-muted-soft"
          >
            Due date
          </label>
          <input
            id={`dueDate-${task.id}`}
            type="date"
            {...form.register("dueDate")}
            className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface"
          />
        </div>
        <div>
          <label
            htmlFor={`dueAt-${task.id}`}
            className="block text-xs font-medium text-muted dark:text-muted-soft"
          >
            Due time (optional)
          </label>
          <input
            id={`dueAt-${task.id}`}
            type="datetime-local"
            {...form.register("dueAt")}
            className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface"
          />
        </div>
      </div>

      <div>
        <label htmlFor={`recurrence-${task.id}`} className="block text-xs font-medium text-muted dark:text-muted-soft">Recurrence rule</label>
        <input
          id={`recurrence-${task.id}`}
          {...form.register("recurrenceRule")}
          placeholder="FREQ=WEEKLY;INTERVAL=1"
          className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface"
        />
        <p className="mt-1 text-xs text-muted-soft">RRULE format; leave blank for a non-recurring task.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`priority-${task.id}`} className="block text-xs font-medium text-muted dark:text-muted-soft">Priority</label>
          <select id={`priority-${task.id}`} {...form.register("priority")} className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface">
            <option value="none">None</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label htmlFor={`labels-${task.id}`} className="block text-xs font-medium text-muted dark:text-muted-soft">Labels</label>
          <select id={`labels-${task.id}`} multiple {...form.register("tagIds")} className="mt-1 h-24 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface">
            {tags?.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`project-${task.id}`}
            className="block text-xs font-medium text-muted dark:text-muted-soft"
          >
            Project
          </label>
          <select
            id={`project-${task.id}`}
            {...form.register("projectId")}
            className="mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface"
          >
            <option value="">No project</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor={`section-${task.id}`}
            className="block text-xs font-medium text-muted dark:text-muted-soft"
          >
            Section
          </label>
          <select
            id={`section-${task.id}`}
            {...form.register("sectionId")}
            disabled={!selectedProject}
            className={cn(
              "mt-1 w-full rounded-lg border border-stroke px-3 py-2 text-sm focus:border-primary focus:outline-none dark:border-stroke dark:bg-surface",
              !selectedProject && "opacity-50",
            )}
          >
            <option value="">No section</option>
            {sections?.map((section) => (
              <option key={section.id} value={section.id}>
                {section.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-subtle dark:text-muted-soft dark:hover:bg-surface-subtle"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={updateTask.isPending}
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </form>
  );
}
