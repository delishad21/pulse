import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import type { Project } from "@pulse/api-client";
import { ProjectModal } from "@/components/project-modal";
import { AppText, EmptyState, IconButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function ProjectsScreen() {
  const { api } = useAuth(); const { palette } = useAppTheme(); const [createOpen, setCreateOpen] = useState(false);
  const query = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects() });
  const renderProject = useCallback(({ item }: { item: Project }) => <Pressable onPress={() => router.push(`/projects/${item.id}`)} style={({ pressed }) => [styles.row, { borderBottomColor: palette.border, opacity: pressed ? 0.55 : 1 }]}><View style={[styles.dot, { backgroundColor: item.color ?? palette.textMuted }]} /><View style={styles.copy}><AppText style={styles.name}>{item.name}</AppText>{item.description && <AppText muted numberOfLines={1} style={styles.description}>{item.description}</AppText>}</View><ChevronRight size={18} color={palette.textMuted} /></Pressable>, [palette.border, palette.textMuted]);
  return <Screen><View style={styles.header}><AppText style={styles.heading}>Projects</AppText><IconButton icon={Plus} label="New project" onPress={() => setCreateOpen(true)} /></View>{query.isLoading ? <View style={styles.center}><ActivityIndicator color={palette.accent} /></View> : <FlatList data={query.data ?? []} keyExtractor={(project) => project.id} contentContainerStyle={styles.list} renderItem={renderProject} ListEmptyComponent={<EmptyState title="No projects yet" detail="Create a project when a task needs more structure than the inbox." />} /> }<ProjectModal visible={createOpen} onClose={() => setCreateOpen(false)} /></Screen>;
}
const styles = StyleSheet.create({ header: { minHeight: 88, paddingHorizontal: 20, paddingTop: 20, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, heading: { fontSize: 28, fontWeight: "800", letterSpacing: -0.7 }, list: { paddingHorizontal: 20, paddingBottom: 80 }, row: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 }, dot: { width: 13, height: 13, borderRadius: 7 }, copy: { flex: 1 }, name: { fontSize: 16, fontWeight: "600" }, description: { fontSize: 12.5, marginTop: 3 }, center: { flex: 1, alignItems: "center", justifyContent: "center" } });
