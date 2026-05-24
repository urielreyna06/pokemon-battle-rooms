/**
 * N1 — Anti-spam: 10 acciones concurrentes del mismo jugador en el mismo turno
 *      → exactamente UNA aceptada por el server.
 *
 * Covers: failure mode #2 (server vs. client authority drift). Highest-
 * priority recurring regression. The defensive code is an atomic MongoDB
 * updateOne with arrayFilters that requires selectedAction == null.
 *
 * This spec hits the API directly via Promise.all to bypass any UI
 * debounce and prove the server-side guard works under contention. It
 * also verifies the UI-side lock (buttons disable after the first click)
 * as a secondary defense.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { setupDosJugadores } from './helpers/room';
import { esperarPantallaBatalla, leerHpOponente } from './helpers/battle';
import { skipIfNoAuth, AUTH_STATE_PATH, getClerkToken } from './helpers/auth';
import fixtures from './fixtures/test-data.json';
import fs from 'node:fs';

test.describe('N1 — Anti-spam', () => {
  test.beforeEach(() => {
    skipIfNoAuth();
  });

  test('10 requests paralelos → exactamente 1 aceptado, 9 rechazados con 4xx', async ({
    browser,
    request,
  }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, p2, code } = await setupDosJugadores(ctxP1, ctxP2);
      await esperarPantallaBatalla(p1);
      await esperarPantallaBatalla(p2);

      const token = await getClerkToken(p1);
      test.skip(!token, 'Could not obtain Clerk session token from p1');

      const moveId = await p1.getByTestId('pb-move').first().getAttribute('data-move-id');
      expect(moveId, 'first move button missing data-move-id').toBeTruthy();

      // 10 parallel POSTs to /battle/<code>/action with the same player + same move.
      const url = `${fixtures.endpoints.api}${fixtures.endpoints.battleAction.replace(':code', code)}`;
      const headers = {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      };
      const body = JSON.stringify({ action: { type: 'move', moveId } });

      const responses = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          request.post(url, { headers, data: body }).then((r) => ({
            status: r.status(),
            json: r.ok() ? null : r.json().catch(() => null),
          })),
        ),
      );

      const ok = responses.filter((r) => r.status >= 200 && r.status < 300);
      const rejected = responses.filter((r) => r.status >= 400 && r.status < 500);

      expect(ok.length, 'server accepted more than one action in the same turn').toBe(1);
      expect(rejected.length, 'expected 9 rejections, got fewer').toBe(9);

      // UI-side lock: pb-waiting must be visible.
      await expect(p1.getByTestId('pb-waiting')).toBeVisible();

      // Opponent HP must not change until P2 acts.
      const hpBefore = await leerHpOponente(p1);
      await p1.waitForTimeout(1500);
      const hpAfter = await leerHpOponente(p1);
      expect(hpAfter, 'opponent HP changed after only P1 acted — server resolved early')
        .toBe(hpBefore);
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });
});
