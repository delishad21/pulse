import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import type { PulseMcpApi } from "../src/server.js";
import { createPulseMcpHttpServer, type PulseMcpHttpOptions } from "../src/http.js";

const CLIENT_TOKEN = "test-client-token";
const API_TOKEN = "pulse_test-api-token";

type TestServer = ReturnType<typeof createServer>;

async function listen(server: TestServer): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return address.port;
}

async function close(server: TestServer): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

function mcpServer(options: PulseMcpHttpOptions = {}): TestServer {
  return createPulseMcpHttpServer({ clientToken: CLIENT_TOKEN, apiToken: API_TOKEN, api: {} as PulseMcpApi, allowApiToken: false, ...options });
}

async function connect(port: number, token: string): Promise<Client> {
  const client = new Client({ name: "pulse-http-test", version: "0.1.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${token}` } },
  }));
  return client;
}

async function statusWithToken(port: number, token: string): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${port}/mcp`, { headers: { authorization: `Bearer ${token}` } });
  await response.body?.cancel();
  return response.status;
}

test("serves MCP over persistent Streamable HTTP to the client token", async () => {
  const server = mcpServer();
  const port = await listen(server);
  const client = await connect(port, CLIENT_TOKEN);

  try {
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 26);
  } finally {
    await client.close();
    await close(server);
  }
});

test("refuses a missing or wrong token with 401 and leaves /health open", async () => {
  const server = mcpServer();
  const port = await listen(server);

  try {
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    const missing = await fetch(`http://127.0.0.1:${port}/mcp`);
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get("www-authenticate"), "Bearer");
    assert.equal(await statusWithToken(port, "wrong-token"), 401);
  } finally {
    await close(server);
  }
});

test("refuses the API token at /mcp while the transition is off", async () => {
  for (const options of [{ allowApiToken: false }, {}]) {
    const server = mcpServer(options);
    const port = await listen(server);
    try {
      assert.equal(await statusWithToken(port, API_TOKEN), 401);
      assert.notEqual(await statusWithToken(port, CLIENT_TOKEN), 401);
    } finally {
      await close(server);
    }
  }
});

test("the transition setting is off unless it is exactly true", async () => {
  const previous = process.env.PULSE_MCP_ALLOW_API_TOKEN;
  try {
    for (const [value, expectedAccepted] of [["false", false], ["1", false], ["", false], ["true", true]] as const) {
      process.env.PULSE_MCP_ALLOW_API_TOKEN = value;
      const server = createPulseMcpHttpServer({ clientToken: CLIENT_TOKEN, apiToken: API_TOKEN, api: {} as PulseMcpApi });
      const port = await listen(server);
      try {
        assert.equal((await statusWithToken(port, API_TOKEN)) !== 401, expectedAccepted, `value ${JSON.stringify(value)}`);
      } finally {
        await close(server);
      }
    }
  } finally {
    if (previous === undefined) delete process.env.PULSE_MCP_ALLOW_API_TOKEN;
    else process.env.PULSE_MCP_ALLOW_API_TOKEN = previous;
  }
});

test("accepts both tokens at /mcp during the transition", async () => {
  const server = mcpServer({ allowApiToken: true });
  const port = await listen(server);
  const oldClient = await connect(port, API_TOKEN);
  const newClient = await connect(port, CLIENT_TOKEN);

  try {
    assert.equal((await oldClient.listTools()).tools.length, 26);
    assert.equal((await newClient.listTools()).tools.length, 26);
    assert.equal(await statusWithToken(port, "wrong-token"), 401);
  } finally {
    await oldClient.close();
    await newClient.close();
    await close(server);
  }
});

test("calls the Pulse API only with the API token", async () => {
  const seen: Array<string | undefined> = [];
  const pulseApi = createServer((request, response) => {
    seen.push(request.headers.authorization);
    response.writeHead(200, { "content-type": "application/json" });
    response.end("[]");
  });
  const apiPort = await listen(pulseApi);
  const previous = process.env.PULSE_API_BASE_URL;
  process.env.PULSE_API_BASE_URL = `http://127.0.0.1:${apiPort}`;
  const server = createPulseMcpHttpServer({ clientToken: CLIENT_TOKEN, apiToken: API_TOKEN, allowApiToken: false });
  const port = await listen(server);
  const client = await connect(port, CLIENT_TOKEN);

  try {
    const result = await client.callTool({ name: "get_today", arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(seen, [`Bearer ${API_TOKEN}`]);
  } finally {
    if (previous === undefined) delete process.env.PULSE_API_BASE_URL;
    else process.env.PULSE_API_BASE_URL = previous;
    await client.close();
    await close(server);
    await close(pulseApi);
  }
});

test("refuses a client token that could be a Pulse credential", () => {
  assert.throws(() => mcpServer({ clientToken: API_TOKEN }), /PULSE_MCP_CLIENT_TOKEN must be its own/);
  assert.throws(() => mcpServer({ clientToken: "same-value", apiToken: "same-value" }), /PULSE_MCP_CLIENT_TOKEN must be its own/);
  assert.throws(() => mcpServer({ clientToken: "pulse_another-api-key" }), /PULSE_MCP_CLIENT_TOKEN must be its own/);
});

function startUp(env: Record<string, string>) {
  // Set-but-empty values also stop dotenv filling them in from a developer's .env.
  return spawnSync(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { PATH: process.env.PATH ?? "", PULSE_API_TOKEN: "", PULSE_MCP_CLIENT_TOKEN: "", PULSE_SERVICE_TOKEN: "service-token", ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
}

test("start-up fails clearly without the API key, even with a service token", () => {
  const result = startUp({ PULSE_MCP_CLIENT_TOKEN: CLIENT_TOKEN });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Pulse MCP failed to start: PULSE_API_TOKEN is required.*PULSE_MCP_API_KEY/);
});

test("start-up fails clearly without the client token", () => {
  const result = startUp({ PULSE_API_TOKEN: API_TOKEN });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Pulse MCP failed to start: PULSE_MCP_CLIENT_TOKEN is required/);
});
