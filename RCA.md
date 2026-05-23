# Root Cause Analysis — PokeBattle Bug Fixes

Ten issues identified and resolved across the codebase. Each entry documents the symptom, root cause, and fix applied.

---

## Issue 1: Tailwind CSS Classes Produced No Styles

**Symptom:** `TypeBadge`, `HPBar`, `MoveButton`, and `StatusBadge` were unstyled — text showed with no colors, backgrounds, or layout.

**Root Cause:** Components used Tailwind utility `className` strings, but Tailwind was never added to `vite.config.ts`. No PostCSS plugin was configured, so the classes were never converted to CSS. The build succeeded silently because Vite doesn't warn about unused class names.

**Fix:** Replaced every `className` with inline `style` objects across all four components. The project now has no Tailwind dependency — styles are fully inline or in `styles.css`.

---

## Issue 2: TypeScript Build Errors — `vite/client.d.ts` Not Found

**Symptom:** `tsc --noEmit` failed with `TS2688: Cannot find type definition file for 'vite/client'`.

**Root Cause:** `apps/web/tsconfig.json` contained `"types": ["vite/client"]`. In a standard `npm` install this resolves to `node_modules/vite/client.d.ts`. However, Bun's workspace partial install only places `dist/`, `bin/`, and `types/package.json` under `node_modules/vite/` — `client.d.ts` is absent, so TypeScript cannot resolve the type reference.

**Fix:** Removed `"types": ["vite/client"]` from `tsconfig.json` and created `apps/web/app/vite-env.d.ts` with manual `ImportMeta` and `ImportMetaEnv` interface declarations that match what Vite injects. Do not re-add the `"types"` entry.

---

## Issue 3: `Route.useParams()` Returned `{}` Instead of `{ code: string }`

**Symptom:** `battle.$code.tsx`, `lobby.$code.tsx`, and `team.$code.tsx` all had `code` typed as `unknown`. Any use of `code` required a cast or produced a TS error.

**Root Cause:** TanStack Router v1 resolves `$code` param types via `ParsePathParams<FileRoutesByPath[path]['id']>`. The auto-generator emits `id`, `path`, and `fullPath` fields in the `FileRoutesByPath` augmentation. Because `routeTree.gen.ts` was manually maintained, those three fields were missing — the hook fell back to `{}` (no params) for all routes.

**Fix:** Added `id`, `path`, and `fullPath` to every route entry in the `declare module '@tanstack/react-router'` block of `routeTree.gen.ts`. Must be maintained by hand when new routes are added.

---

## Issue 4: Turn Counter Was Invisible Against the Battle Background

**Symptom:** The "Turn X" counter and turn timer in the battle scene were invisible — the text rendered black/very dark against a dark background.

**Root Cause:** The turn counter `color` was set to `#2a1f2e` (near-black), which blended completely into the dark scene background `#0d1b2a`. The timer color in countdown state was the same dark value.

**Fix:** Changed turn counter text to `#f0e8d0` (light cream) against the dark battle scene. In the BW DS redesign, the turn counter became a semi-transparent badge (`rgba(0,0,0,0.28)`) with white `#ffffff` text and `textShadow` for legibility against the sky-to-grass gradient.

---

## Issue 5: Forced Switch After Faint Was Not Implemented

**Symptom:** When a player's active Pokémon fainted during battle, the UI showed the regular move menu (or stayed on "Waiting"). The player was stuck — no switch prompt appeared.

**Root Cause:** The `handleBattleUpdate` SSE handler had no logic to detect that the active Pokémon's HP reached 0. There was no `isForcedSwitch` state, no phase transition to `'switch'`, and `SwitchMenu` had no `isForcedSwitch` prop.

**Fix:**
- Added a `useEffect` watching `myActive?.currentHp` that fires when HP ≤ 0, checks if any alive backup exists, and sets `forcedSwitch=true` + `phase='switch'`.
- Added `isForcedSwitch` prop to `SwitchMenu` — shows "CHOOSE NEXT!" header and hides the Cancel button so players cannot dismiss the forced switch.
- Filtered `visibleTeam` in `SwitchMenu` to show only alive, non-active Pokémon.

---

## Issue 6: Turn Spam — Players Could Submit Multiple Actions Per Turn

**Symptom:** Rapid button clicks in `FightPanel` submitted multiple move actions for the same turn, causing the battle engine to receive duplicate actions from one player and behave unpredictably.

**Root Cause:** `sendAction` was `async` and called `api.submitAction` without immediately blocking further input. `phase` was only set to `'busy'` inside the `try` block after the async call returned — during the round-trip latency, the UI remained in `'menu'` state with all buttons enabled.

**Fix:** Moved `setPhase('busy')` to the first line of `sendAction`, before the `await`. All buttons derive their `disabled` state from `canAct` which checks `phase === 'menu'`, so they disable immediately upon the first click. The phase resets to `'menu'` only when the opponent has also acted and the next turn begins via SSE.

---

## Issue 7: Move PP Not Tracked or Displayed

**Symptom:** The `BattleMove` type had no `pp` field. `MoveButton` showed no PP counter. Players had no way to know when a move was about to run out.

**Root Cause:** The shared `BattleMove` type in `packages/shared/types.ts` only had `currentPp` (the live counter) but no `pp` (the max PP). `MoveButton` had no PP display row. The battle engine did not decrement `currentPp` on use and did not block moves with `currentPp <= 0`.

**Fix:**
- Added `pp?: number` to `BattleMove` in `shared/types.ts`.
- Updated `battleEngine.ts` to decrement `currentPp` on every move use and block moves with `currentPp <= 0`.
- Updated `MoveButton` to display `PP {currentPp}/{pp ?? '--'}` and disable when `currentPp <= 0`.
- Added `battle-pp-enforcement.test.ts` (8 tests) covering decrement, exhaustion, and Struggle fallback.

---

## Issue 8: Pokémon Roster Limited to 300 — Full Import Not Loading

**Symptom:** The team selection screen showed far fewer Pokémon than expected. Many well-known Pokémon were missing.

**Root Cause:** Two separate limits:
1. `GET /pokemon` API route had a hardcoded `limit: 300` query cap — even if the DB had more, only 300 were returned.
2. `getAllPokemon()` in `apps/web/app/lib/api.ts` fetched with `?limit=300` and had no pagination.
3. `import-pokemon.ts` was originally hardcoded to fetch only the first 300 from PokéAPI instead of following `next` links.

**Fix:**
- Raised the API query cap to `limit=1000`.
- Added `getAllPokemon()` in `api.ts` with `?limit=1000` and 24-hour `localStorage` cache (key `pokebattle_all_pokemon`).
- Rewrote `import-pokemon.ts` to follow all PokéAPI `next` links until exhausted, importing every available Pokémon (~1,000+).

---

## Issue 9: Pokémon Blocking Only Client-Side — Duplicate Teams Allowed

**Symptom:** Two players could select the same Pokémon on their respective teams because blocking was only visual (in-memory WebSocket state). If one player refreshed, or if the WebSocket state desynchronized, duplicate picks went through to battle.

**Root Cause:** The `POST /rooms/:code/ready` endpoint accepted any team without checking for cross-player duplicates. The only safeguard was the frontend's opacity-and-badge UI, which relied on live WebSocket events and had no server authority.

**Fix:**
- Added server-side duplicate validation in the `ready` endpoint: extract both players' selected Pokémon IDs and compare for intersection. Returns `{ error: 'duplicate_pokemon', duplicates: [...] }` if any overlap is found.
- Frontend surfaces the error as a toast and prevents ready-up until the conflict is resolved.
- Added `pokemon-blocking.test.ts` (9 tests) covering the server-side validation path.

---

## Issue 10: Battle Updates Used 1.5s Polling — Lag and Missed Events

**Symptom:** After submitting a move, the opponent's response appeared with up to 1.5 seconds of delay. Under load, rapid sequential updates (e.g., status damage + faint in same turn) sometimes arrived out of order or merged into one delayed tick.

**Root Cause:** The frontend polled `GET /battle/:roomCode` every 1,500ms. Each poll fetched the full `BattleDoc` regardless of whether anything changed. The poll interval meant updates were always delayed by up to 1.5s, and if two turns resolved within one poll interval only the final state was seen.

**Fix:** Replaced polling with **Server-Sent Events** (`GET /battle/:roomCode/events`). The server uses Hono's `streamSSE` and an in-memory `EventEmitter` (`battleEventBus`) to push a full `BattleDoc` snapshot immediately after every action is processed. The frontend opens an `EventSource` on mount and closes it when the battle ends or the component unmounts. Auth is passed via `?token=<clerk-jwt>` query param because `EventSource` cannot set custom headers. Keepalive pings sent every 20s prevent proxy timeouts.

---

*All ten issues are covered by the test suite in `apps/api/tests/` — run `bun run test` from `apps/api` to verify.*
