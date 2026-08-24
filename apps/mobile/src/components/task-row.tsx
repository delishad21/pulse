import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag, MapPin, Repeat2 } from "lucide-react-native";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Project, Task } from "@pulse/api-client";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { priorityColors } from "@/constants/palette";
import { formatTaskDate, taskIsOverdue } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";
import { syncPulseWidgets } from "@/widgets/sync";

export const TaskRow = memo(function TaskRow({ task, project, onPress, onLongPress, compact = false, dragging = false }: { task: Task; project?: Project; onPress: () => void; onLongPress?: () => void; compact?: boolean; dragging?: boolean }) {
  const { api } = useAuth(); const { palette } = useAppTheme(); const queryClient = useQueryClient();
  const complete = useMutation({ mutationFn: () => task.status === "completed" ? api.reopenTask(task.id) : api.completeTask(task.id), onSuccess: async () => { await queryClient.invalidateQueries(); await syncPulseWidgets(api).catch(() => undefined); } });
  const due = formatTaskDate(task); const overdue = taskIsOverdue(task);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={450} disabled={dragging} style={({ pressed }) => [styles.row, compact && styles.compactRow, { borderBottomColor: palette.border, backgroundColor: dragging ? palette.surfaceRaised : "transparent", opacity: pressed || complete.isPending ? 0.58 : 1 }]}>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: task.status === "completed" }} hitSlop={8} onPress={(event) => { event.stopPropagation(); complete.mutate(); }} style={[styles.checkbox, { borderColor: task.priority === "none" ? palette.textMuted : priorityColors[task.priority], backgroundColor: task.status === "completed" ? palette.accent : "transparent" }]}>
        {task.status === "completed" && <Text style={styles.check}>✓</Text>}
      </Pressable>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={[styles.title, { color: palette.text, fontFamily: AppFont }, task.status === "completed" && styles.completed]}>{task.title}</Text>
        {(task.description || due || project || task.tags.length > 0 || task.location || task.recurrenceRule) && <View style={styles.meta}>
          {due && <Text style={[styles.metaText, { color: overdue ? palette.danger : palette.textMuted }]}>{due}</Text>}
          {project && <View style={styles.inline}><View style={[styles.dot, { backgroundColor: project.color ?? palette.textMuted }]} /><Text numberOfLines={1} style={[styles.metaText, { color: palette.textMuted }]}>{project.name}</Text></View>}
          {task.tags.map((tag) => <View key={tag.id} style={[styles.tag, { backgroundColor: `${tag.color ?? palette.accent}20` }]}><Text style={[styles.tagText, { color: tag.color ?? palette.accent }]}>{tag.name}</Text></View>)}
          {task.location && <View style={styles.inline}><MapPin size={12} color={palette.textMuted} /><Text numberOfLines={1} style={[styles.metaText, { color: palette.textMuted }]}>{task.location}</Text></View>}{task.recurrenceRule && <Repeat2 size={12} color={palette.textMuted} />}
        </View>}
      </View>
      {task.priority !== "none" && <Flag size={17} color={priorityColors[task.priority]} fill={priorityColors[task.priority]} style={styles.flag} />}
    </Pressable>
  );
}, (previous, next) => {
  const a = previous.task; const b = next.task;
  const sameTask = a === b || (a.id === b.id && a.title === b.title && a.description === b.description && a.location === b.location && a.status === b.status && a.priority === b.priority && a.startAt === b.startAt && a.endAt === b.endAt && a.due.date === b.due.date && a.due.at === b.due.at && a.recurrenceRule === b.recurrenceRule && a.projectId === b.projectId && a.tags.length === b.tags.length && a.tags.every((tag, index) => tag.id === b.tags[index]?.id && tag.name === b.tags[index]?.name && tag.color === b.tags[index]?.color));
  const sameProject = previous.project === next.project || (previous.project?.id === next.project?.id && previous.project?.name === next.project?.name && previous.project?.color === next.project?.color);
  return sameTask && sameProject && previous.onLongPress === next.onLongPress && previous.compact === next.compact && previous.dragging === next.dragging;
});

const styles = StyleSheet.create({
  row: { minHeight: 58, flexDirection: "row", alignItems: "flex-start", paddingVertical: 11, paddingHorizontal: 0, borderBottomWidth: StyleSheet.hairlineWidth },
  compactRow: { minHeight: 52, paddingVertical: 8 }, checkbox: { width: 21, height: 21, borderWidth: 1.5, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1, marginRight: 11 },
  check: { color: "#fff", fontFamily: AppFontBold, fontSize: 13, lineHeight: 15, fontWeight: "normal" }, copy: { flex: 1, minWidth: 0 }, title: { fontSize: 15.5, lineHeight: 20, fontWeight: "500" }, completed: { textDecorationLine: "line-through", opacity: 0.55 },
  meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 5 }, metaText: { fontFamily: AppFont, fontSize: 11.5, maxWidth: 130 }, inline: { flexDirection: "row", alignItems: "center", gap: 4 }, dot: { width: 7, height: 7, borderRadius: 4 },
  tag: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 }, tagText: { fontFamily: AppFontBold, fontSize: 10.5, fontWeight: "normal" }, flag: { marginTop: 2, marginLeft: 8 },
});
