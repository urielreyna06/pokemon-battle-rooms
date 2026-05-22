import { createMiddleware } from 'hono/factory';
import { verifyToken } from '@clerk/backend';

export type AuthEnv = { Variables: { userId: string } };

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  // SSE clients (EventSource) cannot set headers — accept ?token= as fallback
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : (c.req.query('token') ?? null);

  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
    });
    c.set('userId', payload.sub);
    await next();
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
