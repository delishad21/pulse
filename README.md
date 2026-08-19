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
