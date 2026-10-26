import assert from "node:assert/strict";
import test from "node:test";
import { isWidgetSyncDue, processWidgetSyncSignals, widgetSyncMessages, type WidgetSyncSignalRow, type WidgetSyncStore } from "../src/widget-sync.js";

const options = { quietMs: 4000, maxWaitMs: 30_000, retryMs: 60_000 };
const at = (ms: number) => new Date(Date.UTC(2026, 9, 26, 9, 0, 0) + ms);

function fakeStore(devices: Record<string, Array<{ token: string; platform: string }>>) {
  const signals = new Map<string, WidgetSyncSignalRow>();
  const deactivated: string[] = [];
  const store: WidgetSyncStore = {
    widgetSyncSignal: {
      // Return every row; processWidgetSyncSignals re-checks due-ness itself.
      findMany: async () => [...signals.values()],
      deleteMany: async ({ where }) => { const row = signals.get(where.userId); if (row && row.requestedAt.getTime() === where.requestedAt.getTime()) signals.delete(where.userId); },
    },
    pushDevice: {
      findMany: async ({ where }) => devices[where.userId] ?? [],
      updateMany: async ({ where }) => { deactivated.push(...where.token.in); },
    },
  };
  // What the API does on each mutation.
  const mark = (userId: string, now: Date) => { const row = signals.get(userId); signals.set(userId, { userId, firstRequestedAt: row?.firstRequestedAt ?? now, requestedAt: now }); };
  return { store, signals, mark, deactivated };
}

test("a burst of edits waits for a quiet period and sends a single push", async () => {
  const { store, signals, mark } = fakeStore({ alice: [{ token: "ExpoPushToken[a]", platform: "ios" }] });
  const sends: number[] = [];
  const send = async (devices: unknown[]) => { sends.push(devices.length); return [{ status: "ok" }]; };
  for (const ms of [0, 500, 1000, 2500]) mark("alice", at(ms));
  assert.equal(await processWidgetSyncSignals(store, at(3000), options, send), 0);
  assert.equal(await processWidgetSyncSignals(store, at(6000), options, send), 0, "still within 4 s of the last edit");
  assert.equal(await processWidgetSyncSignals(store, at(6500), options, send), 1);
  assert.equal(await processWidgetSyncSignals(store, at(12_000), options, send), 0, "signal is cleared after the push");
  assert.deepEqual(sends, [1]);
  assert.equal(signals.size, 0);
});

test("continuous editing is still pushed after the maximum wait", () => {
  const signal = { userId: "bob", firstRequestedAt: at(0), requestedAt: at(29_000) };
  assert.equal(isWidgetSyncDue(signal, at(29_500), options), false);
  assert.equal(isWidgetSyncDue(signal, at(30_000), options), true);
});

test("each user is debounced separately", async () => {
  const { store, mark } = fakeStore({ carol: [{ token: "ExpoPushToken[c]", platform: "android" }], dave: [{ token: "ExpoPushToken[d]", platform: "ios" }] });
  const pushed: string[] = [];
  const send = async (devices: Array<{ token: string }>) => { pushed.push(...devices.map((d) => d.token)); return devices.map(() => ({ status: "ok" })); };
  mark("carol", at(0)); mark("dave", at(3000));
  await processWidgetSyncSignals(store, at(4500), options, send);
  assert.deepEqual(pushed, ["ExpoPushToken[c]"]);
  await processWidgetSyncSignals(store, at(7000), options, send);
  assert.deepEqual(pushed, ["ExpoPushToken[c]", "ExpoPushToken[d]"]);
});

test("a change made while the push was being sent gets its own push", async () => {
  const { store, signals, mark } = fakeStore({ erin: [{ token: "ExpoPushToken[e]", platform: "ios" }] });
  mark("erin", at(0));
  let sends = 0;
  const send = async () => { sends += 1; mark("erin", at(5000)); return [{ status: "ok" }]; };
  await processWidgetSyncSignals(store, at(4000), options, send);
  assert.equal(signals.has("erin"), true);
  await processWidgetSyncSignals(store, at(9000), options, async () => { sends += 1; return [{ status: "ok" }]; });
  assert.equal(sends, 2);
  assert.equal(signals.has("erin"), false);
});

test("a failed send keeps the signal and backs off; unregistered devices are deactivated", async () => {
  const { store, signals, mark, deactivated } = fakeStore({ fay: [{ token: "ExpoPushToken[f1]", platform: "ios" }, { token: "ExpoPushToken[f2]", platform: "android" }] });
  mark("fay", at(0));
  let attempts = 0;
  const failing = async () => { attempts += 1; throw new Error("network down"); };
  await processWidgetSyncSignals(store, at(5000), options, failing);
  await processWidgetSyncSignals(store, at(10_000), options, failing);
  assert.equal(attempts, 1, "waits retryMs before trying again");
  assert.equal(signals.has("fay"), true);
  await processWidgetSyncSignals(store, at(66_000), options, async () => [{ status: "ok" }, { status: "error", details: { error: "DeviceNotRegistered" } }]);
  assert.equal(signals.has("fay"), false);
  assert.deepEqual(deactivated, ["ExpoPushToken[f2]"]);
});

test("users without a registered phone just have their signal cleared", async () => {
  const { store, signals, mark } = fakeStore({});
  mark("gus", at(0));
  assert.equal(await processWidgetSyncSignals(store, at(5000), options, async () => { throw new Error("should not send"); }), 0);
  assert.equal(signals.size, 0);
});

test("silent messages: content-available on iOS, data-only on Android, never an alert", () => {
  const [ios, android] = widgetSyncMessages([{ token: "ExpoPushToken[i]", platform: "ios" }, { token: "ExpoPushToken[a]", platform: "android" }], at(0));
  assert.deepEqual(ios, { to: "ExpoPushToken[i]", _contentAvailable: true, priority: "normal", data: { type: "widget-sync", sentAt: at(0).toISOString() } });
  assert.deepEqual(android, { to: "ExpoPushToken[a]", priority: "high", data: { type: "widget-sync", sentAt: at(0).toISOString() } });
  for (const message of [ios, android]) for (const key of ["title", "body", "sound", "channelId"]) assert.equal(key in message, false);
});
