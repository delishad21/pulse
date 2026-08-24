import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ListFilter, MoreHorizontal, Plus } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import type { Task } from "@pulse/api-client";
import { ProjectModal } from "@/components/project-modal";
import { FilterModal, defaultTaskFilters } from "@/components/filter-modal";
import { TaskComposer } from "@/components/task-composer";
import { TaskRow } from "@/components/task-row";
import { AppText, EmptyState, IconButton, Screen } from "@/components/ui";
import { formatDayHeading, taskDateKey, taskIsOverdue } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

type ProjectDateRow = { type: "heading"; id: string; title: string } | { type: "task"; id: string; task: Task };

export default function ProjectScreen() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>(); const { api } = useAuth(); const { palette } = useAppTheme(); const queryClient = useQueryClient();
  const [composer, setComposer] = useState<Task | "new" | null>(null); const [editProject, setEditProject] = useState(false);
  const [filters, setFilters] = useState(defaultTaskFilters); const [filterOpen, setFilterOpen] = useState(false);
  const projectQuery = useQuery({ queryKey: ["project", projectId], queryFn: () => api.getProject(projectId) });
  const tasksQuery = useQuery({ queryKey: ["tasks", "project", projectId, filters.includeCompleted], queryFn: () => api.listTasks(filters.includeCompleted ? { projectId } : { projectId, status: "open" }) });
  const sourceTasks = useMemo(() => (tasksQuery.data ?? []).filter((task) => task.status === "open" || filters.includeCompleted), [filters.includeCompleted, tasksQuery.data]); const [draggedTasks, setOrderedTasks] = useState<Task[] | null>(null); const orderedTasks = draggedTasks ?? sourceTasks;
  const dateSortedRows = useMemo(() => {
    const rows: ProjectDateRow[] = [];
    const overdue = sourceTasks.filter((task) => taskIsOverdue(task));
    if (overdue.length) {
      rows.push({ type: "heading", id: "overdue", title: "Overdue" });
      rows.push(...overdue.map((task) => ({ type: "task" as const, id: `overdue-${task.id}`, task })));
    }
    const groups = new Map<string, Task[]>();
    for (const task of sourceTasks.filter((item) => !taskIsOverdue(item))) {
      const key = taskDateKey(task) ?? "no-date";
      groups.set(key, [...(groups.get(key) ?? []), task]);
    }
    for (const [key, tasks] of [...groups.entries()].sort(([a], [b]) => a === "no-date" ? 1 : b === "no-date" ? -1 : a.localeCompare(b))) {
      rows.push({ type: "heading", id: `heading-${key}`, title: key === "no-date" ? "No date" : formatDayHeading(key) });
      rows.push(...tasks.map((task) => ({ type: "task" as const, id: task.id, task })));
    }
    return rows;
  }, [sourceTasks]);
  const reorder = useMutation({ mutationFn: (tasks: Task[]) => api.bulkReorder({ updates: tasks.map((task, index) => ({ id: task.id, sortOrder: (index + 1) * 1000 })) }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["tasks"] }); setOrderedTasks(null); }, onError: () => setOrderedTasks(null) });
  const project = projectQuery.data;
  const renderTask = useCallback(({ item, drag, isActive }: RenderItemParams<Task>) => <ScaleDecorator><TaskRow task={item} project={project} onPress={() => setComposer(item)} onLongPress={drag} dragging={isActive} /></ScaleDecorator>, [project]);
  const renderDateRow = useCallback(({ item }: { item: ProjectDateRow }) => item.type === "heading" ? <AppText style={[styles.section, item.id === "overdue" && { color: palette.danger }]}>{item.title}</AppText> : <TaskRow task={item.task} project={project} onPress={() => setComposer(item.task)} />, [palette.danger, project]);
  const handleDragEnd = useCallback(({ data }: { data: Task[] }) => { setOrderedTasks(data); reorder.mutate(data); }, [reorder]);
  return <Screen><View style={styles.header}><IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} /><View style={styles.titleWrap}>{project && <View style={[styles.dot, { backgroundColor: project.color ?? palette.textMuted }]} />}<AppText numberOfLines={1} style={styles.heading}>{project?.name ?? "Project"}</AppText></View><View style={styles.actions}><IconButton icon={ListFilter} label="Filter tasks" onPress={() => setFilterOpen(true)} /><IconButton icon={MoreHorizontal} label="Edit project" onPress={() => setEditProject(true)} /><IconButton icon={Plus} label="Add task" onPress={() => setComposer("new")} /></View></View>{tasksQuery.isLoading ? <View style={styles.center}><ActivityIndicator color={palette.accent} /></View> : filters.sortByDate ? <FlatList data={dateSortedRows} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} renderItem={renderDateRow} ListEmptyComponent={<EmptyState title="This project is clear" detail="Add the first task when you are ready." />} /> : <DraggableFlatList data={orderedTasks} keyExtractor={(task) => task.id} contentContainerStyle={styles.list} activationDistance={8} dragItemOverflow onDragEnd={handleDragEnd} renderItem={renderTask} ListEmptyComponent={<EmptyState title="This project is clear" detail="Add the first task when you are ready." />} /> }<FilterModal visible={filterOpen} value={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} showProjectTasks={false} showSortByDate /><TaskComposer visible={composer !== null} task={composer === "new" ? null : composer} defaultProjectId={projectId} onClose={() => setComposer(null)} />{project && <ProjectModal visible={editProject} project={project} onClose={() => setEditProject(false)} onRemoved={() => router.replace("/projects")} />}</Screen>;
}
const styles = StyleSheet.create({ header: { minHeight: 78, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 4 }, titleWrap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9 }, heading: { fontSize: 22, fontWeight: "800", letterSpacing: -0.5, flexShrink: 1 }, dot: { width: 12, height: 12, borderRadius: 6 }, actions: { flexDirection: "row" }, list: { paddingHorizontal: 20, paddingBottom: 80 }, section: { fontSize: 13, fontWeight: "700", marginTop: 18, marginBottom: 5 }, center: { flex: 1, alignItems: "center", justifyContent: "center" } });
