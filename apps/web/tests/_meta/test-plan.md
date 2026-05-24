# PokéBattle E2E Test Plan

Each flow and negative case below is designed to catch one of the bugs that has been regressing iteration after iteration. The plan covers the 5 critical positive flows and 4 critical negative cases required by the prompt; we also include a regression-guard suite for the already-working real-time forfeit propagation so it cannot silently break.

## Why these flows exist

The recurring bugs in this codebase cluster around five real failure modes:

1. **Asynchronous state coordination** — turn lock, opponent selection, SSE-driven battle updates. When these break, the UI looks fine but the player is stuck.
2. **Server vs. client authority drift** — the engine accepts duplicate actions because the client never blocked the second click.
3. **Manually maintained route metadata** — `/pricing` returned 404 when `routeTree.gen.ts` was missing `id`/`path`/`fullPath`.
4. **CSS regressions in shared components** — `TypeBadge` size bleeds across screens because the same component is reused with different padding.
5. **End-of-battle copy** — distinguishing KO from forfeit and showing the right Poké Ball / flag icon per case.

Every test below targets one of those five failure modes.

## Positive flows

### F1 — Room creation, second-player join, auto-navigate to team

**File:** `flujo1_sala_lobby.spec.ts`

**Why it's critical:** the lobby is the gateway to every other flow. If room codes aren't generated, players can't join the same room, or the lobby's "2 players present" auto-redirect doesn't fire, no other test can run. The lobby polls `/rooms/:code` every 2 s and redirects when `players.length === 2`. That two-condition transition is a classic source of race bugs.

**Bug it covers:** failure mode #1. Past breakages: lobby poll firing too aggressively (rate-limit); lobby never redirecting after a player joined because the poll's "stale closure" captured an empty `players` array.

**Shape:**

1. Player 1 context opens `/`, enters a name, clicks **Create**. Expect URL → `/lobby/<code>`. Expect the visible code element to be 6 chars.
2. Player 1 reads the code from the DOM (`pb-room-code`).
3. Player 2 context opens `/`, enters a name, enters the code, clicks **Join**. Expect URL → `/lobby/<code>`.
4. Within 4 s both contexts navigate to `/team/<code>` automatically.

### F2 — Team selection of 6 Pokémon with search + type filter

**File:** `flujo2_seleccion_equipo.spec.ts`

**Why it's critical:** the team screen is the only place where the `/pokemon` paginated API is exercised before battle; if it regresses, every battle starts with empty teams. The PRD requires that the first 75 Pokémon load on initial render without further interaction.

**Bug it covers:** failure modes #1 and #4. Past breakages: initial page-load showed only 30 cards because `PAGE_SIZE` was lowered without updating the test; type filter buttons stopped working because the click handler was bound but the button's parent was capturing pointer events with `pointer-events: none`.

**Shape:**

1. Reach `/team/<code>` (uses F1's helpers).
2. Assert at least 70 Pokémon cards are rendered on initial paint.
3. Type "char" into search; expect cards count to drop and at least one to have `data-name` matching `char.*`.
4. Click the **Fire** type filter chip; expect every visible card's `data-name` to be fire-typed (cross-referenced via fixture).
5. Clear filters; select 6 different cards; expect `pb-selected-count` to show `6/6` and **Lock In Team** to be enabled.
6. Click **Lock In Team**; expect the "TEAM LOCKED IN!" screen.

### F3 — Normal turn: P1 attacks → client locks → P2 attacks → server resolves → both clients see new turn

**File:** `flujo3_turno_normal.spec.ts`

**Why it's critical:** this is the heartbeat of the entire game. If the client doesn't lock after submit, attack-spam regressions return. If the server resolves on receipt rather than waiting for both players, the engine corrupts state.

**Bug it covers:** failure modes #1 and #2. Past breakages: client buttons remained enabled after submit because `setPhase('busy')` was inside the `try` block instead of at the top of `sendAction`; server resolved a single action and broadcast a turn end, leading to one player's KO before the other acted.

**Shape:**

1. Two contexts reach `/battle/<code>` (via helpers — assumes a battle exists; see Clerk note below).
2. P1 clicks the first move (`pb-move` index 0). Expect all `pb-move` buttons to acquire `[disabled]` within 200 ms (UI-side lock) and `pb-waiting` to appear.
3. P1's `pb-opp-info[data-current-hp]` is unchanged until P2 also acts (no server resolution yet).
4. P2 clicks first move. Within `timeouts.turnResolveMs` ms both contexts see:
   - `pb-battle-log[data-entry-count]` increased by ≥1.
   - One of the `data-current-hp` values dropped on both contexts.
   - Buttons re-enable on both contexts (assuming neither active is fainted).

### F4 — Switch Pokémon: voluntary + forced after faint

**File:** `flujo4_switch_pokemon.spec.ts`

**Why it's critical:** the switch flow has been broken five separate times. Past failures include the panel not opening, cards not being clickable, the server rejecting the action because `currentHp <= 0` blocked all action types, and statuses persisting across switches.

**Bug it covers:** failure modes #1 and #2.

**Shape:**

*Voluntary path:*
1. Reach battle. P1 clicks **Switch** (`pb-switch-open`); `pb-switch-menu` becomes visible.
2. Expect at least one `pb-switch-card[data-fainted="false"][data-active="false"]` is visible and clickable.
3. Click it; verify `pb-my-info[data-pokemon]` changes on both contexts to the chosen Pokémon's name.

*Forced path:*
4. Drive a battle until P1's active Pokémon has 0 HP (this is hard without a server-side "knockout" hook — see Limitations and the `// TODO(human-verify)` markers).
5. Expect `pb-switch-menu[data-forced="true"]` appears automatically, with no `pb-switch-cancel` button rendered.
6. Click a card; battle resumes.

### F5 — Forfeit propagates in real time to the opponent

**File:** `flujo5_forfeit_realtime.spec.ts`

**Why it's critical:** this is the **regression guard** for the bug that finally got fixed in iteration 11–15: the forfeiter sees the end-of-battle overlay, but the non-forfeiting opponent only saw it after a manual refresh. The fix relies on SSE reconnect-with-backoff in `useBattleSSE`. If `useBattleSSE` regresses or the API stops emitting `endReason`, this test catches it.

**Bug it covers:** failure modes #1 and #5.

**Shape:**

1. Two contexts in `/battle/<code>`.
2. P1 clicks **Forfeit** (`pb-forfeit-open`), then **FORFEIT** (`pb-forfeit-confirm`).
3. Within `timeouts.realtimeMs` ms:
   - P1 sees `pb-victory[data-end-reason="forfeit"][data-won="false"]` with subtext containing "forfeited".
   - **P2** (without any refresh) sees `pb-victory[data-end-reason="forfeit"][data-won="true"]` with subtext containing "Your opponent forfeited".
   - Both contexts render an SVG inside `pb-victory-icon` (not an emoji `<span>`).

## Negative cases

### N1 — Attack spam: only one action accepted per (turn, player)

**File:** `negativo1_spam_ataques.spec.ts`

**Why:** this is the highest-priority recurring regression. Multiple concurrent submissions from the same player on the same turn must collapse to exactly one accepted action server-side. The atomic MongoDB `updateOne` with `arrayFilters` is the defensive code; this test exercises it under contention.

**Shape:**

1. Reach `/battle/<code>` for P1.
2. Capture an auth token via `getToken()` (Clerk; see helpers).
3. Fire 10 parallel `POST /battle/<code>/action` requests with the same move via `Promise.all`.
4. Expect exactly 1 response with `{ valid: true }` (or HTTP 200), and 9 responses returning HTTP 4xx with an error mentioning "already submitted".
5. UI assertion: `pb-opp-info[data-current-hp]` is unchanged until P2 submits.

### N2 — Switch to fainted or to active itself is rejected

**File:** `negativo2_switch_invalido.spec.ts`

**Why:** the engine has both UI and server guards against bad switches. If either drifts, the battle desyncs.

**Shape:**

1. Reach battle. Open `pb-switch-menu`.
2. Inject a switch request via `POST /battle/<code>/action` with `targetInstanceId` set to the active Pokémon's `instanceId` (read from the DOM via `data-instance-id` on the card whose `data-active="true"` — note that the active card is normally filtered out; we bypass the UI and call the API directly).
3. Expect HTTP 4xx with an error mentioning "already active".
4. Repeat for a fainted instance (where one is forced into the team via fixture).

### N3 — Stripe `/pricing?success=true` returns 200 and renders success state

**File:** `negativo3_stripe_success.spec.ts`

**Why:** this is the iteration-5 bug. The route was missing from `routeTree.gen.ts`, so a Stripe redirect to `/pricing?success=true` landed on the TanStack Router 404. The fix added the route entry. This test detects regressions if anyone strips `routeTree.gen.ts` again or changes the port without updating `CLIENT_URL`.

**Shape:**

1. Navigate directly to `/pricing?success=true`.
2. Expect HTTP 200 (Playwright's `response.ok()`).
3. Expect `pb-pricing-success` to be visible.
4. Expect the page to not contain the literal "404".
5. Optional follow-up (requires `from=team`): if you set `sessionStorage.player_<code>` first, then visit `/pricing?success=true` while signed in and subscribed, expect a "Return to Team Selection" link to be visible.

### N4 — Joining a non-existent room shows an error

**File:** `negativo4_sala_inexistente.spec.ts`

**Why:** the API returns 404 for unknown room codes. The frontend must surface that as a toast, not silently navigate. Past breakages: navigation happened before the join API call resolved.

**Shape:**

1. Navigate to `/`. Enter a name and a clearly invalid code like `ZZZZZZ`.
2. Click **Join**.
3. Expect the URL to remain on `/` (no navigation).
4. Expect `pb-toast[data-toast-kind="error"]` to appear.

## Clerk authentication strategy

Flows F3, F4, F5, N1, N2, and N3 all require an authenticated Clerk session. Playwright's `storageState` is captured once via `bunx playwright codegen --save-storage=tests/.auth/user.json` against a real Clerk test user. Each authenticated spec then sets `test.use({ storageState: 'tests/.auth/user.json' })`. If the auth file is absent, those specs `test.skip()` with a helpful message — see `helpers/auth.ts`.

## Limitations and TODOs

These items deliberately do not block writing the suite; they are marked in each spec with `// TODO(human-verify): ...` and listed in `bitacora.md` so the human reviewer knows what to confirm.

- **F4 forced switch**: there is no test-only endpoint to KO an active Pokémon. The suite uses the deterministic-IV bias of the engine plus a high-power move loop; the test will quarantine itself with `test.skip(slowTest, '...')` if the KO doesn't materialize within 6 turns. A small backend hook `/__test/set-hp` would make this deterministic.
- **N1 concurrent requests**: the helper assumes the engine accepts back-to-back requests on the same socket. If the API switches to true WebSockets later, the test needs a small adapter.
- **N3 context-aware redirect**: the prompt asks for context-aware redirect from `/team` → `/team?subscription=success`. The current implementation only renders a "Return to Team Selection" button inside the `pb-pricing-success` banner; the spec verifies the button's presence, not a navigation hijack. If you later switch to an auto-redirect, update the matcher.
- **Visual regression**: there are no PNG baselines yet because the rebuild environment isn't deterministic enough (font fallback differs between Linux and macOS). The fixtures include `expect(page).toHaveScreenshot()` calls behind a `process.env.PB_E2E_VISUAL === '1'` guard so they can be enabled when a stable runner is available.
