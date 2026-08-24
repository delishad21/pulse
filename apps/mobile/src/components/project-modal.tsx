import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import type { Project } from "@pulse/api-client";
import { AppText, IconButton, PrimaryButton } from "@/components/ui";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { projectColors } from "@/constants/palette";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export function ProjectModal({ visible, project, onClose, onRemoved }: { visible: boolean; project?: Project | null; onClose: () => void; onRemoved?: () => void }) {
  if (!visible) return null;
  return <ProjectModalForm key={project?.id ?? "new"} project={project} onClose={onClose} onRemoved={onRemoved} />;
}

function ProjectModalForm({ project, onClose, onRemoved }: { project?: Project | null; onClose: () => void; onRemoved?: () => void }) {
  const { api } = useAuth(); const { palette } = useAppTheme(); const client = useQueryClient(); const { width } = useWindowDimensions();
  const [name, setName] = useState(project?.name ?? ""); const [description, setDescription] = useState(project?.description ?? ""); const [color, setColor] = useState<string>(project?.color ?? projectColors[0]); const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => project ? api.updateProject(project.id, { name: name.trim(), description: description.trim() || null, color }) : api.createProject({ name: name.trim(), description: description.trim() || null, color }), onSuccess: async () => { await client.invalidateQueries(); onClose(); }, onError: (value) => setError(value instanceof Error ? value.message : "Could not save project.") });
  const remove = useMutation({ mutationFn: async (action: "archive" | "delete") => { if (action === "archive") await api.archiveProject(project!.id); else await api.deleteProject(project!.id); }, onSuccess: async () => { await client.invalidateQueries(); onClose(); onRemoved?.(); } });
  const confirm = (action: "archive" | "delete") => Alert.alert(`${action === "archive" ? "Archive" : "Delete"} project?`, action === "archive" ? "Tasks stay available and the project leaves active lists." : "The project is soft-deleted. Its tasks remain in Pulse.", [{ text: "Cancel", style: "cancel" }, { text: action === "archive" ? "Archive" : "Delete", style: action === "delete" ? "destructive" : "default", onPress: () => remove.mutate(action) }]);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><Pressable onPress={onClose} style={[styles.backdrop, { backgroundColor: palette.overlay }]}><Pressable onPress={() => undefined} style={[styles.panel, { width: Math.min(width - 36, 480), backgroundColor: palette.surfaceRaised }]}><View style={styles.header}><AppText style={styles.heading}>{project ? "Edit project" : "New project"}</AppText><IconButton icon={X} label="Close" onPress={onClose} /></View><TextInput autoFocus value={name} onChangeText={setName} placeholder="Project name" placeholderTextColor={palette.textMuted} style={[styles.name, { color: palette.text }]} /><TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={palette.textMuted} multiline style={[styles.description, { color: palette.text }]} /><AppText muted style={styles.label}>Colour</AppText><View style={styles.colors}>{projectColors.map((value) => <Pressable accessibilityLabel={`Use ${value}`} key={value} onPress={() => setColor(value)} style={[styles.color, { backgroundColor: value }, color === value && { borderColor: palette.text, borderWidth: 3 }]} />)}</View>{error && <AppText style={{ color: palette.danger }}>{error}</AppText>}<PrimaryButton loading={save.isPending} disabled={!name.trim()} onPress={() => save.mutate()}>{project ? "Save" : "Create project"}</PrimaryButton>{project && <View style={[styles.manage, { borderTopColor: palette.border }]}><Pressable onPress={() => confirm("archive")}><AppText muted style={styles.manageText}>Archive</AppText></Pressable><Pressable onPress={() => confirm("delete")}><AppText style={[styles.manageText, { color: palette.danger }]}>Delete</AppText></Pressable></View>}</Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 }, panel: { borderRadius: 18, padding: 20, gap: 14 }, header: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginRight: -8 }, heading: { fontSize: 19, fontWeight: "700" },
  name: { fontFamily: AppFontBold, fontSize: 21, fontWeight: "normal", paddingHorizontal: 4, paddingVertical: 8, borderWidth: 0 }, description: { fontFamily: AppFont, fontSize: 15, lineHeight: 21, minHeight: 70, textAlignVertical: "top", paddingHorizontal: 4, borderWidth: 0 }, label: { fontSize: 12, fontWeight: "700" }, colors: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 6 }, color: { width: 31, height: 31, borderRadius: 16 }, manage: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 2, flexDirection: "row", justifyContent: "space-between" }, manageText: { fontFamily: AppFontBold, fontSize: 14, fontWeight: "normal", padding: 5 },
});
