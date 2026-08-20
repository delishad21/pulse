"use client";

import { Shell } from "@/components/shell";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SettingsPage() {
  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Settings</h1>

        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Theme</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Toggle between light and dark mode.
              </p>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div>
              <h2 className="font-medium">Keyboard shortcuts</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Cmd/Ctrl + K opens the command palette.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
