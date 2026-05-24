import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Where the saved authenticated Clerk session lives.
 *
 * Capture once with:
 *   cd apps/web
 *   bunx playwright codegen http://localhost:3000 --save-storage=tests/.auth/user.json
 *
 * The file is git-ignored (see README-e2e.md).
 */
export const AUTH_STATE_PATH = path.resolve(__dirname, '..', '.auth', 'user.json');

export function hasAuthState(): boolean {
  try {
    return fs.existsSync(AUTH_STATE_PATH);
  } catch {
    return false;
  }
}

/**
 * Skips the current test if no Clerk auth storageState exists.
 * Use at the top of any spec that needs an authenticated session.
 */
export function skipIfNoAuth() {
  base.skip(
    !hasAuthState(),
    `Skipping: missing ${AUTH_STATE_PATH}. ` +
      `Run \`bunx playwright codegen http://localhost:3000 --save-storage=tests/.auth/user.json\` ` +
      `once with a real Clerk test user to enable.`,
  );
}

/**
 * Fetch a Clerk token from the running page. Used by negative1 to fire
 * parallel API requests with valid auth.
 *
 * Returns null if the page is not signed in.
 */
export async function getClerkToken(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    // @ts-expect-error — Clerk attaches itself to window when loaded
    const Clerk = (globalThis as any).Clerk;
    if (!Clerk?.session) return null;
    try {
      return await Clerk.session.getToken();
    } catch {
      return null;
    }
  });
}

export { expect };
