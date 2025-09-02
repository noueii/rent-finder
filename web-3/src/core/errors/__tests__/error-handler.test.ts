/**
 * Tests for the error handler
 */

import { ErrorHandler, BaseError } from '../index';
import { 
  ValidationError, 
  NotFoundError, 
  UnauthorizedError,
  ForbiddenError,
  RateLimitError 
} from '../operational-errors';

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
    // Mock console methods to avoid test output noise
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: originalEnv,
      writable: true,
      configurable: true
    });
  });

  describe('handle', () => {
    it('should handle BaseError correctly', () => {
      const error = new BaseError('TEST_ERROR', 400, true, 'Test error message');
      const response = errorHandler.handle(error);

      expect(response).toEqual({
        code: 'TEST_ERROR',
        message: 'Test error message',
        statusCode: 400,
      });
    });

    it('should handle operational errors with actual message', () => {
      const error = new ValidationError('Invalid email format');
      const response = errorHandler.handle(error);

      expect(response).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Invalid email format',
        statusCode: 400,
      });
    });

    it('should include stack trace in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      });
      const devHandler = new ErrorHandler();
      
      const error = new Error('Test error');
      const response = devHandler.handle(error);

      expect(response.stack).toBeDefined();
      expect(response.details).toBeDefined();
    });

    it('should hide stack trace in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true
      });
      const prodHandler = new ErrorHandler();
      
      const error = new Error('Test error');
      const response = prodHandler.handle(error);

      expect(response.stack).toBeUndefined();
      expect(response.details).toBeUndefined();
    });

    it('should handle string errors', () => {
      const response = errorHandler.handle('Something went wrong');

      expect(response).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'An internal error occurred. Please try again later.',
        statusCode: 500,
      });
    });

    it('should handle object errors', () => {
      const response = errorHandler.handle({ 
        code: 'CUSTOM_ERROR', 
        message: 'Custom error message',
        statusCode: 418 
      });

      expect(response.code).toBe('CUSTOM_ERROR');
      expect(response.statusCode).toBe(418);
    });

    it('should add context to error logs', () => {
      const error = new ValidationError('Test error');
      const context = { userId: '123', operation: 'updateProfile' };

      errorHandler.handle(error, context);

      // Verify logging was called (implementation detail)
      expect(console.warn).toHaveBeenCalled();
    });
  });

  describe('isOperational', () => {
    it('should identify BaseError operational status', () => {
      const operational = new BaseError('TEST', 400, true);
      const programming = new BaseError('TEST', 500, false);

      expect(errorHandler.isOperational(operational)).toBe(true);
      expect(errorHandler.isOperational(programming)).toBe(false);
    });

    it('should identify operational errors by message pattern', () => {
      const validationError = new Error('Validation failed');
      const notFoundError = new Error('Resource not found');
      const randomError = new Error('Something exploded');

      expect(errorHandler.isOperational(validationError)).toBe(true);
      expect(errorHandler.isOperational(notFoundError)).toBe(true);
      expect(errorHandler.isOperational(randomError)).toBe(false);
    });
  });

  describe('operational error classes', () => {
    it('should create proper NotFoundError', () => {
      const error = new NotFoundError('User', '123');
      
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe("User with identifier '123' not found");
      expect(error.isOperational).toBe(true);
    });

    it('should create proper UnauthorizedError', () => {
      const error = new UnauthorizedError();
      
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Authentication required');
    });

    it('should create proper ForbiddenError', () => {
      const error = new ForbiddenError('delete', 'posts');
      
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.message).toBe("You don't have permission to delete posts");
    });

    it('should create proper RateLimitError', () => {
      const error = new RateLimitError(60);
      
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('error message safety', () => {
    it('should return safe message for programming errors in production', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true
      });
      const prodHandler = new ErrorHandler();
      
      const error = new BaseError('INTERNAL_ERROR', 500, false, 'Database connection failed');
      const response = prodHandler.handle(error);

      expect(response.message).toBe('An internal error occurred. Please try again later.');
    });

    it('should return actual message for programming errors in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        writable: true,
        configurable: true
      });
      const devHandler = new ErrorHandler();
      
      const error = new BaseError('INTERNAL_ERROR', 500, false, 'Database connection failed');
      const response = devHandler.handle(error);

      expect(response.message).toBe('Database connection failed');
    });
  });
});