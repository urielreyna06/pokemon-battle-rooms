# Selectors Map — PokéBattle E2E

Inspection date: 2026-05-23. Audit run via `grep -rn "data-testid\|aria-label" apps/web/app/`.

## Baseline finding

> **There were ZERO `data-testid` attributes and ZERO `aria-label`s in `apps/web/app/` at the start of this iteration.** Every locator below is either (a) added by this iteration as a `data-testid`, or (b) a stable text/role we kept as-is because the copy is unlikely to change without a visual review.

## Conventions

The Playwright specs prefer locators in this order: `getByRole` → `getByLabel` → `getByPlaceholder` → `getByText` → `getByTestId`. We add `data-testid` only where role/text are ambiguous or where the element is icon-only.

All added testids use the `pb-` prefix to avoid colliding with any future tokens.

## Per-screen selector map

### `/` (landing — `routes/index.tsx`)

| Element            | Locator                                              | Source                |
|--------------------|------------------------------------------------------|-----------------------|
| Player-name input  | `page.getByPlaceholder('Enter your name')`           | existing `placeholder` |
| Join-code input    | `page.getByPlaceholder('ROOM CODE')`                 | existing `placeholder` |
| Create button      | `page.getByTestId('pb-create-room')`                 | **added**             |
| Join button        | `page.getByTestId('pb-join-room')`                   | **added**             |
| Error toast        | `page.getByTestId('pb-toast')`                       | **added** (Toast cmp) |

### `/lobby/$code` (lobby — `routes/lobby.$code.tsx`)

| Element            | Locator                                              | Source                |
|--------------------|------------------------------------------------------|-----------------------|
| Room code display  | `page.getByTestId('pb-room-code')`                   | **added**             |
| Status text        | `page.getByTestId('pb-lobby-status')`                | **added**             |

> Lobby auto-navigates to `/team/$code` when 2 players are present (polls every 2s). There is no explicit "Ready" button on this screen.

### `/team/$code` (team selection — `routes/team.$code.tsx`)

| Element              | Locator                                                  | Source     |
|----------------------|----------------------------------------------------------|------------|
| Pokémon card         | `page.getByTestId('pb-pokemon-card').nth(i)`             | **added**  |
| Search input         | `page.getByPlaceholder('Search Pokémon')`                | placeholder |
| Type filter button   | `page.getByTestId('pb-type-filter-${type}')`             | **added**  |
| Confirm/Ready button | `page.getByTestId('pb-team-confirm')`                    | **added**  |
| Selected counter     | `page.getByTestId('pb-selected-count')`                  | **added**  |

### `/battle/$code` (battle — `routes/battle.$code.tsx`)

| Element                | Locator                                              | Source     |
|------------------------|------------------------------------------------------|------------|
| Battle log container   | `page.getByTestId('pb-battle-log')`                  | **added**  |
| Move button (0..3)     | `page.getByTestId('pb-move').nth(i)`                 | **added**  |
| Switch (open) button   | `page.getByTestId('pb-switch-open')`                 | **added**  |
| Forfeit button         | `page.getByTestId('pb-forfeit-open')`                | **added**  |
| Switch menu card       | `page.getByTestId('pb-switch-card').nth(i)`          | **added**  |
| Switch menu cancel     | `page.getByTestId('pb-switch-cancel')`               | **added**  |
| Forfeit confirm        | `page.getByTestId('pb-forfeit-confirm')`             | **added**  |
| Forfeit cancel         | `page.getByTestId('pb-forfeit-cancel')`              | **added**  |
| Victory overlay        | `page.getByTestId('pb-victory')`                     | **added**  |
| Victory heading        | `page.getByTestId('pb-victory-heading')`             | **added**  |
| Victory subtext        | `page.getByTestId('pb-victory-sub')`                 | **added**  |
| Victory icon (svg)     | `page.getByTestId('pb-victory-icon')`                | **added**  |
| Waiting panel          | `page.getByTestId('pb-waiting')`                     | **added**  |
| Type badge (in panels) | `page.getByTestId('pb-type-badge')`                  | **added**  |
| MyInfo block           | `page.getByTestId('pb-my-info')`                     | **added**  |
| OpponentInfo block     | `page.getByTestId('pb-opp-info')`                    | **added**  |

### `/pricing` (Stripe — `routes/pricing.tsx`)

| Element                | Locator                                              | Source     |
|------------------------|------------------------------------------------------|------------|
| Success banner         | `page.getByTestId('pb-pricing-success')`             | **added**  |
| Cancel banner          | `page.getByTestId('pb-pricing-canceled')`            | **added**  |
| Subscribe button       | `page.getByTestId('pb-subscribe')`                   | **added**  |
| Sign-in CTA            | `page.getByRole('button', { name: /sign in/i })`     | Clerk      |

## What was deliberately NOT added

- Sprite `<img>` tags — Playwright can use `getByRole('img', { name })` if needed, but the spec doesn't depend on sprite content.
- HP bar — visual only; tests assert on `currentHp` shown as text via `getByTestId('pb-my-info')`/`pb-opp-info`.
- Each individual move-name text — `pb-move` indexed access is enough.

## TODO(human-verify)

Items that may need human review when locators drift:

- The Stripe success banner copy ("Subscription active!") — if you change the wording, update the spec text matchers.
- `pb-type-badge` is added on the in-battle variant of `TypeBadge`. The team-selection card uses the same component; if you ever split the variants, the spec for Issue 1 will need the new id.
- Clerk sign-in flow is intentionally not exercised by these specs — they assume a `storageState` file with an authenticated session, captured manually via `bunx playwright codegen --save-storage=tests/.auth/user.json`.
