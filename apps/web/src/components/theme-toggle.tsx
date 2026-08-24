"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemeMode = "light" | "dark" | "system";

function applyTheme(mode: ThemeMode) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && systemDark));
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("pulse-theme");
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  });

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [mode]);
  const update = (next: ThemeMode) => {
    setMode(next);
    localStorage.setItem("pulse-theme", next);
    applyTheme(next);
  };

  if (compact) {
    const next: Record<ThemeMode, ThemeMode> = { system: "light", light: "dark", dark: "system" };
    const Icon = mode === "light" ? Sun : mode === "dark" ? Moon : Monitor;
    return (
      <button
        type="button"
        onClick={() => update(next[mode])}
        aria-label={`Theme: ${mode}. Click to switch.`}
        title={`Theme: ${mode}`}
        className="flex size-10 items-center justify-center rounded-lg border border-stroke bg-surface text-muted transition hover:bg-surface-subtle hover:text-ink"
      >
        <Icon className="size-[18px]" />
      </button>
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Theme</span>
      <select
        aria-label="Theme"
        suppressHydrationWarning
        value={mode}
        onChange={(event) => update(event.target.value as ThemeMode)}
        className="h-10 rounded-lg border border-stroke bg-surface px-3 text-sm font-medium text-ink outline-none transition focus:border-primary"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
