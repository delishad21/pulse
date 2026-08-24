import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Flag, Folder, MapPin, Repeat2, Tag as TagIcon, Trash2, X } from "lucide-react-native";
import { forwardRef, useEffect, useMemo, useRef, useState, type ForwardedRef, type ReactNode } from "react";
import { Alert, Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import type { CreateTaskInput, Task, UpdateTaskInput } from "@pulse/api-client";
import { generateRecurrenceRule, type Priority, type Weekday } from "@pulse/domain";
import { DatePickerModal } from "@/components/date-picker-modal";
import { AppText, IconButton, PrimaryButton } from "@/components/ui";
import { priorityColors } from "@/constants/palette";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { formatDayHeading, localDateKey } from "@/lib/dates";
import { parseQuickAdd } from "@/lib/quick-add";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";
import { syncPulseWidgets } from "@/widgets/sync";

type PickerKind = "project" | "priority" | "labels" | "recurrence" | "location" | null;
const priorities: Priority[] = ["none", "low", "medium", "high", "urgent"];
const weekdayChoices: [Weekday, string][] = [["MO", "Monday"], ["TU", "Tuesday"], ["WE", "Wednesday"], ["TH", "Thursday"], ["FR", "Friday"], ["SA", "Saturday"], ["SU", "Sunday"]];
const rule = (frequency: "daily" | "weekly" | "monthly" | "yearly", interval = 1, byWeekday?: Weekday[]) => generateRecurrenceRule({ frequency, interval, byWeekday });
const recurrenceChoices = [
  { label: "Does not repeat", value: null }, { label: "Daily", value: rule("daily") }, { label: "Weekly", value: rule("weekly") },
  { label: "Every 2 weeks", value: rule("weekly", 2) }, { label: "Monthly", value: rule("monthly") }, { label: "Yearly", value: rule("yearly") },
  { label: "Every weekday", value: rule("weekly", 1, ["MO", "TU", "WE", "TH", "FR"]) },
  ...weekdayChoices.map(([day, name]) => ({ label: `Every ${name}`, value: rule("weekly", 1, [day]) })),
];
const timePart = (instant?: string | null) => instant ? `${String(new Date(instant).getHours()).padStart(2, "0")}:${String(new Date(instant).getMinutes()).padStart(2, "0")}` : "";
const makeInstant = (date: string, time: string) => { const [year, month, day] = date.split("-").map(Number); const [hour, minute] = time.split(":").map(Number); return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString(); };

export function TaskComposer({ visible, task, defaultProjectId = null, onClose }: { visible: boolean; task?: Task | null; defaultProjectId?: string | null; onClose: () => void }) {
  return <TaskComposerForm visible={visible} task={task} defaultProjectId={defaultProjectId} onClose={onClose} />;
}

function TaskComposerForm({ visible, task, defaultProjectId, onClose }: { visible: boolean; task?: Task | null; defaultProjectId: string | null; onClose: () => void }) {
  const { api } = useAuth(); const { palette } = useAppTheme(); const queryClient = useQueryClient(); const { width, height } = useWindowDimensions();
  const inputRef = useRef<TextInput>(null); const ignoredBackspace = useRef<{ value: string; selection: { start: number; end: number }; id: string } | null>(null); const initialInstant = task?.startAt ?? task?.due.at ?? null;
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sheetTranslateY] = useState(() => new Animated.Value(0));
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const wasVisible = useRef(false);
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects() }); const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: () => api.listTags() });
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]); const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const [rawTitle, setRawTitle] = useState(task?.title ?? ""); const [description, setDescription] = useState(task?.description ?? "");
  const [dueDate, setDueDate] = useState<string | null>(task?.due.date ?? (initialInstant ? localDateKey(new Date(initialInstant)) : null)); const [startTime, setStartTime] = useState(timePart(initialInstant)); const [endTime, setEndTime] = useState(timePart(task?.endAt));
  const [projectId, setProjectId] = useState<string | null>(task?.projectId ?? defaultProjectId); const [priority, setPriority] = useState<Priority>(task?.priority ?? "none"); const [tagIds, setTagIds] = useState<string[]>(task?.tags.map((tag) => tag.id) ?? []);
  const [location, setLocation] = useState(task?.location ?? ""); const [recurrenceRule, setRecurrenceRule] = useState<string | null>(task?.recurrenceRule ?? null); const [customDays, setCustomDays] = useState("7");
  const [picker, setPicker] = useState<PickerKind>(null); const [dateOpen, setDateOpen] = useState(false); const [error, setError] = useState<string | null>(null); const [selection, setSelection] = useState({ start: rawTitle.length, end: rawTitle.length }); const [ignored, setIgnored] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (visible && !wasVisible.current) {
      const nextTitle = task?.title ?? "";
      const nextInstant = task?.startAt ?? task?.due.at ?? null;
      setRawTitle(nextTitle);
      setDescription(task?.description ?? "");
      setDueDate(task?.due.date ?? (nextInstant ? localDateKey(new Date(nextInstant)) : null));
      setStartTime(timePart(nextInstant));
      setEndTime(timePart(task?.endAt));
      setProjectId(task?.projectId ?? defaultProjectId);
      setPriority(task?.priority ?? "none");
      setTagIds(task?.tags.map((tag) => tag.id) ?? []);
      setLocation(task?.location ?? "");
      setRecurrenceRule(task?.recurrenceRule ?? null);
      setSelection({ start: nextTitle.length, end: nextTitle.length });
      setPicker(null);
      setDateOpen(false);
      setError(null);
      setIgnored(new Set());
      ignoredBackspace.current = null;
    }
    wasVisible.current = visible;
  }, [defaultProjectId, task, visible]);
  useEffect(() => () => {
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    animation.current?.stop();
  }, []);
  useEffect(() => {
    const event = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(event, ({ endCoordinates }) => setKeyboardHeight(endCoordinates.height));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);
  const parsed = useMemo(() => parseQuickAdd(rawTitle, { projects, tags, defaultProjectId: projectId, ignoredTokenIds: ignored }), [rawTitle, projects, tags, projectId, ignored]);
  const activeParameters = parsed.parameters.filter((parameter) => !ignored.has(parameter.id)); const has = (type: string) => activeParameters.some((parameter) => parameter.type === type);
  const effectiveProjectId = has("project") ? parsed.input.projectId ?? null : projectId; const effectivePriority = has("priority") ? parsed.input.priority ?? "none" : priority; const effectiveTagIds = has("label") ? [...new Set([...tagIds, ...(parsed.input.tagIds ?? [])])] : tagIds;
  const parsedDate = parsed.input.startAt ? localDateKey(new Date(parsed.input.startAt)) : parsed.input.dueDate ?? null; const hasParsedScheduleDate = has("date") || (has("recurrence") && Boolean(parsedDate)); const effectiveDueDate = hasParsedScheduleDate ? parsedDate : dueDate; const selectedProject = projects.find((project) => project.id === effectiveProjectId);
  const mention = useMemo(() => { const before = rawTitle.slice(0, selection.end); const match = before.match(/(?:^|\s)([#@])([^\s#@]*)$/u); if (!match) return null; const query = match[2].toLocaleLowerCase(); const start = selection.end - match[1].length - match[2].length; const items = (match[1] === "#" ? projects : tags).filter((item) => item.name.toLocaleLowerCase().includes(query)).slice(0, 6); return items.length ? { marker: match[1], start, items } : null; }, [rawTitle, selection.end, projects, tags]);
  const moveCaret = (next: { start: number; end: number }) => { setSelection(next); requestAnimationFrame(() => inputRef.current?.setNativeProps({ selection: next })); };
  const insertMention = (name: string) => { if (!mention) return; const value = `${rawTitle.slice(0, mention.start)}${mention.marker}${name} ${rawTitle.slice(selection.end)}`; const caret = mention.start + name.length + 2; setRawTitle(value); moveCaret({ start: caret, end: caret }); };
  const onKeyPress = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => { if (event.nativeEvent.key !== "Backspace" || selection.start !== selection.end) return; const token = activeParameters.find((parameter) => parameter.end === selection.start); if (token) { ignoredBackspace.current = { value: rawTitle, selection, id: token.id }; setIgnored((values) => new Set(values).add(token.id)); } };
  const onTitleChange = (value: string) => { const pending = ignoredBackspace.current; if (pending) { ignoredBackspace.current = null; moveCaret(pending.selection); return; } setRawTitle(value); };
  const openAccessory = (next: Exclude<PickerKind, null> | "date") => {
    inputRef.current?.blur();
    Keyboard.dismiss();
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
    pickerTimer.current = setTimeout(() => {
      if (next === "date") setDateOpen(true); else setPicker(next);
      pickerTimer.current = null;
    }, Platform.OS === "ios" ? 180 : 80);
  };
  const closeComposer = () => {
    if (pickerTimer.current) clearTimeout(pickerTimer.current);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    pickerTimer.current = null;
    inputRef.current?.blur();
    Keyboard.dismiss();
    setPicker(null);
    setDateOpen(false);
    onClose();
  };

  const saveMutation = useMutation({ mutationFn: async () => {
    const title = parsed.input.title || rawTitle.trim(); if (!title) throw new Error("Give the task a title."); let manualStart: string | null = null; let manualEnd: string | null = null;
    if (dueDate && startTime) { manualStart = makeInstant(dueDate, startTime); if (endTime) { manualEnd = makeInstant(dueDate, endTime); if (new Date(manualEnd) < new Date(manualStart)) { const next = new Date(manualEnd); next.setDate(next.getDate() + 1); manualEnd = next.toISOString(); } } }
    const common: CreateTaskInput & UpdateTaskInput = { title, description: description.trim() || null, location: (has("location") ? parsed.input.location : location.trim()) || null, priority: effectivePriority, projectId: effectiveProjectId, tagIds: effectiveTagIds, recurrenceRule: has("recurrence") ? parsed.input.recurrenceRule ?? null : recurrenceRule, dueDate: has("time") ? null : hasParsedScheduleDate ? parsed.input.dueDate ?? null : manualStart ? null : dueDate, dueAt: null, startAt: has("time") ? parsed.input.startAt ?? null : manualStart, endAt: has("time") ? parsed.input.endAt ?? null : manualEnd };
    return task ? api.updateTask(task.id, common) : api.createTask(common);
  }, onSuccess: async () => { await queryClient.invalidateQueries(); await syncPulseWidgets(api).catch(() => undefined); closeComposer(); }, onError: (value) => setError(value instanceof Error ? value.message : "Could not save this task.") });
  const deleteMutation = useMutation({ mutationFn: () => api.deleteTask(task!.id), onSuccess: async () => { await queryClient.invalidateQueries(); await syncPulseWidgets(api).catch(() => undefined); closeComposer(); } });
  const completeMutation = useMutation({ mutationFn: () => api.completeTask(task!.id), onSuccess: async () => { await queryClient.invalidateQueries(); await syncPulseWidgets(api).catch(() => undefined); closeComposer(); }, onError: (value) => setError(value instanceof Error ? value.message : "Could not complete this task.") });
  const remove = () => Alert.alert("Delete task?", "This task can still be recovered through operation history.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate() }]);
  const panelHeight = Math.min(Math.max(height * (width >= 700 ? 0.66 : 0.6), 320), width >= 700 ? 720 : 600); const modalWidth = Math.min(width, 640);
  const scheduleLabel = effectiveDueDate ? `${formatDayHeading(effectiveDueDate).split(",")[0]}${has("time") || startTime ? ` · ${has("time") ? timePart(parsed.input.startAt) : startTime}` : ""}` : "Date & time";

  const showComposer = () => {
    animation.current?.stop();
    sheetTranslateY.setValue(panelHeight);
    overlayOpacity.setValue(0);
    requestAnimationFrame(() => {
      animation.current = Animated.parallel([
        Animated.timing(sheetTranslateY, { toValue: 0, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]);
      animation.current.start();
    });
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => { if (visible) { inputRef.current?.focus(); moveCaret({ start: rawTitle.length, end: rawTitle.length }); } }, 320);
  };

  return <Modal visible={visible} transparent animationType="none" onRequestClose={closeComposer} statusBarTranslucent onShow={showComposer}>
    <View style={styles.modalRoot}>
      <Animated.View pointerEvents="none" style={[styles.modalOverlay, { backgroundColor: palette.overlay, opacity: overlayOpacity }]} />
      <View pointerEvents="none" style={[styles.keyboardUnderlay, { backgroundColor: palette.surfaceRaised, height: Platform.OS === "ios" ? keyboardHeight + 20 : 0, opacity: Platform.OS === "ios" && keyboardHeight > 0 ? 1 : 0 }]} />
      <KeyboardAvoidingView enabled={visible} behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.backdrop}><Animated.View style={[styles.panel, { width: modalWidth, maxHeight: panelHeight, backgroundColor: palette.surfaceRaised, transform: [{ translateY: sheetTranslateY }] }]}>
      <View style={styles.topbar}>
        <HighlightedTitleInput ref={inputRef} autoFocus={visible} value={rawTitle} parameters={activeParameters} selection={selection} onSelectionChange={setSelection} onChangeText={onTitleChange} onKeyPress={onKeyPress} />
        <IconButton icon={X} label="Close" onPress={closeComposer} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroller} contentContainerStyle={styles.body}>
        {mention && <View style={[styles.suggestions, { backgroundColor: palette.surface, borderColor: palette.border }]}>{mention.items.map((item) => <Pressable key={item.id} onPress={() => insertMention(item.name)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: palette.accentSoft }]}><View style={[styles.colorDot, { backgroundColor: item.color ?? palette.textMuted }]} /><AppText style={styles.suggestionText}>{mention.marker}{item.name}</AppText></Pressable>)}</View>}
        <TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={palette.textMuted} multiline showSoftInputOnFocus style={[styles.descriptionInput, { color: palette.text }]} selectionColor={palette.accent} />
        <View style={styles.toolbar}><ComposerButton icon={CalendarDays} label={scheduleLabel} color={effectiveDueDate || has("time") ? palette.accent : palette.textMuted} onPress={() => openAccessory("date")} /><ComposerButton icon={Folder} label={selectedProject?.name ?? "Inbox"} color={selectedProject?.color ?? palette.textMuted} onPress={() => openAccessory("project")} /><ComposerButton icon={Flag} label={effectivePriority === "none" ? "Priority" : effectivePriority[0].toUpperCase() + effectivePriority.slice(1)} color={priorityColors[effectivePriority]} onPress={() => openAccessory("priority")} /><ComposerButton icon={TagIcon} label={effectiveTagIds.length ? `${effectiveTagIds.length} label${effectiveTagIds.length === 1 ? "" : "s"}` : "Labels"} color={effectiveTagIds.length ? tags.find((tag) => effectiveTagIds.includes(tag.id))?.color ?? palette.accent : palette.textMuted} onPress={() => openAccessory("labels")} /><ComposerButton icon={Repeat2} label={recurrenceRule || has("recurrence") ? "Repeats" : "Repeat"} color={recurrenceRule || has("recurrence") ? palette.accent : palette.textMuted} onPress={() => openAccessory("recurrence")} /><ComposerButton icon={MapPin} label={(has("location") ? parsed.input.location : location) || "Location"} color={(has("location") ? parsed.input.location : location) ? palette.accent : palette.textMuted} onPress={() => openAccessory("location")} /></View>
        {error && <AppText style={{ color: palette.danger, fontSize: 14, marginTop: 10 }}>{error}</AppText>}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: palette.border }]}>{task ? <Pressable accessibilityRole="button" accessibilityLabel="Delete task" onPress={remove} hitSlop={8} style={({ pressed }) => [styles.deleteButton, { backgroundColor: palette.danger + "18", opacity: pressed ? 0.6 : 1 }]}><Trash2 size={20} color={palette.danger} /></Pressable> : <View />}<View style={styles.footerActions}>{task && task.status === "open" && <Pressable accessibilityRole="button" accessibilityLabel="Complete task" disabled={completeMutation.isPending} onPress={() => completeMutation.mutate()} style={({ pressed }) => [styles.completeButton, { backgroundColor: palette.surface, borderColor: palette.border, opacity: pressed || completeMutation.isPending ? 0.6 : 1 }]}><Text style={[styles.completeText, { color: palette.accent }]}>{completeMutation.isPending ? "Completing…" : "Complete"}</Text></Pressable>}<PrimaryButton loading={saveMutation.isPending} onPress={() => saveMutation.mutate()} style={styles.save}>{task ? "Save" : "Add task"}</PrimaryButton></View></View>
      </Animated.View></KeyboardAvoidingView>
    <DatePickerModal key={`${effectiveDueDate ?? "none"}-${dateOpen}`} visible={dateOpen} value={effectiveDueDate} startTime={has("time") ? timePart(parsed.input.startAt) : startTime} endTime={has("time") ? timePart(parsed.input.endAt) : endTime} onChange={setDueDate} onTimeChange={(start, end) => { setStartTime(start); setEndTime(end); }} onClose={() => setDateOpen(false)} />
    <SelectionModal visible={picker !== null} title={picker ? picker[0].toUpperCase() + picker.slice(1) : ""} onClose={() => setPicker(null)}>
      {picker === "project" && <><SelectionRow label="Inbox" color={palette.textMuted} selected={!effectiveProjectId} onPress={() => { setProjectId(null); setPicker(null); }} />{projects.map((project) => <SelectionRow key={project.id} label={project.name} color={project.color ?? palette.textMuted} selected={effectiveProjectId === project.id} onPress={() => { setProjectId(project.id); setPicker(null); }} />)}</>}
      {picker === "priority" && priorities.map((value) => <SelectionRow key={value} label={value[0].toUpperCase() + value.slice(1)} color={priorityColors[value]} selected={effectivePriority === value} flag onPress={() => { setPriority(value); setPicker(null); }} />)}
      {picker === "labels" && tags.map((tag) => <SelectionRow key={tag.id} label={tag.name} color={tag.color ?? palette.textMuted} selected={effectiveTagIds.includes(tag.id)} onPress={() => setTagIds((values) => values.includes(tag.id) ? values.filter((id) => id !== tag.id) : [...values, tag.id])} />)}
      {picker === "recurrence" && <>{recurrenceChoices.map((choice) => <SelectionRow key={choice.label} label={choice.label} color={palette.accent} selected={recurrenceRule === choice.value} hideIndicator onPress={() => { setRecurrenceRule(choice.value); setPicker(null); }} />)}<View style={[styles.customRow, { borderTopColor: palette.border }]}><AppText style={styles.customLabel}>Every</AppText><TextInput value={customDays} onChangeText={(value) => setCustomDays(value.replace(/\D/g, "").slice(0, 3))} keyboardType="number-pad" showSoftInputOnFocus style={[styles.customInput, { color: palette.text, backgroundColor: palette.surface }]} /><AppText style={styles.customLabel}>days</AppText><Pressable onPress={() => { const days = Math.max(1, Number(customDays) || 1); setCustomDays(String(days)); setRecurrenceRule(rule("daily", days)); setPicker(null); }} style={[styles.customApply, { backgroundColor: palette.accent }]}><Text style={styles.customApplyText}>Apply</Text></Pressable></View></>}
      {picker === "location" && <View style={styles.locationPanel}><AppText muted style={styles.locationHint}>Location</AppText><TextInput autoFocus showSoftInputOnFocus value={location} onChangeText={setLocation} placeholder="e.g. Marina Bay" placeholderTextColor={palette.textMuted} style={[styles.locationInput, { color: palette.text, backgroundColor: palette.surface }]} /><PrimaryButton onPress={() => setPicker(null)} style={styles.locationDone}>Done</PrimaryButton></View>}
    </SelectionModal>
    </View>
  </Modal>;
}

const HighlightedTitleInput = forwardRef(function HighlightedTitleInput({ autoFocus = false, value, parameters, selection, onSelectionChange, onChangeText, onKeyPress }: { autoFocus?: boolean; value: string; parameters: { id: string; start: number; end: number }[]; selection: { start: number; end: number }; onSelectionChange: (value: { start: number; end: number }) => void; onChangeText: (value: string) => void; onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void }, ref: ForwardedRef<TextInput>) {
  const { palette } = useAppTheme(); const pieces: ReactNode[] = []; let cursor = 0;
  for (const parameter of parameters) { if (parameter.start > cursor) pieces.push(<Text key={`plain-${cursor}`}>{value.slice(cursor, parameter.start)}</Text>); pieces.push(<Text key={parameter.id} style={{ backgroundColor: palette.accentSoft }}>{value.slice(parameter.start, parameter.end)}</Text>); cursor = parameter.end; } if (cursor < value.length) pieces.push(<Text key={`plain-${cursor}`}>{value.slice(cursor)}</Text>);
  return <View style={styles.titleInputShell}>
    {value && parameters.length ? <Text pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.titleHighlight, Platform.OS === "ios" && styles.iosTitleContent]}>{pieces}</Text> : null}
    <TextInput ref={ref} autoFocus={autoFocus} value={value} onSelectionChange={(event) => { const next = event.nativeEvent.selection; if (next.start !== selection.start || next.end !== selection.end) onSelectionChange(next); }} onChangeText={onChangeText} onKeyPress={onKeyPress} multiline placeholder="Task title" placeholderTextColor={palette.textMuted} showSoftInputOnFocus={true} style={[styles.titleInput, Platform.OS === "ios" && styles.iosTitleContent, { color: palette.text }]} selectionColor={palette.accent} cursorColor={palette.accent} autoCorrect />
  </View>;
});
function ComposerButton({ icon: Icon, label, color, onPress }: { icon: typeof CalendarDays; label: string; color: string; onPress: () => void }) { const { palette } = useAppTheme(); return <Pressable onPress={onPress} style={({ pressed }) => [styles.toolButton, { backgroundColor: palette.surface, opacity: pressed ? 0.65 : 1 }]}><Icon size={16} color={color} /><Text numberOfLines={1} style={{ color, fontFamily: AppFontBold, fontSize: 13, fontWeight: "normal" }}>{label}</Text><ChevronDown size={13} color={color} /></Pressable>; }
function SelectionModal({ visible, title, children, onClose }: { visible: boolean; title: string; children: ReactNode; onClose: () => void }) { const { palette } = useAppTheme(); return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable onPress={onClose} style={[styles.selectionBackdrop, { backgroundColor: palette.overlay }]}><Pressable onPress={() => undefined} style={[styles.selectionPanel, { backgroundColor: palette.surfaceRaised }]}><View style={styles.selectionHeader}><AppText style={styles.selectionTitle}>{title}</AppText><IconButton icon={X} label="Close" onPress={onClose} /></View><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 430 }}>{children}</ScrollView></Pressable></Pressable></Modal>; }
function SelectionRow({ label, color, selected, flag, hideIndicator, onPress }: { label: string; color: string; selected: boolean; flag?: boolean; hideIndicator?: boolean; onPress: () => void }) { const { palette } = useAppTheme(); return <Pressable onPress={onPress} style={({ pressed }) => [styles.selectionRow, pressed && { backgroundColor: palette.surface }]}>{!hideIndicator && (flag ? <Flag size={18} color={color} fill={color} /> : <View style={[styles.colorDot, { backgroundColor: color }]} />)}<AppText style={styles.selectionLabel}>{label}</AppText>{selected && <Text style={{ color: palette.accent, fontFamily: AppFontBold, fontSize: 18, fontWeight: "normal" }}>✓</Text>}</Pressable>; }
const titleTypography = { fontFamily: AppFontBold, paddingHorizontal: 0, paddingTop: 8, paddingBottom: 1, fontSize: 22, lineHeight: 29, fontWeight: "normal" as const, includeFontPadding: false };
const styles = StyleSheet.create({
  modalRoot: { flex: 1 }, modalOverlay: { ...StyleSheet.absoluteFill }, keyboardUnderlay: { position: "absolute", left: 0, right: 0, bottom: 0 }, backdrop: { flex: 1, alignItems: "center", justifyContent: "flex-end" }, panel: { overflow: "hidden", borderTopLeftRadius: 22, borderTopRightRadius: 22, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 28, elevation: 16 }, topbar: { minHeight: 74, flexDirection: "row", alignItems: "flex-start", paddingTop: 10, paddingLeft: 18, paddingRight: 10 }, scroller: { flexGrow: 0, flexShrink: 1 }, body: { paddingHorizontal: 18, paddingBottom: 0 },
  titleInputShell: { position: "relative", minHeight: 60, flex: 1, marginLeft: 9 }, iosTitleContent: { paddingTop: 12 }, titleHighlight: { ...titleTypography, minHeight: 60, position: "absolute", top: 0, left: 0, right: 0, color: "transparent" }, titleInput: { ...titleTypography, minHeight: 60, borderWidth: 0, backgroundColor: "transparent", zIndex: 1 }, descriptionInput: { fontFamily: AppFont, minHeight: 61, paddingHorizontal: 9, paddingTop: 5, fontSize: 15.5, lineHeight: 22, textAlignVertical: "top", borderWidth: 0 },
  suggestions: { marginHorizontal: 7, borderWidth: StyleSheet.hairlineWidth, borderRadius: 11, paddingVertical: 4 }, suggestion: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 11 }, suggestionText: { fontSize: 14, fontWeight: "600" }, toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }, toolButton: { height: 36, borderRadius: 9, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6, maxWidth: 190 },
  footer: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, footerActions: { flexDirection: "row", alignItems: "center", gap: 8 }, save: { minWidth: 116, minHeight: 44 }, completeButton: { minWidth: 106, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" }, completeText: { fontFamily: AppFontBold, fontSize: 15, fontWeight: "normal" }, deleteButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }, selectionBackdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center" }, selectionPanel: { width: "100%", maxWidth: 560, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 24, maxHeight: "72%" }, selectionHeader: { height: 58, paddingLeft: 20, paddingRight: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, selectionTitle: { fontFamily: AppFontBold, fontSize: 17, fontWeight: "normal" }, selectionRow: { minHeight: 50, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 12 }, selectionLabel: { flex: 1, fontFamily: AppFont, fontSize: 15 }, colorDot: { width: 13, height: 13, borderRadius: 7 },
  customRow: { minHeight: 62, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, marginTop: 5 }, customLabel: { fontFamily: AppFont, fontSize: 14 }, customInput: { fontFamily: AppFontBold, width: 58, height: 38, borderRadius: 9, textAlign: "center", fontWeight: "normal" }, customApply: { marginLeft: "auto", height: 38, paddingHorizontal: 14, borderRadius: 9, justifyContent: "center" }, customApplyText: { color: "#fff", fontFamily: AppFontBold, fontWeight: "normal" }, locationPanel: { paddingHorizontal: 20, paddingBottom: 12 }, locationHint: { fontFamily: AppFontBold, fontSize: 12, fontWeight: "normal", marginBottom: 6 }, locationInput: { fontFamily: AppFont, height: 44, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 }, locationDone: { marginTop: 14 },
});
