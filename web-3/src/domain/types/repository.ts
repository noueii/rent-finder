/**
 * Repository Type Definitions
 * 
 * Common types used across all repository interfaces.
 * These types define the contract for data access patterns.
 */

/**
 * Pagination and query options
 */
export interface QueryOptions {
  /** Current page number (1-based) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Sorting configuration */
  orderBy?: OrderBy;
  /** Relations to include */
  include?: string[];
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Array of entities for current page */
  data: T[];
  /** Total number of entities matching the filter */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Whether more pages exist */
  hasMore: boolean;
}

/**
 * Flexible filtering interface
 */
export type Filter<T> = Partial<T> & {
  /** Advanced where conditions */
  where?: WhereCondition<T>;
};

/**
 * Sorting configuration
 */
export type OrderBy = Record<string, 'asc' | 'desc'>;

/**
 * Advanced where conditions for filtering
 */
export type WhereCondition<T> = {
  /** AND conditions - all must match */
  AND?: WhereCondition<T>[];
  /** OR conditions - at least one must match */
  OR?: WhereCondition<T>[];
  /** NOT condition - must not match */
  NOT?: WhereCondition<T>;
} & {
  [K in keyof T]?: T[K] | WhereClause<T[K]>;
};

/**
 * Where clause operators for field-level filtering
 */
export interface WhereClause<T> {
  /** Equals */
  equals?: T;
  /** Not equals */
  not?: T;
  /** In array */
  in?: T[];
  /** Not in array */
  notIn?: T[];
  /** Less than */
  lt?: T;
  /** Less than or equal */
  lte?: T;
  /** Greater than */
  gt?: T;
  /** Greater than or equal */
  gte?: T;
  /** Contains (for strings) */
  contains?: string;
  /** Starts with (for strings) */
  startsWith?: string;
  /** Ends with (for strings) */
  endsWith?: string;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /** Isolation level for the transaction */
  isolationLevel?: 'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';
  /** Timeout in milliseconds */
  timeout?: number;
}

/**
 * Repository metadata
 */
export interface RepositoryMetadata {
  /** Entity name */
  entityName: string;
  /** Table/collection name */
  tableName: string;
  /** Primary key field */
  primaryKey: string;
}