"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  CircleCheckBig,
  Inbox,
  LayoutDashboard,
  Menu,
  LogOut,
  Plus,
  Settings,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { useProjects } from "@/hooks/use-projects";
import { cn } from "@/lib/utils";
import { signOut, useSession } from "next-auth/react";
import { TaskCreateModal } from "./task-create-modal";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
const taskNav: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/today", label: "Today", icon: CalendarDays },
  { href: "/upcoming", label: "Upcoming", icon: CalendarRange },
];

const toolNav: NavItem[] = [
  { href: "/filters", label: "Filters", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

function isRouteActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate?: () => void }) {
  const active = isRouteActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary-soft text-primary"
          : "text-muted hover:bg-surface-subtle hover:text-ink dark:hover:bg-surface-subtle",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
      {active ? <span className="absolute right-0 h-6 w-1 rounded-l-full bg-primary" /> : null}
    </Link>
  );
}

export function Shell({ children, defaultProjectId = null }: { children: React.ReactNode; defaultProjectId?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const waitingForGo = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const { data: projects } = useProjects();
  const { data: session } = useSession();

  const openAddTask = () => { setAddTaskOpen(true); setMobileOpen(false); };

  useEffect(() => {
    let goTimer: ReturnType<typeof setTimeout> | undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing = target instanceof Element && target.matches("input, textarea, select, [contenteditable='true']");
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();

      if (waitingForGo.current) {
        waitingForGo.current = false;
        if (goTimer) clearTimeout(goTimer);
        const routes: Record<string, string> = { i: "/inbox", t: "/today", u: "/upcoming" };
        if (routes[key]) {
          event.preventDefault();
          router.push(routes[key]);
          return;
        }
      }
      if (key === "g") {
        waitingForGo.current = true;
        goTimer = setTimeout(() => { waitingForGo.current = false; }, 800);
      } else if (key === "q") {
        event.preventDefault();
        openAddTask();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); if (goTimer) clearTimeout(goTimer); };
  }, [router]);
  const sidebar = (
    <aside className="flex h-full w-[286px] flex-col border-r border-stroke bg-surface px-4 py-5 dark:border-stroke">
      <div className="flex items-center gap-3 px-2">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <CircleCheckBig className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-extrabold tracking-tight text-ink">Pulse</p>
          <p className="text-xs font-medium text-muted">Tasks, everywhere.</p>
        </div>
      </div>

      <button
        type="button"
        onClick={openAddTask}
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
      >
        <Plus className="size-4" />
        Add task
      </button>

      <div className="pulse-scrollbar mt-6 flex-1 overflow-y-auto pr-1">
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-soft">Tasks</p>
        <nav className="space-y-1" aria-label="Task navigation">
          {taskNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}
        </nav>
        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between px-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-soft">Projects</p>
            <Link href="/projects" className="rounded p-1 text-muted transition hover:bg-surface-subtle hover:text-ink" aria-label="Manage projects">
              <Plus className="size-3.5" />
            </Link>
          </div>
          <nav className="space-y-1" aria-label="Project navigation">
            {projects?.slice(0, 12).map((project) => {
              const href = `/projects/${project.id}`;
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={project.id}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active ? "bg-primary-soft text-primary" : "text-muted hover:bg-surface-subtle hover:text-ink",
                  )}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? "#dc4c3e" }} />
                  <span className="truncate">{project.name}</span>
                  {active ? <span className="absolute right-0 h-5 w-1 rounded-l-full bg-primary" /> : null}
                </Link>
              );
            })}
            {!projects?.length ? <p className="px-3 py-2 text-xs text-muted">No projects yet</p> : null}
          </nav>
        </div>
        <div className="mt-7">
          <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-soft">Tools</p>
          <nav className="space-y-1" aria-label="Tools">
            {toolNav.map((item) => <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />)}
          </nav>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-stroke pt-4">
        <div className="flex items-center justify-between rounded-lg px-3 py-1.5">
          <span className="text-xs font-semibold text-muted">Appearance</span>
          <ThemeToggle compact />
        </div>
        {session?.user ? (
          <div className="flex items-center gap-2 rounded-lg bg-surface-subtle px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink">{session.user.name || "Pulse user"}</p>
              <p className="truncate text-[11px] text-muted">Signed in</p>
            </div>
            <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="Sign out" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-danger">
              <LogOut className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <div className="hidden shrink-0 md:block">{sidebar}</div>
      {mobileOpen ? (
        <>
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[1px] md:hidden"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">{sidebar}</div>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-stroke bg-surface/95 px-4 backdrop-blur md:hidden">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Toggle navigation"
              className="flex size-10 items-center justify-center rounded-lg border border-stroke text-muted transition hover:bg-surface-subtle hover:text-ink md:hidden"
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <div className="md:hidden">
              <p className="font-bold text-ink">Pulse</p>
              <p className="text-[11px] text-muted">Your task workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle compact />
          </div>
        </header>

        <main className="pulse-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <TaskCreateModal open={addTaskOpen} onClose={() => setAddTaskOpen(false)} defaultProjectId={defaultProjectId} />
    </div>
  );
}
