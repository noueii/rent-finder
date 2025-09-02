import { TRPCError } from '@trpc/server';
import { transitService } from '../../../services/transit-service';
import { createTRPCRouter, publicProcedure, cachedProcedure } from '../trpc';
import {
  stationSearchSchema,
  stationByIdSchema,
  reachableStationsSchema,
  travelTimeSchema,
  popularStationsSchema,
  stationSuggestionsSchema,
  paginationSchema,
} from '../schemas/search';

export const stationRouter = createTRPCRouter({
  /**
   * Search for stations by name
   */
  search: cachedProcedure
    .input(stationSearchSchema)
    .query(async ({ input }) => {
      try {
        const stations = await transitService.findStations(input.query);
        // Transform snake_case to camelCase for frontend
        return {
          stations: stations.slice(0, input.limit).map(station => ({
            id: station.id,
            name: station.name,
            nameJa: station.name_ja,
            lines: station.lines || [],
          })),
        };
      } catch (error) {
        console.error('Station search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search stations',
        });
      }
    }),

  /**
   * Get station by ID
   */
  getById: cachedProcedure
    .input(stationByIdSchema)
    .query(async ({ input }) => {
      try {
        const station = await transitService.getStationById(input.stationId);
        
        if (!station) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Station not found',
          });
        }

        return station;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Get station by ID error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get station',
        });
      }
    }),

  /**
   * Find stations reachable within specified time
   */
  reachable: publicProcedure
    .input(reachableStationsSchema)
    .query(async ({ input }) => {
      try {
        const reachableStations = await transitService.findReachableStations(
          input.stationId,
          input.maxMinutes
        );

        return {
          stations: reachableStations,
          count: reachableStations.length,
          maxMinutes: input.maxMinutes,
          fromStation: await transitService.getStationById(input.stationId),
        };
      } catch (error) {
        console.error('Reachable stations error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to find reachable stations',
        });
      }
    }),

  /**
   * Calculate travel time between two stations
   */
  travelTime: publicProcedure
    .input(travelTimeSchema)
    .query(async ({ input }) => {
      try {
        const result = await transitService.calculateTravelTime(
          input.fromStationId,
          input.toStationId
        );

        if (!result) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No route found between stations',
          });
        }

        return result;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Travel time calculation error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to calculate travel time',
        });
      }
    }),

  /**
   * Get popular stations (based on search frequency)
   */
  popular: cachedProcedure
    .input(popularStationsSchema)
    .query(async ({ input, ctx }) => {
      try {
        // Get popular stations from database search history
        const searches = await ctx.db.search.groupBy({
          by: ['targetStationId', 'targetStationName'],
          _count: { targetStationId: true },
          where: {
            createdAt: {
              gte: new Date(Date.now() - input.days * 24 * 60 * 60 * 1000),
            },
          },
          orderBy: { _count: { targetStationId: 'desc' } },
          take: input.limit,
        });

        // If no search history, fall back to major stations
        if (searches.length === 0) {
          const majorStations = await transitService.getPopularStations(input.limit);
          return majorStations.map(station => ({
            ...station,
            searchCount: 0,
          }));
        }

        // Enrich with full station data
        const enrichedStations = await Promise.all(
          searches.map(async (search) => {
            const station = await transitService.getStationById(search.targetStationId);
            return {
              ...station,
              searchCount: search._count.targetStationId,
            };
          })
        );

        return enrichedStations.filter(Boolean);
      } catch (error) {
        console.error('Popular stations error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get popular stations',
        });
      }
    }),

  /**
   * Get station suggestions for autocomplete
   */
  suggestions: cachedProcedure
    .input(stationSuggestionsSchema)
    .query(async ({ input, ctx }) => {
      try {
        const stations = await transitService.findStations(input.query);
        
        // Get apartment counts for each station
        const stationCounts = await Promise.all(
          stations.slice(0, input.limit).map(async (station) => {
            const count = await ctx.db.apartment.count({
              where: { stationId: station.id, isAvailable: true },
            });
            return { ...station, apartmentCount: count };
          })
        );

        // Sort by apartment count (descending) then by name
        return stationCounts.sort((a, b) => {
          if (a.apartmentCount !== b.apartmentCount) {
            return b.apartmentCount - a.apartmentCount;
          }
          return a.name.localeCompare(b.name);
        });
      } catch (error) {
        console.error('Station suggestions error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get station suggestions',
        });
      }
    }),

  /**
   * Get all stations with pagination
   */
  list: cachedProcedure
    .input(paginationSchema)
    .query(async ({ input }) => {
      try {
        const result = await transitService.getAllStations(input.offset, input.limit);
        return result;
      } catch (error) {
        console.error('List stations error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list stations',
        });
      }
    }),

  /**
   * Get all stations (for admin UI)
   */
  getAll: cachedProcedure
    .query(async ({ ctx }) => {
      try {
        const stations = await ctx.db.station.findMany({
          orderBy: { name: 'asc' },
        });
        
        // Parse JSON fields
        return stations.map(station => ({
          ...station,
          lines: station.lines ? JSON.parse(station.lines) : [],
          transfers: station.transfers ? JSON.parse(station.transfers) : [],
        }));
      } catch (error) {
        console.error('Get all stations error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get all stations',
        });
      }
    }),

  /**
   * Get station statistics
   */
  stats: cachedProcedure
    .input(stationByIdSchema)
    .query(async ({ input, ctx }) => {
      try {
        const station = await transitService.getStationById(input.stationId);
        
        if (!station) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Station not found',
          });
        }

        const stats = await ctx.db.apartment.aggregate({
          where: { stationId: input.stationId, isAvailable: true },
          _count: true,
          _avg: { rentMonthly: true, size: true, walkingMinutes: true },
          _min: { rentMonthly: true, size: true },
          _max: { rentMonthly: true, size: true },
        });

        return {
          station,
          apartmentCount: stats._count,
          averageRent: stats._avg.rentMonthly,
          averageSize: stats._avg.size,
          averageWalkingTime: stats._avg.walkingMinutes,
          rentRange: {
            min: stats._min.rentMonthly,
            max: stats._max.rentMonthly,
          },
          sizeRange: {
            min: stats._min.size,
            max: stats._max.size,
          },
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Station stats error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get station statistics',
        });
      }
    }),
});