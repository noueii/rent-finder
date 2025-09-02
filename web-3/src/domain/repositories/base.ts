/**
 * Base Repository Interface
 * 
 * Provides common data access patterns for all entities.
 * This interface ensures consistent data access across the application
 * while keeping the domain layer independent of persistence details.
 */

import type { 
  PaginatedResult, 
  QueryOptions, 
  Filter, 
  OrderBy,
  WhereCondition 
} from '../types/repository';

/**
 * Input type for creating entities - omits generated fields
 */
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Input type for updating entities - all fields optional except id
 */
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Base repository interface that all domain repositories must implement
 * @template T - The entity type, must have an id field
 */
export interface BaseRepository<T extends { id: string }> {
  /**
   * Find an entity by its unique identifier
   * @param id - The entity's unique identifier
   * @returns The entity if found, null otherwise
   */
  findById(id: string): Promise<T | null>;

  /**
   * Find multiple entities with filtering and pagination
   * @param filter - Filtering conditions
   * @param options - Query options (pagination, sorting, includes)
   * @returns Paginated result with entities and metadata
   */
  findMany(filter: Filter<T>, options?: QueryOptions): Promise<PaginatedResult<T>>;

  /**
   * Find a single entity matching the filter
   * @param filter - Filtering conditions
   * @returns The first matching entity or null
   */
  findOne(filter: Filter<T>): Promise<T | null>;

  /**
   * Create a new entity
   * @param data - Entity data without generated fields
   * @returns The created entity with all fields
   */
  create(data: CreateInput<T>): Promise<T>;

  /**
   * Update an existing entity
   * @param id - The entity's unique identifier
   * @param data - Partial entity data to update
   * @returns The updated entity
   * @throws NotFoundError if entity doesn't exist
   */
  update(id: string, data: UpdateInput<T>): Promise<T>;

  /**
   * Delete an entity
   * @param id - The entity's unique identifier
   * @throws NotFoundError if entity doesn't exist
   */
  delete(id: string): Promise<void>;

  /**
   * Check if any entities exist matching the filter
   * @param filter - Filtering conditions
   * @returns True if at least one entity exists
   */
  exists(filter: Filter<T>): Promise<boolean>;

  /**
   * Count entities matching the filter
   * @param filter - Filtering conditions
   * @returns The count of matching entities
   */
  count(filter: Filter<T>): Promise<number>;

  /**
   * Execute multiple operations in a transaction
   * @param work - Function containing transactional operations
   * @returns The result of the transaction
   */
  transaction<R>(work: (repo: this) => Promise<R>): Promise<R>;
}

// Re-export types for convenience
export type { PaginatedResult, QueryOptions, Filter, OrderBy, WhereCondition };