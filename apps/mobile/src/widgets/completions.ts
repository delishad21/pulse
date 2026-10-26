import type { TaskWidgetSnapshot } from "@pulse/widget-contracts";

/**
 * Widget ticks are recorded explicitly (iOS: the widget appends the id to
 * `completedTaskIds` in its own timeline props; Android: a native pending set)
 * and are never inferred from a snapshot diff. They move through two states:
 *
 * - pending: ticked, not yet confirmed by the server. Retried on every refresh,
 *   hidden from every widget, and written back into each iOS timeline so a
 *   refresh can never drop them.
 * - confirmed: the server accepted it. iOS timelines may still list the id
 *   until the next write, so confirmed ids are ignored when harvesting and
 *   forgotten once that write has happened.
 *
 * Kept free of React Native imports so it can be unit tested under Node.
 */
export interface CompletionState { pending: string[]; confirmed: string[]; }
export const emptyCompletionState: CompletionState = { pending: [], confirmed: [] };

const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const ids = (value: unknown): string[] => Array.isArray(value) ? value.filter(isId) : [];

export function parseCompletionState(raw: string | null, legacyPending?: string | null): CompletionState {
  let state: CompletionState = { pending: [], confirmed: [] };
  try {
    const parsed = raw ? JSON.parse(raw) as Partial<CompletionState> : {};
    state = { pending: ids(parsed.pending), confirmed: ids(parsed.confirmed) };
  } catch { /* A corrupt record is treated as empty; widget timelines still hold their own ticks. */ }
  try {
    // The previous app version kept a plain list of unsent completions.
    if (legacyPending) state = recordCompletions(state, ids(JSON.parse(legacyPending)));
  } catch { /* Ignore an unreadable legacy list. */ }
  return state;
}

/**
 * Collect every tick recorded in widget timeline props: the fixed widgets'
 * snapshot props and the flexible widget's top-level list, plus each of its
 * per-view snapshots, so a tick in any instance on any view is found.
 */
export function recordedCompletions(timelineProps: unknown[]): string[] {
  const found = new Set<string>();
  for (const props of timelineProps) {
    if (!props || typeof props !== "object") continue;
    const record = props as { completedTaskIds?: unknown; snapshots?: unknown };
    ids(record.completedTaskIds).forEach((id) => found.add(id));
    if (record.snapshots && typeof record.snapshots === "object") {
      for (const snapshot of Object.values(record.snapshots as Record<string, unknown>)) {
        if (snapshot && typeof snapshot === "object") ids((snapshot as { completedTaskIds?: unknown }).completedTaskIds).forEach((id) => found.add(id));
      }
    }
  }
  return [...found];
}

/** Add newly seen ticks to pending, ignoring ones the server already confirmed. */
export function recordCompletions(state: CompletionState, recorded: string[]): CompletionState {
  const confirmed = new Set(state.confirmed);
  const pending = [...state.pending];
  for (const id of recorded) if (!confirmed.has(id) && !pending.includes(id)) pending.push(id);
  return { pending, confirmed: [...state.confirmed] };
}

export type CompletionOutcome = "confirmed" | "retry";

/**
 * Success, or a 404 (the task was deleted elsewhere), settles a tick. Network
 * failures, timeouts, rate limits, auth problems and server errors keep it
 * pending so it is retried on the next refresh.
 */
export function completionOutcome(error: unknown): CompletionOutcome {
  if (error === null || error === undefined) return "confirmed";
  const status = typeof error === "object" && "status" in error ? Number((error as { status: unknown }).status) : NaN;
  return status === 404 ? "confirmed" : "retry";
}

export function settleCompletions(state: CompletionState, outcomes: { id: string; outcome: CompletionOutcome }[]): CompletionState {
  const done = new Set(outcomes.filter((item) => item.outcome === "confirmed").map((item) => item.id));
  return {
    pending: state.pending.filter((id) => !done.has(id)),
    confirmed: [...new Set([...state.confirmed, ...done])],
  };
}

/** Once every widget has been rewritten, confirmed ids are no longer in any timeline. */
export function afterWidgetWrite(state: CompletionState): CompletionState {
  return { pending: [...state.pending], confirmed: [] };
}

/** Hide still-pending ticks and carry them in the snapshot so the widget keeps them. */
export function withPendingCompletions(snapshot: TaskWidgetSnapshot, pending: string[]): TaskWidgetSnapshot {
  const hidden = new Set(pending);
  const tasks = snapshot.tasks.filter((task) => !hidden.has(task.id));
  const removed = snapshot.tasks.length - tasks.length;
  return {
    ...snapshot,
    tasks,
    openCount: Math.max(0, snapshot.openCount - removed),
    totalCount: Math.max(0, snapshot.totalCount - removed),
    completedTaskIds: [...pending],
  };
}
