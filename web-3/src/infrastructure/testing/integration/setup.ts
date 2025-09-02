import { type PrismaClient } from '@prisma/client';
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
// import { AppRouter } from '~/server/api/root';
// import { createTRPCMsw } from 'msw-trpc';
import { setupServer } from 'msw/node';

// Prisma client mock
export const prismaMock: DeepMockProxy<PrismaClient> = mockDeep<PrismaClient>();

// Reset all mocks before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// tRPC MSW setup for API mocking
// For now, we'll skip tRPC MSW setup until we need it for API testing
// export const trpcMsw = createTRPCMsw<AppRouter>({ links: [] });
export const server = setupServer();

// Test environment setup
export const setupTestEnvironment = () => {
  // Start MSW server
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/rentfinder_test';
};

// Database test utilities
export const clearDatabase = async (prisma: PrismaClient) => {
  const tablenames = await prisma.$queryRaw<
    Array<{ tablename: string }>
  >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

  const tables = tablenames
    .map(({ tablename }) => tablename)
    .filter((name) => name !== '_prisma_migrations')
    .map((name) => `"public"."${name}"`)
    .join(', ');

  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
  } catch (error) {
    console.log({ error });
  }
};

// Create test database connection
export const createTestPrismaClient = async () => {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  return prisma;
};