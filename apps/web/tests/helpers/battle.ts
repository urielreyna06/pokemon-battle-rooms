import { expect, type Page } from '@playwright/test';
import fixtures from '../fixtures/test-data.json';

/**
 * Battle-screen helpers. They prefer DOM signals (testids + data attrs)
 * over network polling so they survive SSE reconnects.
 */

export async function esperarPantallaBatalla(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/battle\/[A-Z0-9]{6}/, { timeout: 30_000 });
  await expect(page.getByTestId('pb-my-info')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('pb-opp-info')).toBeVisible();
}

export async function clickPrimerMovimiento(page: Page): Promise<void> {
  const move = page.getByTestId('pb-move').first();
  await move.waitFor({ state: 'visible' });
  await expect(move).toBeEnabled();
  await move.click();
}

export async function esperarBloqueoUi(page: Page): Promise<void> {
  // After submitting, all move buttons should disable and pb-waiting appears.
  await expect(page.getByTestId('pb-waiting')).toBeVisible({
    timeout: fixtures.timeouts.realtimeMs,
  });
}

export async function leerHpOponente(page: Page): Promise<number> {
  const raw = await page.getByTestId('pb-opp-info').getAttribute('data-current-hp');
  if (raw === null) throw new Error('pb-opp-info[data-current-hp] missing');
  return Number(raw);
}

export async function leerHpPropio(page: Page): Promise<number> {
  const raw = await page.getByTestId('pb-my-info').getAttribute('data-current-hp');
  if (raw === null) throw new Error('pb-my-info[data-current-hp] missing');
  return Number(raw);
}

export async function abrirMenuSwitch(page: Page): Promise<void> {
  await page.getByTestId('pb-switch-open').click();
  await expect(page.getByTestId('pb-switch-menu')).toBeVisible();
}

export async function elegirCambioPokemon(page: Page): Promise<void> {
  const card = page
    .getByTestId('pb-switch-card')
    .filter({ hasNot: page.locator('[data-active="true"]') })
    .filter({ hasNot: page.locator('[data-fainted="true"]') })
    .first();
  await expect(card).toBeVisible();
  await card.click();
}

export async function abrirYConfirmarForfeit(page: Page): Promise<void> {
  await page.getByTestId('pb-forfeit-open').click();
  await expect(page.getByTestId('pb-forfeit-modal')).toBeVisible();
  await page.getByTestId('pb-forfeit-confirm').click();
}

export async function esperarFinDeBatalla(
  page: Page,
  expectedEndReason: 'forfeit' | 'ko',
  expectedWon: boolean,
): Promise<void> {
  const victory = page.getByTestId('pb-victory');
  await expect(victory).toBeVisible({ timeout: fixtures.timeouts.realtimeMs });
  await expect(victory).toHaveAttribute('data-end-reason', expectedEndReason);
  await expect(victory).toHaveAttribute('data-won', String(expectedWon));
}
