"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { localDateKey, monthGrid } from "@/lib/task-dates";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}

function dateFromKey(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function displayDate(value: string) {
  const date = dateFromKey(value);
  return date?.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" }) ?? "";
}

export function DatePicker({ value, onChange, ariaLabel, placeholder = "Choose date" }: DatePickerProps) {
  const selectedDate = dateFromKey(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1) : new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const root = useRef<HTMLDivElement>(null);
  const days = useMemo(() => monthGrid(month), [month]);
  const todayKey = localDateKey(new Date());

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

  const changeMonth = (delta: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const choose = (next: string) => { onChange(next); setOpen(false); };
  const toggle = () => {
    if (!open && selectedDate) setMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
    setOpen((current) => !current);
  };

  return (
    <div ref={root} className="relative mt-1">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-value={value}
        onClick={toggle}
        className="flex h-9 w-full items-center gap-2 rounded-lg border border-stroke bg-surface px-2.5 text-left text-sm text-ink shadow-sm transition hover:bg-surface-subtle focus-visible:outline-none"
      >
        <CalendarDays className="size-4 shrink-0 text-muted" />
        <span className={cn("min-w-0 flex-1 truncate", !value && "text-muted-soft")}>{value ? displayDate(value) : placeholder}</span>
      </button>

      {open ? (
        <div role="dialog" aria-label={`${ariaLabel} calendar`} className="absolute left-0 top-full z-[120] mt-2 w-[304px] rounded-xl border border-stroke bg-surface p-3 shadow-float">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => changeMonth(-1)} aria-label={`Previous month for ${ariaLabel}`} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink"><ChevronLeft className="size-4" /></button>
            <p className="text-sm font-bold text-ink">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</p>
            <button type="button" onClick={() => changeMonth(1)} aria-label={`Next month for ${ariaLabel}`} className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-subtle hover:text-ink"><ChevronRight className="size-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-muted-soft">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`} className="py-1.5">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const key = localDateKey(day);
              const selected = key === value;
              const today = key === todayKey;
              const inMonth = day.getMonth() === month.getMonth();
              return <button
                key={key}
                type="button"
                aria-label={`Choose ${day.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
                aria-pressed={selected}
                onClick={() => choose(key)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg text-xs font-semibold transition hover:bg-primary-soft hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  selected ? "bg-primary text-white shadow-sm hover:bg-primary hover:text-white" : inMonth ? "text-ink" : "text-muted-soft",
                  today && !selected && "ring-1 ring-primary/40 text-primary",
                )}
              >{day.getDate()}</button>;
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-stroke pt-3">
            <button type="button" onClick={() => choose("")} className="h-8 rounded-lg px-2.5 text-xs font-semibold text-muted hover:bg-surface-subtle hover:text-ink">Clear</button>
            <button type="button" onClick={() => choose(todayKey)} className="h-8 rounded-lg bg-primary-soft px-3 text-xs font-semibold text-primary hover:bg-primary/10">Today</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
