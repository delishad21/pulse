# Home server deployment

```
browser ──HTTPS──▶ nginx :443 (pulse.delishad.com) ──▶ 127.0.0.1:3210 web (Next.js) ──▶ api ──▶ db (Postgres, volume pulse_postgres)
Hermes ──────────────────────────────────────────────▶ 127.0.0.1:6061 mcp ──▶ api        reminder-worker ──▶ db, Hermes/Telegram/SMTP/Expo
```

**Deploying:** say `ship <task>` or run `devbot deploy pulse`; `devbot rollback pulse` undoes it.

- Stack: [compose.yaml](../compose.yaml) (project `pulse`) and the multi-stage
  [Dockerfile](../Dockerfile). devbot uploads the committed tree to
  `~/services/pulse/releases/<commit>/`, builds there with
  `REVISION=<commit> docker compose -p pulse build`, starts it and rolls back if
  it does not become healthy. Images are tagged `pulse-<service>:<commit>`.
- Migrations: the one-shot `migrate` service runs `prisma migrate deploy`
  before `api` starts.
- Settings and secrets: `~/services/pulse/.env` only (mode 600), linked into
  each release. Every variable is listed in [pulse.env.example](pulse.env.example).
- Health: `https://pulse.delishad.com/api/health` (web → API → database).
  The MCP serves `http://127.0.0.1:6061/health`.
- nginx: the server's existing `pulse.conf` keeps working (same port 3210).
  [nginx/pulse.conf](nginx/pulse.conf) is the reference copy, using the shared
  `*.delishad.com` certificate.
- Backups: the `db` service is labelled `backup: postgres`, so the nightly
  `~/services/backup/app-dump.sh` dumps it.
- Logs: `docker compose -p pulse logs <service>` (from a release folder) and
  `/var/log/nginx/pulse_*.log`.

## First-time checklist (moving off Portainer stack 67)

1. Run `devbot adopt pulse 67` to copy the Portainer stack's environment into
   `~/services/pulse/.env` on the server.
2. Check that `.env` has `AUTH_URL=https://pulse.delishad.com`. The
   `PULSE_*_IMAGE` values it copies over are ignored now and can be deleted.
3. Ship: say `ship <task>` or run `devbot deploy pulse`. The first deploy stops
   and removes the Portainer stack, then starts the same project, services,
   ports, networks and `pulse_postgres` volume, so all data is kept.
4. Open https://pulse.delishad.com/api/health and sign in. No nginx or DNS
   change is needed.

## Deprecated

Docker Hub images and Portainer's "Re-pull image and redeploy" are no longer
used. The old `deploy/home-server/bin/pulse-mcp` stdio wrapper is gone: the MCP
runs as the persistent `mcp` service over HTTP.

## User administration

From the current release folder on the server:

```sh
read -r -s PULSE_PASSWORD
printf '%s\n' "$PULSE_PASSWORD" | docker compose -p pulse exec -T api \
  npm run auth:create-user -w @pulse/api -- username
unset PULSE_PASSWORD
```

Use `auth:set-password` the same way to reset a password.
