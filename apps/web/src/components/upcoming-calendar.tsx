"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Task } from "@pulse/api-client";
import { useCompleteTask, useReopenTask, useTasks } from "@/hooks/use-tasks";
import { localDateKey, monthGrid, taskDateKey, weekDays } from "@/lib/task-dates";
import { cn } from "@/lib/utils";
import { Shell } from "./shell";
import { TaskModal } from "./task-modal";
import { TaskComposer } from "./task-composer";

type UpcomingView = "week" | "month";

function tasksForDate(tasks: Task[], date: Date): Task[] {
  const key = localDateKey(date);
  return tasks.filter((task) => taskDateKey(task) === key);
}

function WeekTask({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  return (
    <div className="flex items-start gap-2">
      <input type="checkbox" checked={task.status === "completed"} onChange={(event) => event.target.checked ? complete.mutate(task.id) : reopen.mutate(task.id)} aria-label={`Complete ${task.title}`} className="mt-3 size-4 shrink-0 cursor-pointer rounded border-stroke accent-primary" />
      <button type="button" onClick={onOpen} data-testid="week-task" className="min-w-0 flex-1 rounded-xl border border-stroke bg-surface px-3 py-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
        <span className="line-clamp-2 block text-sm font-semibold leading-5 text-ink">{task.title}</span>
        {task.startAt ? <span className="mt-1 block text-[11px] font-medium text-muted">{new Date(task.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}{task.endAt ? `–${new Date(task.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span> : task.due.at ? <span className="mt-1 block text-[11px] font-medium text-muted">Due {new Date(task.due.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span> : null}
      </button>
    </div>
  );
}

export function UpcomingCalendar() {
  const openTasks = useTasks({ status: "open" });
  const [showCompleted, setShowCompleted] = useState(false);
  const completedTasks = useTasks({ status: "completed" }, showCompleted);
  const tasks = [...(openTasks.data ?? []), ...(showCompleted ? (completedTasks.data ?? []) : [])];
  const isLoading = openTasks.isLoading || (showCompleted && completedTasks.isLoading);
  const [view, setView] = useState<UpcomingView>("week");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [composerDate, setComposerDate] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const week = useMemo(() => weekDays(), []);
  const calendarDays = useMemo(() => monthGrid(month), [month]);
  const todayKey = localDateKey(new Date());

  const changeMonth = (delta: number) => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + delta, 1));
  const resetMonth = () => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  return (
    <Shell>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-8 md:px-8 md:py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Upcoming</h1>
            <p className="mt-1 text-sm font-medium text-muted">Plan your week or scan the month at a glance.</p>
          </div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setShowCompleted((value) => !value)} aria-pressed={showCompleted} className="h-10 rounded-lg border border-stroke bg-surface px-3 text-xs font-semibold text-muted shadow-sm hover:bg-surface-subtle">{showCompleted ? "Hide completed" : "Show completed"}</button><div className="flex items-center rounded-lg border border-stroke bg-surface p-1 shadow-sm" aria-label="Upcoming view">
            <button type="button" onClick={() => setView("week")} className={cn("h-9 rounded-md px-4 text-sm font-semibold transition", view === "week" ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-subtle hover:text-ink")}>Week</button>
            <button type="button" onClick={() => setView("month")} className={cn("h-9 rounded-md px-4 text-sm font-semibold transition", view === "month" ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-subtle hover:text-ink")}>Month</button>
          </div></div>
        </div>

        {isLoading ? <div className="h-80 animate-pulse rounded-xl bg-surface" /> : view === "week" ? (
          <div data-testid="week-scroll" className="pulse-scrollbar -mx-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
            <div className="min-w-[760px] md:min-w-[980px]">
              <div className="mb-3 grid grid-cols-7 gap-2 px-2 md:gap-3 md:px-6">
                {week.map((day) => {
                  const key = localDateKey(day);
                  return <div key={key} data-testid="week-day-header" className={cn("text-center", key === todayKey && "text-primary")}><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-soft">{day.toLocaleDateString([], { weekday: "short" })}</p><p className={cn("mt-1 text-sm font-bold", key === todayKey ? "text-primary" : "text-ink")}>{day.getDate()}</p></div>;
                })}
              </div>
              <div className="grid grid-cols-7 gap-2 md:gap-3">
                {week.map((day) => {
                  const dayTasks = tasksForDate(tasks, day);
                  const key = localDateKey(day);
                  return (
                    <div key={key} data-week-day={key} className="relative min-h-[220px] space-y-2 px-0.5 md:min-h-[360px] md:px-1">
                      {dayTasks.map((task) => <WeekTask key={task.id} task={task} onOpen={() => setSelectedTask(task)} />)}
                      {composerDate === key ? (
                        <TaskComposer defaultDate={key} onCancel={() => setComposerDate(null)} onCreated={() => setComposerDate(null)} className="relative z-40 w-[min(560px,85vw)]" />
                      ) : (
                        <button type="button" onClick={() => setComposerDate(key)} className="inline-flex h-8 items-center gap-1.5 px-1 text-xs font-semibold text-muted hover:text-primary"><Plus className="size-3.5 text-primary" />Add task</button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
              <div className="flex items-center gap-1 rounded-lg border border-stroke bg-surface p-1">
                <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-ink"><ChevronLeft className="size-4" /></button>
                <button type="button" onClick={resetMonth} className="h-8 rounded-md px-3 text-xs font-semibold text-muted hover:bg-surface-subtle hover:text-ink">Today</button>
                <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-ink"><ChevronRight className="size-4" /></button>
              </div>
            </div>
            <div className="pb-3">
              <div className="w-full md:min-w-[900px]">
                <div className="grid grid-cols-7 border-x border-t border-stroke bg-canvas">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <div key={label} className="px-0.5 py-2 text-center text-[9px] font-bold uppercase tracking-[0.08em] text-muted-soft sm:text-[10px] md:px-3 md:text-[11px] md:tracking-[0.12em]">{label}</div>)}
                </div>
                <div className="grid grid-cols-7 border-l border-t border-stroke bg-surface">
                  {calendarDays.map((day) => {
                    const key = localDateKey(day);
                    const dayTasks = tasksForDate(tasks, day);
                    const inMonth = day.getMonth() === month.getMonth();
                    return (
                      <div key={key} data-date={key} className={cn("min-h-[92px] border-b border-r border-stroke p-1 sm:min-h-[108px] md:min-h-[132px] md:p-2", !inMonth && "bg-surface-subtle/60")}>
                        <div className={cn("mb-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold sm:size-6 md:mb-2 md:size-7 md:text-xs", key === todayKey ? "bg-primary text-white" : inMonth ? "text-ink" : "text-muted-soft")}>{day.getDate()}</div>
                        <div className="space-y-1.5">
                          {dayTasks.map((task) => (
                            <button key={task.id} type="button" onClick={() => setSelectedTask(task)} title={task.title} data-testid="month-task" className={cn("block w-full truncate rounded border border-stroke bg-surface px-1 py-1 text-left text-[9px] font-semibold text-ink shadow-sm transition hover:border-primary/35 hover:bg-primary-soft/40 sm:text-[10px] md:rounded-md md:px-2 md:py-1.5 md:text-xs", task.status === "completed" && "line-through opacity-55")}>{task.title}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </Shell>
  );
}
