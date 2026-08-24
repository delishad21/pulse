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

`PULSE_API_TOKEN` is forwarded as a bearer token when set.

## Security note

The current Pulse API still uses the local-development user identity and does not yet enforce service-token authorization. Until API authentication is hardened, keep the API and MCP server on the trusted local/private network only.
