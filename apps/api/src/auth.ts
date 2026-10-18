import { createClerkClient } from '@clerk/backend';
import { createMiddleware } from 'hono/factory';

import { env } from './env.js';

export type AuthVars = { Variables: { userId: string } };

const clerk = env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: env.CLERK_SECRET_KEY, publishableKey: env.CLERK_PUBLISHABLE_KEY, jwtKey: env.CLERK_JWT_KEY })
  : undefined;

/**
 * Requires a signed-in Clerk user. The app sends its Clerk session token as "Authorization: Bearer <token>".
 * The user ID ("user_…") is the same value Supabase RLS reads from auth.jwt()->>'sub'.
 */
export const requireUser = createMiddleware<AuthVars>(async (c, next) => {
  const header = c.req.header('authorization') ?? '';

  if (env.ALLOW_DEV_AUTH === '1' && env.NODE_ENV === 'development' && header.startsWith('Dev ')) {
    c.set('userId', header.slice(4).trim());
    return next();
  }

  if (!clerk) {
    return c.json({ error: 'auth_not_configured', missing: ['CLERK_SECRET_KEY'] }, 503);
  }

  const state = await clerk.authenticateRequest(c.req.raw, { acceptsToken: 'session_token' });
  if (!state.isAuthenticated) {
    return c.json({ error: 'unauthorized', reason: state.reason }, 401);
  }

  const auth = state.toAuth();
  if (!auth.userId) return c.json({ error: 'unauthorized' }, 401);
  c.set('userId', auth.userId);
  return next();
});
