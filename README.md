# Pulse

Pulse is a self-hosted task tracking application. Much of this application is inspired and many of the features were copied from Todoist.

The goal was to create and maintain a customizable Todoist clone that I could modify to further suit my own needs, and to build an MCP on top of it to connect it to an agent.

## Workspace

- `apps/web` — Next.js web app and HTTP API
- `apps/mobile` — Expo / React Native iOS + Android app
- `packages/domain` — platform-neutral task semantics
- `packages/api-client` — shared typed API client
- `packages/db` — Prisma 7 + PostgreSQL
- `packages/widget-contracts` — shared widget snapshots/actions

## Development

Use Node 22.23.2 (`.nvmrc`).

```bash
nvm use
npm install
npm run dev:web
npm run dev:mobile
npm run typecheck
npm run lint
```

## Authentication and user administration

Production compose starts with public registration disabled:
`PULSE_REGISTRATION_ENABLED=false`. The web registration page, registration
API, and mobile auth configuration all honor this setting. 

Create or activate a user from the running Docker API container without
exposing the password in the command line:

```bash
read -r -s PULSE_PASSWORD
printf '%s\n' "$PULSE_PASSWORD" | docker compose exec -T api \
  npm run auth:create-user -w @pulse/api -- username
unset PULSE_PASSWORD
```

To reset an existing user's password, use the same pattern with
`auth:set-password`. Run these commands from the directory containing the
deployment's `compose.yaml` and `.env` file.

Each signed-in user can create named, revocable API keys under **Settings → API
keys**. Pulse displays a new key once and stores only its hash. The production
MCP is a persistent HTTP container managed by Portainer. To bind it—and
therefore Hermes—to that user, add the key to the Portainer stack environment:

```dotenv
PULSE_MCP_API_KEY=pulse_replace-with-the-generated-key
PULSE_MCP_IMAGE=docker.io/<dockerhub-namespace>/pulse-mcp:latest
PULSE_MCP_HOST_PORT=6061
```

The container receives this value as `PULSE_API_TOKEN`, serves
`http://127.0.0.1:6061/mcp`, and requires the same bearer key from Hermes.
Existing installations fall back to `PULSE_SERVICE_TOKEN` until a user key is
configured.
