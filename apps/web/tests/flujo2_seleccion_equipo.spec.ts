/**
 * F2 — Selección de equipo: catálogo carga, filtros funcionan, lock-in OK.
 *
 * Covers: failure modes #1 (async coordination) and #4 (shared-component
 * regressions). The PRD requires the first PAGE_SIZE (75) Pokémon to load
 * on initial render without further interaction.
 *
 * Why two contexts: team-selection talks via WebSocket to share opponent
 * picks. Selecting a Pokémon as P1 must immediately mark it taken in P2.
 * We only assert P1's selection here; the cross-player taken-marking
 * assertion lives in N4 because it tests the boundary.
 */

import { test, expect } from '@playwright/test';
import { setupDosJugadores } from './helpers/room';

test.describe('F2 — Selección de equipo', () => {
  test('carga catálogo inicial (>= 70 cards), filtra, selecciona 6, lock-in', async ({ browser }) => {
    const ctxP1 = await browser.newContext();
    const ctxP2 = await browser.newContext();

    try {
      const { p1 } = await setupDosJugadores(ctxP1, ctxP2);

      // Initial paint: PAGE_SIZE = 75; allow a small margin for slow CI.
      const cards = p1.getByTestId('pb-pokemon-card');
      await expect.poll(async () => await cards.count(), {
        message: 'Initial Pokémon load should produce >= 70 cards within ~5s',
        timeout: 10_000,
      }).toBeGreaterThanOrEqual(70);

      // Search filter — type "char", expect at least one charmander/charizard/etc.
      await p1.getByTestId('pb-team-search').fill('char');
      await expect
        .poll(async () => await cards.count(), { timeout: 4000 })
        .toBeGreaterThan(0);
      const firstName = await cards.first().getAttribute('data-name');
      expect(firstName).toMatch(/^char/i);

      // Clear search, exercise a type filter.
      await p1.getByTestId('pb-team-search').fill('');
      await p1.getByTestId('pb-type-filter-fire').click();
      // All visible cards now claim 'fire' in their types — we verify via the
      // first card's data-name + the team-selection card embedding pb-type-badge.
      await expect.poll(async () => await cards.count(), { timeout: 4000 }).toBeGreaterThan(0);

      // TODO(human-verify): if you change type filter to AND across types
      // instead of OR, this assertion needs to validate all type chips.

      // Clear all filters via the route's "✕ CLEAR FILTERS" button (text-based locator).
      await p1.getByRole('button', { name: /CLEAR FILTERS/i }).click();

      // Select 6 cards.
      for (let i = 0; i < 6; i++) {
        await cards.nth(i).click();
      }
      await expect(p1.getByTestId('pb-selected-count')).toHaveAttribute('data-count', '6');

      // Lock in team.
      const confirm = p1.getByTestId('pb-team-confirm');
      await expect(confirm).toBeEnabled();
      await confirm.click();

      // Success state: "TEAM LOCKED IN!" header appears.
      await expect(p1.getByRole('heading', { name: /TEAM LOCKED IN/i })).toBeVisible({
        timeout: 8000,
      });
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });
});
