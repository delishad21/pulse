import { useQuery } from "@tanstack/react-query";
import { ListFilter, Plus, RotateCw } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import type { Task } from "@pulse/api-client";
import { FilterModal, defaultTaskFilters } from "@/components/filter-modal";
import { TaskComposer } from "@/components/task-composer";
import { TaskRow } from "@/components/task-row";
import { AppText, EmptyState, IconButton, Screen } from "@/components/ui";
import { formatDayHeading, taskDateKey, taskIsOverdue } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

type TaskListRow = { type: "heading"; id: string; title: string } | { type: "task"; id: string; task: Task };

export function TaskListScreen({ view }: { view: "inbox" | "today" }) {
  const { api } = useAuth(); const { palette } = useAppTheme();
  const params = useLocalSearchParams<{ task?: string; create?: string; widgetAction?: string }>(); const openedWidgetAction = useRef<string | null>(null);
  const [filters, setFilters] = useState(defaultTaskFilters); const [filterOpen, setFilterOpen] = useState(false);
  const [composer, setComposer] = useState<Task | "new" | null>(null);
  const tasksQuery = useQuery({ queryKey: ["view", view, filters.includeCompleted], queryFn: () => view === "inbox" ? api.getInbox(filters.includeCompleted) : api.getToday(filters.includeCompleted) });
  const overdueQuery = useQuery({ queryKey: ["view", "overdue"], queryFn: () => api.getOverdue() });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects() });
  const projects = useMemo(() => new Map((projectsQuery.data ?? []).map((project) => [project.id, project])), [projectsQuery.data]);
  const rows = useMemo(() => {
    const applyFilter = (tasks: Task[]) => tasks.filter((task) => filters.includeProjectTasks || !task.projectId);
    const overdue = applyFilter(overdueQuery.data ?? []); const primary = applyFilter(tasksQuery.data ?? []).filter((task) => !taskIsOverdue(task));
    const nextRows: TaskListRow[] = [];
    if (overdue.length) { nextRows.push({ type: "heading", id: "overdue", title: "Overdue" }); nextRows.push(...overdue.map((task) => ({ type: "task" as const, id: `overdue-${task.id}`, task }))); }
    if (primary.length && view === "inbox") {
      const groups = new Map<string, Task[]>();
      for (const task of primary) { const key = taskDateKey(task) ?? "no-date"; groups.set(key, [...(groups.get(key) ?? []), task]); }
      for (const [key, tasks] of [...groups.entries()].sort(([a], [b]) => a === "no-date" ? 1 : b === "no-date" ? -1 : a.localeCompare(b))) {
        nextRows.push({ type: "heading", id: `heading-${key}`, title: key === "no-date" ? "No date" : formatDayHeading(key) });
        nextRows.push(...tasks.map((task) => ({ type: "task" as const, id: task.id, task })));
      }
    } else if (primary.length) { if (overdue.length) nextRows.push({ type: "heading", id: "current", title: "Today" }); nextRows.push(...primary.map((task) => ({ type: "task" as const, id: task.id, task }))); }
    return nextRows;
  }, [filters.includeProjectTasks, overdueQuery.data, tasksQuery.data, view]);
  const refreshing = tasksQuery.isRefetching || overdueQuery.isRefetching;
  useEffect(() => {
    const actionKey = params.widgetAction ?? (params.create ? "create" : params.task ? `task:${params.task}` : null);
    if (!actionKey || openedWidgetAction.current === actionKey) return;
    openedWidgetAction.current = actionKey;
    if (params.create) { Promise.resolve("new" as const).then(setComposer); return; }
    if (!params.task) return;
    const local = [...(tasksQuery.data ?? []), ...(overdueQuery.data ?? [])].find((task) => task.id === params.task);
    if (local) Promise.resolve(local).then(setComposer); else api.getTask(params.task).then(setComposer).catch(() => undefined);
  }, [api, params.create, params.task, params.widgetAction, tasksQuery.data, overdueQuery.data]);
  const refresh = useCallback(() => { tasksQuery.refetch(); overdueQuery.refetch(); projectsQuery.refetch(); }, [overdueQuery, projectsQuery, tasksQuery]);
  const openTask = useCallback((task: Task) => setComposer(task), []);
  const renderItem = useCallback(({ item }: { item: TaskListRow }) => item.type === "heading" ? <AppText style={[styles.section, item.id === "overdue" && { color: palette.danger }]}>{item.title}</AppText> : <TaskRow task={item.task} project={item.task.projectId ? projects.get(item.task.projectId) : undefined} onPress={() => openTask(item.task)} />, [openTask, palette.danger, projects]);
  return <Screen>
    <View style={styles.header}><View><AppText style={styles.heading}>{view === "today" ? "Today" : "Inbox"}</AppText>{view === "today" && <AppText muted style={styles.subheading}>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</AppText>}</View><View style={styles.actions}><IconButton icon={ListFilter} label="Filter tasks" onPress={() => setFilterOpen(true)} /><IconButton icon={Plus} label="Add task" onPress={() => setComposer("new")} /></View></View>
    {tasksQuery.isLoading ? <View style={styles.center}><ActivityIndicator color={palette.accent} /></View> : tasksQuery.isError ? <View style={styles.center}><EmptyState title="Could not load tasks" detail="Your saved list remains available offline. Reconnect and try again." /><IconButton icon={RotateCw} label="Retry" onPress={refresh} /></View> :
      <FlatList data={rows} keyExtractor={(item) => item.id} contentContainerStyle={[styles.list, !rows.length && styles.emptyList]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={palette.accent} />} renderItem={renderItem} ListEmptyComponent={<EmptyState title={view === "today" ? "A clear day" : "Inbox zero"} detail={view === "today" ? "Nothing is due today. Add a task whenever you are ready." : "Loose tasks land here until you give them a home."} />} />}
    <FilterModal visible={filterOpen} value={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} />
    <TaskComposer visible={composer !== null} task={composer === "new" ? null : composer} onClose={() => setComposer(null)} />
  </Screen>;
}

const styles = StyleSheet.create({
  header: { minHeight: 92, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, heading: { fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.7 }, subheading: { fontSize: 13, marginTop: 3 }, actions: { flexDirection: "row", gap: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 90 }, emptyList: { flexGrow: 1, justifyContent: "center" }, section: { fontSize: 13, fontWeight: "700", marginTop: 18, marginBottom: 5 }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
