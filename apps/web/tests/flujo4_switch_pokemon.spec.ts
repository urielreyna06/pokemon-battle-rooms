/**
 * F4 — Switch Pokémon: voluntario + forzado tras KO.
 *
 * Covers: failure modes #1 (async coordination) and #2 (server authority).
 * The switch flow has regressed five separate times. Past failures:
 *   - panel didn't open (handler bound to stale ref)
 *   - cards weren't clickable (parent intercepted pointer events)
 *   - server rejected switch when active was fainted (currentHp <= 0 guard
 *     blocked ALL action types, not just moves)
 *   - statuses persisted across switches
 *
 * TODO(human-verify): the "forced" branch requires the active Pokémon to
 * faint. Without a test-only API for setting HP, we can't make this
 * deterministic in <60s. The test loops up to 6 turns of max-power moves
 * and skips with a clear message if no faint occurs.
 */

import { test, expect } from '@playwright/test';
import { setupDosJugadores } from './helpers/room';
import {
  esperarPantallaBatalla,
  abrirMenuSwitch,
  elegirCambioPokemon,
  clickPrimerMovimiento,
  leerHpPropio,
} from './helpers/battle';
import { skipIfNoAuth, AUTH_STATE_PATH } from './helpers/auth';
import fs from 'node:fs';

test.describe('F4 — Switch Pokémon', () => {
  test.beforeEach(() => {
    skipIfNoAuth();
  });

  test('voluntary switch — abre menú, click en carta, active cambia', async ({ browser }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, p2 } = await setupDosJugadores(ctxP1, ctxP2);
      // TODO(human-verify): teams must be locked in for both players to enter battle.
      await esperarPantallaBatalla(p1);
      await esperarPantallaBatalla(p2);

      const activoAntes = await p1.getByTestId('pb-my-info').getAttribute('data-pokemon');

      await abrirMenuSwitch(p1);

      // The menu must contain at least one alive non-active card.
      const cards = p1.getByTestId('pb-switch-card');
      const count = await cards.count();
      expect(count, 'switch menu opened with zero candidates').toBeGreaterThan(0);

      await elegirCambioPokemon(p1);

      // P2's view of P1's active Pokémon must change within realtimeMs.
      await expect
        .poll(async () => p2.getByTestId('pb-opp-info').getAttribute('data-pokemon'), {
          timeout: 4000,
        })
        .not.toBe(activoAntes);
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });

  test('forced switch tras KO — menú aparece sin botón cancel', async ({ browser }) => {
    const storageState = fs.existsSync(AUTH_STATE_PATH) ? AUTH_STATE_PATH : undefined;
    const ctxP1 = await browser.newContext({ storageState });
    const ctxP2 = await browser.newContext({ storageState });

    try {
      const { p1, p2 } = await setupDosJugadores(ctxP1, ctxP2);
      await esperarPantallaBatalla(p1);
      await esperarPantallaBatalla(p2);

      // Best-effort KO loop: both players hammer move-0 for up to 6 turns.
      // TODO(human-verify): add a /__test/set-hp backend endpoint to make this deterministic.
      let knockedOut = false;
      for (let i = 0; i < 6 && !knockedOut; i++) {
        await Promise.all([clickPrimerMovimiento(p1), clickPrimerMovimiento(p2)]);
        await p1.waitForTimeout(2500); // wait for SSE-driven resolution
        const hpMine = await leerHpPropio(p1);
        if (hpMine <= 0) knockedOut = true;
      }

      test.skip(!knockedOut, '6 turns of move-0 did not produce a KO; cannot exercise forced-switch path');

      const menu = p1.getByTestId('pb-switch-menu');
      await expect(menu).toBeVisible();
      await expect(menu).toHaveAttribute('data-forced', 'true');
      await expect(p1.getByTestId('pb-switch-cancel')).toHaveCount(0);

      await elegirCambioPokemon(p1);

      // After forced switch resolves, the menu disappears.
      await expect(menu).toBeHidden({ timeout: 4000 });
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });
});
