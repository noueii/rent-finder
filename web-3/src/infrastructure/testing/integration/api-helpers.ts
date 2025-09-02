import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { AppRouter } from '~/server/api/root';
import superjson from 'superjson';
import { createServerSideHelpers } from '@trpc/react-query/server';
import { appRouter } from '~/server/api/root';
import { createInnerTRPCContext } from '~/server/api/trpc';
import { Session } from 'next-auth';

// Create test tRPC client
export const createTestTRPCClient = (baseUrl: string = 'http://localhost:3000') => {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        headers() {
          return {
            'content-type': 'application/json',
          };
        },
      }),
    ],
  });
};

// Create server-side helpers for testing
export const createTestServerSideHelpers = async (session?: Session) => {
  const context = await createInnerTRPCContext({
    session: session || null,
  });

  return createServerSideHelpers({
    router: appRouter,
    ctx: context,
    transformer: superjson,
  });
};

// API request helper with authentication
export const makeAuthenticatedRequest = async (
  endpoint: string,
  options: RequestInit = {},
  session?: Session
) => {
  const headers = new Headers(options.headers);
  
  if (session) {
    headers.set('Authorization', `Bearer test-token`);
  }

  return fetch(endpoint, {
    ...options,
    headers,
  });
};

// Helper to create test API context
export const createTestContext = async (overrides?: Partial<any>) => {
  const { prismaMock } = await import('./setup');
  
  return {
    db: prismaMock,
    session: null,
    ...overrides,
  };
};

// Helper to test tRPC procedures
export const testTRPCProcedure = async <TInput, TOutput>(
  procedure: any,
  input: TInput,
  contextOverrides?: Partial<any>
): Promise<TOutput> => {
  const ctx = await createTestContext(contextOverrides);
  return procedure({ ctx, input });
};

// Helper to test API endpoints with error handling
export const testAPIEndpoint = async (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any,
  expectedStatus: number = 200
) => {
  const response = await fetch(`http://localhost:3000${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  expect(response.status).toBe(expectedStatus);

  if (response.ok) {
    return response.json();
  } else {
    const error = await response.text();
    throw new Error(`API Error: ${error}`);
  }
};