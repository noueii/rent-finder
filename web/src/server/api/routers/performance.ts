import { createTRPCRouter, publicProcedure } from '../trpc';
import { 
  performanceMonitor, 
  QueryPerformanceTracker, 
  MemoryMonitor, 
  SystemHealthChecker 
} from '../../../lib/performance';
import { cacheService, cacheKeys, cacheMetrics } from '../../../lib/cache';
import { z } from 'zod';

export const performanceRouter = createTRPCRouter({
  /**
   * Get performance metrics
   */
  getMetrics: publicProcedure
    .query(async () => {
      const allMetrics = performanceMonitor.getAllMetrics();
      const queryStats = QueryPerformanceTracker.getStats();
      const memoryUsage = MemoryMonitor.getFormattedUsage();
      const cacheStats = cacheMetrics.getStats();

      return {
        apiMetrics: allMetrics,
        queryStats,
        memoryUsage,
        cacheStats,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Get slow queries
   */
  getSlowQueries: publicProcedure
    .input(z.object({
      threshold: z.number().default(100),
    }))
    .query(async ({ input }) => {
      return QueryPerformanceTracker.getSlowQueries(input.threshold);
    }),

  /**
   * System health check
   */
  healthCheck: publicProcedure
    .query(async () => {
      return SystemHealthChecker.checkHealth();
    }),

  /**
   * Clear performance metrics
   */
  clearMetrics: publicProcedure
    .mutation(async () => {
      performanceMonitor.clear();
      cacheMetrics.reset();
      return { success: true };
    }),

  /**
   * Get cache statistics
   */
  getCacheStats: publicProcedure
    .query(async () => {
      return {
        ...cacheMetrics.getStats(),
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Clear cache
   */
  clearCache: publicProcedure
    .mutation(async () => {
      await cacheService.clear();
      return { success: true };
    }),

  /**
   * Database statistics
   */
  getDatabaseStats: publicProcedure
    .query(async ({ ctx }) => {
      const [
        stationCount,
        apartmentCount,
        searchCount,
        recentSearches,
      ] = await Promise.all([
        ctx.db.station.count(),
        ctx.db.apartment.count(),
        ctx.db.search.count(),
        ctx.db.search.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            targetStationName: true,
            maxCommuteMinutes: true,
            totalResults: true,
            searchDurationMs: true,
            createdAt: true,
          },
        }),
      ]);

      return {
        counts: {
          stations: stationCount,
          apartments: apartmentCount,
          searches: searchCount,
        },
        recentSearches,
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Get search analytics
   */
  getSearchAnalytics: publicProcedure
    .input(z.object({
      days: z.number().default(7),
    }))
    .query(async ({ input, ctx }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const [
        totalSearches,
        avgSearchDuration,
        popularStations,
        searchesByDay,
      ] = await Promise.all([
        ctx.db.search.count({
          where: { createdAt: { gte: since } },
        }),
        ctx.db.search.aggregate({
          where: { 
            createdAt: { gte: since },
            searchDurationMs: { not: null },
          },
          _avg: { searchDurationMs: true },
        }),
        ctx.db.search.groupBy({
          by: ['targetStationName'],
          where: { createdAt: { gte: since } },
          _count: true,
          orderBy: { _count: { targetStationName: 'desc' } },
          take: 10,
        }),
        ctx.db.search.findMany({
          where: { createdAt: { gte: since } },
          select: {
            createdAt: true,
            searchDurationMs: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
      ]);

      // Group searches by day
      const searchesByDayMap = new Map<string, number>();
      searchesByDay.forEach(search => {
        const day = search.createdAt.toISOString().split('T')[0];
        searchesByDayMap.set(day, (searchesByDayMap.get(day) || 0) + 1);
      });

      return {
        totalSearches,
        avgSearchDuration: avgSearchDuration._avg.searchDurationMs || 0,
        popularStations: popularStations.map(s => ({
          station: s.targetStationName,
          count: s._count,
        })),
        searchesByDay: Array.from(searchesByDayMap.entries()).map(([day, count]) => ({
          day,
          count,
        })),
        timestamp: new Date().toISOString(),
      };
    }),

  /**
   * Benchmark search performance
   */
  benchmarkSearch: publicProcedure
    .input(z.object({
      stationId: z.string(),
      maxMinutes: z.number().default(30),
      iterations: z.number().default(10),
    }))
    .mutation(async ({ input, ctx }) => {
      const { stationId, maxMinutes, iterations } = input;
      const results: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        // Simulate the search process
        try {
          // This would call your actual search logic
          // For now, we'll just simulate some work
          await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
          
          const duration = Date.now() - start;
          results.push(duration);
        } catch (error) {
          console.error('Benchmark iteration failed:', error);
        }
      }

      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      const min = Math.min(...results);
      const max = Math.max(...results);

      return {
        iterations,
        results: {
          avg,
          min,
          max,
          all: results,
        },
        timestamp: new Date().toISOString(),
      };
    }),
});