import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Plus, Trash2, X } from "lucide-react-native";
import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import type { Tag } from "@pulse/api-client";
import { projectColors } from "@/constants/palette";
import { AppText, IconButton, PrimaryButton } from "@/components/ui";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export function LabelManager() {
  const { api } = useAuth(); const { palette } = useAppTheme(); const [editing, setEditing] = useState<Tag | "new" | null>(null);
  const query = useQuery({ queryKey: ["tags"], queryFn: () => api.listTags() });
  return <View><View style={styles.headingRow}><View><AppText style={styles.heading}>Labels</AppText><AppText muted style={styles.detail}>Reusable context shown without an extra @ on tasks.</AppText></View><IconButton icon={Plus} label="New label" onPress={() => setEditing("new")} /></View>{(query.data ?? []).map((tag) => <Pressable key={tag.id} onPress={() => setEditing(tag)} style={({ pressed }) => [styles.row, { borderBottomColor: palette.border, opacity: pressed ? 0.6 : 1 }]}><View style={[styles.dot, { backgroundColor: tag.color ?? palette.textMuted }]} /><AppText style={styles.name}>{tag.name}</AppText><MoreHorizontal size={18} color={palette.textMuted} /></Pressable>)}{query.data?.length === 0 && <AppText muted style={styles.empty}>No labels yet.</AppText>}<LabelModal label={editing === "new" ? null : editing} visible={editing !== null} onClose={() => setEditing(null)} /></View>;
}

function LabelModal({ visible, label, onClose }: { visible: boolean; label?: Tag | null; onClose: () => void }) {
  if (!visible) return null;
  return <LabelModalForm key={label?.id ?? "new"} label={label} onClose={onClose} />;
}

function LabelModalForm({ label, onClose }: { label?: Tag | null; onClose: () => void }) {
  const { api } = useAuth(); const { palette } = useAppTheme(); const client = useQueryClient(); const { width } = useWindowDimensions();
  const [name, setName] = useState(label?.name ?? ""); const [color, setColor] = useState(label?.color ?? projectColors[0]); const [error, setError] = useState<string | null>(null);
  const save = useMutation({ mutationFn: () => label ? api.updateTag(label.id, { name: name.trim(), color }) : api.createTag({ name: name.trim(), color }), onSuccess: async () => { await client.invalidateQueries({ queryKey: ["tags"] }); onClose(); }, onError: (value) => setError(value instanceof Error ? value.message : "Could not save label.") });
  const remove = useMutation({ mutationFn: () => api.deleteTag(label!.id), onSuccess: async () => { await client.invalidateQueries(); onClose(); } });
  const confirmDelete = () => Alert.alert("Delete label?", "The label will be removed from its tasks.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => remove.mutate() }]);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><Pressable onPress={onClose} style={[styles.backdrop, { backgroundColor: palette.overlay }]}><Pressable onPress={() => undefined} style={[styles.panel, { width: Math.min(width - 36, 460), backgroundColor: palette.surfaceRaised }]}><View style={styles.modalHeader}><AppText style={styles.modalTitle}>{label ? "Edit label" : "New label"}</AppText><IconButton icon={X} label="Close" onPress={onClose} /></View><TextInput autoFocus value={name} onChangeText={setName} placeholder="Label name" placeholderTextColor={palette.textMuted} style={[styles.input, { color: palette.text }]} /><View style={styles.colors}>{projectColors.map((value) => <Pressable key={value} accessibilityLabel={`Use ${value}`} onPress={() => setColor(value)} style={[styles.color, { backgroundColor: value }, color === value && { borderWidth: 3, borderColor: palette.text }]} />)}</View>{error && <AppText style={{ color: palette.danger }}>{error}</AppText>}<View style={styles.modalActions}>{label ? <IconButton icon={Trash2} label="Delete label" onPress={confirmDelete} /> : <View />}<PrimaryButton loading={save.isPending} disabled={!name.trim()} onPress={() => save.mutate()} style={styles.save}>Save</PrimaryButton></View></Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }, heading: { fontSize: 16, fontWeight: "700" }, detail: { fontSize: 12.5, marginTop: 3 },
  row: { minHeight: 49, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11 }, dot: { width: 12, height: 12, borderRadius: 6 }, name: { flex: 1, fontFamily: AppFont, fontSize: 15 }, empty: { fontFamily: AppFont, paddingVertical: 16, fontSize: 13 },
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 }, panel: { borderRadius: 18, padding: 20, gap: 16 }, modalHeader: { height: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginRight: -8 }, modalTitle: { fontSize: 19, fontWeight: "700" }, input: { fontFamily: AppFontBold, fontSize: 20, fontWeight: "normal", paddingHorizontal: 4, paddingVertical: 8, borderWidth: 0 },
  colors: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, color: { width: 31, height: 31, borderRadius: 16 }, modalActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, save: { minWidth: 112 },
});
