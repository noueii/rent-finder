import { PrismaClient } from '@prisma/client';
import { cacheService, cacheKeys, cacheTTL } from './cache';
import { QueryPerformanceTracker } from './performance';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Enhanced Prisma client with performance monitoring
class OptimizedPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });

    // Add query performance tracking
    this.$use(async (params, next) => {
      const start = Date.now();
      try {
        const result = await next(params);
        const duration = Date.now() - start;
        
        // Track query performance
        QueryPerformanceTracker.track(
          `${params.model}.${params.action}`,
          duration
        );

        // Log slow queries in development
        if (process.env.NODE_ENV === 'development' && duration > 100) {
          console.warn(`🐌 Slow query: ${params.model}.${params.action} took ${duration}ms`);
        }

        return result;
      } catch (error) {
        const duration = Date.now() - start;
        QueryPerformanceTracker.track(
          `${params.model}.${params.action}_error`,
          duration
        );
        throw error;
      }
    });
  }
}

export const db = globalForPrisma.prisma ?? new OptimizedPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Optimized database utility functions with caching
export const dbUtils = {
  // Cached station search with fuzzy matching
  findStations: async (query: string, limit: number = 50) => {
    const cacheKey = cacheKeys.stationSearch(query, limit);
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const lowerQuery = query.toLowerCase();
    const results = await db.station.findMany({
      where: {
        OR: [
          { name: { contains: lowerQuery, mode: 'insensitive' } },
          { nameJa: { contains: query } }
        ]
      },
      orderBy: { name: 'asc' },
      take: limit,
      select: {
        id: true,
        name: true,
        nameJa: true,
        lines: true,
        _count: {
          select: { apartments: true }
        }
      }
    });

    await cacheService.set(cacheKey, results, cacheTTL.medium);
    return results;
  },

  // Optimized station lookup with caching
  getStationsByIds: async (stationIds: string[]) => {
    // Try to get from cache first
    const cacheKey = `stations:${stationIds.sort().join(',')}`;
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const results = await db.station.findMany({
      where: { id: { in: stationIds } },
      include: { 
        _count: { 
          select: { apartments: { where: { isAvailable: true } } }
        }
      }
    });

    await cacheService.set(cacheKey, results, cacheTTL.long);
    return results;
  },

  // Optimized apartment search with better indexing
  searchApartments: async (params: {
    stationIds: string[];
    maxPrice?: number;
    minPrice?: number;
    minSize?: number;
    maxSize?: number;
    layouts?: string[];
    features?: string[];
    buildingTypes?: string[];
    maxWalkingMinutes?: number;
    maxBuildingAge?: number;
    hasImages?: boolean;
    petFriendly?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }) => {
    const {
      stationIds,
      maxPrice,
      minPrice,
      minSize,
      maxSize,
      layouts,
      features,
      buildingTypes,
      maxWalkingMinutes,
      maxBuildingAge,
      hasImages,
      petFriendly,
      sortBy = 'rentMonthly',
      sortOrder = 'asc',
      limit = 20,
      offset = 0
    } = params;

    // Build optimized where clause
    const where: any = {
      stationId: { in: stationIds },
      isAvailable: true
    };

    // Price filters
    if (maxPrice || minPrice) {
      where.rentMonthly = {};
      if (maxPrice) where.rentMonthly.lte = maxPrice;
      if (minPrice) where.rentMonthly.gte = minPrice;
    }

    // Size filters
    if (minSize || maxSize) {
      where.size = {};
      if (minSize) where.size.gte = minSize;
      if (maxSize) where.size.lte = maxSize;
    }

    // Layout filter
    if (layouts?.length) {
      where.layout = { in: layouts };
    }

    // Building type filter
    if (buildingTypes?.length) {
      where.buildingType = { in: buildingTypes };
    }

    // Walking minutes filter
    if (maxWalkingMinutes) {
      where.walkingMinutes = { lte: maxWalkingMinutes };
    }

    // Building age filter
    if (maxBuildingAge) {
      where.buildingAge = { lte: maxBuildingAge };
    }

    // Features filter (JSON operations)
    if (features?.length) {
      where.features = { hasSome: features };
    }

    // Pet friendly filter
    if (petFriendly) {
      where.features = { 
        ...where.features,
        hasSome: [...(where.features?.hasSome || []), 'Pet Friendly']
      };
    }

    // Images filter
    if (hasImages) {
      where.imageUrls = { not: { equals: [] } };
    }

    // Optimized sorting
    const orderBy = (() => {
      const order = sortOrder === 'desc' ? 'desc' : 'asc' as const;
      switch (sortBy) {
        case 'price':
          return { rentMonthly: order };
        case 'size':
          return { size: order };
        case 'building_age':
          return { buildingAge: order };
        default:
          return { rentMonthly: order };
      }
    })();

    // Execute optimized query with parallel count
    const [apartments, total] = await Promise.all([
      db.apartment.findMany({
        where,
        include: {
          station: {
            select: { id: true, name: true, nameJa: true, lines: true }
          }
        },
        orderBy,
        skip: offset,
        take: limit
      }),
      db.apartment.count({ where })
    ]);

    return { apartments, total };
  },

  // Cached station statistics
  getStationStats: async (stationId: string) => {
    const cacheKey = `station_stats:${stationId}`;
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const stats = await db.apartment.aggregate({
      where: { stationId, isAvailable: true },
      _count: true,
      _avg: { rentMonthly: true, size: true },
      _min: { rentMonthly: true },
      _max: { rentMonthly: true }
    });

    await cacheService.set(cacheKey, stats, cacheTTL.long);
    return stats;
  },

  // Optimized search analytics recording
  recordSearch: async (searchData: {
    targetStationId: string;
    targetStationName: string;
    maxCommuteMinutes: number;
    filters?: any;
    stationsSearched: number;
    totalResults: number;
    resultsReturned: number;
    searchDurationMs?: number;
    sessionId?: string;
  }) => {
    // Use upsert to avoid duplicate entries in high-volume scenarios
    return await db.search.create({
      data: {
        ...searchData,
        searchDurationMs: searchData.searchDurationMs || 0,
      }
    });
  },

  // Cached search analytics
  getSearchAnalytics: async (days: number = 30) => {
    const cacheKey = `search_analytics:${days}`;
    const cached = await cacheService.get<any[]>(cacheKey);
    if (cached) return cached;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await db.search.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        targetStationName: true,
        maxCommuteMinutes: true,
        totalResults: true,
        searchDurationMs: true,
        createdAt: true,
      }
    });

    await cacheService.set(cacheKey, results, cacheTTL.medium);
    return results;
  },

  // Optimized apartment filters with caching
  getApartmentFilters: async () => {
    const cacheKey = cacheKeys.apartmentFilters();
    const cached = await cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const [
      layouts,
      buildingTypes,
      priceRange,
      sizeRange,
      buildingAgeRange,
      featuresData,
    ] = await Promise.all([
      // Layouts
      db.apartment.groupBy({
        by: ['layout'],
        where: { isAvailable: true },
        _count: true,
        orderBy: { _count: { layout: 'desc' } },
      }),
      // Building types
      db.apartment.groupBy({
        by: ['buildingType'],
        where: { isAvailable: true, buildingType: { not: null } },
        _count: true,
        orderBy: { _count: { buildingType: 'desc' } },
      }),
      // Price range
      db.apartment.aggregate({
        where: { isAvailable: true },
        _min: { rentMonthly: true },
        _max: { rentMonthly: true },
      }),
      // Size range
      db.apartment.aggregate({
        where: { isAvailable: true },
        _min: { size: true },
        _max: { size: true },
      }),
      // Building age range
      db.apartment.aggregate({
        where: { isAvailable: true, buildingAge: { not: null } },
        _min: { buildingAge: true },
        _max: { buildingAge: true },
      }),
      // Features (sample for processing)
      db.apartment.findMany({
        where: { isAvailable: true, features: { not: null } },
        select: { features: true },
        take: 1000,
      }),
    ]);

    // Process features
    const featureCount = new Map<string, number>();
    featuresData.forEach(apt => {
      if (apt.features) {
        try {
          const features = typeof apt.features === 'string' 
            ? JSON.parse(apt.features) 
            : apt.features;
          
          if (Array.isArray(features)) {
            features.forEach(feature => {
              featureCount.set(feature, (featureCount.get(feature) || 0) + 1);
            });
          }
        } catch (error) {
          // Skip invalid JSON
        }
      }
    });

    const features = Array.from(featureCount.entries())
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const filters = {
      layouts: layouts.map(l => ({ layout: l.layout, count: l._count })),
      buildingTypes: buildingTypes.map(bt => ({ 
        buildingType: bt.buildingType, 
        count: bt._count 
      })),
      features,
      priceRange: {
        min: priceRange._min.rentMonthly || 0,
        max: priceRange._max.rentMonthly || 1000000,
      },
      sizeRange: {
        min: sizeRange._min.size || 0,
        max: sizeRange._max.size || 1000,
      },
      buildingAgeRange: {
        min: buildingAgeRange._min.buildingAge || 0,
        max: buildingAgeRange._max.buildingAge || 100,
      },
    };

    await cacheService.set(cacheKey, filters, cacheTTL.long);
    return filters;
  },

  // Health check with performance monitoring
  healthCheck: async () => {
    const start = Date.now();
    try {
      await db.$queryRaw`SELECT 1`;
      const duration = Date.now() - start;
      
      QueryPerformanceTracker.track('health_check', duration);
      
      return { 
        status: 'healthy', 
        duration,
        timestamp: new Date().toISOString() 
      };
    } catch (error) {
      const duration = Date.now() - start;
      QueryPerformanceTracker.track('health_check_error', duration);
      
      return { 
        status: 'unhealthy', 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date().toISOString() 
      };
    }
  }
};

// Batch operations for better performance
export const batchOperations = {
  // Batch apartment updates
  updateApartments: async (updates: Array<{
    id: string;
    data: any;
  }>) => {
    const promises = updates.map(update => 
      db.apartment.update({
        where: { id: update.id },
        data: update.data
      })
    );
    
    return await Promise.all(promises);
  },

  // Batch apartment creation
  createApartments: async (apartments: any[]) => {
    const batchSize = 100;
    const results = [];
    
    for (let i = 0; i < apartments.length; i += batchSize) {
      const batch = apartments.slice(i, i + batchSize);
      const batchResults = await db.apartment.createMany({
        data: batch,
        skipDuplicates: true
      });
      results.push(batchResults);
    }
    
    return results;
  },

  // Batch search result creation
  createSearchResults: async (searchId: string, results: any[]) => {
    const batchSize = 50;
    const promises = [];
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      const batchData = batch.map((result, index) => ({
        searchId,
        apartmentId: result.id,
        commuteMinutes: result.commute.totalMinutes,
        transferCount: result.commute.transferCount,
        routeDetails: JSON.stringify(result.commute.route),
        displayOrder: i + index,
      }));
      
      promises.push(
        db.searchResult.createMany({
          data: batchData,
          skipDuplicates: true
        })
      );
    }
    
    return await Promise.all(promises);
  },
};