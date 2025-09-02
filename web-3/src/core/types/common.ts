/**
 * Common type definitions used throughout the application
 * Based on contracts in REFACTOR-CONTRACTS.md
 */

// Primitive type aliases for better semantics
export type ID = string;
export type Timestamp = Date;
export type URL = string;

// Geographic types
export interface Coordinates {
  latitude: number;
  longitude: number;
}

// Time-related types
export interface TimeRange {
  start: Date;
  end: Date;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// Result type for operations that can fail
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Async result type
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

// Common query/filter types
export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Generic key-value type
export type Dictionary<T = unknown> = Record<string, T>;