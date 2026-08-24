import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addUserInteractionListener } from "expo-widgets";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { consumeAndroidWidgetCompletions } from "@pulse/android-widgets";
import type { Project, Task } from "@pulse/api-client";
import { useAuth } from "@/providers/auth-provider";
import { consumeIOSWidgetCompletions, syncPulseWidgets } from "./sync";

const PENDING_WIDGET_ACTIONS_KEY = "pulse.pending-widget-completions-v1";

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
      await api.completeTask(taskId).catch(() => undefined);
      await client.invalidateQueries();
      await syncPulseWidgets(api, cachedWidgetData()).catch(() => undefined);
      return;
    }
    if (action !== "task" || !taskId) return;
    router.replace({ pathname: "/today", params: { task: taskId, widgetAction } });
  }, [api, cachedWidgetData, client]);
  const flushWidgetActions = useCallback(async () => {
    const saved = JSON.parse((await AsyncStorage.getItem(PENDING_WIDGET_ACTIONS_KEY)) ?? "[]") as string[];
    const ids = [...new Set([...saved, ...(await consumeAndroidWidgetCompletions()), ...(await consumeIOSWidgetCompletions())])];
    if (!ids.length) return true;
    const results = await Promise.all(ids.map(async (id) => { try { await api.completeTask(id); return null; } catch { return id; } }));
    await AsyncStorage.setItem(PENDING_WIDGET_ACTIONS_KEY, JSON.stringify(results.filter((id): id is string => Boolean(id))));
    await client.invalidateQueries();
    return results.every((id) => !id);
  }, [api, client]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const refresh = () => flushWidgetActions().then(() => syncPulseWidgets(api, cachedWidgetData())).catch(() => undefined);
    refresh();
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
  }, [api, cachedWidgetData, flushWidgetActions, handleTarget, status]);
  return null;
}
