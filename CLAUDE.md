# PokeBattle — Claude Context

## Project

Multiplayer 1v1 Pokémon battle game. Players create/join rooms by code, select teams, then battle turn-by-turn.

**Path:** `/mnt/c/Users/ureyn/OneDrive/Documentos/Claude/Projects/PokeBattle/pokemon-battle-rooms`

## Stack

| Layer       | Tech                                      |
|-------------|-------------------------------------------|
| Runtime     | Bun 1.1                                   |
| API         | Hono 4.x (TypeScript strict)              |
| Database    | MongoDB 7 (native driver, no ODM)         |
| Auth        | Clerk (`@clerk/backend` + `@clerk/react`) |
| Payments    | Stripe v16 ($5/month subscription)        |
| Frontend    | React 18 + TanStack Router + Vite         |
| Tests       | Vitest v2 + @vitest/coverage-v8 (≥80%)   |
| Git hooks   | Husky + lint-staged                       |
| Containers  | Docker Compose + BuildKit cache mounts    |

## Monorepo layout

```
apps/
  api/src/
    middleware/requireAuth.ts   ← Clerk JWT verification, sets userId in context
    routes/rooms.ts             ← POST /rooms, POST /rooms/:code/join, GET /rooms/:code
    routes/battle.ts            ← GET /battle/:roomCode, GET /battle/:roomCode/events (SSE), POST /battle/:roomCode/action
    routes/pokemon.ts           ← GET /pokemon, GET /pokemon/:id (shiny-aware)
    routes/users.ts             ← GET /users/me
    routes/stripe.ts            ← POST /stripe/create-checkout-session, GET /stripe/subscription-status
    webhooks/clerkWebhook.ts    ← user.created/updated/deleted → sync MongoDB users
    webhooks/stripeWebhook.ts   ← checkout.completed, subscription.updated/deleted
    engine/battleEngine.ts      ← ALL combat logic lives here
    db.ts                       ← MongoDB connection singleton (getDb)
    server.ts                   ← Hono app, route registration
  api/tests/
    auth.test.ts
    subscription.test.ts
    battle-no-regression.test.ts
    stripe-webhook.test.ts
    pricing-flow.test.ts         ← full subscription lifecycle (none→active→past_due→canceled)
  web/app/
    routes/index.tsx            ← Home (create/join room)
    routes/lobby.$code.tsx      ← Lobby + ready-up
    routes/team.$code.tsx       ← Team selection
    routes/battle.$code.tsx     ← Battle UI (SSE real-time + 60s turn timer)
    routes/pricing.tsx          ← Stripe checkout page
    components/SubscriptionStatus.tsx
    hooks/useSubscription.ts
    hooks/useRoom.ts
    hooks/useBattle.ts
    lib/api.ts                  ← All fetch wrappers (never call PokeAPI from frontend)
    lib/constants.ts
packages/
  shared/types.ts               ← All shared TypeScript types
scripts/
  import-pokemon.ts             ← One-time PokeAPI → MongoDB import
```

## Auth pattern

Every game route uses `AuthEnv`:

```typescript
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';
export const myRoutes = new Hono<AuthEnv>();
myRoutes.use('*', requireAuth);
// then: c.get('userId') → Clerk userId string
```

Public routes (no auth): `GET /health`, `POST /webhooks/clerk`, `POST /webhooks/stripe`

The Clerk userId IS the `playerId` stored in rooms/battles.

## MongoDB collections

| Collection      | Key fields                                                     |
|-----------------|----------------------------------------------------------------|
| `pokemon`       | `pokedexId`, `name`, `types`, `baseStats`, `moveIds`, `spriteUrl` |
| `moves`         | `id`, `name`, `type`, `power`, `accuracy`, `category`         |
| `type_relations`| `attackingType`, `defending`, `multiplier`                     |
| `rooms`         | `code`, `status`, `players[]`                                  |
| `battles`       | `roomCode`, `status`, `players[]`, `turnNumber`, `log[]`       |
| `users`         | `clerkId`, `email`, `subscriptionStatus`, `shinyUnlocked`, Stripe fields |

## Shiny Pokémon

- Gated by `users.shinyUnlocked: true` (set by Stripe webhook on `checkout.session.completed`)
- **5% chance** per Pokémon in `initializeBattle` — visual only, no stat changes
- `isShiny?: boolean` and `shinySpriteUrl?: string` are additive optional fields on `BattlePokemon`
- `/pokemon` route adds `shinySpriteUrl` only when `shinyUnlocked === true`

## Invariants — NEVER break these

- **Battle logic**: damage formula, status conditions, turn order, stage modifiers in `battleEngine.ts`
- **Response formats**: never remove or rename fields in existing API responses — only add
- **Route paths**: never rename or remove existing endpoints
- **TypeScript strict**: `strict: true`, no `any`, no type assertions without good reason
- **Shiny = visual only**: `isShiny` never affects stats, damage, or game logic

## Environment variables

```bash
# API (.env)
MONGO_URL=mongodb://localhost:27017/pokemon_battle
PORT=3001
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
CLIENT_URL=http://localhost:3000

# Web (Vite bakes these into the bundle)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
VITE_API_URL=http://localhost:3001
```

## Build quirks

### `@clerk/react@5.54.0` + `@clerk/shared@3.47.5` mismatch
`@clerk/react@5.54.0` imports `loadClerkUiScript` from `@clerk/shared/loadClerkJsScript`, but no `3.x` release exports it (publishing bug in Clerk). Fixed via a Vite plugin shim in `apps/web/vite.config.ts`:
- `enforce: 'pre'` so it intercepts before Vite's resolver
- Intercepts `@clerk/shared/loadClerkJsScript` → virtual module
- Re-exports the 4 real functions from the actual `.mjs` file + adds `loadClerkUiScript` as a no-op

Do NOT add an `overrides` for `@clerk/shared@4.x` — it breaks `useSessionContext`.

### Web host port
The web container runs on 3000 internally (nginx). Host port is mapped to **3002** in `docker-compose.yml` to avoid conflict with `open-webui` which already holds `127.0.0.1:3000`. Frontend is at `http://localhost:3002`.

## Common commands

```bash
# Start everything
docker compose up --build

# Import Pokémon data (once)
docker compose --profile import run --rm importer

# Run API tests  — MUST use bun run test, NOT bun test
# bun test → Bun's native runner (no vi.mock support, tests break)
# bun run test → invokes vitest run via package.json script (correct)
cd apps/api && bun run test
bun run test:coverage    # must stay ≥80%

# Local dev
bun run dev:api      # port 3001
bun run dev:web      # port 3000

# Stripe webhook forwarding (local dev)
stripe listen --forward-to localhost:3001/webhooks/stripe
```

## SSE real-time battle updates

`GET /battle/:roomCode/events` streams `event: battle` (full `BattleDoc` JSON) via Hono `streamSSE`.
- Auth: `requireAuth` middleware accepts `?token=<clerk-jwt>` query param because `EventSource` cannot set headers.
- Event bus: `src/battleEventBus.ts` — in-memory `EventEmitter`, safe for single-process Docker.
- `emitBattleUpdate(roomCode)` is called in `POST /battle/:roomCode/action` after action registration and after turn resolution.
- Keepalive: `event: ping` sent every 20s; client ignores it.
- Frontend (`battle.$code.tsx`): opens `EventSource` on mount, closes on unmount / battle finished.

## Turn timer

- `BattleDoc.turnStartedAt?: string` (ISO) — set in `initializeBattle` and reset each time `battle.turn` increments.
- Frontend syncs `timeLeft` from `turnStartedAt` on every SSE event to prevent drift.
- At 0s, auto-submits the first available move via `autoSubmitRef` (ref pattern avoids stale closure).
- Timer display lives in the turn counter; turns red when ≤ 10s.

## Status (as of 2026-05-22)

All core features are implemented and the Docker stack is confirmed healthy:
- `docker compose up --build -d` → all containers running (mongo healthy, api on 3001, web/nginx on 3002)
- API: MongoDB connected, 292 Pokémon in DB
- Web SPA: serving at `http://localhost:3002` with no build or runtime errors

### Completed

- [x] Run `bun install` after adding stripe/svix/husky/lint-staged deps
- [x] All 34 Vitest tests passing (auth, subscription, battle-no-regression, stripe-webhook, pricing-flow)
- [x] Docker stack fully building and running (`docker compose up --build`)
- [x] API health: `http://localhost:3001/health` → 292 Pokémon in DB
- [x] Web SPA serving at `http://localhost:3002`
- [x] Repo pushed to https://github.com/urielreyna06/pokemon-battle-rooms
- [x] Husky pre-commit hook initialized (`bun run prepare` done)
- [x] `SubscriptionStatus` component wired into `__root.tsx` main nav
- [x] E2E / integration tests for pricing/subscription flow (`pricing-flow.test.ts`)
- [x] Real-time battle updates — SSE replaces 1.5s polling
- [x] Turn timer — 60s limit, auto-submits first move on expiry
- [x] Spectator mode (frontend-only; SSE already open to any authenticated user; isSpectator guard on timer/autoSubmit; SpectatorPanel + VictoryOverlay spectator path)
- [x] Turn order by move priority + speed — switches first, then `move.priority` desc, then effective speed desc (paralysis halves speed), coin flip for exact ties (`battleEngine.ts:processTurn`)
- [x] `getTypeMultiplier` optimized — single DB query per move (was N queries for dual-type defenders)
- [x] Pokémon catalog filters — `GET /pokemon?name=&type=` backend query params; type filter chips + name search wired server-side in `team.$code.tsx`

### Remaining

- [ ] Revoke/rotate GitHub tokens shared in session (PAT + 2 classic tokens for urielreyna06)
- [ ] End-to-end browser smoke test: create room → join → select team → battle → confirm shiny gate works
