"use client";

import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateTask } from "@/hooks/use-tasks";
import { useProjects, useSections } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import type { Task } from "@pulse/api-client";

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
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskEditorProps {
  task: Task;
  onCancel: () => void;
  onSaved: () => void;
}

export function TaskEditor({ task, onCancel, onSaved }: TaskEditorProps) {
  const updateTask = useUpdateTask();
  const { data: projects } = useProjects();

  const resolver: Resolver<TaskFormValues> = zodResolver(taskSchema);
  const form = useForm<TaskFormValues>({
    resolver,
    defaultValues: {
      title: task.title,
      description: task.description,
      dueDate: task.due.date,
      dueAt: task.due.at,
      projectId: task.projectId ?? null,
      sectionId: task.sectionId ?? null,
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
          dueDate: values.dueDate ?? null,
          dueAt: values.dueAt ?? null,
          projectId: values.projectId ?? null,
          sectionId: values.sectionId ?? null,
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
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
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
          className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Description"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`dueDate-${task.id}`}
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Due date
          </label>
          <input
            id={`dueDate-${task.id}`}
            type="date"
            {...form.register("dueDate")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label
            htmlFor={`dueAt-${task.id}`}
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Due time (optional)
          </label>
          <input
            id={`dueAt-${task.id}`}
            type="datetime-local"
            {...form.register("dueAt")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor={`project-${task.id}`}
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Project
          </label>
          <select
            id={`project-${task.id}`}
            {...form.register("projectId")}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
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
            className="block text-xs font-medium text-zinc-600 dark:text-zinc-400"
          >
            Section
          </label>
          <select
            id={`section-${task.id}`}
            {...form.register("sectionId")}
            disabled={!selectedProject}
            className={cn(
              "mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900",
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
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={updateTask.isPending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          Save
        </button>
      </div>
    </form>
  );
}
