import { expect, type Page } from '@playwright/test';
import fixtures from '../fixtures/test-data.json';

/**
 * Stripe checkout helper. Drives the hosted Stripe Checkout page using the
 * standard test card. Returns when Stripe has redirected back to the app's
 * success URL.
 *
 * TODO(human-verify): if Stripe ships a new Checkout layout, the field
 * placeholders below may shift; update them with placeholders observed in
 * Stripe's docs at https://docs.stripe.com/testing.
 */
export async function completarCheckoutStripeTest(page: Page): Promise<void> {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });

  await page.getByPlaceholder('Card number').fill(fixtures.stripe.card);
  await page.getByPlaceholder(/MM ?\/ ?YY/).fill(fixtures.stripe.exp);
  await page.getByPlaceholder('CVC').fill(fixtures.stripe.cvc);

  const nameField = page.getByPlaceholder('Full name on card');
  if (await nameField.isVisible().catch(() => false)) {
    await nameField.fill('PB Test User');
  }

  const zip = page.getByPlaceholder(/zip|postal/i);
  if (await zip.isVisible().catch(() => false)) {
    await zip.fill(fixtures.stripe.zip);
  }

  await page.getByRole('button', { name: /^(subscribe|pay|start trial)/i }).click();
  await page.waitForURL(/\/pricing\?success=true/, { timeout: 30_000 });
}
