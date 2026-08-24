import { X } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Switch, View } from "react-native";
import { AppText, IconButton } from "@/components/ui";
import { useAppTheme } from "@/providers/theme-provider";

export interface TaskFilters { includeProjectTasks: boolean; includeCompleted: boolean; sortByDate: boolean; }
export const defaultTaskFilters: TaskFilters = { includeProjectTasks: false, includeCompleted: false, sortByDate: false };

export function FilterModal({ visible, value, onChange, onClose, showProjectTasks = true, showSortByDate = false }: { visible: boolean; value: TaskFilters; onChange: (value: TaskFilters) => void; onClose: () => void; showProjectTasks?: boolean; showSortByDate?: boolean }) {
  const { palette } = useAppTheme();
  const row = (title: string, detail: string, key: keyof TaskFilters) => <View style={styles.row}><View style={styles.copy}><AppText style={styles.title}>{title}</AppText><AppText muted style={styles.detail}>{detail}</AppText></View><Switch value={value[key]} onValueChange={(next) => onChange({ ...value, [key]: next })} trackColor={{ true: palette.accent }} /></View>;
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable onPress={onClose} style={[styles.backdrop, { backgroundColor: palette.overlay }]}><Pressable onPress={() => undefined} style={[styles.panel, { backgroundColor: palette.surfaceRaised }]}><View style={styles.header}><AppText style={styles.heading}>Filter tasks</AppText><IconButton icon={X} label="Close" onPress={onClose} /></View>{showProjectTasks && row("Project tasks", "Show tasks assigned to a project in this view.", "includeProjectTasks")}{row("Completed tasks", "Keep completed items visible.", "includeCompleted")}{showSortByDate && row("Sort by date", "Group tasks by their due date like Inbox.", "sortByDate")}</Pressable></Pressable></Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center" }, panel: { width: "100%", maxWidth: 560, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 28 },
  header: { height: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 10 }, heading: { fontSize: 18, fontWeight: "700" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, gap: 16 }, copy: { flex: 1 }, title: { fontSize: 15.5, fontWeight: "600" }, detail: { fontSize: 12.5, lineHeight: 18, marginTop: 3 },
});
