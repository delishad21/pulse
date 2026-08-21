"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FolderKanban, Plus, Trash2 } from "lucide-react";
import { Shell } from "@/components/shell";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/use-projects";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [name, setName] = useState("");
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProject.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
  };

  return (
    <Shell>
      <div className="mx-auto w-full max-w-[980px] px-4 py-8 md:px-8 md:py-10">
        <div className="mb-7">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Projects</h1>
          <p className="mt-1 text-sm font-medium text-muted">Give related work a home and keep the sidebar focused.</p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6 flex gap-2 rounded-xl border border-stroke bg-surface p-2 shadow-card focus-within:border-primary/40">
          <label htmlFor="new-project-name" className="sr-only">New project name</label>
          <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
            <FolderKanban className="size-4 text-muted" />
            <input
              id="new-project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New project name"
              className="h-10 min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted-soft"
            />
          </div>
          <button
            type="submit"
            disabled={createProject.isPending || !name.trim()}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-40"
          >
            <Plus className="size-4" /> Create
          </button>
        </form>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl border border-stroke bg-surface" />)}
          </div>
        ) : projects?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <li key={project.id} className="group rounded-xl border border-stroke bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <button type="button" onClick={() => router.push(`/projects/${project.id}`)} className="min-w-0 flex-1 text-left" aria-label={`Open project ${project.name}`}>
                    <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-surface-subtle">
                      <span className="size-3 rounded-full" style={{ backgroundColor: project.color ?? "#dc4c3e" }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{project.name}</span>
                      <ArrowRight className="size-4 text-muted-soft transition group-hover:translate-x-0.5 group-hover:text-primary" />
                    </div>
                    <p className="mt-1 text-xs text-muted">Open project workspace</p>
                  </button>
                  <button type="button" onClick={() => deleteProject.mutate(project.id)} className="flex size-8 items-center justify-center rounded-lg text-muted opacity-40 transition hover:bg-red-50 hover:text-danger group-hover:opacity-100 dark:hover:bg-red-950/30" aria-label={`Delete ${project.name}`} title="Delete">
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-stroke bg-surface p-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-xl bg-primary-soft text-primary"><FolderKanban className="size-6" /></div>
            <p className="font-semibold text-ink">No projects yet</p>
            <p className="mt-1 text-sm text-muted">Create one above, then use #project in quick add.</p>
          </div>
        )}
      </div>
    </Shell>
  );
}
