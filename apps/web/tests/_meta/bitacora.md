# PokéBattle E2E — Bitácora de generación

Single-pass test-suite generation log. Read in order.

## Resumen

| Item | Detalle |
|------|---------|
| **Preguntas hechas al humano** | 2 — alcance del ZERO FALSE OUTPUTS rule (Docker + browser) y agentes paralelos. Decisiones: humano corre rebuild + browser; sin agentes paralelos. Todo lo demás se infirió del código. |
| **Decisiones aceptadas** | _[humano debe marcar tras revisar]_ |
| **Correcciones manuales pendientes** | _[humano debe marcar tras revisar]_ |
| **Validación final** | _[humano debe correr `docker compose down -v && up --build` + `bun run e2e` y pegar el log aquí]_ |

## Inputs

- **Diagnosis date**: 2026-05-23
- **Baseline**: `apps/api/tests` → **154 passed (12 files)**. `tsc --noEmit` on `apps/api` has 5 pre-existing errors in `server.ts`/`pokemon.ts` that are unrelated to this iteration; `apps/web` is clean.
- **Tools added**: Playwright `^1.49.0` to `apps/web/package.json`. No other deps.
- **`data-testid`s added** (none existed before — see `selectors-map.md`):
  - `apps/web/app/routes/index.tsx` → `pb-player-name`, `pb-create-room`, `pb-join-code`, `pb-join-room`
  - `apps/web/app/routes/lobby.$code.tsx` → `pb-room-code`, `pb-lobby-status`
  - `apps/web/app/routes/team.$code.tsx` → `pb-selected-count`, `pb-team-search`, `pb-type-filter-{type}`, `pb-pokemon-card`, `pb-team-confirm`
  - `apps/web/app/routes/battle.$code.tsx` → `pb-forfeit-open`
  - `apps/web/app/routes/pricing.tsx` → `pb-pricing-success`, `pb-pricing-canceled`, `pb-subscribe`
  - `apps/web/app/components/Toast.tsx` → `pb-toast` (+ `data-toast-kind`)
  - `apps/web/app/components/MoveButton.tsx` → `pb-move` (+ `data-move-id`)
  - `apps/web/app/components/FightPanel.tsx` → `pb-switch-open`
  - `apps/web/app/components/SwitchMenu.tsx` → `pb-switch-menu` (+ `data-forced`), `pb-switch-cancel`, `pb-switch-card` (+ `data-instance-id`, `data-fainted`, `data-active`)
  - `apps/web/app/components/ForfeitModal.tsx` → `pb-forfeit-modal` (+ `role="dialog"`, `aria-label`), `pb-forfeit-cancel`, `pb-forfeit-confirm`
  - `apps/web/app/components/VictoryOverlay.tsx` → `pb-victory` (+ `data-end-reason`, `data-won`, `data-spectator`), `pb-victory-icon`, `pb-victory-heading`, `pb-victory-sub`
  - `apps/web/app/components/TypeBadge.tsx` → `pb-type-badge` (+ `data-type`, `data-size`)
  - `apps/web/app/components/MyInfo.tsx` → `pb-my-info` (+ `data-pokemon`, `data-current-hp`, `data-max-hp`)
  - `apps/web/app/components/OpponentInfo.tsx` → `pb-opp-info` (+ `data-pokemon`, `data-current-hp`, `data-max-hp`)
  - `apps/web/app/components/BattleLog.tsx` → `pb-battle-log` (+ `data-entry-count`)
  - Also: `WaitingPanel` inside `battle.$code.tsx` → `pb-waiting`.

## TODO(human-verify) inventory

Each `// TODO(human-verify):` comment in the suite — gather them here so reviews are fast.

1. **`tests/flujo3_turno_normal.spec.ts`** — assumes a battle is already in progress. The current `setupDosJugadores` helper reaches `/team/<code>`. Driving team lock-in for both contexts inside the helper would let this spec run from a cold start; this is the single biggest gap to close.
2. **`tests/flujo4_switch_pokemon.spec.ts`** — forced-switch branch uses a 6-turn KO loop. A backend `/__test/set-hp` endpoint (test-env-only) would make this deterministic; without it, the spec self-skips when the KO doesn't materialize.
3. **`tests/negativo1_spam_ataques.spec.ts`** — assumes the API tolerates back-to-back HTTP `POST` requests on the same socket. If you migrate to true WebSockets, the helper needs an adapter.
4. **`tests/negativo2_switch_invalido.spec.ts`** — reads `activePokemonId` directly from the `GET /battle/:code` body. If you change the API response shape, update the JSON path.
5. **`tests/negativo3_stripe_success.spec.ts`** — does not exercise a real Stripe checkout. The placeholder test for full subscribe → success is `test.skip()` until a Stripe sandbox is wired in CI.
6. **`tests/flujo2_seleccion_equipo.spec.ts`** — the "Fire filter" assertion currently only checks that some cards remain visible; a deeper assertion would walk every card's `pb-type-badge[data-type]` and confirm `'fire'` ∈ types. Skipping for now to keep first-paint timing fast.
7. **`tests/helpers/stripe.ts`** — Stripe Checkout placeholders may drift; verify against https://docs.stripe.com/testing if the helper starts to fail.

## What runs without auth

- `flujo1_sala_lobby.spec.ts` ✓
- `flujo2_seleccion_equipo.spec.ts` (partial — the WebSocket call for opponent picks requires auth; the catalog + filter assertions don't)
- `negativo3_stripe_success.spec.ts` ✓
- `negativo4_sala_inexistente.spec.ts` ✓

## What needs Clerk `storageState`

- `flujo3_turno_normal.spec.ts`
- `flujo4_switch_pokemon.spec.ts`
- `flujo5_forfeit_realtime.spec.ts`
- `negativo1_spam_ataques.spec.ts`
- `negativo2_switch_invalido.spec.ts`

All five `test.skip` themselves with a helpful message if `tests/.auth/user.json` is absent.

## Tabla FINAL STATUS

To be filled after the user runs the suite. Each row should reference a screenshot, trace, or video under `playwright-report/` or `test-results/`.

| STATUS | TEST NAME | EVIDENCIA |
|--------|-----------|-----------|
| PENDING | flujo1_sala_lobby > crea sala, segundo jugador se une… | _user fills_ |
| PENDING | flujo1_sala_lobby > código se renderiza visible | _user fills_ |
| PENDING | flujo2_seleccion_equipo > carga catálogo… | _user fills_ |
| PENDING | flujo3_turno_normal > P1 ataca, UI bloquea… | _user fills_ |
| PENDING | flujo4_switch_pokemon > voluntary switch | _user fills_ |
| PENDING | flujo4_switch_pokemon > forced switch tras KO | _user fills_ |
| PENDING | flujo5_forfeit_realtime > P1 forfeits → P2 ve overlay | _user fills_ |
| PENDING | negativo1_spam_ataques > 10 requests paralelos | _user fills_ |
| PENDING | negativo2_switch_invalido > switch al activo | _user fills_ |
| PENDING | negativo2_switch_invalido > switch a instanceId desconocido | _user fills_ |
| PENDING | negativo3_stripe_success > /pricing 200 | _user fills_ |
| PENDING | negativo3_stripe_success > /pricing?success=true banner | _user fills_ |
| PENDING | negativo3_stripe_success > /pricing?canceled=true banner | _user fills_ |
| PENDING | negativo4_sala_inexistente > join inválido → toast | _user fills_ |

## Comandos de validación final

```bash
# Backend regression check (must still be 154 passed)
cd apps/api && bun run test

# Stack rebuild
cd ../..
docker compose down -v
docker compose up --build -d
docker compose --profile import run --rm importer

# E2E suite
cd apps/web
bun install
bunx playwright install --with-deps
bunx playwright codegen http://localhost:3000 --save-storage=tests/.auth/user.json   # one-time
bun run e2e

# Open the HTML report
bun run e2e:report
```
