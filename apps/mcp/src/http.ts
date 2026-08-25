import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import type { PulseMcpApi } from "./server.js";
import { createDefaultPulseApi, createPulseMcpServer } from "./server.js";

export interface PulseMcpHttpOptions {
  api?: PulseMcpApi;
  token?: string;
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

function json(response: ServerResponse, status: number, body: Record<string, unknown>): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createPulseMcpHttpServer(options: PulseMcpHttpOptions = {}): Server {
  const token = (options.token ?? process.env.PULSE_API_TOKEN)?.trim();
  const api = options.api ?? createDefaultPulseApi();
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
    if (!token || !suppliedToken || !tokenMatches(suppliedToken, token)) {
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
