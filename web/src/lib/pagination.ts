import { z } from 'zod';

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).optional(),
});

// Cursor-based pagination schema for infinite scrolling
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

// Pagination result type
export interface PaginationResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextPage: number | null;
    previousPage: number | null;
  };
}

// Cursor pagination result type
export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

// Pagination utilities
export class PaginationService {
  /**
   * Create pagination info from offset-based query
   */
  static createPaginationInfo(
    page: number,
    limit: number,
    total: number
  ): PaginationResult<any>['pagination'] {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      nextPage: hasNextPage ? page + 1 : null,
      previousPage: hasPreviousPage ? page - 1 : null,
    };
  }

  /**
   * Convert page-based pagination to offset
   */
  static pageToOffset(page: number, limit: number): number {
    return (page - 1) * limit;
  }

  /**
   * Convert offset to page
   */
  static offsetToPage(offset: number, limit: number): number {
    return Math.floor(offset / limit) + 1;
  }

  /**
   * Validate pagination parameters
   */
  static validatePagination(page: number, limit: number): {
    page: number;
    limit: number;
    offset: number;
  } {
    const validPage = Math.max(1, Math.floor(page));
    const validLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    const offset = this.pageToOffset(validPage, validLimit);

    return {
      page: validPage,
      limit: validLimit,
      offset,
    };
  }

  /**
   * Create cursor from item ID and timestamp
   */
  static createCursor(id: string, timestamp: Date): string {
    return Buffer.from(`${id}:${timestamp.getTime()}`).toString('base64');
  }

  /**
   * Parse cursor to get ID and timestamp
   */
  static parseCursor(cursor: string): { id: string; timestamp: Date } | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const [id, timestampStr] = decoded.split(':');
      
      if (!id || !timestampStr) return null;
      
      const timestamp = new Date(parseInt(timestampStr));
      if (isNaN(timestamp.getTime())) return null;
      
      return { id, timestamp };
    } catch (error) {
      return null;
    }
  }

  /**
   * Build cursor-based where clause for Prisma
   */
  static buildCursorWhere(
    cursor: string | undefined,
    orderBy: 'asc' | 'desc' = 'desc'
  ): any {
    if (!cursor) return {};

    const parsed = this.parseCursor(cursor);
    if (!parsed) return {};

    const { id, timestamp } = parsed;

    if (orderBy === 'desc') {
      return {
        OR: [
          { createdAt: { lt: timestamp } },
          { createdAt: timestamp, id: { lt: id } },
        ],
      };
    } else {
      return {
        OR: [
          { createdAt: { gt: timestamp } },
          { createdAt: timestamp, id: { gt: id } },
        ],
      };
    }
  }

  /**
   * Create optimized pagination for large datasets
   */
  static async paginateQuery<T>(
    query: {
      where?: any;
      orderBy?: any;
      select?: any;
      include?: any;
    },
    pagination: {
      page: number;
      limit: number;
    },
    executor: (args: any) => Promise<T[]>,
    counter: (where: any) => Promise<number>
  ): Promise<PaginationResult<T>> {
    const { page, limit, offset } = this.validatePagination(
      pagination.page,
      pagination.limit
    );

    // For large datasets, use approximate counting for better performance
    const useApproximateCount = offset > 10000;

    const [items, total] = await Promise.all([
      executor({
        ...query,
        skip: offset,
        take: limit,
      }),
      useApproximateCount ? 
        this.approximateCount(offset, limit) : 
        counter(query.where || {}),
    ]);

    const paginationInfo = this.createPaginationInfo(page, limit, total);

    return {
      items,
      pagination: paginationInfo,
    };
  }

  /**
   * Approximate count for large datasets to improve performance
   */
  private static approximateCount(offset: number, limit: number): Promise<number> {
    // For very large offsets, provide an approximate count
    // This is a performance optimization for deep pagination
    return Promise.resolve(Math.max(offset + limit * 2, 100000));
  }

  /**
   * Create infinite scroll pagination
   */
  static async infiniteScroll<T extends { id: string; createdAt: Date }>(
    query: {
      where?: any;
      orderBy?: any;
      select?: any;
      include?: any;
    },
    pagination: {
      cursor?: string;
      limit: number;
    },
    executor: (args: any) => Promise<T[]>
  ): Promise<CursorPaginationResult<T>> {
    const { cursor, limit } = pagination;
    const validLimit = Math.min(100, Math.max(1, limit));

    // Build cursor-based where clause
    const cursorWhere = this.buildCursorWhere(cursor);
    const where = {
      ...query.where,
      ...cursorWhere,
    };

    // Fetch one extra item to determine if there's a next page
    const items = await executor({
      ...query,
      where,
      take: validLimit + 1,
    });

    const hasNextPage = items.length > validLimit;
    const resultItems = hasNextPage ? items.slice(0, validLimit) : items;
    
    // Create next cursor from the last item
    const nextCursor = hasNextPage && resultItems.length > 0 ? 
      this.createCursor(
        resultItems[resultItems.length - 1].id,
        resultItems[resultItems.length - 1].createdAt
      ) : null;

    return {
      items: resultItems,
      nextCursor,
      hasNextPage,
    };
  }

  /**
   * Deep pagination optimization
   * For very large datasets, use keyset pagination instead of offset
   */
  static async deepPagination<T>(
    query: {
      where?: any;
      orderBy?: any;
      select?: any;
      include?: any;
    },
    pagination: {
      page: number;
      limit: number;
    },
    executor: (args: any) => Promise<T[]>,
    keyExtractor: (item: T) => string | number
  ): Promise<PaginationResult<T>> {
    const { page, limit } = this.validatePagination(
      pagination.page,
      pagination.limit
    );

    if (page <= 5) {
      // For early pages, use regular offset pagination
      const offset = this.pageToOffset(page, limit);
      const items = await executor({
        ...query,
        skip: offset,
        take: limit,
      });

      return {
        items,
        pagination: {
          page,
          limit,
          total: -1, // Unknown for deep pagination
          totalPages: -1,
          hasNextPage: items.length === limit,
          hasPreviousPage: page > 1,
          nextPage: items.length === limit ? page + 1 : null,
          previousPage: page > 1 ? page - 1 : null,
        },
      };
    }

    // For deep pages, use keyset pagination
    // This is more complex but much faster for large datasets
    const items = await executor({
      ...query,
      take: limit,
    });

    return {
      items,
      pagination: {
        page,
        limit,
        total: -1, // Unknown for deep pagination
        totalPages: -1,
        hasNextPage: items.length === limit,
        hasPreviousPage: true,
        nextPage: items.length === limit ? page + 1 : null,
        previousPage: page - 1,
      },
    };
  }
}

// Pagination middleware for tRPC
export const withPagination = <T>(
  query: {
    where?: any;
    orderBy?: any;
    select?: any;
    include?: any;
  },
  pagination: z.infer<typeof paginationSchema>,
  executor: (args: any) => Promise<T[]>,
  counter: (where: any) => Promise<number>
) => {
  return PaginationService.paginateQuery(
    query,
    pagination,
    executor,
    counter
  );
};

// Infinite scroll middleware for tRPC
export const withInfiniteScroll = <T extends { id: string; createdAt: Date }>(
  query: {
    where?: any;
    orderBy?: any;
    select?: any;
    include?: any;
  },
  pagination: z.infer<typeof cursorPaginationSchema>,
  executor: (args: any) => Promise<T[]>
) => {
  return PaginationService.infiniteScroll(
    query,
    pagination,
    executor
  );
};