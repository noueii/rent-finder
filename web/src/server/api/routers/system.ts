import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { transitService } from '../../../services/transit-service';
import { createTRPCRouter, publicProcedure, cachedProcedure } from '../trpc';
import { healthCheckSchema } from '../schemas/search';

export const systemRouter = createTRPCRouter({
  /**
   * Health check endpoint
   */
  health: publicProcedure
    .input(healthCheckSchema)
    .query(async ({ input, ctx }) => {
      const checks: any = {
        api: { status: 'healthy', timestamp: new Date().toISOString() },
      };

      try {
        // Check database
        if (input.includeDatabase) {
          try {
            await ctx.db.$queryRaw`SELECT 1`;
            checks.database = { status: 'healthy', timestamp: new Date().toISOString() };
          } catch (error) {
            checks.database = { 
              status: 'unhealthy', 
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString() 
            };
          }
        }

        // Check transit service
        if (input.includeTransit) {
          try {
            const transitHealth = await transitService.healthCheck();
            checks.transit = { 
              ...transitHealth, 
              timestamp: new Date().toISOString() 
            };
          } catch (error) {
            checks.transit = { 
              status: 'unhealthy', 
              error: error instanceof Error ? error.message : 'Unknown error',
              timestamp: new Date().toISOString() 
            };
          }
        }

        const overallStatus = Object.values(checks).every(
          (check: any) => check.status === 'healthy'
        ) ? 'healthy' : 'unhealthy';

        return {
          status: overallStatus,
          timestamp: new Date().toISOString(),
          checks,
        };

      } catch (error) {
        console.error('Health check error:', error);
        return {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          checks,
        };
      }
    }),

  /**
   * Get system statistics
   */
  stats: cachedProcedure
    .query(async ({ ctx }) => {
      try {
        const [
          totalApartments,
          availableApartments,
          totalStations,
          totalSearches,
          recentSearches,
          topStations,
        ] = await Promise.all([
          ctx.db.apartment.count(),
          ctx.db.apartment.count({ where: { isAvailable: true } }),
          ctx.db.station.count(),
          ctx.db.search.count(),
          ctx.db.search.count({
            where: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          }),
          ctx.db.search.groupBy({
            by: ['targetStationId', 'targetStationName'],
            _count: { targetStationId: true },
            orderBy: { _count: { targetStationId: 'desc' } },
            take: 5,
          }),
        ]);

        return {
          apartments: {
            total: totalApartments,
            available: availableApartments,
            occupancyRate: totalApartments > 0 ? 
              ((totalApartments - availableApartments) / totalApartments * 100).toFixed(1) : 0,
          },
          stations: {
            total: totalStations,
          },
          searches: {
            total: totalSearches,
            recent: recentSearches,
            averagePerDay: totalSearches > 0 ? 
              (totalSearches / Math.max(1, Math.floor((Date.now() - new Date('2024-01-01').getTime()) / (24 * 60 * 60 * 1000)))).toFixed(1) : 0,
          },
          topStations: topStations.map(s => ({
            stationId: s.targetStationId,
            stationName: s.targetStationName,
            searchCount: s._count.targetStationId,
          })),
        };

      } catch (error) {
        console.error('System stats error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get system statistics',
        });
      }
    }),

  /**
   * Get search analytics
   */
  searchAnalytics: cachedProcedure
    .input(healthCheckSchema.pick({ includeDatabase: true }).extend({
      days: z.number().min(1).max(365).optional().default(7),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const since = new Date(Date.now() - (input.days || 7) * 24 * 60 * 60 * 1000);

        const [
          totalSearches,
          averageResultsPerSearch,
          averageSearchDuration,
          popularFilters,
          commuteTimeDistribution,
        ] = await Promise.all([
          ctx.db.search.count({
            where: { createdAt: { gte: since } },
          }),
          ctx.db.search.aggregate({
            where: { createdAt: { gte: since } },
            _avg: { totalResults: true, resultsReturned: true },
          }),
          ctx.db.search.aggregate({
            where: { 
              createdAt: { gte: since },
              searchDurationMs: { not: null },
            },
            _avg: { searchDurationMs: true },
          }),
          ctx.db.search.findMany({
            where: { 
              createdAt: { gte: since },
              filters: { not: null },
            },
            select: { filters: true },
            take: 1000,
          }).then(results => {
            const filterCount = new Map<string, number>();
            results.forEach(search => {
              const filters = search.filters as any;
              if (filters) {
                Object.keys(filters).forEach(key => {
                  if (filters[key] !== null && filters[key] !== undefined) {
                    filterCount.set(key, (filterCount.get(key) || 0) + 1);
                  }
                });
              }
            });
            return Array.from(filterCount.entries())
              .map(([filter, count]) => ({ filter, count }))
              .sort((a, b) => b.count - a.count);
          }),
          ctx.db.search.groupBy({
            by: ['maxCommuteMinutes'],
            where: { createdAt: { gte: since } },
            _count: true,
            orderBy: { maxCommuteMinutes: 'asc' },
          }),
        ]);

        return {
          period: {
            days: input.days || 7,
            from: since.toISOString(),
            to: new Date().toISOString(),
          },
          totalSearches,
          averageResults: {
            total: averageResultsPerSearch._avg.totalResults || 0,
            returned: averageResultsPerSearch._avg.resultsReturned || 0,
          },
          averageSearchDuration: averageSearchDuration._avg.searchDurationMs || 0,
          popularFilters: popularFilters.slice(0, 10),
          commuteTimeDistribution: commuteTimeDistribution.map(c => ({
            minutes: c.maxCommuteMinutes,
            count: c._count,
          })),
        };

      } catch (error) {
        console.error('Search analytics error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get search analytics',
        });
      }
    }),

  /**
   * Get database info
   */
  databaseInfo: cachedProcedure
    .query(async ({ ctx }) => {
      try {
        const [
          apartmentsBySource,
          apartmentsByLayout,
          apartmentsByPriceRange,
          recentlyUpdated,
        ] = await Promise.all([
          ctx.db.apartment.groupBy({
            by: ['sourceSite'],
            where: { isAvailable: true },
            _count: true,
            orderBy: { _count: { sourceSite: 'desc' } },
          }),
          ctx.db.apartment.groupBy({
            by: ['layout'],
            where: { isAvailable: true },
            _count: true,
            orderBy: { _count: { layout: 'desc' } },
            take: 10,
          }),
          Promise.all([
            ctx.db.apartment.count({ where: { isAvailable: true, rentMonthly: { lt: 100000 } } }),
            ctx.db.apartment.count({ where: { isAvailable: true, rentMonthly: { gte: 100000, lt: 150000 } } }),
            ctx.db.apartment.count({ where: { isAvailable: true, rentMonthly: { gte: 150000, lt: 200000 } } }),
            ctx.db.apartment.count({ where: { isAvailable: true, rentMonthly: { gte: 200000, lt: 300000 } } }),
            ctx.db.apartment.count({ where: { isAvailable: true, rentMonthly: { gte: 300000 } } }),
          ]).then(([under100k, between100k150k, between150k200k, between200k300k, over300k]) => ({
            'Under ¥100,000': under100k,
            '¥100,000-¥150,000': between100k150k,
            '¥150,000-¥200,000': between150k200k,
            '¥200,000-¥300,000': between200k300k,
            'Over ¥300,000': over300k,
          })),
          ctx.db.apartment.findMany({
            where: { isAvailable: true },
            orderBy: { updatedAt: 'desc' },
            take: 10,
            select: {
              id: true,
              title: true,
              sourceSite: true,
              updatedAt: true,
              rentMonthly: true,
              station: {
                select: { name: true },
              },
            },
          }),
        ]);

        return {
          sources: apartmentsBySource.map(s => ({
            site: s.sourceSite,
            count: s._count,
          })),
          layouts: apartmentsByLayout.map(l => ({
            layout: l.layout,
            count: l._count,
          })),
          priceDistribution: apartmentsByPriceRange,
          recentlyUpdated,
        };

      } catch (error) {
        console.error('Database info error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get database information',
        });
      }
    }),
});