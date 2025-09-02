/**
 * Tests for base error utilities
 */

import { 
  BaseError,
  ProgrammingError, 
  AssertionError, 
  assert, 
  assertNever,
  withErrorHandler,
  ErrorWithCause,
  withRetry
} from '../base-error';

describe('Base Error Utilities', () => {
  describe('ProgrammingError', () => {
    it('should create non-operational error', () => {
      const error = new ProgrammingError('Something went wrong');
      
      expect(error.isOperational).toBe(false);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('PROGRAMMING_ERROR');
      expect(error.message).toBe('Something went wrong');
    });

    it('should accept custom code', () => {
      const error = new ProgrammingError('Error', 'CUSTOM_CODE');
      expect(error.code).toBe('CUSTOM_CODE');
    });
  });

  describe('AssertionError', () => {
    it('should create assertion error', () => {
      const error = new AssertionError('Invariant violated');
      
      expect(error.code).toBe('ASSERTION_ERROR');
      expect(error.isOperational).toBe(false);
      expect(error.message).toBe('Invariant violated');
    });
  });

  describe('assert', () => {
    it('should not throw when condition is truthy', () => {
      expect(() => assert(true, 'Should not throw')).not.toThrow();
      expect(() => assert(1, 'Should not throw')).not.toThrow();
      expect(() => assert('string', 'Should not throw')).not.toThrow();
      expect(() => assert({}, 'Should not throw')).not.toThrow();
    });

    it('should throw AssertionError when condition is falsy', () => {
      expect(() => assert(false, 'Should throw')).toThrow(AssertionError);
      expect(() => assert(false, 'Should throw')).toThrow('Should throw');
      expect(() => assert(0, 'Zero is falsy')).toThrow(AssertionError);
      expect(() => assert('', 'Empty string is falsy')).toThrow(AssertionError);
      expect(() => assert(null, 'Null is falsy')).toThrow(AssertionError);
    });
  });

  describe('assertNever', () => {
    it('should handle exhaustiveness checking', () => {
      type Status = 'active' | 'inactive';
      
      function handleStatus(status: Status): string {
        switch (status) {
          case 'active':
            return 'Active';
          case 'inactive':
            return 'Inactive';
          default:
            // This should never be reached if all cases are handled
            assertNever(status);
        }
      }

      expect(handleStatus('active')).toBe('Active');
      expect(handleStatus('inactive')).toBe('Inactive');
    });
  });

  describe('withErrorHandler', () => {
    it('should wrap async function and pass through result', async () => {
      const fn = async (x: number) => x * 2;
      const wrapped = withErrorHandler(fn);

      const result = await wrapped(5);
      expect(result).toBe(10);
    });

    it('should transform errors when transformer provided', async () => {
      const fn = async () => {
        throw new Error('Original error');
      };

      const wrapped = withErrorHandler(fn, (error) => 
        new BaseError('TRANSFORMED', 400, true, 'Transformed error')
      );

      await expect(wrapped()).rejects.toThrow(BaseError);
      await expect(wrapped()).rejects.toMatchObject({
        code: 'TRANSFORMED',
        message: 'Transformed error',
      });
    });

    it('should pass through errors when no transformer', async () => {
      const originalError = new Error('Original error');
      const fn = async () => {
        throw originalError;
      };

      const wrapped = withErrorHandler(fn);

      await expect(wrapped()).rejects.toThrow(originalError);
    });
  });

  describe('ErrorWithCause', () => {
    it('should create error with cause', () => {
      const cause = new Error('Root cause');
      const error = new ErrorWithCause(
        'High level error',
        'WITH_CAUSE',
        500,
        cause
      );

      expect(error.message).toBe('High level error');
      expect(error.cause).toBe(cause);
      expect(error.stack).toContain('Caused by:');
    });

    it('should handle non-Error causes', () => {
      const error = new ErrorWithCause(
        'Error with object cause',
        'WITH_CAUSE',
        500,
        { reason: 'Some object' }
      );

      expect(error.cause).toEqual({ reason: 'Some object' });
      expect(error.stack).not.toContain('Caused by:');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        return 'success';
      });

      const result = await withRetry(fn);
      
      expect(result).toBe('success');
      expect(attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0;
      const fn = jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          throw new BaseError('TEMP_ERROR', 503, true);
        }
        return 'success';
      });

      const result = await withRetry(fn, { 
        initialDelayMs: 10,
        shouldRetry: () => true 
      });
      
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
      const error = new BaseError('PERSISTENT_ERROR', 500, true);
      const fn = jest.fn(async () => {
        throw error;
      });

      await expect(
        withRetry(fn, { 
          maxAttempts: 3, 
          initialDelayMs: 10,
          shouldRetry: () => true 
        })
      ).rejects.toThrow(error);
      
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect shouldRetry predicate', async () => {
      const fn = jest.fn(async () => {
        throw new BaseError('NON_RETRYABLE', 400, true);
      });

      await expect(
        withRetry(fn, {
          shouldRetry: (error) => {
            if (error instanceof BaseError) {
              return error.statusCode >= 500;
            }
            return false;
          }
        })
      ).rejects.toThrow();
      
      expect(fn).toHaveBeenCalledTimes(1); // No retry
    });

    it('should apply exponential backoff', async () => {
      const delays: number[] = [];
      let lastTime = Date.now();
      
      const fn = jest.fn(async () => {
        const now = Date.now();
        delays.push(now - lastTime);
        lastTime = now;
        throw new BaseError('ERROR', 500, true);
      });

      await expect(
        withRetry(fn, {
          maxAttempts: 3,
          initialDelayMs: 100,
          backoffMultiplier: 2,
          shouldRetry: () => true
        })
      ).rejects.toThrow();

      // First attempt has no delay, subsequent attempts should have increasing delays
      expect(delays[1]).toBeGreaterThanOrEqual(90); // ~100ms
      expect(delays[2]).toBeGreaterThanOrEqual(180); // ~200ms
    });
  });
});