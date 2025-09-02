/**
 * Core infrastructure exports
 */

// Export everything from errors except ValidationError
export {
  // Error handler
  ErrorHandler,
  errorHandler,
  handleError,
  logAndHandleError,
  // Base errors
  BaseError,
  // Operational errors (excluding ValidationError to avoid conflict)
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  // Types
  type IErrorHandler,
  type ErrorContext,
  type ErrorResponse
} from './errors';

// Export ValidationError class as ValidationErrorClass
export { ValidationError as ValidationErrorClass } from './errors/operational-errors';

// Export validation (includes ValidationError interface)
export * from './validation';

// Export dependency injection
export * from './di';

// Export type utilities
export * from './types';

// Export logging
export * from './logging';

// Export testing infrastructure (only in test environment)
if (process.env.NODE_ENV === 'test') {
  module.exports.testing = require('./testing');
}