import "dotenv/config";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createDefaultPulseApi, createPulseMcpServer } from "./server.js";

serveStdio(() => createPulseMcpServer(createDefaultPulseApi()), {
  legacy: "serve",
  onerror: (error) => console.error("Pulse MCP error:", error),
});
