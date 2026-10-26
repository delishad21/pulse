import assert from "node:assert/strict";
import test from "node:test";
import type { TaskWidgetSnapshot } from "@pulse/widget-contracts";
import { afterWidgetWrite, completionOutcome, emptyCompletionState, parseCompletionState, recordCompletions, recordedCompletions, settleCompletions, withPendingCompletions } from "./completions.ts";

const task = (id: string) => ({ id, title: id, dueLabel: null, isOverdue: false, priority: "none" as const, projectName: null, projectColor: null, tagNames: [], location: null, dateKey: null, dateLabel: null });
const snapshot = (view: "today" | "inbox" | "upcoming" | "overdue", ids: string[], completedTaskIds?: string[]) => ({
  version: 2, view, title: view, generatedAt: "2026-10-26T09:00:00.000Z", staleAfter: "2026-10-26T09:15:00.000Z",
  openCount: ids.length, totalCount: ids.length, accentColor: "#dc4c3e", configuration: {} as TaskWidgetSnapshot["configuration"], tasks: ids.map(task), completedTaskIds,
}) satisfies TaskWidgetSnapshot;

test("ticks are read from fixed widgets and from every view and instance of the flexible widget", () => {
  const props = [
    snapshot("today", ["b"], ["a"]),
    // Flexible widget: one instance on Upcoming, one on Overdue; neither is the view set in app settings.
    { snapshots: { today: snapshot("today", []), upcoming: snapshot("upcoming", ["d"]), overdue: snapshot("overdue", []) }, completedTaskIds: ["c", "e"] },
    // Older timelines that kept the list inside a per-view snapshot.
    { snapshots: { inbox: snapshot("inbox", [], ["f"]) } },
    null, "garbage", { completedTaskIds: [42, "", "g"] },
  ];
  assert.deepEqual(recordedCompletions(props).sort(), ["a", "c", "e", "f", "g"]);
});

test("a tick is never inferred from a task missing from a snapshot", () => {
  // The task disappeared because it was completed or rescheduled elsewhere, not because it was ticked here.
  assert.deepEqual(recordedCompletions([snapshot("today", [])]), []);
});

test("a tick stays pending until the server confirms it", () => {
  let state = recordCompletions(emptyCompletionState, ["a", "b"]);
  state = settleCompletions(state, [{ id: "a", outcome: completionOutcome(null) }, { id: "b", outcome: completionOutcome(new TypeError("Network request failed")) }]);
  assert.deepEqual(state, { pending: ["b"], confirmed: ["a"] });
  // The timeline still lists both until the next write; "a" must not be sent again, "b" must be.
  state = recordCompletions(state, ["a", "b"]);
  assert.deepEqual(state.pending, ["b"]);
  state = afterWidgetWrite(state);
  assert.deepEqual(state, { pending: ["b"], confirmed: [] });
});

test("server errors, auth failures and rate limits retry; a deleted task is settled", () => {
  for (const status of [401, 408, 429, 500, 503]) assert.equal(completionOutcome({ status }), "retry", `status ${status}`);
  assert.equal(completionOutcome(new Error("offline")), "retry");
  assert.equal(completionOutcome({ status: 404 }), "confirmed");
});

test("a reopened task ticked again after the next widget write is sent again", () => {
  let state = settleCompletions(recordCompletions(emptyCompletionState, ["a"]), [{ id: "a", outcome: "confirmed" }]);
  state = afterWidgetWrite(state);
  state = recordCompletions(state, ["a"]);
  assert.deepEqual(state.pending, ["a"]);
});

test("pending ticks stay hidden and are carried into the rewritten snapshot", () => {
  const fresh = snapshot("today", ["a", "b", "c"]);
  const shown = withPendingCompletions(fresh, ["b", "z"]);
  assert.deepEqual(shown.tasks.map((item) => item.id), ["a", "c"]);
  assert.equal(shown.openCount, 2);
  assert.equal(shown.totalCount, 2);
  assert.deepEqual(shown.completedTaskIds, ["b", "z"]);
  assert.deepEqual(withPendingCompletions(fresh, []).completedTaskIds, []);
});

test("stored state survives corruption and migrates the old pending list", () => {
  assert.deepEqual(parseCompletionState(null), emptyCompletionState);
  assert.deepEqual(parseCompletionState("{not json"), emptyCompletionState);
  assert.deepEqual(parseCompletionState(JSON.stringify({ pending: ["a"], confirmed: ["b"] }), JSON.stringify(["b", "c", "a"])), { pending: ["a", "c"], confirmed: ["b"] });
});
