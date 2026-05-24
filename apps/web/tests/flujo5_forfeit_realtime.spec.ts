/**
 * F5 — Forfeit propaga en tiempo real al oponente sin refresh.
 *
 * Covers: failure modes #1 (async coordination) and #5 (end-of-battle copy).
 * This is the REGRESSION GUARD for the bug that got fixed in iteration
 * 11–15: the forfeiter saw the overlay, but the opponent had to refresh
 * to see anything.
 *
 * Two contexts are mandatory: the whole point is to prove the
 * non-forfeiting side transitions to the end state without any
 * user interaction.
 *
 * Bug-recurrence detector: if anyone reverts the SSE reconnect logic
 * in useBattleSSE.ts, or stops emitting endReason from the API forfeit
 * route, this test fails within `realtimeMs` of P1's forfeit click.
 */

import { test, expect } from '@playwright/test';
import { setupDosJugadores } from './helpers/room';
import {
  esperarPantallaBatalla,
  abrirYConfirmarForfeit,
  esperarFinDeBatalla,
} from './helpers/battle';
import { skipIfNoAuth, AUTH_STATE_PATH } from './helpers/auth';
import fixtures from './fixtures/test-data.json';
import fs from 'node:fs';

test.describe('F5 — Forfeit realtime propagation', () => {
  test.beforeEach(() => {
    skipIfNoAuth();
  });

  test('P1 forfeits → P2 ve overlay con endReason=forfeit sin refresh', async ({ browser }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, p2 } = await setupDosJugadores(ctxP1, ctxP2);
      await esperarPantallaBatalla(p1);
      await esperarPantallaBatalla(p2);

      // Snapshot URL so we can verify P2 did NOT navigate (just got an overlay).
      const p2UrlBefore = p2.url();

      await abrirYConfirmarForfeit(p1);

      // P1: loser-by-forfeit overlay.
      await esperarFinDeBatalla(p1, 'forfeit', false);
      await expect(p1.getByTestId('pb-victory-sub')).toContainText(/forfeit/i);

      // P2: winner-by-forfeit overlay — within realtimeMs, no refresh.
      await esperarFinDeBatalla(p2, 'forfeit', true);
      await expect(p2.getByTestId('pb-victory-sub')).toContainText(/forfeited/i);
      expect(p2.url(), 'opponent navigated away instead of receiving the overlay')
        .toBe(p2UrlBefore);

      // Both overlays must render the SVG icon, not an emoji.
      await expect(p1.getByTestId('pb-victory-icon').locator('svg')).toBeVisible();
      await expect(p2.getByTestId('pb-victory-icon').locator('svg')).toBeVisible();
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });
});
