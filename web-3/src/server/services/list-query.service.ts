import { type PrismaClient, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import type { ApartmentFilters, SortOptions, PaginationOptions } from "./list.service";

export class ListQueryService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  /**
   * Get apartments in a list with pagination, filtering, and sorting
   */
  async getApartments(
    listId: string,
    pagination?: PaginationOptions,
    filters?: ApartmentFilters,
    sort?: SortOptions,
    excludeListTypes?: ('LIKED' | 'HIDDEN' | 'BOOKMARKED' | 'FAVORITED')[]
  ) {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Verify list access
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId: this.session.user.id },
          { isPublic: true },
        ],
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    // For commute search lists, get the workplace station ID from searchParams
    let workplaceStationId: string | undefined;
    if (list.type === 'SEARCH_RESULT' && list.searchParams) {
      const searchParams = list.searchParams as any;
      workplaceStationId = searchParams.workplaceStationId;
    }

    // Build apartment filters
    const apartmentWhere = this.buildApartmentWhereClause(filters);
    
    // Build the list item where clause
    let listItemWhere: any = {
      listId,
      apartment: apartmentWhere,
    };
    
    // Exclude apartments that are in user's specified list types
    if (excludeListTypes && excludeListTypes.length > 0) {
      const excludeApartmentIds = await this.getExcludedApartmentIds(excludeListTypes);
      if (excludeApartmentIds.length > 0) {
        listItemWhere.apartmentId = { notIn: excludeApartmentIds };
      }
    }
    
    // Add commute time filter at the list item level
    if (filters?.maxCommuteMinutes !== undefined && workplaceStationId) {
      listItemWhere.apartment = {
        ...apartmentWhere,
        routes: {
          some: {
            toStationId: workplaceStationId,
            duration: { lte: filters.maxCommuteMinutes },
          },
        },
      };
    }

    // Handle different sorting strategies
    const needsManualSort = sort && ['commuteTime', 'score'].includes(sort.field);
    
    if (needsManualSort) {
      return await this.getApartmentsWithManualSort(
        listItemWhere,
        workplaceStationId,
        sort!,
        skip,
        limit,
        filters
      );
    } else {
      return await this.getApartmentsWithDatabaseSort(
        listItemWhere,
        workplaceStationId,
        sort,
        skip,
        limit,
        filters
      );
    }
  }

  /**
   * Get all apartments for export (no pagination)
   */
  async getAllApartmentsForExport(
    listId: string,
    filters?: ApartmentFilters,
    sort?: SortOptions
  ) {
    // Verify list access
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId: this.session.user.id },
          { isPublic: true },
        ],
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    // For commute search lists, get the workplace station ID from searchParams
    let workplaceStationId: string | undefined;
    let workplaceStationName: string | undefined;
    if (list.type === 'SEARCH_RESULT' && list.searchParams) {
      const searchParams = list.searchParams as any;
      workplaceStationId = searchParams.workplaceStationId;
      workplaceStationName = searchParams.workplaceStationName;
    }

    // Build filters
    const apartmentWhere = this.buildApartmentWhereClause(filters);
    const listItemWhere: any = {
      listId,
      apartment: apartmentWhere,
    };
    
    // Add commute time filter at the list item level
    if (filters?.maxCommuteMinutes !== undefined && workplaceStationId) {
      listItemWhere.apartment = {
        ...apartmentWhere,
        routes: {
          some: {
            toStationId: workplaceStationId,
            duration: { lte: filters.maxCommuteMinutes },
          },
        },
      };
    }

    // Fetch all apartments without pagination
    const apartmentListItems = await this.db.apartmentList.findMany({
      where: listItemWhere,
      include: {
        apartment: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1, // Only need first image for export
            },
            nearestStations: {
              include: {
                station: true,
              },
              orderBy: { walkingMinutes: 'asc' },
              take: 1, // Only need nearest station for export
            },
            preferredStation: true,
            ...(workplaceStationId && {
              routes: {
                where: {
                  toStationId: workplaceStationId,
                },
                include: {
                  toStation: true,
                },
                take: 1, // Only need one route for export
              },
            }),
            scores: {
              where: {
                userId: this.session.user.id,
                listId,
              },
              take: 1,
            },
          },
        },
      },
    });

    // Extract and sort apartments
    let apartments = apartmentListItems.map(item => item.apartment);
    
    // Apply sorting if needed
    if (sort) {
      apartments = this.sortApartments(apartments, apartmentListItems, sort, workplaceStationId);
    }

    return {
      apartments,
      listItems: apartmentListItems,
      total: apartments.length,
      listName: list.name,
      targetStationName: workplaceStationName,
    };
  }

  /**
   * Build apartment where clause from filters
   * 
   * @param filters - Optional filters to apply
   * @returns Prisma where clause for apartment queries
   * 
   * @private
   * @remarks
   * Constructs a complex where clause handling:
   * - Price ranges (min/max)
   * - Size ranges (min/max)  
   * - Layout types (1K, 1LDK, etc.)
   * - Building age limits
   * - Walking distance to stations
   * - Ward exclusions
   * Always excludes removed apartments
   */
  private buildApartmentWhereClause(filters?: ApartmentFilters): Prisma.ApartmentWhereInput {
    const where: Prisma.ApartmentWhereInput = {
      // Always exclude removed apartments
      removed: false,
    };

    if (!filters) return where;

    if (filters.priceMin !== undefined) {
      where.price = { ...where.price, gte: filters.priceMin };
    }
    if (filters.priceMax !== undefined) {
      where.price = { ...where.price, lte: filters.priceMax };
    }
    if (filters.sizeMin !== undefined) {
      where.size = { ...where.size, gte: filters.sizeMin };
    }
    if (filters.sizeMax !== undefined) {
      where.size = { ...where.size, lte: filters.sizeMax };
    }
    if (filters.layout && filters.layout.length > 0) {
      where.layout = { in: filters.layout };
    }
    if (filters.buildingAge !== undefined) {
      where.age = { lte: filters.buildingAge };
    }
    if (filters.maxWalkingMinutes !== undefined) {
      where.nearestStations = {
        some: {
          walkingMinutes: { lte: filters.maxWalkingMinutes },
        },
      };
    }
    if (filters.excludeWards && filters.excludeWards.length > 0) {
      where.ward = { notIn: filters.excludeWards };
    }

    return where;
  }

  /**
   * Get apartment IDs to exclude based on list types
   * 
   * @param excludeListTypes - Array of list types to exclude apartments from
   * @returns Array of apartment IDs to exclude
   * 
   * @private
   * @remarks
   * Used to filter out apartments that the user has already categorized.
   * For example, when browsing available apartments, you might want to
   * exclude those already marked as LIKED or HIDDEN.
   * 
   * @example
   * const excluded = await this.getExcludedApartmentIds(['LIKED', 'HIDDEN']);
   * // Returns IDs of all apartments in user's LIKED or HIDDEN lists
   */
  private async getExcludedApartmentIds(excludeListTypes: string[]): Promise<string[]> {
    // Find user's lists of the specified types
    const userLists = await this.db.list.findMany({
      where: {
        userId: this.session.user.id,
        type: { in: excludeListTypes },
      },
      select: { id: true },
    });
    
    const excludeListIds = userLists.map(list => list.id);
    
    if (excludeListIds.length === 0) {
      return [];
    }

    // Get apartment IDs that are in these lists
    const excludedApartments = await this.db.apartmentList.findMany({
      where: {
        listId: { in: excludeListIds },
      },
      select: { apartmentId: true },
    });
    
    return [...new Set(excludedApartments.map(item => item.apartmentId))];
  }

  /**
   * Build order by clause for database sorting
   * 
   * @param sort - Sort options with field and order
   * @returns Prisma orderBy clause
   * 
   * @private
   * @remarks
   * Converts sort options to Prisma orderBy format.
   * Includes secondary sort by apartmentId for consistent pagination.
   * Note: Score and commute time sorting require post-query sorting.
   */
  private buildOrderByClause(sort?: SortOptions): any {
    let orderBy: any = [{ addedAt: 'desc' }, { apartmentId: 'asc' }]; // default with secondary sort
    
    if (!sort) return orderBy;
    
    const { field, order } = sort;
    
    switch (field) {
      case 'price':
        orderBy = [
          { apartment: { price: order } },
          { apartmentId: 'asc' }
        ];
        break;
      case 'size':
        orderBy = [
          { apartment: { size: order } },
          { apartment: { price: 'asc' } },
          { apartmentId: 'asc' }
        ];
        break;
      case 'addedAt':
        orderBy = [
          { addedAt: order },
          { apartmentId: 'asc' }
        ];
        break;
    }
    
    return orderBy;
  }

  /**
   * Get apartments with database-level sorting
   */
  private async getApartmentsWithDatabaseSort(
    listItemWhere: any,
    workplaceStationId: string | undefined,
    sort?: SortOptions,
    skip?: number,
    limit?: number,
    filters?: ApartmentFilters
  ) {
    const orderBy = this.buildOrderByClause(sort);
    
    // Check if we need to apply 2-year average filter
    if (filters?.twoYearAvgMin !== undefined || filters?.twoYearAvgMax !== undefined) {
      return await this.getApartmentsWithTwoYearAvgFilter(
        listItemWhere,
        workplaceStationId,
        orderBy,
        skip,
        limit,
        filters
      );
    }
    
    // Normal query with pagination
    const [apartmentListItems, total] = await Promise.all([
      this.db.apartmentList.findMany({
        where: listItemWhere,
        skip,
        take: limit,
        orderBy,
        include: {
          apartment: {
            include: {
              images: {
                orderBy: { order: 'asc' },
              },
              nearestStations: {
                include: {
                  station: true,
                },
                orderBy: { walkingMinutes: 'asc' },
                take: 3,
              },
              preferredStation: true,
              ...(workplaceStationId && {
                routes: {
                  where: {
                    toStationId: workplaceStationId,
                  },
                  include: {
                    toStation: true,
                  },
                },
              }),
            },
          },
        },
      }),
      this.db.apartmentList.count({
        where: listItemWhere,
      }),
    ]);

    const apartments = apartmentListItems.map(item => item.apartment);

    return {
      apartments,
      listItems: apartmentListItems,
      total,
      page: skip && limit ? Math.floor(skip / limit) + 1 : 1,
      limit: limit ?? apartments.length,
      hasMore: skip !== undefined && limit !== undefined ? skip + limit < total : false,
    };
  }

  /**
   * Get apartments with manual sorting (for score and commute time)
   */
  private async getApartmentsWithManualSort(
    listItemWhere: any,
    workplaceStationId: string | undefined,
    sort: SortOptions,
    skip: number,
    limit: number,
    filters?: ApartmentFilters
  ) {
    // Fetch all apartments for manual sorting
    const allApartmentListItems = await this.db.apartmentList.findMany({
      where: listItemWhere,
      orderBy: [{ addedAt: 'asc' }, { apartmentId: 'asc' }], // Temporary order
      include: {
        apartment: {
          include: {
            images: {
              orderBy: { order: 'asc' },
            },
            nearestStations: {
              include: {
                station: true,
              },
              orderBy: { walkingMinutes: 'asc' },
              take: 3,
            },
            preferredStation: true,
            ...(workplaceStationId && {
              routes: {
                where: {
                  toStationId: workplaceStationId,
                },
                include: {
                  toStation: true,
                },
              },
            }),
            ...(sort.field === 'score' && {
              scores: {
                where: {
                  userId: this.session.user.id,
                  listId: listItemWhere.listId,
                },
              },
            }),
          },
        },
      },
    });
    
    // Sort the items
    if (sort.field === 'score') {
      allApartmentListItems.sort((a, b) => {
        const aScore = a.apartment.scores?.[0]?.score ?? 0;
        const bScore = b.apartment.scores?.[0]?.score ?? 0;
        
        // Primary sort by score
        const scoreDiff = bScore - aScore; // Descending by default
        if (scoreDiff !== 0) {
          return sort.order === 'asc' ? -scoreDiff : scoreDiff;
        }
        
        // Secondary sort by price (always ascending for consistency)
        const priceDiff = a.apartment.price - b.apartment.price;
        if (priceDiff !== 0) return priceDiff;
        
        // Tertiary sort by ID for absolute consistency
        return a.apartment.id.localeCompare(b.apartment.id);
      });
    } else if (sort.field === 'commuteTime' && workplaceStationId) {
      allApartmentListItems.sort((a, b) => {
        const aRoute = a.apartment.routes?.[0];
        const bRoute = b.apartment.routes?.[0];
        
        // Put apartments without routes at the end
        if (!aRoute && !bRoute) {
          // Both have no routes, sort by price then by ID
          const priceDiff = a.apartment.price - b.apartment.price;
          if (priceDiff !== 0) return priceDiff;
          return a.apartment.id.localeCompare(b.apartment.id);
        }
        if (!aRoute) return 1;
        if (!bRoute) return -1;
        
        // Primary sort by duration
        const durationDiff = aRoute.duration - bRoute.duration;
        if (durationDiff !== 0) {
          return sort.order === 'asc' ? durationDiff : -durationDiff;
        }
        
        // Secondary sort by price (always ascending for consistency)
        const priceDiff = a.apartment.price - b.apartment.price;
        if (priceDiff !== 0) return priceDiff;
        
        // Tertiary sort by ID for absolute consistency
        return a.apartment.id.localeCompare(b.apartment.id);
      });
    }
    
    // Apply pagination after sorting
    const total = allApartmentListItems.length;
    const apartmentListItems = allApartmentListItems.slice(skip, skip + limit);
    const apartments = apartmentListItems.map(item => item.apartment);
    
    return {
      apartments,
      listItems: apartmentListItems,
      total,
      page: Math.floor(skip / limit) + 1,
      limit,
      hasMore: skip + limit < total,
    };
  }

  /**
   * Get apartments with 2-year average filter applied
   */
  private async getApartmentsWithTwoYearAvgFilter(
    listItemWhere: any,
    workplaceStationId: string | undefined,
    orderBy: any,
    skip?: number,
    limit?: number,
    filters?: ApartmentFilters
  ) {
    // For 2-year avg filtering, we need to fetch all matching apartments first
    const allApartmentListItems = await this.db.apartmentList.findMany({
      where: listItemWhere,
      orderBy,
      include: {
        apartment: {
          include: {
            images: {
              orderBy: { order: 'asc' },
            },
            nearestStations: {
              include: {
                station: true,
              },
              orderBy: { walkingMinutes: 'asc' },
              take: 3,
            },
            preferredStation: true,
            ...(workplaceStationId && {
              routes: {
                where: {
                  toStationId: workplaceStationId,
                },
                include: {
                  toStation: true,
                },
              },
            }),
          },
        },
      },
    });
    
    // Filter by 2-year average
    const filteredApartments = allApartmentListItems
      .map(item => item.apartment)
      .filter(apartment => {
        // Calculate 2-year monthly average
        const twoYearTotal = apartment.price * 24 + 
          (apartment.deposit || apartment.price * 2) + 
          (apartment.keyMoney || 0) + 
          (apartment.reikin || 0);
        const twoYearAvg = Math.round(twoYearTotal / 24);
        
        if (filters?.twoYearAvgMin !== undefined && twoYearAvg < filters.twoYearAvgMin) {
          return false;
        }
        if (filters?.twoYearAvgMax !== undefined && twoYearAvg > filters.twoYearAvgMax) {
          return false;
        }
        return true;
      });
    
    // Apply pagination to filtered results
    const apartments = skip !== undefined && limit !== undefined 
      ? filteredApartments.slice(skip, skip + limit)
      : filteredApartments;
    const filteredTotal = filteredApartments.length;
    
    return {
      apartments,
      listItems: allApartmentListItems.slice(skip, skip !== undefined && limit !== undefined ? skip + limit : undefined),
      total: filteredTotal,
      page: skip && limit ? Math.floor(skip / limit) + 1 : 1,
      limit: limit ?? apartments.length,
      hasMore: skip !== undefined && limit !== undefined ? skip + limit < filteredTotal : false,
    };
  }

  /**
   * Sort apartments array
   */
  private sortApartments(
    apartments: any[],
    apartmentListItems: any[],
    sort: SortOptions,
    workplaceStationId?: string
  ) {
    const { field, order } = sort;
    
    switch (field) {
      case 'price':
        apartments.sort((a, b) => {
          const diff = a.price - b.price;
          return order === 'asc' ? diff : -diff;
        });
        break;
      case 'size':
        apartments.sort((a, b) => {
          const diff = a.size - b.size;
          return order === 'asc' ? diff : -diff;
        });
        break;
      case 'addedAt':
        apartments.sort((a, b) => {
          const aDate = apartmentListItems.find(item => item.apartmentId === a.id)?.addedAt || new Date(0);
          const bDate = apartmentListItems.find(item => item.apartmentId === b.id)?.addedAt || new Date(0);
          const diff = aDate.getTime() - bDate.getTime();
          return order === 'asc' ? diff : -diff;
        });
        break;
      case 'commuteTime':
        if (workplaceStationId) {
          apartments.sort((a, b) => {
            const aRoute = a.routes?.[0];
            const bRoute = b.routes?.[0];
            
            if (!aRoute && !bRoute) return 0;
            if (!aRoute) return 1;
            if (!bRoute) return -1;
            
            const diff = aRoute.duration - bRoute.duration;
            return order === 'asc' ? diff : -diff;
          });
        }
        break;
      case 'score':
        apartments.sort((a, b) => {
          const aScore = a.scores?.[0]?.score ?? 0;
          const bScore = b.scores?.[0]?.score ?? 0;
          const diff = aScore - bScore;
          return order === 'asc' ? diff : -diff;
        });
        break;
    }
    
    return apartments;
  }
}