"use client";

import { useState } from "react";
import { useTask } from "./use-tasks";

const readTaskParam = () =>
  typeof window === "undefined" ? "" : (new URLSearchParams(window.location.search).get("task") ?? "");

/**
 * Deep link support: `/inbox?task=<id>` (also /today, /upcoming, /filters) opens that task.
 * Returns the linked task once loaded, and a `clear` to call when its modal closes,
 * which also drops `?task=` from the URL so a refresh doesn't reopen it.
 */
export function useLinkedTask() {
  const [taskId, setTaskId] = useState(readTaskParam);
  const { data } = useTask(taskId);

  const clear = () => {
    if (!taskId) return;
    setTaskId("");
    const url = new URL(window.location.href);
    url.searchParams.delete("task");
    window.history.replaceState(window.history.state, "", url);
  };

  return { linkedTask: taskId ? (data ?? null) : null, clear };
}
