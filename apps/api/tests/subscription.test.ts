import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('../src/db', () => ({ getDb: vi.fn() }));
vi.mock('stripe');

import { verifyToken } from '@clerk/backend';
import { getDb } from '../src/db';
import Stripe from 'stripe';
import { stripeRoutes } from '../src/routes/stripe';
import { requireAuth, type AuthEnv } from '../src/middleware/requireAuth';

const MOCK_USER_ID = 'user_test_sub';

function buildApp() {
  const app = new Hono<AuthEnv>();
  app.use('*', requireAuth);
  app.route('/stripe', stripeRoutes);
  return app;
}

function authedRequest(path: string, init?: RequestInit) {
  return buildApp().request(path, {
    ...init,
    headers: { Authorization: 'Bearer valid.token', ...(init?.headers ?? {}) },
  });
}

const mockFindOne = vi.fn();
const mockDb = { collection: vi.fn(() => ({ findOne: mockFindOne })) };

beforeEach(() => {
  vi.mocked(verifyToken).mockResolvedValue({ sub: MOCK_USER_ID } as ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never);
  vi.mocked(getDb).mockResolvedValue(mockDb as never);
  mockFindOne.mockReset();
});

describe('GET /stripe/subscription-status', () => {
  it('returns none + shinyUnlocked=false when user not in db', async () => {
    mockFindOne.mockResolvedValue(null);
    const res = await authedRequest('/stripe/subscription-status');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('none');
    expect(data.shinyUnlocked).toBe(false);
  });

  it('returns active + shinyUnlocked=true for subscribed user', async () => {
    mockFindOne.mockResolvedValue({
      clerkId: MOCK_USER_ID,
      subscriptionStatus: 'active',
      shinyUnlocked: true,
    });
    const res = await authedRequest('/stripe/subscription-status');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('active');
    expect(data.shinyUnlocked).toBe(true);
  });

  it('returns canceled + shinyUnlocked=false for canceled subscription', async () => {
    mockFindOne.mockResolvedValue({
      clerkId: MOCK_USER_ID,
      subscriptionStatus: 'canceled',
      shinyUnlocked: false,
    });
    const res = await authedRequest('/stripe/subscription-status');
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('canceled');
    expect(data.shinyUnlocked).toBe(false);
  });

  it('returns 401 without auth header', async () => {
    const res = await buildApp().request('/stripe/subscription-status');
    expect(res.status).toBe(401);
  });
});

describe('POST /stripe/create-checkout-session', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    process.env.STRIPE_PRICE_ID = 'price_test_123';
    process.env.CLIENT_URL = 'http://localhost:3000';
  });

  it('returns 500 when Stripe env vars are missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await authedRequest('/stripe/create-checkout-session', { method: 'POST' });
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Stripe not configured');
  });

  it('returns checkout url for new user', async () => {
    mockFindOne.mockResolvedValue({ email: 'test@example.com' });

    const mockCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/test' });
    vi.mocked(Stripe).mockImplementation(() => ({
      checkout: { sessions: { create: mockCreate } },
    }) as never);

    const res = await authedRequest('/stripe/create-checkout-session', { method: 'POST' });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe('https://checkout.stripe.com/pay/test');
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        metadata: { clerkId: MOCK_USER_ID },
      })
    );
  });

  it('uses existing stripeCustomerId when user already has one', async () => {
    mockFindOne.mockResolvedValue({
      email: 'test@example.com',
      stripeCustomerId: 'cus_existing',
    });

    const mockCreate = vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/pay/test2' });
    vi.mocked(Stripe).mockImplementation(() => ({
      checkout: { sessions: { create: mockCreate } },
    }) as never);

    await authedRequest('/stripe/create-checkout-session', { method: 'POST' });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: 'cus_existing' })
    );
  });
});
