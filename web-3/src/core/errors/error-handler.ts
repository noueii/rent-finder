/**
 * Centralized error handler implementation
 * Implements the IErrorHandler interface from contracts
 */

import { logger as baseLogger, createLogger, logError } from '~/lib/logging';
import type { ErrorHandler as IErrorHandler, ErrorContext, ErrorResponse } from './types';
import { BaseError } from './types';

const errorLogger = createLogger('error-handler');

export class ErrorHandler implements IErrorHandler {
  private readonly isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  /**
   * Handle an error and return a standardized response
   */
  handle(error: unknown, context?: ErrorContext): ErrorResponse {
    // Log the error first
    this.log(error, context);

    // Convert to BaseError if needed
    const baseError = this.normalizeError(error);

    // Create response
    const response: ErrorResponse = {
      code: baseError.code,
      message: this.getSafeMessage(baseError),
      statusCode: baseError.statusCode,
    };

    // Add details in development
    if (this.isDevelopment) {
      response.details = this.getErrorDetails(baseError);
      response.stack = baseError.stack;
    }

    return response;
  }

  /**
   * Log an error with context
   */
  log(error: unknown, context?: ErrorContext): void {
    const normalizedError = this.normalizeError(error);
    const isOperational = this.isOperational(normalizedError);

    // Choose log level based on error type
    const logLevel = isOperational ? 'warn' : 'error';

    // Create log entry
    const logEntry = {
      errorCode: normalizedError.code,
      statusCode: normalizedError.statusCode,
      isOperational,
      ...context,
      error: {
        name: normalizedError.name,
        message: normalizedError.message,
        stack: normalizedError.stack,
      },
    };

    // Log with appropriate level
    errorLogger[logLevel](logEntry, `${isOperational ? 'Operational' : 'Programming'} error occurred`);

    // For non-operational errors in production, might want to send to error tracking service
    if (!isOperational && !this.isDevelopment) {
      // TODO: Send to Sentry/Rollbar/etc
      this.notifyErrorTracking(normalizedError, context);
    }
  }

  /**
   * Check if an error is operational (expected) vs programming (unexpected)
   */
  isOperational(error: Error): boolean {
    if (error instanceof BaseError) {
      return error.isOperational;
    }

    // Check for common operational error patterns
    const operationalPatterns = [
      /validation/i,
      /not found/i,
      /unauthorized/i,
      /forbidden/i,
      /bad request/i,
      /conflict/i,
      /rate limit/i,
    ];

    const message = error.message.toLowerCase();
    return operationalPatterns.some(pattern => pattern.test(message));
  }

  /**
   * Normalize any error to BaseError
   */
  private normalizeError(error: unknown): BaseError {
    // Already a BaseError
    if (error instanceof BaseError) {
      return error;
    }

    // Standard Error
    if (error instanceof Error) {
      return this.createBaseError(error);
    }

    // String error
    if (typeof error === 'string') {
      return new BaseError('UNKNOWN_ERROR', 500, false, error);
    }

    // Object with error-like properties
    if (typeof error === 'object' && error !== null) {
      const errorObj = error as any;
      return new BaseError(
        errorObj.code || 'UNKNOWN_ERROR',
        errorObj.statusCode || errorObj.status || 500,
        false,
        errorObj.message || 'An unknown error occurred'
      );
    }

    // Fallback for everything else
    return new BaseError('UNKNOWN_ERROR', 500, false, String(error));
  }

  /**
   * Create BaseError from standard Error
   */
  private createBaseError(error: Error): BaseError {
    // Check for common HTTP error patterns
    const httpErrorMap: Record<string, { code: string; statusCode: number }> = {
      'validation': { code: 'VALIDATION_ERROR', statusCode: 400 },
      'bad request': { code: 'BAD_REQUEST', statusCode: 400 },
      'unauthorized': { code: 'UNAUTHORIZED', statusCode: 401 },
      'forbidden': { code: 'FORBIDDEN', statusCode: 403 },
      'not found': { code: 'NOT_FOUND', statusCode: 404 },
      'conflict': { code: 'CONFLICT', statusCode: 409 },
      'rate limit': { code: 'RATE_LIMIT', statusCode: 429 },
      'internal server': { code: 'INTERNAL_ERROR', statusCode: 500 },
    };

    const messageLower = error.message.toLowerCase();
    for (const [pattern, config] of Object.entries(httpErrorMap)) {
      if (messageLower.includes(pattern)) {
        return new BaseError(
          config.code,
          config.statusCode,
          true, // These are operational errors
          error.message
        );
      }
    }

    // Default to internal error
    return new BaseError('INTERNAL_ERROR', 500, false, error.message);
  }

  /**
   * Get safe error message for client
   */
  private getSafeMessage(error: BaseError): string {
    // For operational errors, return the actual message
    if (error.isOperational) {
      return error.message || 'An error occurred';
    }

    // For programming errors in production, return generic message
    if (!this.isDevelopment) {
      return 'An internal error occurred. Please try again later.';
    }

    // In development, return actual message
    return error.message || 'An unknown error occurred';
  }

  /**
   * Get error details for development
   */
  private getErrorDetails(error: BaseError): unknown {
    return {
      name: error.name,
      isOperational: error.isOperational,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Send error to tracking service (stub for now)
   */
  private notifyErrorTracking(error: BaseError, context?: ErrorContext): void {
    // TODO: Implement when error tracking service is configured
    // Example: Sentry.captureException(error, { extra: context });
    errorLogger.debug({ error, context }, 'Would send to error tracking service');
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Export convenience functions
export const handleError = (error: unknown, context?: ErrorContext): ErrorResponse => {
  return errorHandler.handle(error, context);
};

export const logAndHandleError = (error: unknown, context?: ErrorContext): ErrorResponse => {
  return errorHandler.handle(error, context);
};