import assert from "node:assert/strict";
import test from "node:test";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { PulseMcpApi } from "../src/server.js";
import { createPulseMcpHttpServer } from "../src/http.js";

async function listen(server: ReturnType<typeof createPulseMcpHttpServer>): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

test("serves MCP over persistent authenticated Streamable HTTP", async () => {
  const server = createPulseMcpHttpServer({ token: "test-token", api: {} as PulseMcpApi });
  const port = await listen(server);
  const endpoint = `http://127.0.0.1:${port}/mcp`;
  const client = new Client({ name: "pulse-http-test", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
    requestInit: { headers: { authorization: "Bearer test-token" } },
  });

  try {
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    assert.equal((await fetch(endpoint)).status, 401);
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 25);
  } finally {
    await client.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
