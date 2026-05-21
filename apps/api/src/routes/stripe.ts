import { Hono } from 'hono';
import Stripe from 'stripe';
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';
import { getDb } from '../db';
import type { UserDoc } from '../../../../packages/shared/types';

export const stripeRoutes = new Hono<AuthEnv>();
stripeRoutes.use('*', requireAuth);

stripeRoutes.post('/create-checkout-session', async (c) => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const priceId = process.env.STRIPE_PRICE_ID;
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:3000';

  if (!stripeSecretKey || !priceId) {
    return c.json({ error: 'Stripe not configured' }, 500);
  }

  const stripe = new Stripe(stripeSecretKey);
  const userId = c.get('userId');
  const db = await getDb();
  const user = await db.collection<UserDoc>('users').findOne({ clerkId: userId });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      ...(user?.stripeCustomerId
        ? { customer: user.stripeCustomerId }
        : { customer_email: user?.email }),
      metadata: { clerkId: userId },
      success_url: `${clientUrl}/pricing?success=true`,
      cancel_url: `${clientUrl}/pricing?canceled=true`,
    });

    return c.json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }
});

stripeRoutes.get('/subscription-status', async (c) => {
  const userId = c.get('userId');
  const db = await getDb();
  const user = await db.collection<UserDoc>('users').findOne({ clerkId: userId });

  return c.json({
    status: user?.subscriptionStatus ?? 'none',
    shinyUnlocked: user?.shinyUnlocked ?? false,
  });
});
