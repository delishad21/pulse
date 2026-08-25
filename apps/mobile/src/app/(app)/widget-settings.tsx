import { ArrowLeft, RefreshCw } from "lucide-react-native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, PanResponder, Pressable, ScrollView, StyleSheet, Switch, View, type GestureResponderEvent } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import type { Project, Task } from "@pulse/api-client";
import type { WidgetConfiguration } from "@pulse/widget-contracts";
import { defaultWidgetSettings, loadWidgetSettings, saveWidgetSettings, syncPulseWidgets, type WidgetSettings, type WidgetSlot } from "@/widgets/sync";
import { AppText, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const widgetSlots: WidgetSlot[] = ["today", "inbox", "upcoming", "overdue", "tasks"];
const views = ["today", "inbox", "upcoming", "overdue"] as const;

export default function SettingsScreen() {
  const auth = useAuth(); const theme = useAppTheme(); const { palette } = theme;
  const queryClient = useQueryClient();
  const [slot, setSlot] = useState<WidgetSlot>("today"); const [settings, setSettings] = useState<WidgetSettings>(defaultWidgetSettings); const [syncing, setSyncing] = useState(false);
  useEffect(() => { loadWidgetSettings().then(setSettings); }, []);
  const config = settings[slot];
  const widgetCache = () => ({
    today: queryClient.getQueryData<Task[]>(["view", "today", false]),
    inbox: queryClient.getQueryData<Task[]>(["view", "inbox", false]),
    upcoming: queryClient.getQueryData<Task[]>(["view", "upcoming", false]),
    overdue: queryClient.getQueryData<Task[]>(["view", "overdue"]),
    projects: queryClient.getQueryData<Project[]>(["projects"]),
  });
  const update = async (patch: Partial<WidgetConfiguration>) => { const next = { ...settings, [slot]: { ...config, ...patch } }; setSettings(next); await saveWidgetSettings(next); await syncPulseWidgets(auth.api, widgetCache()).catch(() => undefined); };
  const sync = async () => { setSyncing(true); try { await syncPulseWidgets(auth.api, widgetCache()); Alert.alert("Widgets refreshed", "Your widget layouts and task snapshots are up to date."); } catch { Alert.alert("Could not refresh widgets", "Reconnect to Pulse and try again."); } finally { setSyncing(false); } };
  const switchRow = (label: string, detail: string, key: keyof WidgetConfiguration) => <View style={[styles.switchRow, { borderBottomColor: palette.border }]}><View style={styles.switchCopy}><AppText style={styles.optionLabel}>{label}</AppText><AppText muted style={styles.rowDetail}>{detail}</AppText></View><Switch value={Boolean(config[key])} onValueChange={(value) => update({ [key]: value })} trackColor={{ true: palette.accent }} /></View>;
  const chips = <T extends string | number>(values: readonly T[], selected: T, label: (value: T) => string, onPress: (value: T) => void) => <View style={styles.chips}>{values.map((value) => <Pressable key={String(value)} onPress={() => onPress(value)} style={[styles.chip, { backgroundColor: value === selected ? palette.accentSoft : palette.surface, borderColor: value === selected ? palette.accent : palette.border }]}><AppText style={[styles.chipText, value === selected && { color: palette.accent }]}>{label(value)}</AppText></Pressable>)}</View>;
  return <Screen><View style={styles.header}><Pressable onPress={() => router.back()} style={styles.back}><ArrowLeft size={20} color={palette.text} /></Pressable><AppText style={styles.heading}>Widget settings</AppText></View><ScrollView contentContainerStyle={styles.content}>
    <AppText muted style={styles.detail}>Each widget type keeps its own view, layout, filters, metadata, and appearance. Changes apply to both iOS and Android.</AppText>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotTabs}>{widgetSlots.map((value) => <Pressable key={value} onPress={() => setSlot(value)} style={[styles.slotTab, { backgroundColor: slot === value ? palette.accent : palette.surface }]}><AppText style={{ color: slot === value ? "#fff" : palette.text, fontWeight: "700" }}>{value[0].toUpperCase() + value.slice(1)}</AppText></Pressable>)}</ScrollView>
    {slot === "tasks" && <><AppText style={styles.settingLabel}>Displayed view</AppText>{chips(views, config.view as typeof views[number], (value) => value[0].toUpperCase() + value.slice(1), (view) => update({ view }))}</>}
    <AppText style={styles.settingLabel}>Arrangement</AppText>{chips(["grouped", "list"] as const, config.arrangement, (value) => value === "grouped" ? "Grouped by date" : "Simple list", (arrangement) => update({ arrangement }))}
    <AppText style={styles.settingLabel}>Sort</AppText>{chips(["smart", "due", "priority", "manual"] as const, config.sort, (value) => value[0].toUpperCase() + value.slice(1), (sort) => update({ sort }))}
    <AppText style={styles.settingLabel}>Density</AppText>{chips(["compact", "comfortable", "detailed"] as const, config.density, (value) => value[0].toUpperCase() + value.slice(1), (density) => update({ density }))}
    <AppText style={styles.settingLabel}>Tasks shown</AppText>{chips([4, 6, 10, 20] as const, config.maxTasks as 4 | 6 | 10 | 20, String, (maxTasks) => update({ maxTasks }))}
    <AppText style={styles.settingLabel}>Widget theme</AppText>{chips(["system", "light", "dark"] as const, config.theme, (value) => value[0].toUpperCase() + value.slice(1), (widgetTheme) => update({ theme: widgetTheme }))}
    <AppText style={styles.settingLabel}>Background transparency</AppText><TransparencySlider value={Math.round((1 - config.backgroundOpacity) * 100)} onChange={(transparency) => update({ backgroundOpacity: 1 - transparency / 100 })} />
    <View style={styles.toggles}>{switchRow("Project tasks", "Include tasks assigned to projects.", "includeProjectTasks")}{switchRow("Completed tasks", "Keep completed tasks visible.", "showCompleted")}{switchRow("Dates and times", "Show scheduling metadata.", "showDue")}{switchRow("Projects", "Show project names and colours.", "showProject")}{switchRow("Priority flags", "Show task priority colour.", "showPriority")}{switchRow("Labels", "Show labels in detailed layouts.", "showLabels")}{switchRow("Locations", "Show locations in detailed layouts.", "showLocation")}</View>
    <PrimaryButton loading={syncing} onPress={sync} style={styles.sync}><View style={styles.buttonContent}><RefreshCw size={17} color="#fff" /><AppText style={{ color: "#fff", fontWeight: "700" }}>Refresh widgets</AppText></View></PrimaryButton>
  </ScrollView></Screen>;
}

function TransparencySlider({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(0);
  const setFromEvent = useCallback((event: GestureResponderEvent) => {
    if (!width) return;
    const next = Math.round(Math.max(0, Math.min(1, event.nativeEvent.locationX / width)) * 100);
    onChange(next);
  }, [onChange, width]);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: setFromEvent,
    onPanResponderMove: setFromEvent,
    onPanResponderTerminationRequest: () => false,
  }), [setFromEvent]);
  const { palette } = useAppTheme();
  return <View accessibilityRole="adjustable" accessibilityLabel="Background transparency" accessibilityValue={{ min: 0, max: 100, now: value, text: `${value}% transparent` }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.slider} {...responder.panHandlers}>
    <View style={[styles.sliderTrack, { backgroundColor: palette.border }]}><View style={[styles.sliderFill, { width: `${value}%`, backgroundColor: palette.accent }]} /></View>
    <View style={[styles.sliderThumb, { left: `${value}%`, backgroundColor: palette.accent }]} />
    <View style={styles.sliderLabels}><AppText muted style={styles.sliderLabel}>0% opaque</AppText><AppText muted style={styles.sliderValue}>{value}% transparent</AppText><AppText muted style={styles.sliderLabel}>100% transparent</AppText></View>
  </View>;
}

const styles = StyleSheet.create({ header: { minHeight: 88, paddingHorizontal: 20, paddingTop: 20, flexDirection: "row", alignItems: "center", gap: 10 }, back: { width: 38, height: 38, alignItems: "center", justifyContent: "center" }, heading: { fontSize: 28, fontWeight: "800", letterSpacing: -0.7 }, content: { paddingHorizontal: 20, paddingBottom: 80, maxWidth: 720, width: "100%", alignSelf: "center" }, section: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.7, marginTop: 24, marginBottom: 6 }, detail: { fontSize: 13, lineHeight: 18 }, option: { minHeight: 49, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, optionLabel: { fontSize: 15 }, slotTabs: { gap: 8, paddingVertical: 14 }, slotTab: { minHeight: 38, borderRadius: 19, paddingHorizontal: 15, alignItems: "center", justifyContent: "center" }, settingLabel: { fontSize: 13, fontWeight: "700", marginTop: 16, marginBottom: 8 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, chip: { minHeight: 36, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }, chipText: { fontSize: 13, fontWeight: "600" }, slider: { height: 54, justifyContent: "flex-start", paddingTop: 10 }, sliderTrack: { height: 6, borderRadius: 3, width: "100%", overflow: "hidden" }, sliderFill: { height: "100%", borderRadius: 3 }, sliderThumb: { position: "absolute", top: 3, marginLeft: -10, width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 }, sliderLabels: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }, sliderLabel: { fontSize: 10.5 }, sliderValue: { fontSize: 11, fontWeight: "700" }, toggles: { marginTop: 14 }, switchRow: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 }, switchCopy: { flex: 1, paddingVertical: 8 }, rowDetail: { fontSize: 11.5, lineHeight: 16, marginTop: 2 }, sync: { marginTop: 18 }, buttonContent: { flexDirection: "row", alignItems: "center", gap: 8 } });
