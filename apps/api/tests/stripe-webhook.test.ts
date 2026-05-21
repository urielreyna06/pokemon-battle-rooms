import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../src/db', () => ({ getDb: vi.fn() }));
vi.mock('stripe');

import { getDb } from '../src/db';
import Stripe from 'stripe';
import { stripeWebhookRoutes } from '../src/webhooks/stripeWebhook';

function buildApp() {
  const app = new Hono();
  app.route('/webhooks/stripe', stripeWebhookRoutes);
  return app;
}

const mockUpdateOne = vi.fn();
const mockDb = {
  collection: vi.fn(() => ({ updateOne: mockUpdateOne })),
};

const WEBHOOK_SECRET = 'whsec_test';
const STRIPE_KEY = 'sk_test_key';

beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = STRIPE_KEY;
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  vi.mocked(getDb).mockResolvedValue(mockDb as never);
  mockUpdateOne.mockReset();
});

function postWebhook(event: Partial<Stripe.Event>, sig = 'valid_sig') {
  const body = JSON.stringify(event);
  return buildApp().request('/webhooks/stripe', {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': sig,
    },
  });
}

function mockConstructEvent(event: Partial<Stripe.Event>) {
  vi.mocked(Stripe).mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(event),
    },
  }) as never);
}

describe('Stripe webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    mockConstructEvent({ type: 'checkout.session.completed' });
    const res = await buildApp().request('/webhooks/stripe', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing stripe-signature header');
  });

  it('returns 500 when Stripe env vars are missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const res = await postWebhook({});
    expect(res.status).toBe(500);
  });

  it('returns 400 when signature verification fails', async () => {
    vi.mocked(Stripe).mockImplementation(() => ({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error('Invalid signature');
        }),
      },
    }) as never);

    const res = await postWebhook({}, 'bad_sig');
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid signature');
  });

  it('checkout.session.completed sets shinyUnlocked=true', async () => {
    const event: Partial<Stripe.Event> = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
          customer_details: { email: 'user@example.com' },
          customer_email: null,
        } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      expect.objectContaining({
        $set: expect.objectContaining({
          shinyUnlocked: true,
          subscriptionStatus: 'active',
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_456',
        }),
      })
    );
  });

  it('customer.subscription.deleted sets shinyUnlocked=false', async () => {
    const event: Partial<Stripe.Event> = {
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_456', status: 'canceled' } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { stripeSubscriptionId: 'sub_456' },
      expect.objectContaining({
        $set: expect.objectContaining({
          shinyUnlocked: false,
          subscriptionStatus: 'canceled',
        }),
      })
    );
  });

  it('customer.subscription.updated maps status correctly', async () => {
    const event: Partial<Stripe.Event> = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_789',
          status: 'past_due',
          current_period_end: 1700000000,
        } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { stripeSubscriptionId: 'sub_789' },
      expect.objectContaining({
        $set: expect.objectContaining({
          subscriptionStatus: 'past_due',
          shinyUnlocked: false,
        }),
      })
    );
  });

  it('unknown event type returns received=true without db write', async () => {
    mockConstructEvent({ type: 'payment_intent.created' as Stripe.Event['type'] });
    const res = await postWebhook({ type: 'payment_intent.created' as Stripe.Event['type'] });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.received).toBe(true);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});
