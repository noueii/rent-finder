import { TRPCError, initTRPC } from '@trpc/server';
import { type NextRequest } from 'next/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { PerformanceTimer, performanceMonitor, QueryPerformanceTracker } from '../../lib/performance';
import { db } from '~/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '~/lib/auth';

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  // Force fresh session on every request
  const session = await getServerSession(authOptions);
  
  // Log to debug session caching
  if (session?.user) {
    console.log('[tRPC Context] Session user:', session.user.email);
  } else {
    console.log('[tRPC Context] No session');
  }
  
  return {
    db,
    headers: opts.headers,
    session,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Performance middleware for monitoring
 */
const performanceMiddleware = t.middleware(async ({ path, next }) => {
  const timer = new PerformanceTimer();
  console.log(`🔄 Starting ${path}`);

  try {
    const result = await next();
    const duration = timer.getTotal();

    // Record timing
    performanceMonitor.recordTiming(`trpc_${path}`, duration);
    QueryPerformanceTracker.track(path, duration);

    // Log slow queries
    if (duration > 200) {
      console.warn(`🐌 Slow query: ${path} took ${duration}ms`);
    } else {
      console.log(`✅ ${path} completed in ${duration}ms`);
    }

    return result;
  } catch (error) {
    const duration = timer.getTotal();
    performanceMonitor.recordTiming(`trpc_${path}_error`, duration);
    console.error(`❌ ${path} failed after ${duration}ms:`, error);
    throw error;
  }
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(performanceMiddleware);

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */
export const protectedProcedure = t.procedure
  .use(performanceMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in to perform this action',
      });
    }
    
    return next({
      ctx: {
        ...ctx,
        session: ctx.session, // Now guaranteed to have user
      },
    });
  });

/**
 * Rate-limited procedure
 * 
 * For expensive operations like searches, we can add rate limiting
 */
export const rateLimitedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  // For now, we'll skip rate limiting
  // In the future, you can add rate limiting logic here based on IP or user
  return next();
});

/**
 * Cached procedure - DISABLED, just uses publicProcedure
 */
export const cachedProcedure = publicProcedure;
