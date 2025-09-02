import { TRPCError } from '@trpc/server';
import { transitService } from '../../../services/transit-service';
import { createTRPCRouter, publicProcedure, rateLimitedProcedure } from '../trpc';
import {
  apartmentSearchSchema,
  apartmentByIdSchema,
  paginationSchema,
} from '../schemas/search';

/**
 * Helper function to build orderBy clause
 */
function buildOrderBy(sortBy: string, sortOrder: string) {
  const order = sortOrder === 'desc' ? 'desc' : 'asc' as const;

  switch (sortBy) {
    case 'price':
      return { rentMonthly: order };
    case 'size':
      return { size: order };
    case 'building_age':
      return { buildingAge: order };
    case 'commute_time':
      // This will be handled after the query since it involves transit calculations
      return { rentMonthly: 'asc' as const };
    default:
      return { rentMonthly: 'asc' as const };
  }
}

/**
 * Helper function to record search analytics
 */
async function recordSearch(
  ctx: any,
  targetStationId: string,
  maxCommuteMinutes: number,
  filters: any,
  stationsSearched: number,
  totalResults: number,
  resultsReturned: number,
  searchDurationMs: number
) {
  try {
    const targetStation = await transitService.getStationById(targetStationId);

    await ctx.db.search.create({
      data: {
        targetStationId,
        targetStationName: targetStation?.name || 'Unknown',
        maxCommuteMinutes,
        filters,
        stationsSearched,
        totalResults,
        resultsReturned,
        searchDurationMs,
      },
    });
  } catch (error) {
    console.error('Failed to record search:', error);
    // Don't throw - analytics failure shouldn't break search
  }
}

export const apartmentRouter = createTRPCRouter({
  /**
   * Search apartments by commute time
   */
  searchByCommute: rateLimitedProcedure
    .input(apartmentSearchSchema)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();

      try {
        // Step 1: Find all stations within commute range
        const reachableStations = await transitService.findReachableStations(
          input.targetStationId,
          input.maxCommuteMinutes
        );

        const stationIds = reachableStations.map(s => s.station_id);

        if (stationIds.length === 0) {
          return {
            apartments: [],
            pagination: {
              total: 0,
              limit: input.limit,
              offset: input.offset,
              hasMore: false,
            },
            searchMetadata: {
              stationsSearched: 0,
              searchDurationMs: Date.now() - startTime,
              targetStation: await transitService.getStationById(input.targetStationId),
            },
          };
        }

        // Step 2: Build apartment search query
        const where: any = {
          stationId: { in: stationIds },
          isAvailable: true,
        };

        // Apply filters
        if (input.filters) {
          const filters = input.filters;

          if (filters.maxPrice) {
            where.rentMonthly = { lte: filters.maxPrice };
          }

          if (filters.minPrice) {
            where.rentMonthly = { ...where.rentMonthly, gte: filters.minPrice };
          }

          if (filters.minSize) {
            where.size = { ...where.size, gte: filters.minSize };
          }

          if (filters.maxSize) {
            where.size = { ...where.size, lte: filters.maxSize };
          }

          if (filters.layouts?.length) {
            where.layout = { in: filters.layouts };
          }

          if (filters.features?.length) {
            where.features = { hasSome: filters.features };
          }

          if (filters.maxWalkingMinutes) {
            where.walkingMinutes = { lte: filters.maxWalkingMinutes };
          }

          if (filters.buildingTypes?.length) {
            where.buildingType = { in: filters.buildingTypes };
          }

          if (filters.maxBuildingAge) {
            where.buildingAge = { lte: filters.maxBuildingAge };
          }

          if (filters.hasImages) {
            where.imageUrls = { not: { equals: [] } };
          }

          if (filters.petFriendly) {
            where.features = {
              ...where.features,
              hasSome: [...(where.features?.hasSome || []), 'Pet Friendly']
            };
          }
        }

        // Step 3: Execute search with pagination
        const [apartments, total] = await Promise.all([
          ctx.db.apartment.findMany({
            where,
            include: {
              station: {
                select: { id: true, name: true, nameJa: true },
              },
            },
            orderBy: buildOrderBy(input.sortBy, input.sortOrder),
            skip: input.offset,
            take: input.limit,
          }),
          ctx.db.apartment.count({ where }),
        ]);

        // Step 4: Enrich with commute information
        const enrichedApartments = apartments.map(apartment => {
          const stationCommute = reachableStations.find(
            s => s.station_id === apartment.stationId
          );

          const totalCommuteTime = (stationCommute?.travel_time || 0) + apartment.walkingMinutes;

          return {
            id: apartment.id,
            title: apartment.title,
            buildingName: apartment.buildingName,
            unitNumber: apartment.unitNumber,
            rentMonthly: apartment.rentMonthly,
            managementFee: apartment.managementFee,
            keyMoney: apartment.keyMoney,
            deposit: apartment.deposit,
            size: apartment.size,
            sizeJo: apartment.sizeJo,
            layout: apartment.layout,
            layoutDetails: apartment.layoutDetails,
            address: apartment.address,
            walkingMinutes: apartment.walkingMinutes,
            buildingType: apartment.buildingType,
            buildingAge: apartment.buildingAge,
            buildYear: apartment.buildYear,
            totalFloors: apartment.totalFloors,
            floor: apartment.floor,
            features: apartment.features,
            nearbyFacilities: apartment.nearbyFacilities,
            imageUrls: apartment.imageUrls,
            floorPlanUrl: apartment.floorPlanUrl,
            sourceUrl: apartment.sourceUrl,
            sourceSite: apartment.sourceSite,
            availableFrom: apartment.availableFrom,
            station: apartment.station,
            commute: {
              totalMinutes: totalCommuteTime,
              transitMinutes: stationCommute?.travel_time || 0,
              walkingMinutes: apartment.walkingMinutes,
              transferCount: stationCommute?.transfers || 0,
              route: stationCommute?.path || [] as any,
            },
          };
        });

        // Step 5: Sort by commute time if that's the sort criteria
        if (input.sortBy === 'commute_time') {
          enrichedApartments.sort((a, b) => {
            const comparison = a.commute.totalMinutes - b.commute.totalMinutes;
            return input.sortOrder === 'desc' ? -comparison : comparison;
          });
        }

        const searchDurationMs = Date.now() - startTime;

        // Step 6: Record search for analytics
        await recordSearch(
          ctx,
          input.targetStationId,
          input.maxCommuteMinutes,
          input.filters,
          stationIds.length,
          total,
          enrichedApartments.length,
          searchDurationMs
        );

        return {
          apartments: enrichedApartments,
          pagination: {
            total,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < total,
          },
          searchMetadata: {
            stationsSearched: stationIds.length,
            searchDurationMs,
            targetStation: await transitService.getStationById(input.targetStationId),
          },
        };

      } catch (error) {
        console.error('Apartment search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Search failed',
        });
      }
    }),

  /**
   * Get apartment by ID with optional commute calculation
   */
  getById: publicProcedure
    .input(apartmentByIdSchema)
    .query(async ({ input, ctx }) => {
      try {
        const apartment = await ctx.db.apartment.findUnique({
          where: { id: input.apartmentId },
          include: {
            stations: {
              include: {
                station: true
              },
              where: {
                isPrimary: true
              }
            },
            images: {
              orderBy: {
                displayOrder: 'asc'
              }
            },
          },
        });

        if (!apartment) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Apartment not found',
          });
        }

        // Get the primary station info
        const primaryStation = apartment.stations[0];
        const walkingMinutes = primaryStation?.walkingMinutes || 0;
        const stationId = primaryStation?.stationId;

        let commute = {
          totalMinutes: walkingMinutes,
          transitMinutes: 0,
          walkingMinutes: walkingMinutes,
          transferCount: 0,
          route: [],
        };

        // If origin station is provided, calculate commute
        if (input.fromStationId && stationId && input.fromStationId !== stationId) {
          const travelTime = await transitService.calculateTravelTime(
            input.fromStationId,
            stationId
          );

          if (travelTime) {
            commute = {
              totalMinutes: travelTime.travel_time + walkingMinutes,
              transitMinutes: travelTime.travel_time,
              walkingMinutes: walkingMinutes,
              transferCount: travelTime.transfers,
              route: travelTime.path,
            };
          }
        }

        return {
          ...apartment,
          station: primaryStation?.station || null,
          walkingMinutes,
          commute,
        };

      } catch (error) {
        if (error instanceof TRPCError) throw error;

        console.error('Get apartment by ID error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get apartment',
        });
      }
    }),

  /**
   * Get apartments near a specific station
   */
  nearStation: publicProcedure
    .input(apartmentSearchSchema.omit({ targetStationId: true, maxCommuteMinutes: true })
      .extend({ stationId: apartmentSearchSchema.shape.targetStationId }))
    .query(async ({ input, ctx }) => {
      try {
        const where: any = {
          stationId: input.stationId,
          isAvailable: true,
        };

        // Apply filters (same logic as search)
        if (input.filters) {
          const filters = input.filters;

          if (filters.maxPrice) {
            where.rentMonthly = { lte: filters.maxPrice };
          }

          if (filters.minPrice) {
            where.rentMonthly = { ...where.rentMonthly, gte: filters.minPrice };
          }

          if (filters.minSize) {
            where.size = { ...where.size, gte: filters.minSize };
          }

          if (filters.maxSize) {
            where.size = { ...where.size, lte: filters.maxSize };
          }

          if (filters.layouts?.length) {
            where.layout = { in: filters.layouts };
          }

          if (filters.features?.length) {
            where.features = { hasSome: filters.features };
          }

          if (filters.maxWalkingMinutes) {
            where.walkingMinutes = { lte: filters.maxWalkingMinutes };
          }

          if (filters.buildingTypes?.length) {
            where.buildingType = { in: filters.buildingTypes };
          }

          if (filters.maxBuildingAge) {
            where.buildingAge = { lte: filters.maxBuildingAge };
          }

          if (filters.hasImages) {
            where.imageUrls = { not: { equals: [] } };
          }
        }

        const [apartments, total] = await Promise.all([
          ctx.db.apartment.findMany({
            where,
            include: {
              station: {
                select: { id: true, name: true, nameJa: true },
              },
            },
            orderBy: buildOrderBy(input.sortBy, input.sortOrder),
            skip: input.offset,
            take: input.limit,
          }),
          ctx.db.apartment.count({ where }),
        ]);

        return {
          apartments,
          pagination: {
            total,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < total,
          },
        };

      } catch (error) {
        console.error('Near station search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search apartments near station',
        });
      }
    }),

  /**
   * Get apartment search filters/facets
   */
  getFilters: publicProcedure
    .query(async ({ ctx }) => {
      try {
        const [
          layouts,
          features,
          buildingTypes,
          priceRange,
          sizeRange,
          buildingAgeRange,
        ] = await Promise.all([
          ctx.db.apartment.groupBy({
            by: ['layout'],
            where: { isAvailable: true },
            _count: true,
            orderBy: { _count: { layout: 'desc' } },
          }),
          ctx.db.apartment.findMany({
            where: { isAvailable: true },
            select: { features: true },
            take: 1000,
          }).then(results => {
            const featureCount = new Map<string, number>();
            results.forEach(apt => {
              if (apt.features) {
                apt.features.forEach(feature => {
                  featureCount.set(feature, (featureCount.get(feature) || 0) + 1);
                });
              }
            });
            return Array.from(featureCount.entries())
              .map(([feature, count]) => ({ feature, count }))
              .sort((a, b) => b.count - a.count);
          }),
          ctx.db.apartment.groupBy({
            by: ['buildingType'],
            where: { isAvailable: true, buildingType: { not: null } },
            _count: true,
            orderBy: { _count: { buildingType: 'desc' } },
          }),
          ctx.db.apartment.aggregate({
            where: { isAvailable: true },
            _min: { rentMonthly: true },
            _max: { rentMonthly: true },
          }),
          ctx.db.apartment.aggregate({
            where: { isAvailable: true },
            _min: { size: true },
            _max: { size: true },
          }),
          ctx.db.apartment.aggregate({
            where: { isAvailable: true, buildingAge: { not: null } },
            _min: { buildingAge: true },
            _max: { buildingAge: true },
          }),
        ]);

        return {
          layouts: layouts.map(l => ({ layout: l.layout, count: l._count })),
          features: features.slice(0, 20), // Top 20 features
          buildingTypes: buildingTypes.map(bt => ({
            buildingType: bt.buildingType,
            count: bt._count
          })),
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

      } catch (error) {
        console.error('Get filters error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get search filters',
        });
      }
    }),

});
