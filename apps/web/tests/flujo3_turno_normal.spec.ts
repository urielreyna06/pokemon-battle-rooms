/**
 * F3 — Turno normal: P1 ataca → cliente bloquea → P2 ataca → server resuelve.
 *
 * Covers: failure modes #1 (async coordination) and #2 (server vs. client
 * authority). This is the heartbeat of the entire game.
 *
 * Two contexts because the server must wait for BOTH players' actions
 * before resolving the turn. With one context we cannot observe the
 * "wait state" the bug lives in.
 *
 * TODO(human-verify): this spec assumes a battle is already in progress.
 * Getting there requires both players to lock in teams (covered by F2)
 * and the room to transition to `status: 'battling'`. The skipIfNoAuth
 * guard exists because Clerk auth is required for the action endpoints.
 */

import { test, expect } from '@playwright/test';
import { setupDosJugadores } from './helpers/room';
import {
  esperarPantallaBatalla,
  clickPrimerMovimiento,
  esperarBloqueoUi,
  leerHpOponente,
} from './helpers/battle';
import { skipIfNoAuth, AUTH_STATE_PATH } from './helpers/auth';
import fixtures from './fixtures/test-data.json';
import fs from 'node:fs';

test.describe('F3 — Turno normal', () => {
  test.beforeEach(() => {
    skipIfNoAuth();
  });

  test('P1 ataca, UI bloquea, hasta que P2 también envía no se resuelve', async ({ browser }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, p2 } = await setupDosJugadores(ctxP1, ctxP2);

      // TODO(human-verify): drive both players' team selection + lock-in here.
      // For now this spec assumes the battle is already in progress and only
      // exercises the turn-lock invariants.
      await esperarPantallaBatalla(p1);
      await esperarPantallaBatalla(p2);

      const hpOppBefore = await leerHpOponente(p1);

      // P1 submits first. UI must lock immediately.
      await clickPrimerMovimiento(p1);
      await esperarBloqueoUi(p1);

      // Hold for 1.5s: the opponent's HP must NOT change because P2 hasn't acted.
      await p1.waitForTimeout(1500);
      const hpOppMid = await leerHpOponente(p1);
      expect(hpOppMid, 'opponent HP changed before P2 acted — server resolved prematurely')
        .toBe(hpOppBefore);

      // P2 submits. Within turnResolveMs, HP changes on both contexts.
      await clickPrimerMovimiento(p2);

      await expect
        .poll(async () => await leerHpOponente(p1), { timeout: fixtures.timeouts.turnResolveMs })
        .toBeLessThan(hpOppBefore);
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });
});
