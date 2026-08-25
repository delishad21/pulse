"use client";

import { Command, Palette } from "lucide-react";
import { Shell } from "@/components/shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LabelManager } from "@/components/label-manager";
import { ApiKeyManager } from "@/components/api-key-manager";

export default function SettingsPage() {
  return (
    <Shell>
      <div className="mx-auto w-full max-w-[880px] px-4 py-8 md:px-8 md:py-10">
        <div className="mb-7">
          <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Settings</h1>
          <p className="mt-1 text-sm font-medium text-muted">Tune Pulse to the way you work.</p>
        </div>

        <div className="overflow-hidden rounded-xl border border-stroke bg-surface shadow-card">
          <div className="flex flex-col gap-4 border-b border-stroke p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary"><Palette className="size-5" /></div>
              <div>
                <h2 className="font-semibold text-ink">Appearance</h2>
                <p className="mt-0.5 text-sm text-muted">Choose light, dark, or follow your system.</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <div className="border-b border-stroke p-5">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-subtle text-muted"><Command className="size-5" /></div>
              <div>
                <h2 className="font-semibold text-ink">Keyboard shortcuts</h2>
                <p className="mt-0.5 text-sm leading-6 text-muted">Q add task · G then I/T/U navigate. Focus a task row and use C complete, E edit, D due, P priority, M move.</p>
              </div>
            </div>
          </div>

          <div className="border-b border-stroke p-5"><ApiKeyManager /></div>
          <div className="p-5"><LabelManager /></div>
        </div>
      </div>
    </Shell>
  );
}
