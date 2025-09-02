/**
 * Global test setup configuration
 */

import { beforeAll, afterAll, afterEach, expect, jest } from '@jest/globals';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Extend matchers
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock environment variables
if (!process.env.NODE_ENV) {
  (process.env as any).NODE_ENV = 'test';
}
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test';

// Global setup
beforeAll(() => {
  // Setup any global test configuration
  console.log('Starting test suite...');
});

// Global teardown
afterAll(() => {
  // Cleanup any global resources
  console.log('Test suite completed.');
});

// Cleanup after each test
afterEach(() => {
  // Cleanup React Testing Library
  cleanup();
  
  // Clear all mocks
  jest.clearAllMocks();
  
  // Clear all timers
  jest.clearAllTimers();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock fetch for tests
(global as any).fetch = jest.fn(() => 
  Promise.resolve(new Response(JSON.stringify({}), { status: 200 }))
);

// Add custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(min: number, max: number): R;
      toHaveBeenCalledExactlyOnceWith(...args: any[]): R;
    }
  }
}

// Custom matcher implementations
expect.extend({
  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${min} - ${max}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${min} - ${max}`,
        pass: false,
      };
    }
  },
  
  toHaveBeenCalledExactlyOnceWith(received: any, ...args: any[]) {
    const mock = received as any;
    const pass = mock.mock.calls.length === 1 && 
                 JSON.stringify(mock.mock.calls[0]) === JSON.stringify(args);
    
    if (pass) {
      return {
        message: () => `expected mock not to have been called exactly once with ${JSON.stringify(args)}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected mock to have been called exactly once with ${JSON.stringify(args)}, but was called ${mock.mock.calls.length} times`,
        pass: false,
      };
    }
  },
});