# syntax=docker/dockerfile:1
# Build context: repo root (docker-compose sets context: .)
FROM oven/bun:1.1
WORKDIR /app

# Copy workspace manifests FIRST — only reinstall when these change, not on every source edit
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install with BuildKit cache mount — downloaded packages survive across builds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Copy source AFTER install — changes here hit the cache, skip reinstall
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY scripts ./scripts

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["bun", "run", "src/server.ts"]
