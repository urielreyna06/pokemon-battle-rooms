import { Hono } from 'hono';
import { createClerkClient } from '@clerk/backend';
import { requireAuth, type AuthEnv } from '../middleware/requireAuth';

export const userRoutes = new Hono<AuthEnv>();

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

// GET /users/me — returns subscription status from Clerk publicMetadata
userRoutes.get('/me', requireAuth, async (c) => {
  try {
    const userId = c.get('userId');
    const user = await clerk.users.getUser(userId);
    const isShinySubscriber = user.publicMetadata?.isShinySubscriber === true;
    return c.json({ isShinySubscriber });
  } catch (err) {
    console.error('GET /users/me error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
