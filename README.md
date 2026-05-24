# PokeBattle — Multiplayer Pokémon Battle Arena

[![Bun](https://img.shields.io/badge/Bun-1.1-orange)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-green)](https://www.mongodb.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://www.docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

A real-time multiplayer 1v1 Pokémon battle game with turn-based combat, team selection, and Stripe subscription support for shiny Pokémon. Built with Bun, Hono, React, and MongoDB.

**[Repository](https://github.com/urielreyna06/pokemon-battle-rooms)** | **[Live Demo](#how-to-run)**

---

## Table of Contents

- [Project Description](#project-description)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [How to Run](#how-to-run)
  - [Option A: Docker (Recommended)](#option-a-docker-recommended)
  - [Option B: Local Development](#option-b-local-development)
  - [Starting a Battle](#starting-a-battle)
- [Implemented Battle Rules](#implemented-battle-rules)
- [Data Source: PokéAPI](#data-source-pokeapi)
- [Running Tests](#running-tests)
- [Known Limitations](#known-limitations)

---

## Project Description

**PokeBattle** is an educational real-time multiplayer Pokémon battle game where two players compete in turn-based 1v1 battles. Players create or join private battle rooms by sharing a 6-character code, select their team of 6 Pokémon, and engage in strategic turn-by-turn combat with real-time updates.

The UI is inspired by **Pokémon Black/White** for educational purposes, featuring a DS-era aesthetic with gradient backgrounds, DS-style HP bars, and a focused battle interface.

### Features

- **Room Creation & Code Joining**: Create a battle room and invite opponents via shareable 6-character code
- **Team Selection**: Choose 6 Pokémon from a searchable, filterable roster with real-time Pokémon locking (opponent sees your picks instantly)
- **Real-Time Turn-Based Battles**: SSE (Server-Sent Events) live updates replace polling; no refresh lag
- **Complete Battle Rules**:
  - Type effectiveness with 2×/0.5×/0× multipliers based on PokéAPI data
  - Status effects (burn, paralysis, poison, sleep, freeze) with side effects
  - Critical hits (1/16 base chance, 1.5× damage)
  - Move priority & speed-based turn ordering (paralysis halves speed)
  - Forced switches after Pokémon faint
  - 60-second turn timer with auto-submit fallback
- **Shiny Pokémon**: $5/month Stripe subscription unlocks 5% chance of shiny Pokémon per battle (visual only)
- **Spectator Mode**: Any authenticated player can watch active battles via SSE
- **Pokémon Data**: Import ALL Pokémon from PokéAPI with complete move pools and type relationships

### Educational Purpose

UI design references to Pokémon Black/White are for **educational inspiration only**. This project demonstrates full-stack web development patterns: real-time WebSocket-free architecture (SSE), server-side game logic, Stripe payment integration, Clerk authentication, and battle AI turn ordering.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Runtime** | [Bun 1.1](https://bun.sh) |
| **API Framework** | [Hono 4.x](https://hono.dev) (TypeScript strict mode) |
| **Database** | [MongoDB 7](https://www.mongodb.com) (native driver, no ODM) |
| **Authentication** | [Clerk](https://clerk.com) (@clerk/react, @clerk/backend) |
| **Payments** | [Stripe](https://stripe.com) v16 ($5/month subscription) |
| **Frontend** | React 18 + TanStack Router v1 + Vite |
| **Testing** | Vitest v2 + @vitest/coverage-v8 (≥80% coverage) |
| **Containers** | Docker Compose + BuildKit cache mounts |
| **Data Source** | [PokéAPI](https://pokeapi.co/) (open-source REST API) |

---

## How to Run

### Option A: Docker (Recommended)

**Prerequisites**: Docker, Docker Compose

```bash
# 1. Clone the repository
git clone https://github.com/urielreyna06/pokemon-battle-rooms
cd pokemon-battle-rooms

# 2. Copy environment file templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Fill in credentials in your .env files
# Required:
# - CLERK_SECRET_KEY, CLERK_WEBHOOK_SECRET (from clerk.com)
# - STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET (from stripe.com)
# - MONGO_URL (local or Atlas)
# - VITE_CLERK_PUBLISHABLE_KEY, VITE_STRIPE_PUBLISHABLE_KEY

# 4. Start all services (API, Web, MongoDB)
docker compose up --build -d

# 5. Import Pokémon data (first time only)
docker compose --profile import run --rm importer

# 6. Open the app
# Frontend: http://localhost:3002
# API health: http://localhost:3001/health
# Logs: docker compose logs -f api
```

### Option B: Local Development

**Prerequisites**: Bun, Node 20+, MongoDB running locally

```bash
# Install dependencies
bun install

# Terminal 1: Start API (port 3001)
bun run dev:api

# Terminal 2: Start Web (port 3000)
bun run dev:web

# Import Pokémon data (one-time)
cd apps/api && bun run ../../scripts/import-pokemon.ts
```

### Starting a Battle

1. **Sign In**: Click "Sign In" → authenticate with Clerk (Google, email, or another method)
2. **Create a Room**: On the home page, click "Create Room" → a 6-character code is generated
3. **Share the Code**: Give the code to your opponent (e.g., `AB12XY`)
4. **Join or Create**: The opponent clicks "Join Room" and enters the code (or you both create separate rooms and meet via code)
5. **Select Teams**: Both players browse, search, and filter Pokémon, then select 6 for their team
6. **Lock-In**: Click "Ready" → your Pokémon are locked in and visible to opponent
7. **Battle Starts**: Once both are ready, the battle begins automatically with turn counter
8. **Each Turn** (60-second limit):
   - Choose a **Move** (up to 4 per Pokémon) or **Switch** to another team member
   - Turn order is determined by: switches first, then move priority, then effective Speed (paralysis halves speed)
   - On timer expiry, the first valid move auto-submits
9. **Win Condition**: Last Pokémon standing wins the battle

---

## Implemented Battle Rules

### Turn Order
- **Switches execute first** (cost a turn)
- **Moves ordered by**: priority (desc) → effective speed (desc) → random tiebreaker
- **Paralysis**: halves Speed stat
- **Ties broken randomly**: exact speed matches use coin flip

### Type Effectiveness
- **Full multiplier system**: 2×, 1×, 0.5×, 0× via PokéAPI type relations
- **Dual-type defenders**: multiplicative (e.g., Fire/Water defending Fire move = 0.5× × 0.5× = 0.25×)
- **No type immunity**: 0× results are possible (e.g., Water → Grass = 0×)

### Critical Hits
- **Base chance**: 1/16 (6.25%)
- **Damage multiplier**: 1.5×

### Status Effects
| Effect | Damage | Turn Cost | Cure |
|--------|--------|-----------|------|
| Burn | 1/16 max HP/turn; Atk ÷ 2 | — | Switch out (persists in battle) |
| Paralysis | — | 25% skip move | Switch out (persists in battle) |
| Poison | 1/8 max HP/turn | — | Switch out (persists in battle) |
| Sleep | — | Skip turn until awake | 20% thaw per turn (random) |
| Freeze | — | Skip turn until thawed | 20% thaw per turn (random) |

### Switch Rules
- **Voluntary switch**: costs a turn; player chooses when to switch
- **Forced switch after faint**: triggered when active Pokémon faints; must switch before next turn; cannot switch to already-fainted or active Pokémon
- **Cannot switch to same Pokémon**: prevents no-op switches

### Pokémon Locking
- When a player selects a Pokémon in the lobby, it is **immediately marked as taken** for the opponent via WebSocket
- Opponent sees selected Pokémon at 40% opacity with a **"TAKEN"** badge
- Cannot select taken Pokémon; attempting to does nothing

### Real-Time Search & Filters
- **Search bar**: updates as you type (150ms debounce)
- **Type filters**: OR logic (selecting Fire OR Water shows both)
- **Combined filters**: search results AND'd with type filters
- **Clear Filters button**: resets both search and types

### Turn Timer
- **60 seconds per turn**
- **Auto-submit**: if player doesn't act by 0s, the first valid move auto-submits (preventing timeout stalls)
- **Display**: red when ≤ 10 seconds remaining

### Shiny Pokémon
- **Unlock**: $5/month Stripe subscription
- **Spawn chance**: 5% per Pokémon in battle (independent rolls)
- **Effect**: visual only (different sprite); no stat or gameplay changes
- **Persistence**: remains until battle ends

---

## Data Source: PokéAPI

All Pokémon data comes from **[PokéAPI](https://pokeapi.co/)**, a free, open-source Pokémon REST API.

### What's Imported

- **Pokémon**: name, types, base stats (HP, Atk, Def, SpA, SpD, Spe), move IDs, sprite URL
- **Moves**: name, type, power, accuracy, category (Physical/Special/Status), priority
- **Type Relations**: all type-vs-type effectiveness multipliers (2×, 0.5×, 0×)

### Import Process

```bash
# Run once after first docker compose up --build
docker compose --profile import run --rm importer

# Or locally (requires MONGO_URL set):
cd apps/api
bun run ../../scripts/import-pokemon.ts
```

The import script (`scripts/import-pokemon.ts`):
- **Pagination**: follows all PokeAPI `next` links until exhausted (fetches every Pokémon)
- **Upsert**: safe to re-run; uses MongoDB upsert by `pokedexId` (no duplicates)
- **Skip incomplete**: skips Pokémon missing required battle data (moves, stats)
- **Duration**: ~2–3 minutes for full import (~1,000+ Pokémon)
- **Updates**: re-run periodically if PokeAPI adds new Pokémon

### Storage

| Collection | Documents | Key Fields |
|-----------|-----------|-----------|
| `pokemon` | ~1,000+ | `pokedexId`, `name`, `types[]`, `baseStats`, `moveIds[]`, `spriteUrl`, `shinySpriteUrl?` |
| `moves` | ~900+ | `id`, `name`, `type`, `power`, `accuracy`, `category`, `priority` |
| `type_relations` | ~400+ | `attackingType`, `defendingType`, `multiplier` (2, 1, 0.5, 0) |

---

## Running Tests

```bash
cd apps/api

# Run all 154 tests
bun run test

# Run with coverage report (must stay ≥80%)
bun run test:coverage

# Run a single test file
bun run test auth.test.ts
```

> **Important:** Use `bun run test` (not `bun test`). `bun test` invokes Bun's native runner which lacks `vi.mock` support and breaks the test suite.

### Test Files (12 files, 154 tests)

| File | Tests | Focus |
|------|-------|-------|
| `auth.test.ts` | 5 | Clerk JWT verification, role-based auth |
| `subscription.test.ts` | 7 | Subscription status checks, shiny unlock |
| `battle-no-regression.test.ts` | 9 | Damage formula, crits, status effects |
| `battle-faint-switch.test.ts` | 19 | Faint detection, forced switch flow, alive backup, full attack→faint→switch→continue, registerAction faint-aware validation |
| `battle-turn-order.test.ts` | 16 | Turn ordering, speed, priority, tiebreaks, `bothPlayersActed` |
| `battle-pp-enforcement.test.ts` | 38 | PP decrement, out-of-PP blocking, Struggle fallback |
| `battle-spam-prevention.test.ts` | 18 | Double-submit prevention, phase transitions, race conditions |
| `battle-forfeit.test.ts` | 16 | Forfeit flow, SSE broadcast, endReason field |
| `pokemon-blocking.test.ts` | 9 | Duplicate Pokémon validation (server-side ready endpoint) |
| `stripe-webhook.test.ts` | 7 | Webhook signature verification, user sync |
| `pricing-flow.test.ts` | 6 | Full subscription lifecycle (none→active→past_due→canceled) |
| `mongo-ttl.test.ts` | 4 | MongoDB TTL index creation for rooms and battles collections |

All tests use **Vitest** with **@vitest/coverage-v8** for coverage tracking.

---

## Known Limitations

- **No audio**: sound effects and music not implemented
- **Mobile UI**: optimized for desktop browsers; mobile layout not fully responsive
- **Pokémon locking**: uses in-memory WebSocket state — restarting the API server resets it (acceptable since lobby is temporary)
- **Spectator mode**: frontend-only; any authenticated user can watch active battles (no role-based restrictions)
- **Account deletion**: Clerk manages user deletion; no in-app flow provided
- **PokeAPI gaps**: import skips Pokémon with incomplete data (some legendaries, alternate forms missing moves)
- **No save/resume**: battles must complete in one session; no persistence across reconnects
- **Single process**: event bus uses in-memory Node.js EventEmitter (works in Docker but not distributed)

---

## Architecture Highlights

### Real-Time Updates (SSE, Not WebSocket)

Uses **Server-Sent Events** (`GET /battle/:roomCode/events`) instead of polling or WebSocket:
- Simpler than WebSocket (no heartbeat plumbing)
- Hono's `streamSSE` handles multipart responses
- Auth via query param `?token=<clerk-jwt>` (EventSource can't set headers)
- Keepalive pings every 20s

### Battle Logic Isolation

All combat rules live in **`battleEngine.ts`**:
- Damage calculation
- Type matchups
- Status conditions
- Turn ordering
- Move execution

Keeps route handlers clean and testable.

### MongoDB-First Data

Native MongoDB driver (no ORM):
- Direct `getDb().collection('pokemon').find(...)` calls
- Upserts for safe re-imports
- Indexes on common queries (`code`, `roomCode`, `pokedexId`)

### Stripe Subscription Flow

Webhook (`POST /webhooks/stripe`) auto-syncs user subscription status to MongoDB:
- `checkout.session.completed` → `shinyUnlocked: true`
- `subscription.updated` → status tracking
- `subscription.deleted` → `shinyUnlocked: false`

---

## Development Workflow

1. **Clone & Setup**
   ```bash
   git clone https://github.com/urielreyna06/pokemon-battle-rooms
   cd pokemon-battle-rooms
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   # Fill in Clerk, Stripe, MongoDB credentials
   ```

2. **Install & Build**
   ```bash
   bun install
   docker compose up --build -d
   docker compose --profile import run --rm importer
   ```

3. **Local Dev**
   ```bash
   bun run dev:api   # Terminal 1
   bun run dev:web   # Terminal 2
   ```

4. **Test Before Commit**
   ```bash
   cd apps/api && bun run test
   ```

5. **Git Hooks** (Husky + lint-staged)
   - Runs ESLint, TypeScript, and Vitest on staged files
   - Pre-commit hook prevents commits with test failures

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

**Questions?** Open an issue on [GitHub](https://github.com/urielreyna06/pokemon-battle-rooms/issues)
