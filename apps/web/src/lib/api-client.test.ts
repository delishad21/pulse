import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PulseApiClient } from "@pulse/api-client";

describe("PulseApiClient", () => {
  const originalFetch = globalThis.fetch;
  let requests: { url: string; init?: RequestInit }[] = [];

  before(() => {
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      requests.push({ url, init });
      return new Response(JSON.stringify([{ id: "task-001", title: "Mock" }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
  });

  it("sends auth header when getAccessToken is provided", async () => {
    requests = [];
    const client = new PulseApiClient({
      baseUrl: "http://localhost:3000",
      getAccessToken: async () => "token-123",
    });
    await client.listTasks();
    assert.equal(requests.length, 1);
    assert.equal(
      (requests[0]?.init?.headers as Record<string, string>)?.Authorization,
      "Bearer token-123",
    );
  });

  it("throws on non-ok response", async () => {
    globalThis.fetch = async () =>
      new Response("Not found", { status: 404 });
    const client = new PulseApiClient({ baseUrl: "http://localhost:3000" });
    await assert.rejects(() => client.listTasks(), /Pulse API error: 404/);
    globalThis.fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      requests.push({ url, init });
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });
});
