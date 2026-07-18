FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Pin pnpm to v10 — v11 makes ignored-build-scripts fatal even when
# `pnpm.onlyBuiltDependencies` is set in package.json, breaking CI install.
RUN apk add --no-cache libc6-compat && npm install -g pnpm@10

WORKDIR /app

# Copy package manifests, build config, and ALL dialect templates so the
# postinstall hook can stamp out a matching schema.ts during install.
COPY package.json pnpm-lock.yaml* vite.config.ts ./
COPY scripts/db-setup.mjs scripts/db-setup.mjs
COPY src/config/db/schema.sqlite.ts src/config/db/schema.sqlite.ts
COPY src/config/db/schema.postgres.ts src/config/db/schema.postgres.ts
COPY src/config/db/schema.mysql.ts src/config/db/schema.mysql.ts

# DATABASE_PROVIDER must be set at build time so prebuild / postinstall pick
# the matching schema template. Pass it via `docker build --build-arg
# DATABASE_PROVIDER=postgresql` or set in your CI / k8s build pipeline.
ARG DATABASE_PROVIDER=sqlite
ENV DATABASE_PROVIDER=${DATABASE_PROVIDER}

RUN pnpm i --frozen-lockfile

# Rebuild the source code only when needed
FROM deps AS builder

WORKDIR /app

# Public client vars are STATICALLY injected into the bundle at build time —
# they MUST be the production values, passed via `--build-arg` (compose does
# this). Without these ARGs, docker silently drops the build args and the
# bundle ships with dev defaults (localhost URL, hidden Harvey entry, etc.).
ARG VITE_APP_URL
ARG VITE_APP_NAME=Barbot
ARG VITE_APP_LOGO=/logo.svg
ARG VITE_HARVEY_URL
ARG VITE_DEFAULT_LOCALE=en
ENV VITE_APP_URL=${VITE_APP_URL} \
    VITE_APP_NAME=${VITE_APP_NAME} \
    VITE_APP_LOGO=${VITE_APP_LOGO} \
    VITE_HARVEY_URL=${VITE_HARVEY_URL} \
    VITE_DEFAULT_LOCALE=${VITE_DEFAULT_LOCALE}

COPY . .
RUN pnpm build

# Production image — run the nitro server output
FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/.output ./.output

USER appuser

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"]

# Worker image — the resident agent-task worker (widget answers, sync jobs).
# Same source as the server, but needs tsx + drizzle + scripts, so it carries
# node_modules and the migration tooling. Run with WORKER_LOOP=1.
FROM base AS worker
WORKDIR /app
RUN npm install -g pnpm@10
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src ./src
COPY --from=builder /app/scripts ./scripts
CMD ["pnpm", "agent:worker"]
