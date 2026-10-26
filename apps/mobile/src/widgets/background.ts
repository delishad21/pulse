import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { createHeadlessApi } from "@/lib/session";
import { refreshPulseWidgets } from "./sync";

/**
 * Keeps home-screen widgets current while the app is closed. Two triggers run
 * the same refresh WidgetBridge runs in the foreground (send widget ticks,
 * then rewrite every widget from the server):
 *
 * - a silent push the server sends shortly after the user's tasks change
 *   (iOS content-available, Android data-only);
 * - a periodic background task, the fallback for when the OS drops or
 *   throttles silent pushes. The OS decides the actual timing; 15 minutes is
 *   the shortest interval either platform honours.
 *
 * Both run headless, outside the React tree, so they build their own API
 * client from the stored session. Tasks must be defined at module scope, so
 * this file is imported from the app entry point (index.ts).
 */
export const WIDGET_BACKGROUND_TASK = "pulse.widgets.background-refresh";
export const WIDGET_PUSH_TASK = "pulse.widgets.push-refresh";
const MINIMUM_INTERVAL_MINUTES = 15;

export async function runHeadlessWidgetRefresh(): Promise<boolean> {
  const api = await createHeadlessApi();
  if (!api) return false;
  await refreshPulseWidgets(api);
  return true;
}

if (Platform.OS !== "web") {
  TaskManager.defineTask(WIDGET_BACKGROUND_TASK, async () => {
    try {
      await runHeadlessWidgetRefresh();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch (error) {
      console.warn("[widgets] background refresh failed", error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });

  TaskManager.defineTask<Notifications.NotificationTaskPayload>(WIDGET_PUSH_TASK, async ({ data }) => {
    // Taps on notifications (Android) arrive here too; only received pushes
    // refresh. Any received push may mean tasks changed (reminders included),
    // so this does not depend on the payload shape, which differs by platform.
    if (data && "actionIdentifier" in data) return Notifications.BackgroundNotificationTaskResult.NoData;
    try {
      return (await runHeadlessWidgetRefresh()) ? Notifications.BackgroundNotificationTaskResult.NewData : Notifications.BackgroundNotificationTaskResult.NoData;
    } catch (error) {
      console.warn("[widgets] push refresh failed", error);
      return Notifications.BackgroundNotificationTaskResult.Failed;
    }
  });
}

/** Called once signed in. Safe to call repeatedly; registration is idempotent. */
export async function registerWidgetBackgroundTasks(): Promise<void> {
  if (Platform.OS === "web") return;
  await Notifications.registerTaskAsync(WIDGET_PUSH_TASK).catch((error) => console.warn("[widgets] unable to register push task", error));
  const status = await BackgroundTask.getStatusAsync().catch(() => BackgroundTask.BackgroundTaskStatus.Restricted);
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(WIDGET_BACKGROUND_TASK).catch(() => false)) return;
  await BackgroundTask.registerTaskAsync(WIDGET_BACKGROUND_TASK, { minimumInterval: MINIMUM_INTERVAL_MINUTES })
    .catch((error) => console.warn("[widgets] unable to register background refresh", error));
}
