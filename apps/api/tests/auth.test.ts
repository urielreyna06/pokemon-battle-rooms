import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from '@clerk/backend';
import { requireAuth, type AuthEnv } from '../src/middleware/requireAuth';

function buildApp() {
  const app = new Hono<AuthEnv>();
  app.use('*', requireAuth);
  app.get('/', (c) => c.json({ userId: c.get('userId') }));
  return app;
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.mocked(verifyToken).mockResolvedValue({ sub: 'user_test_123' } as ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never);
  });

  it('returns 401 when Authorization header is missing', async () => {
    const res = await buildApp().request('/');
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 for non-Bearer scheme', async () => {
    const res = await buildApp().request('/', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    expect(res.status).toBe(401);
  });

  it('sets userId and calls next on valid Bearer token', async () => {
    const res = await buildApp().request('/', {
      headers: { Authorization: 'Bearer valid.jwt.token' },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.userId).toBe('user_test_123');
  });

  it('returns 401 when verifyToken throws', async () => {
    vi.mocked(verifyToken).mockRejectedValueOnce(new Error('Token expired'));
    const res = await buildApp().request('/', {
      headers: { Authorization: 'Bearer expired.token' },
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid token');
  });

  it('passes the clerk secret key to verifyToken', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test_secret';
    await buildApp().request('/', {
      headers: { Authorization: 'Bearer some.token' },
    });
    expect(vi.mocked(verifyToken)).toHaveBeenCalledWith(
      'some.token',
      expect.objectContaining({ secretKey: 'sk_test_secret' })
    );
  });
});
