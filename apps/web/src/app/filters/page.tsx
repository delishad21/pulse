"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Dashboard } from "@/components/dashboard";
import { useProjects } from "@/hooks/use-projects";
import type { DashboardFilter } from "@/lib/dashboard-filters";

export default function FiltersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-zinc-500 dark:text-zinc-400">Loading filters…</p>
        </div>
      }
    >
      <FiltersContent />
    </Suspense>
  );
}

function FiltersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: projects } = useProjects();

  const status = searchParams.get("status") as "open" | "completed" | null;
  const projectId = searchParams.get("projectId") ?? undefined;
  const q = searchParams.get("q") ?? "";

  const updateParam = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const qs = params.toString();
    router.replace(`/filters${qs ? `?${qs}` : ""}`);
  };

  const filter: DashboardFilter = {
    type: "filters",
    ...(status ? { status } : {}),
    ...(projectId ? { projectId } : {}),
    ...(q ? { q } : {}),
  };

  return (
    <Dashboard
      title="Filters"
      filter={filter}
      header={
        <div className="mb-6 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap gap-3">
            <select
              value={status ?? ""}
              onChange={(e) =>
                updateParam(
                  "status",
                  e.target.value || undefined,
                )
              }
              aria-label="Status"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All active</option>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
            </select>
            <select
              value={projectId ?? ""}
              onChange={(e) =>
                updateParam(
                  "projectId",
                  e.target.value || undefined,
                )
              }
              aria-label="Project"
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">All projects</option>
              {projects?.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <input
              type="search"
              value={q}
              onChange={(e) =>
                updateParam("q", e.target.value.trim() || undefined)
              }
              placeholder="Search tasks…"
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            />
          </form>
        </div>
      }
    />
  );
}
