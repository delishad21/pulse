import { useQueryClient } from "@tanstack/react-query";
import { addUserInteractionListener } from "expo-widgets";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { Project, Task } from "@pulse/api-client";
import { useAuth } from "@/providers/auth-provider";
import { registerWidgetBackgroundTasks } from "./background";
import { registerWidgetPushDevice } from "./push-device";
import { recordWidgetCompletion, refreshPulseWidgets } from "./sync";

function targetFromWidgetUrl(url: string): string | null {
  const parsed = Linking.parse(url);
  if (parsed.hostname !== "widget") return null;
  const segments = (parsed.path ?? "").split("/").filter(Boolean);
  if (segments[0] === "add") return "add";
  if (segments[0] === "view" && segments[1]) return `view:${segments[1]}`;
  if ((segments[0] === "task" || segments[0] === "complete") && segments[1]) return `${segments[0]}:${segments[1]}`;
  return null;
}

export function WidgetBridge() {
  const { api, status } = useAuth(); const client = useQueryClient();
  const handledInitialUrl = useRef(false);
  const actionSequence = useRef(0);
  const cachedWidgetData = useCallback(() => ({
    today: client.getQueryData<Task[]>(["view", "today", false]),
    inbox: client.getQueryData<Task[]>(["view", "inbox", false]),
    overdue: client.getQueryData<Task[]>(["view", "overdue"]),
    projects: client.getQueryData<Project[]>(["projects"]),
  }), [client]);
  const handleTarget = useCallback(async (target: string) => {
    actionSequence.current += 1;
    const widgetAction = `${Date.now()}-${actionSequence.current}`;
    if (target === "add") {
      router.replace({ pathname: "/today", params: { create: "1", widgetAction } });
      return;
    }
    if (target.startsWith("view:")) {
      const view = target.slice("view:".length);
      const pathname = view === "inbox" ? "/inbox" : view === "upcoming" ? "/upcoming" : view === "today" ? "/today" : view === "overdue" ? "/today" : "/inbox";
      router.replace(pathname as never);
      return;
    }
    const [, action, taskId] = target.match(/^(complete|task):([^?]+)/) ?? [];
    if (action === "complete" && taskId) {
      // Recorded as pending first, so a failed request is retried later
      // instead of the task reappearing in the widget.
      await recordWidgetCompletion(taskId);
      await refreshPulseWidgets(api, cachedWidgetData()).catch(() => undefined);
      await client.invalidateQueries();
      return;
    }
    if (action !== "task" || !taskId) return;
    router.replace({ pathname: "/today", params: { task: taskId, widgetAction } });
  }, [api, cachedWidgetData, client]);
  useEffect(() => {
    if (status !== "authenticated") return;
    const refresh = () => refreshPulseWidgets(api, cachedWidgetData()).then(({ completed }) => completed ? client.invalidateQueries() : undefined).catch(() => undefined);
    refresh();
    // Keep widgets current while the app is closed (see background.ts).
    registerWidgetBackgroundTasks().catch(() => undefined);
    registerWidgetPushDevice(api).catch((error) => console.warn("[widgets] unable to register for widget refresh pushes", error));
    const refreshTimer = setInterval(refresh, 60_000);
    const appState = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    const widget = addUserInteractionListener((event) => { handleTarget(event.target); });
    const links = Linking.addEventListener("url", ({ url }) => {
      const target = targetFromWidgetUrl(url);
      if (target) handleTarget(target);
    });
    if (!handledInitialUrl.current) {
      handledInitialUrl.current = true;
      Linking.getInitialURL().then((url) => { if (!url) return; const target = targetFromWidgetUrl(url); if (target) handleTarget(target); });
    }
    return () => { clearInterval(refreshTimer); appState.remove(); widget.remove(); links.remove(); };
  }, [api, cachedWidgetData, client, handleTarget, status]);
  return null;
}
