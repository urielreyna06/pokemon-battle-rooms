import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

vi.mock('../src/db', () => ({ getDb: vi.fn() }));
vi.mock('stripe');

import { getDb } from '../src/db';
import Stripe from 'stripe';
import { stripeWebhookRoutes } from '../src/webhooks/stripeWebhook';
import type { UserDoc } from '../../../packages/shared/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildApp() {
  const app = new Hono();
  app.route('/webhooks/stripe', stripeWebhookRoutes);
  return app;
}

function mockConstructEvent(event: Partial<Stripe.Event>) {
  vi.mocked(Stripe).mockImplementation(() => ({
    webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
  }) as never);
}

async function postWebhook(event: Partial<Stripe.Event>) {
  return buildApp().request('/webhooks/stripe', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 'valid_sig',
    },
  });
}

// ─── Stateful user fixture ────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    clerkId: 'user_abc',
    email: 'player@example.com',
    username: 'player1',
    subscriptionStatus: 'none',
    shinyUnlocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as UserDoc;
}

// ─── Full lifecycle test ──────────────────────────────────────────────────────

describe('Pricing subscription lifecycle', () => {
  let user: UserDoc;
  const mockUpdateOne = vi.fn();

  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    user = makeUser();
    mockUpdateOne.mockClear();

    // Simulate updateOne applying the $set patch to the in-memory user doc
    mockUpdateOne.mockImplementation(
      (_filter: unknown, update: { $set: Partial<UserDoc> }) => {
        Object.assign(user, update.$set);
        return Promise.resolve({ matchedCount: 1, modifiedCount: 1 });
      }
    );

    vi.mocked(getDb).mockResolvedValue({
      collection: vi.fn(() => ({ updateOne: mockUpdateOne })),
    } as never);
  });

  it('step 1 — user starts with no subscription', () => {
    expect(user.subscriptionStatus).toBe('none');
    expect(user.shinyUnlocked).toBe(false);
  });

  it('step 2 — checkout.session.completed activates subscription and unlocks shiny', async () => {
    const event: Partial<Stripe.Event> = {
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_123',
          subscription: 'sub_456',
          customer_details: { email: user.email },
          customer_email: null,
        } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    expect(user.subscriptionStatus).toBe('active');
    expect(user.shinyUnlocked).toBe(true);
    expect(user.stripeCustomerId).toBe('cus_123');
    expect(user.stripeSubscriptionId).toBe('sub_456');
  });

  it('step 3 — customer.subscription.updated to past_due revokes shiny access', async () => {
    user.stripeSubscriptionId = 'sub_456';

    const event: Partial<Stripe.Event> = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          status: 'past_due',
          current_period_end: 1800000000,
        } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    expect(user.subscriptionStatus).toBe('past_due');
    expect(user.shinyUnlocked).toBe(false);
  });

  it('step 4 — customer.subscription.updated back to active restores shiny access', async () => {
    user.stripeSubscriptionId = 'sub_456';

    const event: Partial<Stripe.Event> = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          status: 'active',
          current_period_end: 1900000000,
        } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    expect(user.subscriptionStatus).toBe('active');
    expect(user.shinyUnlocked).toBe(true);
  });

  it('step 5 — customer.subscription.deleted cancels subscription and locks shiny', async () => {
    user.stripeSubscriptionId = 'sub_456';

    const event: Partial<Stripe.Event> = {
      type: 'customer.subscription.deleted',
      data: {
        object: { id: 'sub_456', status: 'canceled' } as never,
      },
    };
    mockConstructEvent(event);

    const res = await postWebhook(event);
    expect(res.status).toBe(200);

    expect(user.subscriptionStatus).toBe('canceled');
    expect(user.shinyUnlocked).toBe(false);
  });

  it('full lifecycle — correct updateOne call count (one per webhook)', async () => {
    const events: Array<Partial<Stripe.Event>> = [
      {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_123',
            subscription: 'sub_456',
            customer_details: { email: user.email },
            customer_email: null,
          } as never,
        },
      },
      {
        type: 'customer.subscription.updated',
        data: { object: { id: 'sub_456', status: 'past_due', current_period_end: 1800000000 } as never },
      },
      {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_456', status: 'canceled' } as never },
      },
    ];

    for (const event of events) {
      mockConstructEvent(event);
      const res = await postWebhook(event);
      expect(res.status).toBe(200);
    }

    expect(mockUpdateOne).toHaveBeenCalledTimes(3);
    expect(user.subscriptionStatus).toBe('canceled');
    expect(user.shinyUnlocked).toBe(false);
  });
});
