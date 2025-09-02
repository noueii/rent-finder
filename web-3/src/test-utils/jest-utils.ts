/**
 * Jest test utilities
 * Central place for all test utilities compatible with Jest
 */

// Re-export Jest globals for easy importing
export { 
  describe, 
  it, 
  test,
  expect, 
  beforeAll, 
  afterAll, 
  beforeEach, 
  afterEach,
  jest
} from '@jest/globals';

// Mock function utilities
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

// Type exports for TypeScript
export type MockedFunction<T extends (...args: any[]) => any> = jest.MockedFunction<T>;
export type MockedClass<T extends new (...args: any[]) => any> = jest.MockedClass<T>;
export type MockedObject<T> = jest.MockedObject<T>;