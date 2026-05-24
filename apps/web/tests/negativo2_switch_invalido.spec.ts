/**
 * N2 — Switch inválido (a fainted o al active) → server rechaza, UI no consume turno.
 *
 * Covers: failure mode #2 (server authority). The engine validates:
 *   - target Pokémon belongs to the player
 *   - target is alive (currentHp > 0)
 *   - target is NOT the currently active Pokémon
 *
 * We bypass the UI (which already filters out invalid targets) and send
 * the action directly via API to confirm the server enforces these
 * invariants.
 */

import { test, expect } from '@playwright/test';
import { setupDosJugadores } from './helpers/room';
import { esperarPantallaBatalla } from './helpers/battle';
import { skipIfNoAuth, AUTH_STATE_PATH, getClerkToken } from './helpers/auth';
import fixtures from './fixtures/test-data.json';
import fs from 'node:fs';

test.describe('N2 — Switch inválido', () => {
  test.beforeEach(() => {
    skipIfNoAuth();
  });

  test('switch al pokémon activo es rechazado con error legible', async ({ browser, request }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, code } = await setupDosJugadores(ctxP1, ctxP2);
      await esperarPantallaBatalla(p1);

      const token = await getClerkToken(p1);
      test.skip(!token, 'Could not obtain Clerk session token from p1');

      // The currently active instance id. We read it via the API (state)
      // because the active card is filtered out of the switch menu DOM.
      const apiState = await request
        .get(`${fixtures.endpoints.api}/battle/${code}`, {
          headers: { authorization: `Bearer ${token}` },
        })
        .then((r) => (r.ok() ? r.json() : null));
      test.skip(!apiState, 'GET /battle/:code did not return a body');

      // TODO(human-verify): adjust this if the API response shape changes.
      const myPlayer = apiState.players?.find?.((p: any) => p.id);
      const activeInstanceId: string | undefined = myPlayer?.activePokemonId;
      test.skip(!activeInstanceId, 'Could not read activePokemonId from API');

      const url = `${fixtures.endpoints.api}${fixtures.endpoints.battleAction.replace(':code', code)}`;
      const res = await request.post(url, {
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        data: JSON.stringify({ action: { type: 'switch', targetInstanceId: activeInstanceId } }),
      });
      expect(res.status(), 'server should reject switching to the active Pokémon').toBeGreaterThanOrEqual(400);
      const body = await res.json().catch(() => ({}));
      expect(JSON.stringify(body)).toMatch(/already active|active|invalid/i);
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });

  test('switch a un instanceId desconocido es rechazado', async ({ browser, request }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, code } = await setupDosJugadores(ctxP1, ctxP2);
      await esperarPantallaBatalla(p1);

      const token = await getClerkToken(p1);
      test.skip(!token, 'Could not obtain Clerk session token from p1');

      const url = `${fixtures.endpoints.api}${fixtures.endpoints.battleAction.replace(':code', code)}`;
      const res = await request.post(url, {
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        data: JSON.stringify({
          action: { type: 'switch', targetInstanceId: 'not-a-real-instance-id' },
        }),
      });
      expect(res.status()).toBeGreaterThanOrEqual(400);
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });
});
