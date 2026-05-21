import { Hono } from 'hono';
import Stripe from 'stripe';
import { getDb } from '../db';
import type { UserDoc } from '../../../../packages/shared/types';

export const stripeWebhookRoutes = new Hono();

stripeWebhookRoutes.post('/', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing stripe-signature header' }, 400);

  const body = await c.req.text();
  const stripe = new Stripe(stripeSecretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = await getDb();
  const users = db.collection<UserDoc>('users');

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const customerId = session.customer as string | undefined;
    const subscriptionId = session.subscription as string | undefined;
    const customerEmail = session.customer_details?.email ?? session.customer_email;

    if (customerEmail) {
      await users.updateOne(
        { email: customerEmail },
        {
          $set: {
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
            subscriptionStatus: 'active',
            shinyUnlocked: true,
            updatedAt: new Date(),
          },
        }
      );
    }
  } else if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription;
    const status: UserDoc['subscriptionStatus'] =
      sub.status === 'active' ? 'active' :
      sub.status === 'canceled' ? 'canceled' :
      sub.status === 'past_due' ? 'past_due' : 'none';
    const shinyUnlocked = sub.status === 'active';
    const endsAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : undefined;

    await users.updateOne(
      { stripeSubscriptionId: sub.id },
      {
        $set: {
          subscriptionStatus: status,
          shinyUnlocked,
          ...(endsAt ? { subscriptionEndsAt: endsAt } : {}),
          updatedAt: new Date(),
        },
      }
    );
  } else if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    await users.updateOne(
      { stripeSubscriptionId: sub.id },
      {
        $set: {
          subscriptionStatus: 'canceled',
          shinyUnlocked: false,
          updatedAt: new Date(),
        },
      }
    );
  }

  return c.json({ received: true });
});
