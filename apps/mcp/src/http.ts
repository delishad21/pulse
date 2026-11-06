import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import type { PulseMcpApi } from "./server.js";
import { createDefaultPulseApi, createPulseMcpServer } from "./server.js";

export interface PulseMcpHttpOptions {
  api?: PulseMcpApi;
  clientToken?: string;
  apiToken?: string;
  allowApiToken?: boolean;
  host?: string;
  port?: number;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function tokenMatches(candidate: string, expected: string): boolean {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function bearerToken(request: IncomingMessage): string | null {
  const authorization = headerValue(request.headers.authorization);
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function requiredSetting(name: string, value: string | undefined, hint: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${name} is required: ${hint}`);
  return trimmed;
}

function json(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createPulseMcpHttpServer(options: PulseMcpHttpOptions = {}): Server {
  const apiToken = requiredSetting(
    "PULSE_API_TOKEN",
    options.apiToken ?? process.env.PULSE_API_TOKEN,
    "Compose sets it from PULSE_MCP_API_KEY, a key created under Pulse Settings → API keys.",
  );
  const clientToken = requiredSetting(
    "PULSE_MCP_CLIENT_TOKEN",
    options.clientToken ?? process.env.PULSE_MCP_CLIENT_TOKEN,
    "set it to a long random value; clients send it as their bearer token at /mcp.",
  );
  // The API only looks up pulse_-prefixed bearers as API keys, so this keeps the
  // client token from ever being a Pulse credential.
  if (clientToken === apiToken || clientToken.startsWith("pulse_")) {
    throw new Error("PULSE_MCP_CLIENT_TOKEN must be its own random value, not a Pulse API key.");
  }
  // Transition only: remove this setting once no client sends the API token to /mcp.
  const allowApiToken = options.allowApiToken ?? process.env.PULSE_MCP_ALLOW_API_TOKEN === "true";
  if (allowApiToken) console.warn("Pulse MCP: PULSE_MCP_ALLOW_API_TOKEN is on, /mcp also accepts the API token.");
  else console.log("Pulse MCP: /mcp accepts only the client token.");
  const api = options.api ?? createDefaultPulseApi(apiToken);
  const handler = toNodeHandler(
    createMcpHandler(() => createPulseMcpServer(api), { legacy: "stateless" }),
    { onerror: (error) => console.error("Pulse MCP HTTP error:", error) },
  );

  return createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, { status: "ok", service: "pulse-mcp" });
      return;
    }

    if (url.pathname !== "/mcp") {
      json(response, 404, { error: "Not found" });
      return;
    }

    const suppliedToken = bearerToken(request);
    const usedApiToken = allowApiToken && suppliedToken !== null && tokenMatches(suppliedToken, apiToken);
    if (usedApiToken) console.warn("Pulse MCP: a client authenticated at /mcp with the API token.");
    if (!suppliedToken || (!usedApiToken && !tokenMatches(suppliedToken, clientToken))) {
      response.writeHead(401, { "content-type": "application/json", "www-authenticate": "Bearer" });
      response.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    void handler(request, response).catch((error: unknown) => {
      console.error("Pulse MCP request error:", error);
      if (!response.headersSent) json(response, 500, { error: "Internal server error" });
      else response.destroy();
    });
  }).on("clientError", (error, socket) => {
    console.error("Pulse MCP client error:", error);
    socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  });
}

export function startPulseMcpHttpServer(options: PulseMcpHttpOptions = {}): Server {
  const port = options.port ?? Number(process.env.PULSE_MCP_PORT ?? 6060);
  const host = options.host ?? process.env.PULSE_MCP_HOST ?? "0.0.0.0";
  const server = createPulseMcpHttpServer(options);
  server.listen(port, host, () => console.log(`Pulse MCP listening on http://${host}:${port}/mcp`));
  return server;
}
