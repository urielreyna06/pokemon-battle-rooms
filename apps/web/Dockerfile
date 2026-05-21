# syntax=docker/dockerfile:1
# SPA build with Vite + nginx
# Builder uses oven/bun:1.1 (Debian/glibc) — bun install is 10-100x faster than npm,
# and the Debian base satisfies esbuild's glibc requirement (no musl crash).
# Runtime stays on nginx:alpine (tiny, no Node/Bun needed at runtime).

# ─── Stage 1: build ───────────────────────────────────────────────────────────
FROM oven/bun:1.1 AS builder
WORKDIR /app

# Copy shared package first (needed for vite alias resolution)
COPY packages/shared ./packages/shared

# Copy web package.json BEFORE source — install layer is cached until deps change
COPY apps/web/package.json ./apps/web/package.json
WORKDIR /app/apps/web

# VITE_API_URL at build time: the URL the BROWSER will use to call the API.
# The browser runs on the user's machine, so this points to localhost:3001
# (the port docker-compose exposes to the host — NOT the internal "api" hostname).
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=${VITE_API_URL}

ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}

# Install with BuildKit cache mount — downloaded packages survive across builds
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install

# Copy full web source after install (layer cache: re-run only on source changes)
COPY apps/web/ ./

RUN bun run build
# Result: ./dist/ — static SPA ready to serve

# ─── Stage 2: runtime (nginx:alpine — tiny static server) ────────────────────
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# SPA config: all unknown paths → index.html so TanStack Router handles them
RUN printf 'server {\n\
    listen 3000;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
