FROM node:22.23.2-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mcp/package.json apps/mcp/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/widget-contracts/package.json packages/widget-contracts/package.json
RUN npm ci

FROM base AS source
COPY . .
ENV DATABASE_URL=postgresql://pulse:build-only@postgres:5432/pulse
RUN npm run db:generate
FROM source AS web-build
RUN npm run build -w @pulse/web

FROM source AS api
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "npm run db:deploy && exec npm run start -w @pulse/api"]

FROM source AS mcp
ENV NODE_ENV=production
CMD ["npm", "run", "start", "-w", "@pulse/mcp"]

FROM source AS web
ENV NODE_ENV=production
COPY --from=web-build /app/apps/web/.next /app/apps/web/.next
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@pulse/web"]
