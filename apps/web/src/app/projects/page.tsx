"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { useProjects, useCreateProject, useDeleteProject } from "@/hooks/use-projects";

export default function ProjectsPage() {
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const [name, setName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createProject.mutate({ name: name.trim() }, { onSuccess: () => setName("") });
  };

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Projects</h1>

        <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New project name"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={createProject.isPending || !name.trim()}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
          >
            Create
          </button>
        </form>

        {isLoading ? (
          <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {projects?.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center gap-3"
                >
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: project.color ?? undefined }}
                  />
                  <span className="font-medium">{project.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => deleteProject.mutate(project.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-700 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Shell>
  );
}
