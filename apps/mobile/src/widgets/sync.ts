import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { PulseApiClient, Project, Task } from "@pulse/api-client";
import { clampWidgetTaskCount, defaultWidgetConfiguration, makeWidgetSnapshot, type TaskWidgetSnapshot, type WidgetConfiguration } from "@pulse/widget-contracts";
import { consumeAndroidWidgetCompletions, updateAndroidWidgetSnapshot } from "@pulse/android-widgets";
import { formatTaskDate, taskDateKey, taskIsOverdue } from "@/lib/dates";
import { afterWidgetWrite, completionOutcome, parseCompletionState, recordCompletions, recordedCompletions, settleCompletions, withPendingCompletions, type CompletionState } from "./completions";
import { pulseWidgets } from "./index";
import { LEGACY_PENDING_COMPLETIONS_KEY, WIDGET_BASELINES_KEY, WIDGET_COMPLETIONS_KEY } from "./storage-keys";

const views = ["today", "inbox", "upcoming", "overdue"] as const;
export type WidgetSlot = typeof views[number] | "tasks";
export type WidgetSettings = Record<WidgetSlot, WidgetConfiguration>;
export type WidgetTaskCache = Partial<Record<typeof views[number], Task[]>> & { projects?: Project[] };
export const WIDGET_SETTINGS_KEY = "pulse.widget-settings-v2";
let widgetQueue: Promise<unknown> = Promise.resolve();

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

/** Every iOS timeline entry's props, from all five widget kinds. */
async function iosTimelineProps(): Promise<unknown[]> {
  if (Platform.OS !== "ios") return [];
  const kinds = [...views, "tasks"] as const;
  const timelines = await Promise.all(kinds.map(async (kind) => {
    try { return (await pulseWidgets[kind].getTimeline()).map((entry) => entry.props as unknown); } catch { return []; }
  }));
  return timelines.flat();
}

async function loadCompletionState(): Promise<CompletionState> {
  const [[, raw], [, legacy]] = await AsyncStorage.multiGet([WIDGET_COMPLETIONS_KEY, LEGACY_PENDING_COMPLETIONS_KEY]);
  return parseCompletionState(raw, legacy);
}

async function saveCompletionState(state: CompletionState): Promise<void> {
  await AsyncStorage.setItem(WIDGET_COMPLETIONS_KEY, JSON.stringify(state));
  await AsyncStorage.removeItem(LEGACY_PENDING_COMPLETIONS_KEY);
}

/**
 * Move every tick the widgets recorded (iOS timeline props, Android's native
 * pending set) into the app's persistent pending list. Android's set is
 * consumed by the read, so it is saved straight away.
 */
async function harvestWidgetCompletions(): Promise<CompletionState> {
  const recorded = [...recordedCompletions(await iosTimelineProps()), ...(await consumeAndroidWidgetCompletions().catch(() => [] as string[]))];
  const state = recordCompletions(await loadCompletionState(), recorded);
  await saveCompletionState(state);
  return state;
}

/** Send pending ticks to the server. Resolves to how many the server confirmed. */
async function flushWidgetCompletionsInternal(api: PulseApiClient): Promise<number> {
  const state = await harvestWidgetCompletions();
  if (!state.pending.length) return 0;
  const outcomes = await Promise.all(state.pending.map((id) => api.completeTask(id)
    .then(() => ({ id, outcome: completionOutcome(null) }), (error: unknown) => ({ id, outcome: completionOutcome(error) }))));
  const settled = settleCompletions(state, outcomes);
  await saveCompletionState(settled);
  return state.pending.length - settled.pending.length;
}

function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = widgetQueue.then(job);
  widgetQueue = next.catch(() => undefined);
  return next;
}

/** Record a tick that arrived as an event or deep link rather than through widget props. */
export function recordWidgetCompletion(taskId: string): Promise<void> {
  return enqueue(async () => saveCompletionState(recordCompletions(await loadCompletionState(), [taskId])));
}

/** Send widget ticks to the server, then rewrite every widget from fresh data. */
export function refreshPulseWidgets(api: PulseApiClient, cache: WidgetTaskCache = {}): Promise<{ completed: number }> {
  return enqueue(async () => {
    const completed = await flushWidgetCompletionsInternal(api).catch(() => 0);
    await syncPulseWidgetsInternal(api, cache);
    return { completed };
  });
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
  return enqueue(() => syncPulseWidgetsInternal(api, cache));
}

async function syncPulseWidgetsInternal(api: PulseApiClient, cache: WidgetTaskCache): Promise<void> {
  await initializeIOSWidgetTimelines();
  let previous: Partial<Record<WidgetSlot, TaskWidgetSnapshot>> = {};
  try { previous = JSON.parse((await AsyncStorage.getItem(WIDGET_BASELINES_KEY)) ?? "{}"); } catch { /* Use empty snapshots when no prior sync exists. */ }
  const fetchView = (request: Promise<Task[]>) => request
    .then((value) => Array.isArray(value) ? { value, ok: true as const } : Promise.reject(new Error("Invalid widget task response")))
    .catch(() => ({ value: [] as Task[], ok: false as const }));
  const [todayResult, inboxResult, upcomingResult, overdueResult, projectsResult, settings] = await Promise.all([
    fetchView(api.getToday(true)),
    fetchView(api.getInbox(true)),
    fetchView(api.getUpcoming(true)),
    fetchView(api.getOverdue()),
    api.listProjects().catch(() => cache.projects ?? [] as Project[]),
    loadWidgetSettings(),
  ]);
  const projects = projectsResult;
  const results = { today: todayResult, inbox: inboxResult, upcoming: upcomingResult, overdue: overdueResult };
  // Offline: keep what the widget last showed. The previous baseline is what
  // the last successful refresh wrote, so it is never older than the app's
  // query cache (which may be from the last time a screen was opened); the
  // cache is only a first-run fallback.
  const fallback = (view: typeof views[number], config: WidgetConfiguration): TaskWidgetSnapshot => {
    const baseline = previous[view];
    if (baseline) return reconfigureSnapshot(baseline, view, config);
    const cached = cache[view];
    return cached ? snapshot(view, cached, projects, config) : emptySnapshot(view);
  };
  const build = (view: typeof views[number], config: WidgetConfiguration) => results[view].ok ? snapshot(view, results[view].value, projects, config) : fallback(view, config);
  const snapshots = { today: build("today", settings.today), inbox: build("inbox", settings.inbox), upcoming: build("upcoming", settings.upcoming), overdue: build("overdue", settings.overdue) };
  const flexibleView = views.includes(settings.tasks.view as typeof views[number]) ? settings.tasks.view as typeof views[number] : "today";
  const flexible = results[flexibleView].ok
    ? snapshot(flexibleView, results[flexibleView].value, projects, settings.tasks)
    : reconfigureSnapshot(previous.tasks?.view === flexibleView ? previous.tasks : snapshots[flexibleView], flexibleView, settings.tasks);

  let written = true;
  const updateIOS = (slot: WidgetSlot, value: object) => {
    if (Platform.OS !== "ios") return;
    try {
      pulseWidgets[slot].updateSnapshot(propertyListSafe(value) as never);
    } catch (error) {
      written = false;
      console.warn(`[widgets] unable to update iOS ${slot} widget`, error);
    }
  };
  const updateAndroid = async (view: string, value: object) => {
    try { await updateAndroidWidgetSnapshot(view, value); } catch (error) { console.warn(`[widgets] unable to update Android ${view} widget`, error); }
  };
  // Pick up ticks made since the last flush right before overwriting the
  // timelines that hold them; anything still unconfirmed stays hidden and is
  // carried into the new timelines.
  const completions = await harvestWidgetCompletions();
  const shown = (value: TaskWidgetSnapshot) => withPendingCompletions(value, completions.pending);
  for (const view of views) updateIOS(view, shown(snapshots[view]));
  updateIOS("tasks", {
    snapshots: Object.fromEntries(views.map((view) => [view, shown(view === flexibleView ? flexible : snapshots[view])])),
    completedTaskIds: completions.pending,
  });
  await Promise.all(views.map((view) => updateAndroid(view, shown(snapshots[view]))));
  await updateAndroid("tasks", shown(flexible));
  if (written) await saveCompletionState(afterWidgetWrite(completions)).catch(() => undefined);
  await AsyncStorage.setItem(WIDGET_BASELINES_KEY, JSON.stringify({ ...snapshots, tasks: flexible })).catch((error) => console.warn("[widgets] unable to persist widget baseline", error));
  // Existing snapshots are a valid offline result. Only report failure when
  // there is neither network data, a previous baseline nor a cache to show.
  const hasPrevious = Object.keys(previous).length > 0;
  if (!Object.values(results).some((result) => result.ok) && !hasPrevious && !views.some((view) => cache[view])) throw new Error("Unable to refresh widget tasks");
}
