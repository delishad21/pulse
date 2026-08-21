"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Inbox" },
  { href: "/today", label: "Today" },
  { href: "/upcoming", label: "Upcoming" },
  { href: "/projects", label: "Projects" },
  { href: "/filters", label: "Filters" },
  { href: "/completed", label: "Completed" },
  { href: "/search", label: "Search" },
  { href: "/settings", label: "Settings" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const waitingForGo = useRef(false);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        return;
      }
      if (key === "q") {
        event.preventDefault();
        const quickAdd = document.getElementById("quick-add") as HTMLInputElement | null;
        if (quickAdd) quickAdd.focus();
        else router.push("/inbox");
      } else if (key === "/") {
        event.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); if (goTimer) clearTimeout(goTimer); };
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile header */}
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 md:hidden dark:border-zinc-800">
        <Link href="/" className="text-lg font-semibold">
          Pulse
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Toggle navigation"
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-20 w-64 transform border-r border-zinc-200 bg-zinc-50 p-4 transition-transform md:static md:translate-x-0 dark:border-zinc-800 dark:bg-zinc-900",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            Pulse
          </Link>
          <ThemeToggle />
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Backdrop */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-black/25 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto p-4 md:p-8">{children}</main>
      <CommandPalette />
    </div>
  );
}
