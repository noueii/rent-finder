/**
 * Prisma Base Repository Implementation
 * 
 * Generic repository implementation that works with any Prisma model.
 * Provides CRUD operations, pagination, filtering, sorting, and transactions.
 * Maps Prisma types to domain types to prevent leakage.
 */

import { PrismaClient, Prisma } from '@prisma/client';
import type { 
  BaseRepository,
  CreateInput,
  UpdateInput,
  PaginatedResult,
  QueryOptions,
  Filter,
  WhereCondition,
  OrderBy
} from '~/domain/repositories/base';
import type { WhereClause } from '~/domain/types/repository';
import { 
  NotFoundError, 
  ValidationError,
  ConflictError,
  ServiceUnavailableError
} from '~/core/errors/operational-errors';
import { errorHandler } from '~/core/errors/error-handler';
import { logger as baseLogger, createLogger } from '~/lib/logging';

const logger = createLogger('prisma-repository');

/**
 * Type to extract Prisma model delegate type
 */
type PrismaModelDelegate = {
  findUnique: Function;
  findFirst: Function;
  findMany: Function;
  create: Function;
  update: Function;
  delete: Function;
  count: Function;
};

/**
 * Generic Prisma repository implementation
 * @template T - Domain entity type
 * @template M - Prisma model type
 */
export abstract class PrismaBaseRepository<T extends { id: string }, M = T> 
  implements BaseRepository<T> {
  
  protected readonly prisma: PrismaClient;
  protected abstract readonly modelName: Prisma.ModelName;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Get the Prisma model delegate for this repository
   */
  protected get model(): PrismaModelDelegate {
    return (this.prisma as any)[this.modelName];
  }

  /**
   * Map Prisma model to domain entity
   * Override this to handle complex mappings
   */
  protected abstract toDomain(model: M): T;

  /**
   * Map domain entity to Prisma model data
   * Override this to handle complex mappings
   */
  protected abstract toPrisma(entity: Partial<T>): any;

  /**
   * Find an entity by its unique identifier
   */
  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.model.findUnique({
        where: { id }
      });

      return result ? this.toDomain(result) : null;
    } catch (error) {
      throw this.handlePrismaError(error, 'findById');
    }
  }

  /**
   * Find multiple entities with filtering and pagination
   */
  async findMany(filter: Filter<T>, options: QueryOptions = {}): Promise<PaginatedResult<T>> {
    try {
      const { page = 1, limit = 20, orderBy, include } = options;
      const skip = (page - 1) * limit;

      // Build where clause
      const where = this.buildWhereClause(filter);

      // Execute queries in parallel
      const [data, total] = await Promise.all([
        this.model.findMany({
          where,
          skip,
          take: limit,
          orderBy: this.buildOrderBy(orderBy),
          include: this.buildInclude(include)
        }),
        this.model.count({ where })
      ]);

      return {
        data: data.map((item: M) => this.toDomain(item)),
        total,
        page,
        limit,
        hasMore: total > page * limit
      };
    } catch (error) {
      throw this.handlePrismaError(error, 'findMany');
    }
  }

  /**
   * Find a single entity matching the filter
   */
  async findOne(filter: Filter<T>): Promise<T | null> {
    try {
      const where = this.buildWhereClause(filter);
      const result = await this.model.findFirst({ where });

      return result ? this.toDomain(result) : null;
    } catch (error) {
      throw this.handlePrismaError(error, 'findOne');
    }
  }

  /**
   * Create a new entity
   */
  async create(data: CreateInput<T>): Promise<T> {
    try {
      const prismaData = this.toPrisma(data as Partial<T>);
      const result = await this.model.create({
        data: prismaData
      });

      return this.toDomain(result);
    } catch (error) {
      throw this.handlePrismaError(error, 'create');
    }
  }

  /**
   * Update an existing entity
   */
  async update(id: string, data: UpdateInput<T>): Promise<T> {
    try {
      const prismaData = this.toPrisma(data as Partial<T>);
      
      const result = await this.model.update({
        where: { id },
        data: prismaData
      });

      return this.toDomain(result);
    } catch (error) {
      // Check if it's a not found error
      if (this.isPrismaNotFoundError(error)) {
        throw new NotFoundError(this.modelName, id);
      }
      throw this.handlePrismaError(error, 'update');
    }
  }

  /**
   * Delete an entity
   */
  async delete(id: string): Promise<void> {
    try {
      await this.model.delete({
        where: { id }
      });
    } catch (error) {
      // Check if it's a not found error
      if (this.isPrismaNotFoundError(error)) {
        throw new NotFoundError(this.modelName, id);
      }
      throw this.handlePrismaError(error, 'delete');
    }
  }

  /**
   * Check if any entities exist matching the filter
   */
  async exists(filter: Filter<T>): Promise<boolean> {
    try {
      const where = this.buildWhereClause(filter);
      const count = await this.model.count({ where });
      return count > 0;
    } catch (error) {
      throw this.handlePrismaError(error, 'exists');
    }
  }

  /**
   * Count entities matching the filter
   */
  async count(filter: Filter<T>): Promise<number> {
    try {
      const where = this.buildWhereClause(filter);
      return await this.model.count({ where });
    } catch (error) {
      throw this.handlePrismaError(error, 'count');
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async transaction<R>(work: (repo: this) => Promise<R>): Promise<R> {
    return await this.prisma.$transaction(async (tx) => {
      // Create a new instance of this repository with the transaction client
      const txRepo = Object.create(this);
      txRepo.prisma = tx;
      return await work(txRepo);
    });
  }

  /**
   * Build Prisma where clause from our filter type
   */
  protected buildWhereClause(filter: Filter<T>): any {
    const { where, ...simpleFilters } = filter;
    
    const prismaWhere: any = {};

    // Apply simple filters
    Object.entries(simpleFilters).forEach(([key, value]) => {
      if (value !== undefined) {
        prismaWhere[key] = value;
      }
    });

    // Apply advanced where conditions
    if (where) {
      Object.assign(prismaWhere, this.convertWhereCondition(where));
    }

    return prismaWhere;
  }

  /**
   * Convert our WhereCondition to Prisma format
   */
  protected convertWhereCondition(where: WhereCondition<T>): any {
    const prismaWhere: any = {};

    // Handle logical operators
    if (where.AND) {
      prismaWhere.AND = where.AND.map(condition => this.convertWhereCondition(condition));
    }
    if (where.OR) {
      prismaWhere.OR = where.OR.map(condition => this.convertWhereCondition(condition));
    }
    if (where.NOT) {
      prismaWhere.NOT = this.convertWhereCondition(where.NOT);
    }

    // Handle field-level conditions
    Object.entries(where).forEach(([key, value]) => {
      if (['AND', 'OR', 'NOT'].includes(key)) return;

      if (this.isWhereClause(value)) {
        prismaWhere[key] = this.convertWhereClause(value);
      } else {
        prismaWhere[key] = value;
      }
    });

    return prismaWhere;
  }

  /**
   * Convert our WhereClause to Prisma format
   */
  protected convertWhereClause(clause: WhereClause<any>): any {
    const prismaClause: any = {};

    if (clause.equals !== undefined) prismaClause.equals = clause.equals;
    if (clause.not !== undefined) prismaClause.not = clause.not;
    if (clause.in !== undefined) prismaClause.in = clause.in;
    if (clause.notIn !== undefined) prismaClause.notIn = clause.notIn;
    if (clause.lt !== undefined) prismaClause.lt = clause.lt;
    if (clause.lte !== undefined) prismaClause.lte = clause.lte;
    if (clause.gt !== undefined) prismaClause.gt = clause.gt;
    if (clause.gte !== undefined) prismaClause.gte = clause.gte;
    if (clause.contains !== undefined) prismaClause.contains = clause.contains;
    if (clause.startsWith !== undefined) prismaClause.startsWith = clause.startsWith;
    if (clause.endsWith !== undefined) prismaClause.endsWith = clause.endsWith;

    return prismaClause;
  }

  /**
   * Build Prisma orderBy from our OrderBy type
   */
  protected buildOrderBy(orderBy?: OrderBy): any {
    if (!orderBy) return undefined;

    return Object.entries(orderBy).map(([field, direction]) => ({
      [field]: direction
    }));
  }

  /**
   * Build Prisma include from array of relation names
   */
  protected buildInclude(include?: string[]): any {
    if (!include || include.length === 0) return undefined;

    return include.reduce((acc, relation) => {
      acc[relation] = true;
      return acc;
    }, {} as Record<string, boolean>);
  }

  /**
   * Type guard for WhereClause
   */
  protected isWhereClause(value: any): value is WhereClause<any> {
    if (typeof value !== 'object' || value === null) return false;
    
    const clauseKeys = ['equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte', 'contains', 'startsWith', 'endsWith'];
    return Object.keys(value).some(key => clauseKeys.includes(key));
  }

  /**
   * Check if error is a Prisma not found error
   */
  protected isPrismaNotFoundError(error: any): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && 
           error.code === 'P2025';
  }

  /**
   * Handle Prisma errors and convert to domain errors
   */
  protected handlePrismaError(error: any, operation: string): Error {
    logger.error({ error, operation, model: this.modelName }, 'Prisma operation failed');

    // Prisma known request errors
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002': // Unique constraint violation
          return new ConflictError(`A ${this.modelName} with these values already exists`);
        case 'P2003': // Foreign key constraint violation
          return new ValidationError('Related entity does not exist');
        case 'P2025': // Record not found
          return new NotFoundError(this.modelName);
        default:
          return new ValidationError(`Database operation failed: ${error.message}`);
      }
    }

    // Prisma validation errors
    if (error instanceof Prisma.PrismaClientValidationError) {
      return new ValidationError('Invalid data provided');
    }

    // Connection errors
    if (error instanceof Prisma.PrismaClientInitializationError) {
      return new ServiceUnavailableError('Database', undefined, 'Unable to connect to database');
    }

    // Default to error handler
    return errorHandler.handle(error, { 
      operation
    }) as any;
  }
}

/**
 * Simple implementation for entities that map 1:1 with Prisma models
 */
export class SimplePrismaRepository<T extends { id: string }> extends PrismaBaseRepository<T, T> {
  protected readonly modelName: Prisma.ModelName;
  
  constructor(prisma: PrismaClient, modelName: Prisma.ModelName) {
    super(prisma);
    this.modelName = modelName;
  }

  protected toDomain(model: T): T {
    return model;
  }

  protected toPrisma(entity: Partial<T>): any {
    return entity;
  }
}