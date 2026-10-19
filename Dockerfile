# One multi-stage build for every Pulse server image; compose picks the target.
# Build stages get the full workspace; runtime targets get production deps only.

FROM node:22.23.2-bookworm-slim AS os
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM os AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/reminder-worker/package.json apps/reminder-worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/widget-contracts/package.json packages/widget-contracts/package.json

# Full dependency tree. compose.dev.yaml runs its dev servers from this stage.
FROM manifests AS base
COPY patches ./patches
RUN npm ci

FROM base AS build
COPY . .
# Prisma needs a URL to load its config; nothing connects to it during the build.
RUN export DATABASE_URL=postgresql://build:build@localhost:5432/build \
  && npm run db:generate \
  && npm run build -w @pulse/web \
  && rm -rf apps/web/.next/cache

# Production deps for the server workspaces only (no mobile/Expo toolchain).
# The root postinstall only patches a mobile package and needs dev deps.
FROM manifests AS prod-deps
RUN npm pkg delete scripts.postinstall \
  && npm ci --omit=dev \
    --workspace=@pulse/api --workspace=@pulse/web --workspace=@pulse/mcp \
    --workspace=@pulse/reminder-worker --workspace=@pulse/db \
    --workspace=@pulse/domain --workspace=@pulse/api-client \
  && npm cache clean --force

FROM os AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app ./
COPY packages ./packages
COPY --from=build /app/packages/db/src/generated ./packages/db/src/generated
USER node

FROM runtime AS migrate
CMD ["npm", "run", "db:deploy"]

FROM runtime AS api
COPY apps/api ./apps/api
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "@pulse/api"]

FROM runtime AS mcp
COPY apps/mcp ./apps/mcp
EXPOSE 6060
CMD ["./node_modules/.bin/tsx", "apps/mcp/src/index.ts"]

FROM runtime AS reminder-worker
COPY apps/reminder-worker ./apps/reminder-worker
CMD ["./node_modules/.bin/tsx", "apps/reminder-worker/src/index.ts"]

FROM runtime AS web
COPY apps/web/package.json apps/web/next.config.ts ./apps/web/
COPY apps/web/public ./apps/web/public
# next start writes its runtime cache under .next.
COPY --chown=node:node --from=build /app/apps/web/.next ./apps/web/.next
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@pulse/web"]
