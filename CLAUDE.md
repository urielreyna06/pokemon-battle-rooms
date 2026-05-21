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
    routes/battle.ts            ← GET /battle/:roomCode, POST /battle/:roomCode/action
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
  web/app/
    routes/index.tsx            ← Home (create/join room)
    routes/lobby.$code.tsx      ← Lobby + ready-up
    routes/team.$code.tsx       ← Team selection
    routes/battle.$code.tsx     ← Battle UI (polling every 1.5s)
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

## Pending work (as of 2026-05-20)

- [x] Run `bun install` after adding stripe/svix/husky/lint-staged deps
- [x] All 28 Vitest tests passing (auth, subscription, battle-no-regression, stripe-webhook)
- [ ] Run `bun run prepare` to initialize Husky (activates pre-commit hook)
- [ ] Wire `SubscriptionStatus` component into the main nav
- [ ] E2E tests for the pricing/subscription flow
- [ ] Real-time battle updates (currently polling every 1.5s — consider WebSocket/SSE)
- [ ] Turn timer (currently no limit; a player can stall indefinitely)
- [ ] Spectator mode
