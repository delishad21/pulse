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
    const onOpen = () => setPalette((prev) => ({ ...prev, open: true, query: "" }));
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pulse:command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pulse:command-palette", onOpen);
    };
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4 pt-[12vh] backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-stroke bg-surface shadow-float"
      >
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks, projects, or jump to a page…"
          className="w-full border-b border-stroke bg-transparent px-5 py-4 text-[15px] font-medium text-ink outline-none placeholder:text-muted-soft"
        />
        <div className="pulse-scrollbar max-h-[60vh] overflow-auto p-2.5">
          <section>
            <h3 className="px-3 py-1.5 text-xs font-semibold uppercase text-muted">
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
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-subtle"
                >
                  {item.label}
                </button>
              ))}
          </section>

          {projectResults.length > 0 && (
            <section className="mt-2">
              <h3 className="px-3 py-1.5 text-xs font-semibold uppercase text-muted">
                Projects
              </h3>
              {projectResults.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-subtle"
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
              <h3 className="px-3 py-1.5 text-xs font-semibold uppercase text-muted">
                Tasks
              </h3>
              {taskResults.slice(0, 10).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => navigate(`/task/${task.id}`)}
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-subtle"
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
