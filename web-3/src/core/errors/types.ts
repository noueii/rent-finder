/**
 * Error handling type definitions
 * Based on contracts in REFACTOR-CONTRACTS.md
 */

export interface ErrorHandler {
  handle(error: unknown, context?: ErrorContext): ErrorResponse;
  log(error: unknown, context?: ErrorContext): void;
  isOperational(error: Error): boolean;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  operation?: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
  stack?: string; // Only in development
}

export class BaseError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public isOperational: boolean = true,
    message?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}