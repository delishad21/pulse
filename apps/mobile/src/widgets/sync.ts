import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { PulseApiClient, Project, Task } from "@pulse/api-client";
import { clampWidgetTaskCount, defaultWidgetConfiguration, makeWidgetSnapshot, type TaskWidgetSnapshot, type WidgetConfiguration } from "@pulse/widget-contracts";
import { updateAndroidWidgetSnapshot } from "@pulse/android-widgets";
import { formatTaskDate, taskDateKey, taskIsOverdue } from "@/lib/dates";
import { pulseWidgets } from "./index";

const views = ["today", "inbox", "upcoming", "overdue"] as const;
export type WidgetSlot = typeof views[number] | "tasks";
export type WidgetSettings = Record<WidgetSlot, WidgetConfiguration>;
export type WidgetTaskCache = Partial<Record<typeof views[number], Task[]>> & { projects?: Project[] };
export const WIDGET_SETTINGS_KEY = "pulse.widget-settings-v2";
const WIDGET_BASELINES_KEY = "pulse.widget-baselines-v2";
let syncQueue: Promise<void> = Promise.resolve();

const emptySnapshot = (view: typeof views[number]): TaskWidgetSnapshot => makeWidgetSnapshot({
  configuration: { ...defaultWidgetConfiguration, view, maxTasks: 20, arrangement: view === "inbox" || view === "upcoming" ? "grouped" : "list" },
  title: view[0].toUpperCase() + view.slice(1),
  tasks: [],
});

/** Ensure WidgetKit always has at least one entry, even before login or while offline. */
export async function initializeIOSWidgetTimelines(): Promise<void> {
  if (Platform.OS !== "ios") return;
  const fixed = { today: pulseWidgets.today, inbox: pulseWidgets.inbox, upcoming: pulseWidgets.upcoming, overdue: pulseWidgets.overdue };
  // WidgetKit may not have registered a timeline yet (or may still be
  // rebuilding the extension). That should never prevent the app from
  // refreshing its own data, so treat each native read/write independently.
  await Promise.all(views.map(async (view) => {
    try {
      const timeline = await fixed[view].getTimeline();
      if (!timeline.length) fixed[view].updateSnapshot(emptySnapshot(view));
    } catch (error) {
      console.warn(`[widgets] unable to initialize ${view} timeline`, error);
    }
  }));
  try {
    const tasksTimeline = await pulseWidgets.tasks.getTimeline();
    if (!tasksTimeline.length) {
      const snapshots = Object.fromEntries(views.map((view) => [view, emptySnapshot(view)])) as Record<typeof views[number], TaskWidgetSnapshot>;
      pulseWidgets.tasks.updateSnapshot({ snapshots });
    }
  } catch (error) {
    console.warn("[widgets] unable to initialize tasks timeline", error);
  }
}

export function defaultWidgetSettings(): WidgetSettings {
  const make = (view: typeof views[number]): WidgetConfiguration => ({ ...defaultWidgetConfiguration, view, maxTasks: 20, arrangement: view === "inbox" || view === "upcoming" ? "grouped" : "list" });
  return { today: make("today"), inbox: make("inbox"), upcoming: make("upcoming"), overdue: make("overdue"), tasks: make("today") };
}

export async function loadWidgetSettings(): Promise<WidgetSettings> {
  const defaults = defaultWidgetSettings();
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(WIDGET_SETTINGS_KEY)) ?? "{}") as Partial<Record<WidgetSlot, Partial<WidgetConfiguration>>>;
    for (const slot of [...views, "tasks"] as const) defaults[slot] = { ...defaults[slot], ...saved[slot] };
  } catch { /* Keep safe defaults if an older snapshot is malformed. */ }
  return defaults;
}

export async function saveWidgetSettings(settings: WidgetSettings): Promise<void> {
  await AsyncStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify(settings));
}

export async function consumeIOSWidgetCompletions(): Promise<string[]> {
  if (Platform.OS !== "ios") return [];
  try {
    const baselines = JSON.parse((await AsyncStorage.getItem(WIDGET_BASELINES_KEY)) ?? "{}") as Partial<Record<WidgetSlot, TaskWidgetSnapshot>>;
    const widgets = { today: pulseWidgets.today, inbox: pulseWidgets.inbox, upcoming: pulseWidgets.upcoming, overdue: pulseWidgets.overdue };
    const completed = new Set<string>();
    for (const view of views) {
      const baseline = baselines[view]; const timeline = await widgets[view].getTimeline(); const current = timeline[timeline.length - 1]?.props;
      if (!baseline || !current || current.generatedAt !== baseline.generatedAt) continue;
      const remaining = new Set(current.tasks.map((task) => task.id));
      baseline.tasks.forEach((task) => { if (!remaining.has(task.id)) completed.add(task.id); });
    }
    const taskBaseline = baselines.tasks; const taskTimeline = await pulseWidgets.tasks.getTimeline(); const taskProps = taskTimeline[taskTimeline.length - 1]?.props;
    if (taskBaseline && taskProps) {
      const baselineView = views.includes(taskBaseline.view as typeof views[number]) ? taskBaseline.view as typeof views[number] : "today";
      const current = taskProps.snapshots[baselineView];
      if (current?.generatedAt === taskBaseline.generatedAt) { const remaining = new Set(current.tasks.map((task) => task.id)); taskBaseline.tasks.forEach((task) => { if (!remaining.has(task.id)) completed.add(task.id); }); }
    }
    return [...completed];
  } catch { return []; }
}

function snapshot(view: typeof views[number], tasks: Task[], projects: Project[], config: WidgetConfiguration): TaskWidgetSnapshot {
  return makeWidgetSnapshot({
    configuration: { ...config, view }, title: view[0].toUpperCase() + view.slice(1), tasks, projects,
    accentColor: view === "overdue" ? "#dc4f49" : "#dc4c3e", dueLabel: formatTaskDate, dateKey: taskDateKey, isOverdue: taskIsOverdue,
  });
}

/**
 * WidgetKit stores JavaScript props in an App Group UserDefaults plist. NSUserDefaults
 * cannot represent JavaScript null/undefined values, even though JSON and the
 * Android widget contract can. Omit those values only for the iOS native write;
 * the layout already treats missing optional properties as empty.
 */
function propertyListSafe<T>(value: T): T {
  const clean = (input: unknown): unknown => {
    if (input === null || input === undefined) return undefined;
    if (Array.isArray(input)) return input.map(clean).filter((item): item is unknown => item !== undefined);
    if (typeof input === "object") {
      return Object.fromEntries(Object.entries(input as Record<string, unknown>)
        .map(([key, item]) => [key, clean(item)] as const)
        .filter(([, item]) => item !== undefined));
    }
    return input;
  };
  return clean(value) as T;
}

function reconfigureSnapshot(previous: TaskWidgetSnapshot, view: typeof views[number], config: WidgetConfiguration): TaskWidgetSnapshot {
  const configuration = { ...config, view, maxTasks: clampWidgetTaskCount(config.maxTasks) };
  const tasks = previous.tasks.map((task) => ({
    ...task,
    dueLabel: configuration.showDue ? task.dueLabel : null,
    projectName: configuration.showProject ? task.projectName : null,
    priority: configuration.showPriority ? task.priority : "none" as const,
    tagNames: configuration.showLabels ? task.tagNames : [],
    location: configuration.showLocation ? task.location : null,
  })).slice(0, configuration.maxTasks);
  return { ...previous, view, title: view[0].toUpperCase() + view.slice(1), configuration, tasks };
}

/**
 * WidgetKit writes are shared state. Serialize refreshes so a slow/offline
 * refresh cannot finish after a successful one and overwrite it with an empty
 * snapshot. This is especially important when app resume and the settings
 * button are used close together.
 */
export function syncPulseWidgets(api: PulseApiClient, cache: WidgetTaskCache = {}): Promise<void> {
  const next = syncQueue.then(() => syncPulseWidgetsInternal(api, cache));
  syncQueue = next.catch(() => undefined);
  return next;
}

async function syncPulseWidgetsInternal(api: PulseApiClient, cache: WidgetTaskCache): Promise<void> {
  await initializeIOSWidgetTimelines();
  let previous: Partial<Record<WidgetSlot, TaskWidgetSnapshot>> = {};
  try { previous = JSON.parse((await AsyncStorage.getItem(WIDGET_BASELINES_KEY)) ?? "{}"); } catch { /* Use empty snapshots when no prior sync exists. */ }
  const fetchView = (request: Promise<Task[]>, fallback: Task[] | undefined) => request
    .then((value) => Array.isArray(value) ? { value, ok: true as const, fromCache: false as const } : Promise.reject(new Error("Invalid widget task response")))
    .catch(() => ({ value: fallback ?? [], ok: false as const, fromCache: Boolean(fallback) }));
  const [todayResult, inboxResult, upcomingResult, overdueResult, projectsResult, settings] = await Promise.all([
    fetchView(api.getToday(true), cache.today),
    fetchView(api.getInbox(true), cache.inbox),
    fetchView(api.getUpcoming(true), cache.upcoming),
    fetchView(api.getOverdue(), cache.overdue),
    api.listProjects().catch(() => cache.projects ?? [] as Project[]),
    loadWidgetSettings(),
  ]);
  const projects = projectsResult;
  const keepOrBuild = (view: typeof views[number], result: { value: Task[]; ok: boolean; fromCache: boolean }, config: WidgetConfiguration): TaskWidgetSnapshot => result.ok || result.fromCache ? snapshot(view, result.value, projects, config) : previous[view] ? reconfigureSnapshot(previous[view], view, config) : emptySnapshot(view);
  const snapshots = { today: keepOrBuild("today", todayResult, settings.today), inbox: keepOrBuild("inbox", inboxResult, settings.inbox), upcoming: keepOrBuild("upcoming", upcomingResult, settings.upcoming), overdue: keepOrBuild("overdue", overdueResult, settings.overdue) };
  const updateIOS = (slot: WidgetSlot, value: object) => {
    try {
      pulseWidgets[slot].updateSnapshot(propertyListSafe(value) as never);
    } catch (error) {
      console.warn(`[widgets] unable to update iOS ${slot} widget`, error);
    }
  };
  const updateAndroid = async (view: string, value: object) => {
    try { await updateAndroidWidgetSnapshot(view, value); } catch (error) { console.warn(`[widgets] unable to update Android ${view} widget`, error); }
  };
  for (const view of views) updateIOS(view, snapshots[view]);
  await Promise.all(views.map((view) => updateAndroid(view, snapshots[view])));
  const flexibleView = views.includes(settings.tasks.view as typeof views[number]) ? settings.tasks.view as typeof views[number] : "today";
  const flexibleResult = { today: todayResult, inbox: inboxResult, upcoming: upcomingResult, overdue: overdueResult }[flexibleView];
  const flexible = flexibleResult.ok || flexibleResult.fromCache ? snapshot(flexibleView, flexibleResult.value, projects, settings.tasks) : reconfigureSnapshot(snapshots[flexibleView], flexibleView, settings.tasks);
  updateIOS("tasks", { snapshots: { ...snapshots, [flexibleView]: flexible } });
  await updateAndroid("tasks", flexible);
  await AsyncStorage.setItem(WIDGET_BASELINES_KEY, JSON.stringify({ ...snapshots, tasks: flexible })).catch((error) => console.warn("[widgets] unable to persist widget baseline", error));
  // Existing snapshots are a valid offline result. Only report failure when
  // there is neither network data, caller-provided cache, nor a previous
  // baseline to keep showing.
  const hasPrevious = Object.keys(previous).length > 0;
  if (![todayResult, inboxResult, upcomingResult, overdueResult].some((result) => result.ok || result.fromCache) && !hasPrevious) throw new Error("Unable to refresh widget tasks");
}
