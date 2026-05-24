import { expect, type Page, type BrowserContext } from '@playwright/test';
import fixtures from '../fixtures/test-data.json';

/**
 * Sala / lobby helpers — purely UI-driven (no API calls).
 *
 * These exist because room creation, join, and lobby auto-nav are
 * exercised before every battle test; duplicating them in each spec
 * was getting flaky.
 */

const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;

export async function crearSala(page: Page, playerName: string): Promise<string> {
  await page.goto('/');
  await page.getByTestId('pb-player-name').fill(playerName);
  await page.getByTestId('pb-create-room').click();
  await expect(page).toHaveURL(/\/lobby\/[A-Z0-9]{6}/, { timeout: 8000 });
  const code = page.url().split('/lobby/').pop()!.split('?')[0];
  if (!ROOM_CODE_RE.test(code)) {
    throw new Error(`Lobby URL produced an unexpected code: ${code}`);
  }
  await expect(page.getByTestId('pb-room-code')).toHaveText(code);
  return code;
}

export async function unirseASala(page: Page, code: string, playerName: string): Promise<void> {
  await page.goto('/');
  await page.getByTestId('pb-player-name').fill(playerName);
  await page.getByTestId('pb-join-code').fill(code);
  await page.getByTestId('pb-join-room').click();
}

export async function esperarFaseTeam(page: Page): Promise<void> {
  // Lobby auto-redirects to /team/<code> once 2 players are present.
  await expect(page).toHaveURL(/\/team\/[A-Z0-9]{6}/, {
    timeout: fixtures.timeouts.lobbyAutoNavMs,
  });
}

/** Convenience: spawn two contexts, create + join, both end at /team/<code>. */
export async function setupDosJugadores(
  ctxP1: BrowserContext,
  ctxP2: BrowserContext,
): Promise<{ p1: Page; p2: Page; code: string }> {
  const p1 = await ctxP1.newPage();
  const code = await crearSala(p1, fixtures.players.p1);

  const p2 = await ctxP2.newPage();
  await unirseASala(p2, code, fixtures.players.p2);

  await Promise.all([esperarFaseTeam(p1), esperarFaseTeam(p2)]);
  return { p1, p2, code };
}
