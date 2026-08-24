import { createWidget } from "expo-widgets";
import type { TaskWidgetSnapshot, WidgetView } from "@pulse/widget-contracts";
import { WidgetLayout } from "./layout";

export const todayWidget = createWidget<TaskWidgetSnapshot>("PulseToday", WidgetLayout);
export const inboxWidget = createWidget<TaskWidgetSnapshot>("PulseInbox", WidgetLayout);
export const upcomingWidget = createWidget<TaskWidgetSnapshot>("PulseUpcoming", WidgetLayout);
export const overdueWidget = createWidget<TaskWidgetSnapshot>("PulseOverdue", WidgetLayout);

interface FlexibleProps { snapshots: Record<Exclude<WidgetView, "project">, TaskWidgetSnapshot>; }
interface FlexibleConfiguration { view?: Exclude<WidgetView, "project">; showDue?: boolean; showProject?: boolean; }

export const tasksWidget = createWidget<FlexibleProps, FlexibleConfiguration>("PulseTasks", (props, environment) => {
  "widget";
  const view = environment.configuration?.view ?? "today";
  const snapshot = props.snapshots[view] ?? props.snapshots.today;
  return WidgetLayout({
    ...snapshot,
    tasks: snapshot.tasks.map((task) => ({ ...task, dueLabel: environment.configuration?.showDue === false ? null : task.dueLabel, projectName: environment.configuration?.showProject === false ? null : task.projectName })),
  }, environment, (taskId) => {
    const current = props.snapshots[view] ?? props.snapshots.today;
    return { ...props, snapshots: { ...props.snapshots, [view]: { ...current, openCount: Math.max(0, current.openCount - 1), totalCount: Math.max(0, current.totalCount - 1), tasks: current.tasks.filter((task) => task.id !== taskId) } } };
  });
});

export const pulseWidgets = { today: todayWidget, inbox: inboxWidget, upcoming: upcomingWidget, overdue: overdueWidget, tasks: tasksWidget };
