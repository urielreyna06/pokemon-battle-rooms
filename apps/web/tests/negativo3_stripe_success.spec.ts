/**
 * N3 — Stripe /pricing?success=true responde 200 (no 404) y redirige contextual.
 *
 * Covers: failure mode #3 (manually-maintained route metadata). The
 * /pricing route was missing from routeTree.gen.ts → TanStack Router
 * returned 404 → Stripe redirected to a black 404 page after checkout.
 *
 * This spec deliberately does NOT drive a real Stripe checkout — it
 * only verifies that the route exists and the success/cancel banners
 * render. The real-checkout flow is documented in helpers/stripe.ts
 * for the day someone wants to wire a sandbox test against a Stripe
 * test webhook.
 */

import { test, expect } from '@playwright/test';

test.describe('N3 — Stripe success route', () => {
  test('/pricing responde 200 (HEAD: no 404)', async ({ page }) => {
    const response = await page.goto('/pricing');
    expect(response?.ok(), 'GET /pricing should return 200').toBeTruthy();
    expect(response?.status()).toBe(200);
    // Ensure the document body is NOT just a router 404 placeholder.
    await expect(page.locator('body')).not.toContainText('404');
  });

  test('/pricing?success=true muestra el banner de éxito', async ({ page }) => {
    const response = await page.goto('/pricing?success=true');
    expect(response?.status()).toBe(200);
    const banner = page.getByTestId('pb-pricing-success');
    await expect(banner).toBeVisible();
    // The banner text varies (confirming → activated → received) — we only
    // assert that the banner exists, since copy may rotate.
  });

  test('/pricing?canceled=true muestra el banner de cancelación', async ({ page }) => {
    const response = await page.goto('/pricing?canceled=true');
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('pb-pricing-canceled')).toBeVisible();
  });

  // TODO(human-verify): full subscribe → checkout → success flow.
  // This requires:
  //   - Clerk test user with a known email
  //   - STRIPE_SECRET_KEY (test mode) configured server-side
  //   - The 4242 test card sequence in helpers/stripe.ts
  // Skipped by default to keep CI runs deterministic.
  test.skip('end-to-end Stripe checkout from /pricing (manual)', async () => {});
});
