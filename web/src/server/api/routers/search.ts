import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';
import { Prisma } from '@prisma/client';
import { TransitService } from '~/services/transit-service';

// Pagination schema
const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

// Sorting schema
const sortingSchema = z.object({
  sortBy: z.enum([
    'price_asc',
    'price_desc',
    'size_asc',
    'size_desc',
    'newest',
    'commute_asc'
  ]).default('price_asc'),
});

// Search filters schema
const searchFiltersSchema = z.object({
  // Basic filters
  minRent: z.number().optional(),
  maxRent: z.number().optional(),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
  layouts: z.array(z.string()).optional(),
  
  // Commute filter
  targetStation: z.string().optional(),
  maxCommuteTime: z.number().optional(),
  
  // Location filters
  wards: z.array(z.string()).optional(),
  
  // Building filters
  minBuildingAge: z.number().optional(),
  maxBuildingAge: z.number().optional(),
  
  // List filters
  includeFromLists: z.array(z.enum(['saved', 'liked', 'favorites', 'hidden'])).optional(),
  excludeFromLists: z.array(z.enum(['saved', 'liked', 'favorites', 'hidden'])).optional(),
});

// Search input schema
const searchInputSchema = z.object({
  filters: searchFiltersSchema.optional(),
  pagination: paginationSchema.optional(),
  sorting: sortingSchema.optional(),
});

export const searchRouter = createTRPCRouter({
  // Advanced apartment search with filters
  searchApartments: publicProcedure
    .input(searchInputSchema)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      const transitService = new TransitService();

      try {
        const filters = input.filters || {};
        const pagination = input.pagination || { page: 1, limit: 20 };
        const sorting = input.sorting || { sortBy: 'price_asc' };
        const offset = (pagination.page - 1) * pagination.limit;

        // Build where clause
        const whereClause: Prisma.ApartmentWhereInput = {
          isAvailable: true,
        };

        // Price filter
        if (filters.minRent || filters.maxRent) {
          whereClause.rentMonthly = {
            ...(filters.minRent && { gte: filters.minRent }),
            ...(filters.maxRent && { lte: filters.maxRent }),
          };
        }

        // Size filter
        if (filters.minSize || filters.maxSize) {
          whereClause.size = {
            ...(filters.minSize && { gte: filters.minSize }),
            ...(filters.maxSize && { lte: filters.maxSize }),
          };
        }

        // Layout filter
        if (filters.layouts && filters.layouts.length > 0) {
          whereClause.layout = {
            in: filters.layouts,
          };
        }

        // Location filter (wards)
        if (filters.wards && filters.wards.length > 0) {
          whereClause.ward = {
            in: filters.wards,
          };
        }

        // Building age filter
        if (filters.minBuildingAge || filters.maxBuildingAge) {
          whereClause.buildingAge = {
            ...(filters.minBuildingAge && { gte: filters.minBuildingAge }),
            ...(filters.maxBuildingAge && { lte: filters.maxBuildingAge }),
          };
        }

        // List filters - exclude apartments in certain lists
        if (filters.excludeFromLists && filters.excludeFromLists.length > 0) {
          const excludedApartmentIds = await ctx.db.apartmentList.findMany({
            where: {
              listType: {
                in: filters.excludeFromLists,
              },
            },
            select: {
              apartmentId: true,
            },
          });

          if (excludedApartmentIds.length > 0) {
            whereClause.id = {
              notIn: excludedApartmentIds.map(item => item.apartmentId),
            };
          }
        }

        // List filters - include only apartments in certain lists
        if (filters.includeFromLists && filters.includeFromLists.length > 0) {
          const includedApartmentIds = await ctx.db.apartmentList.findMany({
            where: {
              listType: {
                in: filters.includeFromLists,
              },
            },
            select: {
              apartmentId: true,
            },
          });

          if (includedApartmentIds.length > 0) {
            whereClause.id = {
              in: includedApartmentIds.map(item => item.apartmentId),
            };
          }
        }

        // Commute time filter - if specified, we need to filter by stations
        let validApartmentIds: string[] | undefined;
        const apartmentCommuteMap = new Map<string, { totalTime: number; transitTime: number; walkingTime: number }>();
        
        if (filters.targetStation && filters.maxCommuteTime) {
          // Get all stations reachable within the commute time
          // We need to get stations reachable in less time to account for walking
          const reachableStations = await transitService.findReachableStations(
            filters.targetStation,
            filters.maxCommuteTime // This should already account for total time
          );

          if (reachableStations.length === 0) {
            // No reachable stations, return empty results
            return {
              apartments: [],
              pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
              },
              searchTime: Date.now() - startTime,
              stationsSearched: 0,
            };
          }

          // Get apartments near these stations
          const stationIds = reachableStations.map(s => s.station_id);
          const apartmentStations = await ctx.db.apartmentStation.findMany({
            where: {
              stationId: {
                in: stationIds,
              },
              // Walking time + transit time should be <= maxCommuteTime
              walkingMinutes: {
                lte: filters.maxCommuteTime, // Simple check, will refine below
              },
            },
            select: {
              apartmentId: true,
              stationId: true,
              walkingMinutes: true,
            },
          });

          // Filter apartments where total commute time is within limit
          validApartmentIds = [];
          
          for (const aptStation of apartmentStations) {
            const stationInfo = reachableStations.find(s => s.station_id === aptStation.stationId);
            if (stationInfo) {
              const walkingTime = aptStation.walkingMinutes || 0;
              const totalTime = stationInfo.travel_time + walkingTime;
              
              if (totalTime <= filters.maxCommuteTime) {
                validApartmentIds.push(aptStation.apartmentId);
                apartmentCommuteMap.set(aptStation.apartmentId, {
                  totalTime,
                  transitTime: stationInfo.travel_time,
                  walkingTime,
                });
              }
            }
          }

          if (validApartmentIds.length === 0) {
            // No apartments within commute time
            return {
              apartments: [],
              pagination: {
                page: pagination.page,
                limit: pagination.limit,
                total: 0,
                totalPages: 0,
                hasNext: false,
                hasPrev: false,
              },
              searchTime: Date.now() - startTime,
              stationsSearched: stationIds.length,
            };
          }

          // Add to where clause
          if (whereClause.id) {
            // If we already have an ID filter (from list filters), intersect them
            const existingIds = Array.isArray(whereClause.id.in) ? whereClause.id.in : [];
            whereClause.id = {
              in: validApartmentIds.filter(id => existingIds.includes(id)),
            };
          } else {
            whereClause.id = {
              in: validApartmentIds,
            };
          }
        }

        // Build order by clause
        let orderBy: Prisma.ApartmentOrderByWithRelationInput = {};
        switch (sorting.sortBy) {
          case 'price_asc':
            orderBy = { rentMonthly: 'asc' };
            break;
          case 'price_desc':
            orderBy = { rentMonthly: 'desc' };
            break;
          case 'size_asc':
            orderBy = { size: 'asc' };
            break;
          case 'size_desc':
            orderBy = { size: 'desc' };
            break;
          case 'newest':
            orderBy = { createdAt: 'desc' };
            break;
          case 'commute_asc':
            // For commute sorting, we'll sort by rent as a fallback
            // True commute sorting would require post-processing
            orderBy = { rentMonthly: 'asc' };
            break;
        }

        // Execute query
        const [apartments, total] = await Promise.all([
          ctx.db.apartment.findMany({
            where: whereClause,
            include: {
              stations: {
                include: {
                  station: true,
                },
                orderBy: {
                  walkingMinutes: 'asc'
                },
                take: 3, // Get top 3 stations
              },
              images: {
                orderBy: {
                  displayOrder: 'asc'
                },
                take: 5,
              },
            },
            orderBy,
            skip: offset,
            take: pagination.limit,
          }),
          ctx.db.apartment.count({
            where: whereClause,
          }),
        ]);

        // If we have commute filtering, add commute info to results
        let apartmentsWithCommute = apartments;
        if (filters.targetStation && filters.maxCommuteTime && validApartmentIds) {
          // Use pre-calculated commute info from filtering phase
          apartmentsWithCommute = apartments.map(apt => {
            const commuteData = apartmentCommuteMap.get(apt.id);
            if (commuteData) {
              return {
                ...apt,
                commuteInfo: {
                  totalTime: commuteData.totalTime,
                  transitTime: commuteData.transitTime,
                  walkingTime: commuteData.walkingTime,
                  transfers: 0, // We don't have this info readily available
                },
              };
            }
            return apt;
          });

          // Sort by commute time if requested
          if (sorting.sortBy === 'commute_asc') {
            apartmentsWithCommute.sort((a, b) => {
              const aTime = (a as any).commuteInfo?.totalTime || 999;
              const bTime = (b as any).commuteInfo?.totalTime || 999;
              return aTime - bTime;
            });
          }
        }

        const totalPages = Math.ceil(total / pagination.limit);

        return {
          apartments: apartmentsWithCommute.map(apt => ({
            ...apt,
            imageUrls: apt.images?.map(img => img.imageUrl) || [],
            mainImageUrl: apt.mainImageUrl || apt.images?.[0]?.imageUrl,
            stationName: apt.stations[0]?.station?.name || apt.stations[0]?.originalStationName || 'Unknown',
            walkingMinutes: apt.stations[0]?.walkingMinutes || 0,
          })),
          pagination: {
            page: pagination.page,
            limit: pagination.limit,
            total,
            totalPages,
            hasNext: pagination.page < totalPages,
            hasPrev: pagination.page > 1,
          },
          searchTime: Date.now() - startTime,
          stationsSearched: filters.targetStation ? (validApartmentIds?.length || 0) : 0,
        };
      } catch (error) {
        console.error('Search error:', error);
        throw new Error('Search failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }),

  // Station search - just return all stations
  searchStations: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      try {
        // Just fetch all stations
        const stations = await ctx.db.station.findMany({
          select: {
            id: true,
            name: true,
            nameJa: true,
            nameEn: true,
            nameKana: true,
            passengerCount: true,
          },
        });

        // Return all stations - let client handle filtering
        return stations.map(station => ({
          id: station.id,
          name: station.name,
          name_ja: station.nameJa,
          name_en: station.nameEn,
          lines: [],
        }));
      } catch (error) {
        console.error('Station search error:', error);
        throw new Error('Station search failed');
      }
    }),
});