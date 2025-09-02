/**
 * Core error handling utilities
 * 
 * This module provides centralized error handling for the entire application.
 * All errors should flow through these handlers for consistent logging and responses.
 */

// Export error types and interfaces
export type { ErrorHandler as IErrorHandler, ErrorContext, ErrorResponse } from './types';
export { BaseError } from './types';

// Export error handler implementation
export { ErrorHandler, errorHandler, handleError, logAndHandleError } from './error-handler';

// Export base error utilities
export * from './base-error';

// Export operational errors
export * from './operational-errors';