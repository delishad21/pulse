# Pulse MCP

Thin MCP adapter for Pulse. It exposes semantic task actions and delegates every operation to `@pulse/api-client`; it never reads Prisma or PostgreSQL directly.

## Initial tools

- `get_today`
- `get_inbox`
- `search_tasks`
- `create_task`
- `update_task`
- `complete_task`
- `reschedule_task`
- `create_project`
- `get_projects`

## Runtime

The production MCP is a persistent Streamable HTTP server. It listens on
`/mcp` inside the container at port `6060`; the Compose file publishes it on
loopback port `6061` for Hermes by default:

```text
url: http://127.0.0.1:6061/mcp
headers:
  Authorization: Bearer <PULSE_MCP_CLIENT_TOKEN>
```

The server uses two separate tokens:

- `PULSE_MCP_CLIENT_TOKEN` authenticates clients at `/mcp`. It is a random value
  that is not a Pulse credential: the server refuses to start if it equals the
  API token or starts with `pulse_`, the prefix the API requires of an API key.
- `PULSE_API_TOKEN` is used only for the MCP's requests to the Pulse API. In a
  production deployment, create a named API key from the Pulse Settings page and
  provide it to the `mcp` service via `PULSE_MCP_API_KEY` (see
  `deploy/README.md`). The key is resolved to its owning Pulse user, so every
  MCP operation remains scoped to that account. Clients never need it.

The server exits at start-up if either token is missing, and Compose refuses to
start the stack without them. There is no fallback to `PULSE_SERVICE_TOKEN`.

`PULSE_MCP_ALLOW_API_TOKEN=true` is a temporary setting that also accepts the API
token at `/mcp`, so a client can move to the client token without an outage. It
is off unless set to exactly `true`. While it is on, the server logs a warning at
start-up and on each request that uses the old path.

For local development, run the HTTP server directly:

```bash
PULSE_API_BASE_URL=http://127.0.0.1:4000 \
PULSE_API_TOKEN=local-api-token \
PULSE_MCP_CLIENT_TOKEN=local-client-token \
PULSE_MCP_PORT=6060 \
npm run start -w @pulse/mcp
```

The unauthenticated `/health` endpoint is intended for the container healthcheck.

## Security note

API keys are bearer credentials. Keep them out of source control, prompts, and
logs. The server stores only a SHA-256 hash, displays the raw key once, and lets
the owner revoke it from Settings. Keep the API and MCP server on the trusted
local/private network and use HTTPS for any traffic that leaves it.
