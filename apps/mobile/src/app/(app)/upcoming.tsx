import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, List, ListFilter, Plus } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import type { Task } from "@pulse/api-client";
import { DatePickerModal } from "@/components/date-picker-modal";
import { FilterModal, defaultTaskFilters } from "@/components/filter-modal";
import { TaskComposer } from "@/components/task-composer";
import { TaskRow } from "@/components/task-row";
import { AppText, EmptyState, IconButton, Screen } from "@/components/ui";
import { AppFont, AppFontBold } from "@/constants/fonts";
import { addDays, localDateKey, taskDateKey, taskIsOverdue } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";
import { useAppTheme } from "@/providers/theme-provider";

const headingFor = (date: string) => { const value = new Date(`${date}T12:00:00Z`); const parts = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" }).formatToParts(value); const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ""; return `${part("day")} ${part("month")}, ${part("weekday")}`; };
const monthTitle = (date: string) => new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const shiftMonth = (date: string, amount: number) => { const value = new Date(`${monthStart(date)}T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + amount); return value.toISOString().slice(0, 10); };

export default function UpcomingScreen() {
  const { api } = useAuth(); const { palette } = useAppTheme(); const { width } = useWindowDimensions(); const today = localDateKey();
  const dates = useMemo(() => Array.from({ length: 1096 }, (_, index) => addDays(today, index)), [today]); const listRef = useRef<FlatList<string>>(null);
  const [selectedDate, setSelectedDate] = useState(today); const [mode, setMode] = useState<"daily" | "calendar">("daily"); const [calendarMonth, setCalendarMonth] = useState(monthStart(today));
  const [filters, setFilters] = useState(defaultTaskFilters); const [filterOpen, setFilterOpen] = useState(false); const [dateOpen, setDateOpen] = useState(false); const [composer, setComposer] = useState<Task | "new" | null>(null);
  const tasksQuery = useQuery({ queryKey: ["tasks", "upcoming-continuous", filters.includeCompleted], queryFn: () => api.listTasks(filters.includeCompleted ? undefined : { status: "open" }) });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: () => api.listProjects() }); const projects = useMemo(() => new Map((projectsQuery.data ?? []).map((project) => [project.id, project])), [projectsQuery.data]);
  const source = useMemo(() => (tasksQuery.data ?? []).filter((task) => filters.includeProjectTasks || !task.projectId), [tasksQuery.data, filters.includeProjectTasks]);
  const handleDayScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => { const index = Math.round(event.nativeEvent.contentOffset.x / width); if (dates[index]) { setSelectedDate(dates[index]); setCalendarMonth(monthStart(dates[index])); } }, [dates, width]);
  const renderDay = useCallback(({ item }: { item: string }) => <DayPage date={item} today={today} width={width} tasks={source} projects={projects} includeCompleted={filters.includeCompleted} onTask={setComposer} />, [filters.includeCompleted, projects, source, today, width]);
  useEffect(() => { if (mode === "daily") requestAnimationFrame(() => listRef.current?.scrollToIndex({ index: Math.max(0, dates.indexOf(selectedDate)), animated: false })); }, [width, mode, dates, selectedDate]);
  const goTo = (date: string, animated = true) => { const safe = date < today ? today : date; const index = dates.indexOf(safe); if (index < 0) return; setSelectedDate(safe); setCalendarMonth(monthStart(safe)); setMode("daily"); requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated })); };
  const move = (amount: number) => goTo(addDays(selectedDate, amount));

  return <Screen>
    <View style={styles.header}>
      <IconButton icon={ChevronLeft} label={mode === "calendar" ? "Previous month" : "Previous day"} disabled={mode === "calendar" ? calendarMonth <= monthStart(today) : selectedDate === today} style={(mode === "calendar" ? calendarMonth <= monthStart(today) : selectedDate === today) ? styles.disabled : undefined} onPress={() => mode === "calendar" ? setCalendarMonth(shiftMonth(calendarMonth, -1)) : move(-1)} />
      <Pressable onPress={() => setDateOpen(true)} style={styles.dateHeading}><AppText numberOfLines={1} style={styles.heading}>{mode === "calendar" ? monthTitle(calendarMonth) : headingFor(selectedDate)}</AppText></Pressable>
      <IconButton icon={ChevronRight} label={mode === "calendar" ? "Next month" : "Next day"} onPress={() => mode === "calendar" ? setCalendarMonth(shiftMonth(calendarMonth, 1)) : move(1)} />
      <View style={styles.actions}><IconButton icon={ListFilter} label="Filter tasks" onPress={() => setFilterOpen(true)} /><IconButton icon={mode === "calendar" ? List : CalendarDays} label={mode === "calendar" ? "Daily view" : "Calendar view"} onPress={() => setMode((value) => value === "calendar" ? "daily" : "calendar")} /><IconButton icon={Plus} label="Add task" onPress={() => setComposer("new")} /></View>
    </View>
    {tasksQuery.isLoading ? <View style={styles.center}><ActivityIndicator color={palette.accent} /></View> : mode === "calendar" ? <CalendarView month={calendarMonth} today={today} selectedDate={selectedDate} tasks={source} onSelect={goTo} /> : <FlatList ref={listRef} horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={dates} initialNumToRender={2} windowSize={3} keyExtractor={(date) => date} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} onMomentumScrollEnd={handleDayScroll} renderItem={renderDay} />}
    <DatePickerModal key={`${selectedDate}-${dateOpen}`} visible={dateOpen} value={selectedDate} onChange={(date) => { if (date) goTo(date); }} onClose={() => setDateOpen(false)} />
    <FilterModal visible={filterOpen} value={filters} onChange={setFilters} onClose={() => setFilterOpen(false)} />
    <TaskComposer visible={composer !== null} task={composer === "new" ? null : composer} onClose={() => setComposer(null)} />
  </Screen>;
}

const DayPage = memo(function DayPage({ date, today, width, tasks, projects, includeCompleted, onTask }: { date: string; today: string; width: number; tasks: Task[]; projects: Map<string, Awaited<ReturnType<ReturnType<typeof useAuth>["api"]["listProjects"]>>[number]>; includeCompleted: boolean; onTask: (task: Task) => void }) {
  const { palette } = useAppTheme(); const items = tasks.filter((task) => taskDateKey(task) === date && (includeCompleted || task.status === "open")); const overdue = date === today ? tasks.filter((task) => taskIsOverdue(task)) : [];
  return <ScrollView style={{ width }} contentContainerStyle={styles.dayPage}>{overdue.length > 0 && <View style={styles.section}><AppText style={[styles.daySectionHeading, { color: palette.danger }]}>Overdue</AppText>{overdue.map((task) => <TaskRow key={task.id} task={task} project={task.projectId ? projects.get(task.projectId) : undefined} onPress={() => onTask(task)} />)}</View>}<View style={styles.section}>{items.map((task) => <TaskRow key={task.id} task={task} project={task.projectId ? projects.get(task.projectId) : undefined} onPress={() => onTask(task)} />)}{!items.length && <EmptyState title="No tasks" detail="This day is clear." />}</View></ScrollView>;
});

function CalendarView({ month, today, selectedDate, tasks, onSelect }: { month: string; today: string; selectedDate: string; tasks: Task[]; onSelect: (date: string) => void }) {
  const { palette } = useAppTheme(); const first = new Date(`${month}T12:00:00Z`); const start = new Date(first); start.setUTCDate(1 - first.getUTCDay()); const days = Array.from({ length: 42 }, (_, index) => { const value = new Date(start); value.setUTCDate(start.getUTCDate() + index); return value.toISOString().slice(0, 10); });
  return <ScrollView contentContainerStyle={styles.calendarWrap}><View style={styles.calendarGrid}>{["S","M","T","W","T","F","S"].map((day,index)=><AppText key={`${day}-${index}`} muted style={styles.weekday}>{day}</AppText>)}{days.map((date)=>{const inMonth=date.slice(0,7)===month.slice(0,7);const dayTasks=tasks.filter((task)=>taskDateKey(task)===date);const isToday=date===today;const selected=date===selectedDate;return <Pressable key={date} disabled={date<today} onPress={()=>onSelect(date)} style={[styles.calendarDay,{borderColor:selected?palette.accent:palette.border,backgroundColor:isToday?palette.accentSoft:"transparent",opacity:inMonth&&date>=today?1:0.38}]}><Text style={{color:isToday||selected?palette.accent:palette.text,fontFamily:isToday||selected?AppFontBold:AppFont,fontWeight:isToday||selected?"normal":"500",fontSize:12}}>{Number(date.slice(-2))}</Text>{dayTasks.slice(0,3).map((task)=><Text key={task.id} numberOfLines={1} style={[styles.calendarTask,{color:palette.textMuted}]}>{task.title}</Text>)}{dayTasks.length>3&&<Text style={[styles.more,{color:palette.accent}]}>+{dayTasks.length-3}</Text>}</Pressable>;})}</View></ScrollView>;
}

const styles = StyleSheet.create({
  header: { minHeight: 58, paddingHorizontal: 4, paddingTop: 8, paddingBottom: 6, flexDirection: "row", alignItems: "center" }, dateHeading: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 2 }, heading: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25, textAlign: "center" }, actions: { flexDirection: "row" }, disabled: { opacity: 0.25 }, center: { flex: 1, alignItems: "center", justifyContent: "center" },
  dayPage: { paddingHorizontal: 20, paddingBottom: 80 }, section: { marginBottom: 24 }, daySectionHeading: { fontSize: 14, fontWeight: "800", marginBottom: 5 }, calendarWrap: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 70 }, calendarGrid: { flexDirection: "row", flexWrap: "wrap" }, weekday: { width: "14.2857%", textAlign: "center", paddingVertical: 7, fontSize: 11, fontWeight: "800" }, calendarDay: { width: "14.2857%", minHeight: 82, borderWidth: StyleSheet.hairlineWidth, padding: 5 }, calendarTask: { fontFamily: AppFont, fontSize: 9.5, marginTop: 3 }, more: { fontFamily: AppFontBold, fontSize: 9, fontWeight: "normal", marginTop: 2 },
});
