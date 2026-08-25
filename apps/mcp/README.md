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

## Runtime

The production MCP is a persistent Streamable HTTP server. It listens on
`/mcp` inside the container at port `6060`; the Compose file publishes it on
loopback port `6061` for Hermes by default:

```text
url: http://127.0.0.1:6061/mcp
headers:
  Authorization: Bearer <the-same-key-as-PULSE_MCP_API_KEY>
```

`PULSE_API_TOKEN` is used both to authenticate Hermes at the MCP boundary and
to authenticate the MCP's requests to Pulse. In a production deployment,
create a named API key from the Pulse Settings page and provide it to the
Portainer-managed MCP container. The key is resolved to its owning Pulse user,
so every MCP operation remains scoped to that account.

For local development, run the HTTP server directly:

```bash
PULSE_API_BASE_URL=http://127.0.0.1:4000 \
PULSE_API_TOKEN=local-token \
PULSE_MCP_PORT=6060 \
npm run start -w @pulse/mcp
```

The unauthenticated `/health` endpoint is intended for the container healthcheck.

## Security note

API keys are bearer credentials. Keep them out of source control, prompts, and
logs. The server stores only a SHA-256 hash, displays the raw key once, and lets
the owner revoke it from Settings. Keep the API and MCP server on the trusted
local/private network and use HTTPS for any traffic that leaves it.
