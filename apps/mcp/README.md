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

The monorepo's shared packages are TypeScript source packages, so run the MCP server through `tsx`:

```bash
PULSE_API_BASE_URL=http://127.0.0.1:4000 npm run start -w @pulse/mcp
```
For an MCP client such as Hermes, invoke the `tsx` binary directly so npm's lifecycle output cannot pollute the stdio protocol stream:

```text
command: <repo>/node_modules/.bin/tsx
args: ["<repo>/apps/mcp/src/index.ts"]
env:
  PULSE_API_BASE_URL: http://127.0.0.1:4000
```

`PULSE_API_TOKEN` is forwarded as a bearer token when set. In a production
deployment, create a named API key from the Pulse Settings page and provide it
to the MCP process. The key is resolved to its owning Pulse user, so every MCP
operation remains scoped to that account.

## Security note

API keys are bearer credentials. Keep them out of source control, prompts, and
logs. The server stores only a SHA-256 hash, displays the raw key once, and lets
the owner revoke it from Settings. Keep the API and MCP server on the trusted
local/private network and use HTTPS for any traffic that leaves it.
