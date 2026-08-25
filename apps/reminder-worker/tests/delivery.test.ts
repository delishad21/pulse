import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import { formatReminderMessage, isQuietTime, sendExpoPush, sendHermes } from "../src/delivery.js";

test("formats deterministic detailed reminders", () => {
  const message = formatReminderMessage({ title: "Pay bill", description: "Electricity", project: "Home", priority: "HIGH", dueDate: "2026-08-26", remindAt: new Date("2026-08-25T12:00:00Z"), timezone: "Asia/Singapore" }, { style: "detailed", includeDescription: true, includeProject: true, includePriority: true, includeDue: true });
  assert.match(message, /🔔 Pay bill/); assert.match(message, /Electricity/); assert.match(message, /Project: Home/); assert.match(message, /Priority: high/); assert.match(message, /Due: 2026-08-26/);
});

test("quiet hours support overnight windows", () => {
  assert.equal(isQuietTime(new Date("2026-08-25T15:00:00Z"), "Asia/Singapore", "22:00", "07:00"), true);
  assert.equal(isQuietTime(new Date("2026-08-25T04:00:00Z"), "Asia/Singapore", "22:00", "07:00"), false);
});

test("signs Hermes delivery webhooks and requires a delivery acknowledgement", async () => {
  const secret = "test-reminder-secret";
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      const timestamp = String(request.headers["x-webhook-timestamp"]);
      const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
      assert.equal(request.headers["x-webhook-signature-v2"], expected);
      assert.equal(request.headers["x-request-id"], "reminder-123");
      assert.deepEqual(JSON.parse(body), { message: "Time to test", deliveryId: "reminder-123" });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "delivered", delivery_id: "telegram-456" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    const result = await sendHermes({
      url: `http://127.0.0.1:${address.port}/pulse-reminder`,
      secret,
      message: "Time to test",
      deliveryId: "reminder-123",
      timeoutSeconds: 2,
    });
    assert.equal(result.externalId, "telegram-456");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("submits phone reminders to Expo Push", async () => {
  const server = http.createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Array<Record<string, unknown>>;
      assert.equal(body[0]?.to, "ExpoPushToken[test-device]");
      assert.equal(body[0]?.channelId, "reminders");
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ data: [{ status: "ok", id: "ticket-1" }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address === "object");
  process.env.EXPO_PUSH_URL = `http://127.0.0.1:${address.port}`;
  try {
    const result = await sendExpoPush({ tokens: ["ExpoPushToken[test-device]"], title: "Task", message: "Reminder", taskId: "task-1" });
    assert.equal(result.externalId, "ticket-1");
  } finally {
    delete process.env.EXPO_PUSH_URL;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
