/**
 * N4 — Unirse a una sala inexistente: el UI muestra error y NO navega.
 *
 * Covers: failure mode #2 (server vs. client). Past breakage: client
 * navigated to /lobby/<code> before the join API call resolved, then
 * the lobby showed a perpetual "Player 1/2" with no opponent ever
 * possible. The fix: client must await join, surface 4xx as a toast,
 * and stay on `/`.
 */

import { test, expect } from '@playwright/test';
import fixtures from './fixtures/test-data.json';

test.describe('N4 — Sala inexistente', () => {
  test('join con código inválido → toast de error, sin navegación', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('pb-player-name').fill(fixtures.players.p1);
    await page.getByTestId('pb-join-code').fill(fixtures.invalidRoomCode);
    await page.getByTestId('pb-join-room').click();

    // Toast must appear with the error kind.
    const toast = page.getByTestId('pb-toast');
    await expect(toast).toBeVisible({ timeout: 6000 });
    await expect(toast).toHaveAttribute('data-toast-kind', 'error');

    // URL must not change.
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/\/$|\/\?/);
  });
});
