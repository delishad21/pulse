"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Task } from "@pulse/api-client";
import { useTaskView } from "@/hooks/use-tasks";
import { localDateKey, monthGrid, taskDateKey, weekDateLabel, weekDays, startOfCurrentWeek } from "@/lib/task-dates";
import { cn } from "@/lib/utils";
import { Shell } from "./shell";
import { TaskList } from "./task-list";
import { TaskCreateModal } from "./task-create-modal";
import { TaskComposer } from "./task-composer";
import { TaskViewFilter } from "./task-view-filter";

type UpcomingView = "week" | "month";

function tasksForDate(tasks: Task[], date: Date): Task[] {
  const key = localDateKey(date);
  return tasks.filter((task) => taskDateKey(task) === key);
}

function uniqueTasks(...groups: Task[][]): Task[] {
  const byId = new Map<string, Task>();
  for (const task of groups.flat()) byId.set(task.id, task);
  return [...byId.values()];
}

type WeekColumn =
  | { kind: "overdue"; key: "overdue"; tasks: Task[] }
  | { kind: "day"; key: string; date: Date; tasks: Task[] };

export function UpcomingCalendar() {
  const [showCompleted, setShowCompleted] = useState(false);
  const [includeProjectTasks, setIncludeProjectTasks] = useState(false);
  const [view, setView] = useState<UpcomingView>("week");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [composerDate, setComposerDate] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const todayKey = localDateKey(new Date());
  const todayView = useTaskView("today", true, showCompleted);
  const upcomingView = useTaskView("upcoming", true, showCompleted);
  const overdueView = useTaskView("overdue", true, showCompleted);
  const tasks = useMemo(() => uniqueTasks(todayView.data ?? [], upcomingView.data ?? []).filter((task) => includeProjectTasks || task.projectId === null), [includeProjectTasks, todayView.data, upcomingView.data]);
  const overdueTasks = useMemo(() => (overdueView.data ?? []).filter((task) => includeProjectTasks || task.projectId === null), [includeProjectTasks, overdueView.data]);
  const isCurrentWeek = localDateKey(startOfCurrentWeek(weekAnchor)) === localDateKey(startOfCurrentWeek(new Date()));
  const week = useMemo(() => {
    const dates = weekDays(weekAnchor);
    return isCurrentWeek ? dates.filter((date) => localDateKey(date) >= todayKey) : dates;
  }, [isCurrentWeek, todayKey, weekAnchor]);
  const calendarDays = useMemo(() => monthGrid(month), [month]);
  const isLoading = view === "week" && (todayView.isLoading || upcomingView.isLoading || overdueView.isLoading);
  const weekColumns = useMemo<WeekColumn[]>(() => [
    ...(isCurrentWeek && overdueTasks.length ? [{ kind: "overdue" as const, key: "overdue" as const, tasks: overdueTasks }] : []),
    ...week.map((date) => ({ kind: "day" as const, key: localDateKey(date), date, tasks: tasksForDate(tasks, date) })),
  ], [isCurrentWeek, overdueTasks, tasks, week]);

  const changeWeek = (delta: number) => {
    setComposerDate(null);
    setWeekAnchor((value) => {
      const next = new Date(value);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  };
  const resetWeek = () => {
    setComposerDate(null);
    setWeekAnchor(new Date());
  };
  const changeMonth = (delta: number) => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + delta, 1));
  const resetMonth = () => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  return (
    <Shell>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-8 md:px-8 md:py-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Upcoming</h1>
            <p className="mt-1 text-sm font-medium text-muted">Plan the days ahead or scan the month at a glance.</p>
          </div>
          <div className="flex items-center gap-2"><div className="flex items-center rounded-lg border border-stroke bg-surface p-1 shadow-sm"><TaskViewFilter includeProjectTasks={includeProjectTasks} onIncludeProjectTasksChange={setIncludeProjectTasks} /></div><button type="button" onClick={() => setShowCompleted((value) => !value)} aria-pressed={showCompleted} className="h-10 rounded-lg border border-stroke bg-surface px-3 text-xs font-semibold text-muted shadow-sm hover:bg-surface-subtle">{showCompleted ? "Hide completed" : "Show completed"}</button><div className="flex items-center rounded-lg border border-stroke bg-surface p-1 shadow-sm" aria-label="Upcoming view">
            <button type="button" onClick={() => setView("week")} className={cn("h-9 rounded-md px-4 text-sm font-semibold transition", view === "week" ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-subtle hover:text-ink")}>Week</button>
            <button type="button" onClick={() => setView("month")} className={cn("h-9 rounded-md px-4 text-sm font-semibold transition", view === "month" ? "bg-primary text-white shadow-sm" : "text-muted hover:bg-surface-subtle hover:text-ink")}>Month</button>
          </div></div>
        </div>

        {isLoading ? <div className="h-80 animate-pulse rounded-xl bg-surface" /> : view === "week" ? (
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-ink">{week.length ? `${weekDateLabel(week[0]!)} – ${weekDateLabel(week[week.length - 1]!)}` : "Upcoming"}</h2>
              <div className="flex items-center gap-1 rounded-lg border border-stroke bg-surface p-1">
                <button type="button" onClick={() => changeWeek(-1)} aria-label="Previous week" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-ink"><ChevronLeft className="size-4" /></button>
                <button type="button" onClick={resetWeek} className="h-8 rounded-md px-3 text-xs font-semibold text-muted hover:bg-surface-subtle hover:text-ink">Today</button>
                <button type="button" onClick={() => changeWeek(1)} aria-label="Next week" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-surface-subtle hover:text-ink"><ChevronRight className="size-4" /></button>
              </div>
            </div>
            <div data-testid="week-scroll" className="pulse-scrollbar -mx-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
              <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${weekColumns.length}, 290px)`, minWidth: `${weekColumns.length * 290}px` }}>
                {weekColumns.map((column) => {
                  if (column.kind === "overdue") {
                    return <section key={column.key} data-week-overdue className="min-w-0">
                      <div data-testid="week-day-header" className="border-b border-danger/30 pb-3 text-left"><p className="text-sm font-bold text-danger">Overdue</p></div>
                      <div className="border-t border-danger/30">{column.tasks.length ? <TaskList tasks={column.tasks} onEditTask={setEditingTask} rowTestId="week-task" /> : null}</div>
                    </section>;
                  }
                  const { date, key, tasks: dayTasks } = column;
                  return <section key={key} id={`week-day-${key}`} data-week-day={key} className="min-w-0">
                    <div data-testid="week-day-header" className="border-b border-stroke pb-3 text-left"><p className={cn("text-sm font-bold", key === todayKey ? "text-primary" : "text-ink")}>{weekDateLabel(date)}</p></div>
                    <div className="border-t border-stroke">
                      {dayTasks.length ? <TaskList tasks={dayTasks} onEditTask={setEditingTask} rowTestId="week-task" /> : <div className="py-8 text-left text-sm text-muted">No tasks scheduled.</div>}
                    </div>
                    {composerDate === key ? <TaskComposer defaultDate={key} onCancel={() => setComposerDate(null)} onCreated={() => setComposerDate(null)} className="mt-3" /> : <button type="button" onClick={() => setComposerDate(key)} className="mt-2 inline-flex h-8 items-center gap-1.5 px-1 text-xs font-semibold text-muted hover:text-primary"><Plus className="size-3.5 text-primary" />Add task</button>}
                  </section>;
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
                    return <div key={key} data-date={key} className={cn("min-h-[92px] border-b border-r border-stroke p-1 sm:min-h-[108px] md:min-h-[132px] md:p-2", !inMonth && "bg-surface-subtle/60")}>
                      <div className={cn("mb-1 flex size-5 items-center justify-center rounded-full text-[10px] font-bold sm:size-6 md:mb-2 md:size-7 md:text-xs", key === todayKey ? "bg-primary text-white" : inMonth ? "text-ink" : "text-muted-soft")}>{day.getDate()}</div>
                      <div className="space-y-1.5">{dayTasks.map((task) => <button key={task.id} type="button" onClick={() => setEditingTask(task)} title={task.title} data-testid="month-task" className={cn("block w-full truncate rounded border border-stroke bg-surface px-1 py-1 text-left text-[9px] font-semibold text-ink shadow-sm transition hover:border-primary/35 hover:bg-primary-soft/40 sm:text-[10px] md:rounded-md md:px-2 md:py-1.5 md:text-xs", task.status === "completed" && "line-through opacity-55")}>{task.title}</button>)}</div>
                    </div>;
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <TaskCreateModal key={editingTask?.id ?? "closed"} open={Boolean(editingTask)} task={editingTask} onClose={() => setEditingTask(null)} />
    </Shell>
  );
}
