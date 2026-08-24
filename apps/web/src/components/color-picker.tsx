"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const themeColors = [
  "#64748b", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#ec4899",
];

interface ColorPickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  showValue?: boolean;
}

function normalizeHex(value: string) {
  const prefixed = value.startsWith("#") ? value : `#${value}`;
  return /^#[\da-f]{6}$/i.test(prefixed) ? prefixed.toLowerCase() : null;
}

export function ColorPicker({ value, onChange, ariaLabel, showValue = false }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", closeOnPointerDown);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (next: string) => {
    setDraft(next);
    onChange(next);
    setOpen(false);
  };
  const applyDraft = (close = false) => {
    const next = normalizeHex(draft);
    if (next) {
      setDraft(next);
      onChange(next);
      if (close) setOpen(false);
    }
    else setDraft(value);
  };
  const toggle = () => {
    if (!open) setDraft(value);
    setOpen((current) => !current);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-color={value}
        onClick={toggle}
        className={cn(
          "inline-flex items-center rounded-lg border border-stroke bg-surface text-sm font-semibold text-ink shadow-sm transition hover:bg-surface-subtle focus-visible:outline-none",
          showValue ? "h-10 gap-2 px-2.5" : "size-8 justify-center p-1.5 opacity-65 group-hover:opacity-100",
        )}
      >
        <span className={cn("shrink-0 rounded-md shadow-sm ring-1 ring-black/10", showValue ? "size-5" : "size-full")} style={{ backgroundColor: value }} />
        {showValue ? <><span className="font-mono text-xs uppercase text-muted">{value}</span><ChevronDown className="size-3.5 text-muted" /></> : null}
      </button>

      {open ? (
        <div role="dialog" aria-label={`${ariaLabel} picker`} className="absolute right-0 top-full z-[110] mt-2 w-[276px] rounded-xl border border-stroke bg-surface p-3 shadow-float">
          <p className="mb-2 text-xs font-bold text-ink">Choose a color</p>
          <div className="grid grid-cols-5 gap-2">
            {themeColors.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Choose color ${color}`}
                onClick={() => choose(color)}
                className={cn("relative size-9 rounded-lg ring-offset-2 ring-offset-surface transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40", value.toLowerCase() === color && "ring-2 ring-ink")}
                style={{ backgroundColor: color }}
              >
                {value.toLowerCase() === color ? <Check className="absolute inset-0 m-auto size-4 text-white drop-shadow" /> : null}
              </button>
            ))}
          </div>
          <label className="mt-3 block text-xs font-semibold text-muted">
            Hex color
            <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-stroke bg-surface-subtle px-2.5 focus-within:border-primary/40">
              <span className="size-4 shrink-0 rounded" style={{ backgroundColor: normalizeHex(draft) ?? value }} />
              <input
                aria-label={`${ariaLabel} hex value`}
                value={draft}
                onChange={(event) => setDraft(event.target.value.slice(0, 7))}
                onBlur={() => applyDraft()}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyDraft(true); } }}
                className="h-9 min-w-0 flex-1 bg-transparent font-mono text-xs uppercase text-ink outline-none"
              />
            </div>
          </label>
        </div>
      ) : null}
    </div>
  );
}
