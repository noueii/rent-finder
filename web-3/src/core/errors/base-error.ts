/**
 * Base error class with additional utilities
 * Extends the BaseError from types.ts with helper methods
 */

import { BaseError as BaseErrorType } from './types';

export { BaseError } from './types';

/**
 * Create a programming error (non-operational)
 */
export class ProgrammingError extends BaseErrorType {
  constructor(message: string, code: string = 'PROGRAMMING_ERROR') {
    super(code, 500, false, message);
  }
}

/**
 * Create an assertion error for invariant violations
 */
export class AssertionError extends ProgrammingError {
  constructor(message: string) {
    super(message, 'ASSERTION_ERROR');
  }
}

/**
 * Assert a condition and throw if false
 */
export function assert(condition: any, message: string): asserts condition {
  if (!condition) {
    throw new AssertionError(message);
  }
}

/**
 * Assert that a value is never reached (exhaustiveness check)
 */
export function assertNever(value: never): never {
  throw new AssertionError(`Unexpected value: ${value}`);
}

/**
 * Wrap an async function to catch and handle errors
 */
export function withErrorHandler<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorTransformer?: (error: unknown) => BaseErrorType
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (errorTransformer) {
        throw errorTransformer(error);
      }
      throw error;
    }
  }) as T;
}

/**
 * Create an error from a Zod validation error
 */
export function fromZodError(error: any): BaseErrorType {
  // Check if it's a Zod error
  if (error?.issues && Array.isArray(error.issues)) {
    const issues = error.issues.map((issue: any) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    return new BaseErrorType(
      'VALIDATION_ERROR',
      400,
      true,
      'Validation failed'
    );
  }

  // Not a Zod error
  return new BaseErrorType(
    'VALIDATION_ERROR',
    400,
    true,
    error?.message || 'Validation failed'
  );
}

/**
 * Create an error with cause (for error chaining)
 */
export class ErrorWithCause extends BaseErrorType {
  public cause: unknown;

  constructor(
    message: string,
    code: string,
    statusCode: number,
    cause: unknown,
    isOperational: boolean = true
  ) {
    super(code, statusCode, isOperational, message);
    this.cause = cause;
    
    // Include cause in stack trace if it's an Error
    if (cause instanceof Error && cause.stack) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

/**
 * Retry configuration for retryable errors
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

/**
 * Default retry configuration
 */
export const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    if (error instanceof BaseErrorType) {
      return error.isOperational && error.statusCode >= 500;
    }
    return false;
  },
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: unknown;
  let delay = finalConfig.initialDelayMs;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = finalConfig.shouldRetry?.(error, attempt) ?? true;
      if (!shouldRetry || attempt === finalConfig.maxAttempts) {
        throw error;
      }

      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));

      // Calculate next delay with backoff
      delay = Math.min(
        delay * finalConfig.backoffMultiplier,
        finalConfig.maxDelayMs
      );
    }
  }

  // This should never be reached, but TypeScript doesn't know that
  throw lastError;
}