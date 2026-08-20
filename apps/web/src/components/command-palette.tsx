"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTasks } from "@/hooks/use-tasks";
import { useProjects } from "@/hooks/use-projects";
export function CommandPalette() {
  const [{ open, query }, setPalette] = useState({
    open: false,
    query: "",
  });
  const router = useRouter();
  const { data: tasks } = useTasks();
  const { data: projects } = useProjects();

  const setQuery = (nextQuery: string) => {
    setPalette((prev) => ({ ...prev, query: nextQuery }));
  };

  const closePalette = useCallback(() => {
    setPalette((prev) => ({ ...prev, open: false }));
  }, []);

  const togglePalette = useCallback(() => {
    setPalette((prev) => ({
      open: !prev.open,
      query: prev.open ? prev.query : "",
    }));
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        togglePalette();
      }
      if (e.key === "Escape") {
        closePalette();
      }
    },
    [togglePalette, closePalette],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const taskResults =
    tasks?.filter((t) =>
      t.title.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];

  const projectResults =
    projects?.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()),
    ) ?? [];

  const navigate = (href: string) => {
    router.push(href);
    closePalette();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[15vh]">
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, projects, or jump to a page…"
          className="w-full border-b border-zinc-200 px-4 py-3 text-sm outline-none dark:border-zinc-800 dark:bg-zinc-950"
        />
        <div className="max-h-[60vh] overflow-auto p-2">
          <section>
            <h3 className="px-3 py-1.5 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Pages
            </h3>
            {[
              { label: "Dashboard", href: "/" },
              { label: "Inbox", href: "/inbox" },
              { label: "Today", href: "/today" },
              { label: "Upcoming", href: "/upcoming" },
              { label: "Projects", href: "/projects" },
              { label: "Search", href: "/search" },
              { label: "Settings", href: "/settings" },
            ]
              .filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase()),
              )
              .map((item) => (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => navigate(item.href)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {item.label}
                </button>
              ))}
          </section>

          {projectResults.length > 0 && (
            <section className="mt-2">
              <h3 className="px-3 py-1.5 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Projects
              </h3>
              {projectResults.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: project.color ?? undefined }}
                  />
                  {project.name}
                </button>
              ))}
            </section>
          )}

          {taskResults.length > 0 && (
            <section className="mt-2">
              <h3 className="px-3 py-1.5 text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Tasks
              </h3>
              {taskResults.slice(0, 10).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    // TODO: open task detail when available
                    closePalette();
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {task.title}
                </button>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
