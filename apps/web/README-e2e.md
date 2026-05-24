# PokéBattle — Playwright E2E Suite

End-to-end regression suite that exercises the five critical user flows and four negative cases for the recurring bugs documented in `RCA.md`.

Specs live under `apps/web/tests/`. The Bun + Vitest backend suite in `apps/api/tests/` is unaffected.

## Quick start

```bash
# From the repo root
cd apps/web
bun install
bunx playwright install --with-deps
```

> The first `playwright install --with-deps` pulls Chromium, Firefox, and WebKit plus system libs (~700 MB). Subsequent runs reuse the cache.

## Run the stack

Two supported modes:

### Mode A — Docker (recommended, matches production wiring)

```bash
# From the repo root
docker compose down -v          # only if you want a fully fresh DB
docker compose up --build       # starts mongo + api + web on the same network
docker compose --profile import run --rm importer   # first time only
```

Web is published on http://localhost:3000, API on http://localhost:3001.

### Mode B — Local dev

```bash
# Terminal 1 — Mongo (Docker is the simplest source of truth)
docker run -d --name pb-mongo -p 27017:27017 mongo:7

# Terminal 2 — API
bun run --cwd apps/api dev

# Terminal 3 — Web
bun run --cwd apps/web dev
```

## Run the suite

```bash
cd apps/web

# All specs, default project (chromium)
bun run e2e

# Single spec
bunx playwright test tests/flujo3_turno_normal.spec.ts

# Headed UI mode (great for debugging)
bun run e2e:ui

# Cross-browser
bunx playwright test --project=firefox
bunx playwright test --project=webkit
```

Reports:

```bash
bun run e2e:report     # opens playwright-report/index.html
```

Traces, screenshots, and videos are captured on failure under `apps/web/test-results/`.

## Clerk authentication

Most positive flows and all of N1/N2 need a signed-in Clerk session. We capture it once and reuse via `storageState`:

```bash
cd apps/web
bunx playwright codegen http://localhost:3000 --save-storage=tests/.auth/user.json
```

In the browser that opens:

1. Click the Clerk **Sign in** button anywhere in the app.
2. Complete the sign-in with your **Clerk dev/test user**.
3. Once you are back at the app, close the codegen browser. The session is now saved at `tests/.auth/user.json`.

If that file does not exist, the Clerk-dependent specs auto-skip with a helpful message (see `tests/helpers/auth.ts`).

The `tests/.auth/` directory is git-ignored (see `.gitignore` near the bottom of this file).

## Environment variables — `.env.test`

Create `apps/web/.env.test` and `apps/api/.env.test` only if you want to override the dev stack. The suite reads `BASE_URL` for everything else.

```dotenv
# apps/web/.env.test
BASE_URL=http://localhost:3000
PB_E2E_VISUAL=0
# optional Clerk vars for codegen — never commit real keys
# VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
```

```dotenv
# apps/api/.env.test — already documented in docs/CONFIG.md
MONGO_URL=mongodb://localhost:27017/pokemon_battle
CLERK_SECRET_KEY=sk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRICE_ID=price_xxx
CLIENT_URL=http://localhost:3000
```

> **Never commit real keys.** `.env.test` files are git-ignored.

## CI

A minimal GitHub Actions job:

```yaml
- name: Install
  run: bun install
- name: Playwright
  run: bunx playwright install --with-deps
- name: Run E2E (chromium only)
  env:
    BASE_URL: http://localhost:3000
  run: |
    cd apps/web
    bunx playwright test --project=chromium --reporter=github
- name: Upload trace + report
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: apps/web/playwright-report
```

## What's in the suite

| File | What it covers | Bug class |
|------|----------------|-----------|
| `flujo1_sala_lobby.spec.ts`         | Create + join + auto-nav to /team | async coordination |
| `flujo2_seleccion_equipo.spec.ts`   | 75 cards on first paint, search + type filter, lock-in | shared component regressions |
| `flujo3_turno_normal.spec.ts`       | UI lock after submit, server waits for both players | server authority |
| `flujo4_switch_pokemon.spec.ts`     | Voluntary switch + forced post-faint | switch flow |
| `flujo5_forfeit_realtime.spec.ts`   | Forfeit propagates without refresh, distinct copy by endReason | regression guard |
| `negativo1_spam_ataques.spec.ts`    | 10 parallel actions → 1 accepted, 9 rejected | server authority |
| `negativo2_switch_invalido.spec.ts` | Switch-to-active and unknown-id are rejected | server authority |
| `negativo3_stripe_success.spec.ts`  | `/pricing?success=true` returns 200, banner visible | route metadata |
| `negativo4_sala_inexistente.spec.ts`| Bad code → toast, no navigation | UI gating |

Full design rationale: `tests/_meta/test-plan.md`. Selector mapping: `tests/_meta/selectors-map.md`.

## .gitignore additions

Append to your existing `.gitignore`:

```gitignore
# Playwright
apps/web/playwright-report/
apps/web/test-results/
apps/web/tests/.auth/
apps/web/.env.test
apps/api/.env.test
```

## Troubleshooting

- **"Cannot find module '@playwright/test'"** — run `bun install` inside `apps/web` after the package.json update.
- **All Clerk-dependent specs skip** — missing `tests/.auth/user.json`. See the codegen step above.
- **F3/F4 hang at "esperarPantallaBatalla"** — both players must complete F2 (team lock-in) before the room transitions to `status: 'battling'`. The current setup helper does not yet drive F2; if you need this end-to-end, extend `helpers/room.ts` to call `togglePokemon` + `pb-team-confirm` for both contexts, or use a backend seed script.
- **Stripe spec stuck at "Card number"** — Stripe Checkout DOM occasionally changes placeholder text. Update `helpers/stripe.ts`.

## Versions

- Playwright `^1.49.0`
- Node 18+ (Playwright requirement) — Bun runs the test runner via `bunx`.
