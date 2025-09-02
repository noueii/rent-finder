/**
 * Common test helpers and utilities
 */

import { expect } from '@jest/globals';
import type { Result } from '../types';

/**
 * Assert that a Result is successful and return the data
 */
export function expectOk<T, E>(result: Result<T, E>): T {
  expect(result.success).toBe(true);
  if (result.success) {
    return result.data;
  }
  throw new Error('Result was not successful');
}

/**
 * Assert that a Result is an error and return the error
 */
export function expectErr<T, E>(result: Result<T, E>): E {
  expect(result.success).toBe(false);
  if (!result.success) {
    return result.error;
  }
  throw new Error('Result was not an error');
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number;
    interval?: number;
    message?: string;
  } = {}
): Promise<void> {
  const { timeout = 5000, interval = 50, message = 'Condition not met' } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`${message} (timeout: ${timeout}ms)`);
}

/**
 * Create a test timeout helper
 */
export function createTimeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Test timeout after ${ms}ms`)), ms);
  });
}

/**
 * Retry a function multiple times
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    attempts?: number;
    delay?: number;
    backoff?: number;
  } = {}
): Promise<T> {
  const { attempts = 3, delay = 100, backoff = 2 } = options;
  
  let lastError: Error | undefined;
  let currentDelay = delay;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < attempts - 1) {
        await new Promise(resolve => setTimeout(resolve, currentDelay));
        currentDelay *= backoff;
      }
    }
  }

  throw lastError || new Error('Retry failed');
}

/**
 * Mock console methods
 */
export function mockConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  const calls = {
    log: [] as any[][],
    error: [] as any[][],
    warn: [] as any[][],
    info: [] as any[][],
  };

  console.log = (...args: any[]) => calls.log.push(args);
  console.error = (...args: any[]) => calls.error.push(args);
  console.warn = (...args: any[]) => calls.warn.push(args);
  console.info = (...args: any[]) => calls.info.push(args);

  return {
    calls,
    restore: () => {
      console.log = originalConsole.log;
      console.error = originalConsole.error;
      console.warn = originalConsole.warn;
      console.info = originalConsole.info;
    },
  };
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: Error) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}

/**
 * Measure execution time
 */
export async function measureTime<T>(
  fn: () => Promise<T>
): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

/**
 * Create a test data generator
 */
export function* testDataGenerator<T>(
  factory: (index: number) => T,
  count = Infinity
): Generator<T> {
  for (let i = 0; i < count; i++) {
    yield factory(i);
  }
}

/**
 * Assert that a promise rejects with a specific error
 */
export async function expectRejects(
  promise: Promise<any>,
  errorMatcher?: string | RegExp | Error | typeof Error
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject');
  } catch (error) {
    if (!errorMatcher) return;

    if (typeof errorMatcher === 'string') {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain(errorMatcher);
    } else if (errorMatcher instanceof RegExp) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(errorMatcher);
    } else if (errorMatcher instanceof Error) {
      expect(error).toEqual(errorMatcher);
    } else if (typeof errorMatcher === 'function') {
      expect(error).toBeInstanceOf(errorMatcher);
    }
  }
}

/**
 * Create a test fixture
 */
export function createFixture<T>(setup: () => T | Promise<T>) {
  let instance: T | undefined;

  return {
    get: async () => {
      if (!instance) {
        instance = await setup();
      }
      return instance;
    },
    reset: () => {
      instance = undefined;
    },
  };
}

/**
 * Run tests in parallel with concurrency limit
 */
export async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const promise = task().then(result => {
      results.push(result);
    });

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex(p => p === promise), 1);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Create a test sandbox
 */
export function createTestSandbox() {
  const cleanups: (() => void | Promise<void>)[] = [];

  return {
    addCleanup: (cleanup: () => void | Promise<void>) => {
      cleanups.push(cleanup);
    },
    cleanup: async () => {
      for (const cleanup of cleanups.reverse()) {
        await cleanup();
      }
      cleanups.length = 0;
    },
  };
}