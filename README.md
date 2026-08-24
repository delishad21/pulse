# Pulse

Pulse is a multi-client task platform for web, native mobile, Telegram/Hermes, and home-screen widgets.

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

See `AGENTS.md` for architecture and automation rules.

## Authentication and user administration

Production compose starts with public registration disabled:
`PULSE_REGISTRATION_ENABLED=false`. The web registration page, registration
API, and mobile auth configuration all honor this setting. If registration is
ever enabled temporarily, recreate the web service after changing the
environment and set it back to `false` when onboarding is complete.

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
deployment's `compose.yaml` and `.env` file. User creation is intentionally a
server-side Docker operation; public self-registration remains off by default.

For local mobile development, `apps/mobile/.env.local` points at the Mac's
LAN address (`http://192.168.1.130:3010`). Start the development compose stack
before launching the Expo development client. Use the deployment's HTTPS URL
only in a production/release environment.

## CI/CD and releases

The workflow in [`docs/ci-cd.md`](docs/ci-cd.md) runs checks, publishes Docker
Hub images, and attaches a signed Android APK to versioned GitHub Releases.
Pull `:latest` manually on the home server when you want to update it. Keep all
credentials in GitHub Actions secrets or the server `.env`; never commit local `.env` files or
signing keys.
