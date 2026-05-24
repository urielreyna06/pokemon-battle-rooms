/**
 * F1 — Crear sala + unirse desde un segundo contexto + ambos llegan a /team.
 *
 * Covers: failure mode #1 (async state coordination). The lobby polls
 * /rooms/:code every 2s and auto-navigates when players.length === 2;
 * if that race breaks, no other E2E flow can run.
 *
 * Two browser contexts are required because the lobby's auto-redirect
 * fires from a poll inside each player's session; a single context would
 * see only its own player.
 */

import { test, expect } from '@playwright/test';
import { crearSala, unirseASala, esperarFaseTeam } from './helpers/room';
import fixtures from './fixtures/test-data.json';

test.describe('F1 — Sala + Lobby + Auto-nav', () => {
  test('crea sala, segundo jugador se une y ambos llegan a /team', async ({ browser }) => {
    const ctxP1 = await browser.newContext();
    const ctxP2 = await browser.newContext();

    try {
      const p1 = await ctxP1.newPage();
      const code = await crearSala(p1, fixtures.players.p1);

      // The room code must be exactly 6 uppercase alphanumeric characters.
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      expect(code.length).toBe(fixtures.roomCodeLength);

      // Lobby UI checks while waiting for P2.
      await expect(p1.getByTestId('pb-lobby-status')).toContainText(/Players \(1\/2\)/);

      const p2 = await ctxP2.newPage();
      await unirseASala(p2, code, fixtures.players.p2);

      // Both contexts should auto-navigate to /team within lobbyAutoNavMs.
      await Promise.all([esperarFaseTeam(p1), esperarFaseTeam(p2)]);

      expect(p1.url()).toMatch(new RegExp(`/team/${code}`));
      expect(p2.url()).toMatch(new RegExp(`/team/${code}`));
    } finally {
      await ctxP1.close();
      await ctxP2.close();
    }
  });

  test('código de sala se renderiza visible y es copiable', async ({ browser }) => {
    const ctx = await browser.newContext();
    try {
      const page = await ctx.newPage();
      const code = await crearSala(page, fixtures.players.p1);

      const codeEl = page.getByTestId('pb-room-code');
      await expect(codeEl).toBeVisible();
      await expect(codeEl).toHaveText(code);
    } finally {
      await ctx.close();
    }
  });
});
