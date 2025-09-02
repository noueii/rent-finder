/**
 * Common Domain Types
 * 
 * Shared type definitions used across the domain layer.
 */

/**
 * Unique identifier type
 */
export type ID = string;

/**
 * Timestamp type
 */
export type Timestamp = Date;

/**
 * URL type for type safety
 */
export type URL = string;

/**
 * Coordinate pair for geographic locations
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Time range for filtering
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Price range for filtering
 */
export interface PriceRange {
  min?: number;
  max?: number;
}

/**
 * Size range for filtering (in square meters)
 */
export interface SizeRange {
  min?: number;
  max?: number;
}

/**
 * Generic result wrapper
 */
export interface Result<T, E = Error> {
  success: boolean;
  data?: T;
  error?: E;
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{
    item: T;
    error: Error;
  }>;
  totalProcessed: number;
  successCount: number;
  failureCount: number;
}