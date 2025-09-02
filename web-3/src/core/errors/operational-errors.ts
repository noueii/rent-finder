/**
 * Common operational errors that are expected to occur
 * These errors are safe to show to users
 */

import { BaseError } from './types';

/**
 * Validation error - input data doesn't meet requirements
 */
export class ValidationError extends BaseError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', 400, true, message);
    this.details = details;
  }

  public details?: unknown;
}

/**
 * Not found error - requested resource doesn't exist
 */
export class NotFoundError extends BaseError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super('NOT_FOUND', 404, true, message);
    this.resource = resource;
    this.identifier = identifier;
  }

  public resource: string;
  public identifier?: string;
}

/**
 * Unauthorized error - user not authenticated
 */
export class UnauthorizedError extends BaseError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', 401, true, message);
  }
}

/**
 * Forbidden error - user authenticated but lacks permission
 */
export class ForbiddenError extends BaseError {
  constructor(action: string, resource?: string) {
    const message = resource
      ? `You don't have permission to ${action} ${resource}`
      : `You don't have permission to ${action}`;
    super('FORBIDDEN', 403, true, message);
    this.action = action;
    this.resource = resource;
  }

  public action: string;
  public resource?: string;
}

/**
 * Conflict error - request conflicts with current state
 */
export class ConflictError extends BaseError {
  constructor(message: string, conflictingResource?: string) {
    super('CONFLICT', 409, true, message);
    this.conflictingResource = conflictingResource;
  }

  public conflictingResource?: string;
}

/**
 * Rate limit error - too many requests
 */
export class RateLimitError extends BaseError {
  constructor(
    retryAfter?: number,
    message: string = 'Too many requests. Please try again later.'
  ) {
    super('RATE_LIMIT', 429, true, message);
    this.retryAfter = retryAfter;
  }

  public retryAfter?: number; // Seconds until retry is allowed
}

/**
 * Bad request error - general client error
 */
export class BadRequestError extends BaseError {
  constructor(message: string, details?: unknown) {
    super('BAD_REQUEST', 400, true, message);
    this.details = details;
  }

  public details?: unknown;
}

/**
 * Service unavailable error - temporary server issue
 */
export class ServiceUnavailableError extends BaseError {
  constructor(
    service: string,
    retryAfter?: number,
    message?: string
  ) {
    const defaultMessage = message || `${service} is temporarily unavailable. Please try again later.`;
    super('SERVICE_UNAVAILABLE', 503, true, defaultMessage);
    this.service = service;
    this.retryAfter = retryAfter;
  }

  public service: string;
  public retryAfter?: number;
}

/**
 * External service error - third-party API failure
 */
export class ExternalServiceError extends BaseError {
  constructor(
    service: string,
    originalError?: unknown,
    message?: string
  ) {
    const defaultMessage = message || `External service '${service}' encountered an error`;
    super('EXTERNAL_SERVICE_ERROR', 502, true, defaultMessage);
    this.service = service;
    this.originalError = originalError;
  }

  public service: string;
  public originalError?: unknown;
}

/**
 * Timeout error - operation took too long
 */
export class TimeoutError extends BaseError {
  constructor(
    operation: string,
    timeoutMs: number,
    message?: string
  ) {
    const defaultMessage = message || `Operation '${operation}' timed out after ${timeoutMs}ms`;
    super('TIMEOUT', 504, true, defaultMessage);
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }

  public operation: string;
  public timeoutMs: number;
}

/**
 * Type guards for operational errors
 */
export const isValidationError = (error: unknown): error is ValidationError => {
  return error instanceof ValidationError;
};

export const isNotFoundError = (error: unknown): error is NotFoundError => {
  return error instanceof NotFoundError;
};

export const isUnauthorizedError = (error: unknown): error is UnauthorizedError => {
  return error instanceof UnauthorizedError;
};

export const isForbiddenError = (error: unknown): error is ForbiddenError => {
  return error instanceof ForbiddenError;
};

export const isConflictError = (error: unknown): error is ConflictError => {
  return error instanceof ConflictError;
};

export const isRateLimitError = (error: unknown): error is RateLimitError => {
  return error instanceof RateLimitError;
};

export const isOperationalError = (error: unknown): boolean => {
  return error instanceof BaseError && error.isOperational;
};