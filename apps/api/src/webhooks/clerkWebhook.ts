import { Hono } from 'hono';
import { Webhook } from 'svix';
import { getDb } from '../db';
import type { UserDoc } from '../../../../packages/shared/types';

export const clerkWebhookRoutes = new Hono();

clerkWebhookRoutes.post('/', async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) return c.json({ error: 'Webhook secret not configured' }, 500);

  const svixId = c.req.header('svix-id');
  const svixTimestamp = c.req.header('svix-timestamp');
  const svixSignature = c.req.header('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json({ error: 'Missing svix headers' }, 400);
  }

  const body = await c.req.text();
  const wh = new Webhook(webhookSecret);

  let evt: { type: string; data: Record<string, unknown> };
  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: Record<string, unknown> };
  } catch {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const db = await getDb();
  const users = db.collection<UserDoc>('users');
  const { type, data } = evt;

  if (type === 'user.created') {
    const emailAddresses = data.email_addresses as Array<{ email_address: string }> | undefined;
    const email = emailAddresses?.[0]?.email_address ?? '';
    const clerkId = data.id as string;
    const existing = await users.findOne({ clerkId });
    if (!existing) {
      await users.insertOne({
        clerkId,
        email,
        subscriptionStatus: 'none',
        shinyUnlocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  } else if (type === 'user.updated') {
    const emailAddresses = data.email_addresses as Array<{ email_address: string }> | undefined;
    const email = emailAddresses?.[0]?.email_address ?? '';
    const clerkId = data.id as string;
    await users.updateOne(
      { clerkId },
      { $set: { email, updatedAt: new Date() } },
      { upsert: true }
    );
  } else if (type === 'user.deleted') {
    const clerkId = data.id as string;
    await users.deleteOne({ clerkId });
  }

  return c.json({ received: true });
});
