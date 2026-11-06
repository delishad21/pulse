import "dotenv/config";
import { startPulseMcpHttpServer } from "./http.js";

try {
  startPulseMcpHttpServer();
} catch (error) {
  console.error(`Pulse MCP failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
