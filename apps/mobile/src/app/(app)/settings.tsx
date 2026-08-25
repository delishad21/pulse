import { Bell, Boxes, ChevronRight, Check, Tags } from "lucide-react-native";
import { router, type Href } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { ThemePreference } from "@/constants/palette";
import { AppText, Screen } from "@/components/ui";
import { LabelManager } from "@/components/label-manager";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

export default function SettingsScreen() {
  const auth = useAuth(); const theme = useAppTheme(); const { palette } = theme;
  const link = (label: string, detail: string, path: string, Icon: typeof Bell) => <Pressable onPress={() => router.push(path as Href)} style={({ pressed }) => [styles.link, { borderBottomColor: palette.border, opacity: pressed ? 0.6 : 1 }]}><Icon size={20} color={palette.accent} /><View style={styles.linkCopy}><AppText style={styles.linkTitle}>{label}</AppText><AppText muted style={styles.detail}>{detail}</AppText></View><ChevronRight size={19} color={palette.textMuted} /></Pressable>;
  return <Screen><View style={styles.header}><AppText style={styles.heading}>Settings</AppText></View><ScrollView contentContainerStyle={styles.content}>
    <AppText muted style={styles.section}>Appearance</AppText>{(["system", "light", "dark"] as ThemePreference[]).map((value) => <Pressable key={value} onPress={() => theme.setPreference(value)} style={[styles.option, { borderBottomColor: palette.border }]}><AppText>{value[0].toUpperCase() + value.slice(1)}</AppText>{theme.preference === value ? <Check size={18} color={palette.accent} /> : null}</Pressable>)}
    <AppText muted style={styles.section}>Application</AppText>{link("Notifications and reminders", "Hermes, fallback Telegram, quiet hours, and message details.", "/notification-settings", Bell)}{link("Widget settings", "Layouts, filters, density, themes, and refresh.", "/widget-settings", Boxes)}
    <AppText muted style={styles.section}>Task metadata</AppText><View style={styles.labelHeading}><Tags size={18} color={palette.accent} /><AppText style={styles.linkTitle}>Labels</AppText></View><LabelManager />
    <AppText muted style={styles.section}>Account</AppText><AppText style={styles.accountName}>{auth.user?.name}</AppText><AppText muted style={styles.detail}>@{auth.user?.username}</AppText><AppText muted style={styles.server}>{auth.apiOrigin}</AppText><Pressable onPress={auth.logout} style={[styles.signOut, { borderColor: palette.border }]}><AppText style={{ color: palette.danger, fontWeight: "700" }}>Sign out</AppText></Pressable>
  </ScrollView></Screen>;
}

const styles = StyleSheet.create({ header: { minHeight: 88, paddingHorizontal: 20, paddingTop: 20 }, heading: { fontSize: 28, fontWeight: "800", letterSpacing: -0.7 }, content: { paddingHorizontal: 20, paddingBottom: 80, maxWidth: 720, width: "100%", alignSelf: "center" }, section: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 24, marginBottom: 6 }, option: { minHeight: 49, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, link: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 }, linkCopy: { flex: 1, paddingVertical: 10 }, linkTitle: { fontSize: 15, fontWeight: "700" }, detail: { fontSize: 12.5, lineHeight: 18, marginTop: 2 }, labelHeading: { flexDirection: "row", gap: 8, alignItems: "center", marginVertical: 8 }, accountName: { fontSize: 16, fontWeight: "700", marginTop: 8 }, server: { fontSize: 11, marginVertical: 8 }, signOut: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 } });
