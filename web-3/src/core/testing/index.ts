/**
 * Testing infrastructure exports
 */

// Export test helpers
export * from './helpers';

// Export mock factories
export * from './factories';

// Export database utilities
export * from './database';

// Export fixtures
export * from './fixtures';

// Re-export jest utilities for convenience
export { expect, describe, it, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';

// Export vi compatibility layer
export const vi = {
  fn: jest.fn,
  spyOn: jest.spyOn,
  clearAllMocks: jest.clearAllMocks,
  resetAllMocks: jest.resetAllMocks,
  restoreAllMocks: jest.restoreAllMocks,
  mocked: jest.mocked,
  useFakeTimers: jest.useFakeTimers,
  useRealTimers: jest.useRealTimers,
  runAllTimers: jest.runAllTimers,
  advanceTimersByTime: jest.advanceTimersByTime,
  clearAllTimers: jest.clearAllTimers,
  getTimerCount: jest.getTimerCount,
  setSystemTime: jest.setSystemTime,
};