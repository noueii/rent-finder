import { config } from 'dotenv';
import { join } from 'path';

// Load test environment variables
config({ path: join(__dirname, '../../../.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/rentfinder_test';

// Increase test timeout for E2E tests
jest.setTimeout(30000);

// Global test utilities
global.testHelpers = {
  // Helper to wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to retry flaky operations
  retry: async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        await global.testHelpers.wait(1000);
      }
    }
    throw lastError;
  },
};

// Mock external services
jest.mock('~/lib/geocoding', () => ({
  geocodeAddress: jest.fn().mockResolvedValue({
    lat: 35.6762,
    lng: 139.6503,
    formattedAddress: 'Tokyo, Japan',
  }),
}));

jest.mock('~/lib/transit', () => ({
  getReachableStations: jest.fn().mockResolvedValue([
    { stationId: 'station-1', commuteTime: 10 },
    { stationId: 'station-2', commuteTime: 20 },
    { stationId: 'station-3', commuteTime: 30 },
  ]),
  calculateCommute: jest.fn().mockResolvedValue({
    duration: 25,
    transfers: 1,
    route: 'Mock Route',
  }),
}));

// Suppress console logs during tests unless debugging
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };
}

// Clean up after all tests
afterAll(async () => {
  // Close database connections
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.$disconnect();
});