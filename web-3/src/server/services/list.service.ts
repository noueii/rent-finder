import { type PrismaClient, ListType, type Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";
import type { ListWithMeta, ListWithApartments } from "~/types";

export interface CreateListInput {
  name: string;
  type: ListType;
  isPublic?: boolean;
  searchParams?: any;
}

export interface UpdateListInput {
  id: string;
  name?: string;
  isPublic?: boolean;
  status?: string;
  progress?: number;
}

export interface ApartmentFilters {
  priceMin?: number;
  priceMax?: number;
  twoYearAvgMin?: number;
  twoYearAvgMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  layout?: string[];
  buildingAge?: number;
  maxWalkingMinutes?: number;
  maxCommuteMinutes?: number;
  excludeWards?: string[];
}

export interface SortOptions {
  field: 'price' | 'size' | 'addedAt' | 'commuteTime' | 'score';
  order: 'asc' | 'desc';
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Service for managing apartment lists
 * 
 * Handles all list-related operations including CRUD, access control,
 * apartment management within lists, and metadata calculations.
 * All methods are scoped to the authenticated user's context.
 */
export class ListService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  /**
   * Check if user has access to a list (owner or public)
   * 
   * @param listId - The ID of the list to check
   * @returns The list if accessible
   * @throws {NOT_FOUND} If list doesn't exist or user doesn't have access
   * 
   * @example
   * const list = await this.verifyListAccess('list123');
   * // list is guaranteed to be accessible by the current user
   */
  private async verifyListAccess(listId: string): Promise<Prisma.ListGetPayload<{ select: { id: true; userId: true; type: true; searchParams: true } }>> {
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId: this.session.user.id },
          { isPublic: true },
        ],
      },
      select: {
        id: true,
        userId: true,
        type: true,
        searchParams: true,
      }
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    return list;
  }

  /**
   * Check if user owns a list
   * 
   * @param listId - The ID of the list to check
   * @throws {NOT_FOUND} If list doesn't exist or user doesn't own it
   * 
   * @remarks
   * This is stricter than verifyListAccess - it requires ownership, not just access
   */
  private async verifyListOwnership(listId: string): Promise<void> {
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId: this.session.user.id,
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }
  }

  /**
   * Extract workplace station ID from list search params
   * 
   * @param list - List object with type and searchParams
   * @returns The workplace station ID if this is a search result list, undefined otherwise
   * 
   * @remarks
   * Only SEARCH_RESULT lists have workplace stations associated with them
   */
  private extractWorkplaceStationId(list: { type: ListType; searchParams: any }): string | undefined {
    if (list.type === 'SEARCH_RESULT' && list.searchParams) {
      const searchParams = list.searchParams as any;
      return searchParams.workplaceStationId;
    }
    return undefined;
  }

  /**
   * Build apartment where clause from filters
   * 
   * @param filters - Optional filters to apply
   * @returns Prisma where clause for apartment queries
   * 
   * @remarks
   * Always excludes removed apartments. Handles price ranges, size ranges,
   * layout types, building age, walking distance, and ward exclusions.
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
   * Calculate 2-year average monthly cost
   * 
   * @param apartment - Apartment with price and initial fees
   * @returns Average monthly cost over 2 years including all fees
   * 
   * @remarks
   * Formula: (24 months rent + deposit + key money + reikin) / 24
   * If deposit is missing, assumes 2 months rent as default
   * 
   * @example
   * const avg = this.calculateTwoYearAverage({
   *   price: 100000,
   *   deposit: 200000,
   *   keyMoney: 100000,
   *   reikin: 0
   * });
   * // Returns: 116667 (2,800,000 total / 24 months)
   */
  private calculateTwoYearAverage(apartment: {
    price: number;
    deposit?: number | null;
    keyMoney?: number | null;
    reikin?: number | null;
  }): number {
    const twoYearTotal = apartment.price * 24 + 
      (apartment.deposit || apartment.price * 2) + 
      (apartment.keyMoney || 0) + 
      (apartment.reikin || 0);
    return Math.round(twoYearTotal / 24);
  }

  /**
   * Get list by ID with metadata
   * 
   * @param id - The list ID to retrieve
   * @returns List with apartment count and route metadata
   * @throws {NOT_FOUND} If list doesn't exist or user doesn't have access
   * 
   * @remarks
   * For commute search lists, also returns counts of apartments missing routes
   * or coordinates for better user feedback
   * 
   * @example
   * const list = await listService.getById('list123');
   * console.log(`${list.apartmentsWithoutRoutes} apartments need route calculation`);
   */
  async getById(id: string) {
    const list = await this.verifyListAccess(id);
    
    const fullList = await this.db.list.findUnique({
      where: { id },
      include: {
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!fullList) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    // Get additional metadata for commute search lists
    let apartmentsWithoutRoutes = 0;
    let apartmentsWithoutCoordinates = 0;
    
    const workplaceStationId = this.extractWorkplaceStationId(list);
    
    if (workplaceStationId) {
      // Count apartments without routes to the workplace station
      apartmentsWithoutRoutes = await this.db.apartmentList.count({
        where: {
          listId: list.id,
          apartment: {
            routes: {
              none: {
                toStationId: workplaceStationId,
              },
            },
          },
        },
      });

      // Count apartments without coordinates
      apartmentsWithoutCoordinates = await this.db.apartmentList.count({
        where: {
          listId: list.id,
          apartment: {
            OR: [
              { latitude: null },
              { longitude: null },
            ],
          },
        },
      });
    }

    return {
      ...fullList,
      apartmentsWithoutRoutes,
      apartmentsWithoutCoordinates,
    };
  }

  /**
   * Get all lists for the current user with metadata
   * 
   * @param type - Optional filter by list type
   * @param includeCount - Whether to include apartment counts (default: true)
   * @returns Array of lists with metadata including counts and seen status
   * 
   * @remarks
   * Automatically calculates:
   * - Total apartment count
   * - Seen/unseen counts
   * - Apartments without routes (for search result lists)
   * - Related workplace station (for search result lists)
   * 
   * @example
   * const searchLists = await listService.getUserLists('SEARCH_RESULT');
   * const allLists = await listService.getUserLists();
   */
  async getUserLists(type?: ListType, includeCount = true): Promise<ListWithMeta[]> {
    const lists = await this.db.list.findMany({
      where: {
        userId: this.session.user.id,
        ...(type && { type }),
      },
      orderBy: { updatedAt: 'desc' },
      ...(includeCount && {
        include: {
          _count: {
            select: { apartments: true },
          },
        },
      }),
    });

    // Calculate additional metadata
    const listsWithMeta = await Promise.all(
      lists.map(async (list) => {
        const seenCount = await this.db.apartmentList.count({
          where: {
            listId: list.id,
            seen: true,
          },
        });

        // Check if this list has a related workplace station
        let apartmentsWithoutRoutes = 0;
        let relatedStationId: string | undefined;
        
        if (list.type === 'SEARCH_RESULT' && list.searchParams) {
          const searchParams = list.searchParams as any;
          relatedStationId = searchParams.workplaceStationId;
          
          if (relatedStationId) {
            // Count apartments in this list that don't have a route to the workplace station
            apartmentsWithoutRoutes = await this.db.apartmentList.count({
              where: {
                listId: list.id,
                apartment: {
                  routes: {
                    none: {
                      toStationId: relatedStationId,
                    },
                  },
                },
              },
            });
          }
        }

        return {
          ...list,
          totalApartments: (list as any)._count?.apartments ?? 0,
          seenCount,
          apartmentsWithoutRoutes,
          relatedStationId,
        } as ListWithMeta;
      })
    );

    return listsWithMeta;
  }

  /**
   * Get apartment stats for a list
   * 
   * @param listId - The list to get stats for
   * @returns Statistics about apartments in the list
   * @throws {NOT_FOUND} If list doesn't exist
   * @throws {FORBIDDEN} If user doesn't have permission
   * 
   * @remarks
   * Returns counts of:
   * - Total apartments
   * - Apartments needing detail fetching
   * - Apartments with user scores
   * - Apartments with complete details
   * 
   * @example
   * const stats = await listService.getApartmentStats('list123');
   * console.log(`${stats.needingDetails} apartments need details scraped`);
   */
  async getApartmentStats(listId: string) {
    // Get list to verify ownership
    const list = await this.db.list.findUnique({
      where: { id: listId },
      select: { userId: true },
    });

    if (!list) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "List not found",
      });
    }

    // Check if user owns the list or is admin
    const user = await this.db.user.findUnique({
      where: { id: this.session.user.id },
      select: { role: true },
    });

    if (list.userId !== this.session.user.id && user?.role !== 'ADMIN') {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to view this list",
      });
    }

    // Get stats about apartments in the list
    const totalApartments = await this.db.apartmentList.count({
      where: { listId },
    });

    const needingDetails = await this.db.apartmentList.count({
      where: {
        listId,
        apartment: {
          fetchedDetails: false,
        },
      },
    });

    const withScores = await this.db.apartmentList.count({
      where: {
        listId,
        apartment: {
          scores: {
            some: {
              userId: this.session.user.id,
            },
          },
        },
      },
    });

    return {
      total: totalApartments,
      needingDetails,
      withScores,
      withDetails: totalApartments - needingDetails,
    };
  }

  /**
   * Create a new list
   * 
   * @param input - List creation parameters
   * @returns The created list
   * 
   * @example
   * const list = await listService.create({
   *   name: 'My Tokyo Apartments',
   *   type: 'CUSTOM',
   *   isPublic: false
   * });
   */
  async create(input: CreateListInput) {
    return await this.db.list.create({
      data: {
        ...input,
        userId: this.session.user.id,
      },
    });
  }

  /**
   * Update list details
   * 
   * @param input - Update parameters including list ID
   * @returns The updated list
   * @throws {NOT_FOUND} If list doesn't exist or user doesn't own it
   * 
   * @example
   * const updated = await listService.update({
   *   id: 'list123',
   *   name: 'Updated Name',
   *   isPublic: true
   * });
   */
  async update(input: UpdateListInput) {
    const { id, ...updateData } = input;

    // Verify ownership
    await this.verifyListOwnership(id);

    return await this.db.list.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a list
   * 
   * @param id - The list ID to delete
   * @returns Success confirmation
   * @throws {NOT_FOUND} If list doesn't exist or user doesn't own it
   * 
   * @remarks
   * Deleting a list also removes all apartment associations (cascade delete)
   */
  async delete(id: string) {
    // Verify ownership
    await this.verifyListOwnership(id);

    await this.db.list.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Add apartment to list
   * 
   * @param listId - The list to add to
   * @param apartmentId - The apartment to add
   * @returns The created apartment-list association
   * @throws {NOT_FOUND} If list or apartment doesn't exist
   * @throws {FORBIDDEN} If user doesn't own the list
   * 
   * @remarks
   * Uses upsert to handle duplicate additions gracefully
   * 
   * @example
   * await listService.addApartment('list123', 'apt456');
   */
  async addApartment(listId: string, apartmentId: string) {
    // Verify list ownership
    await this.verifyListOwnership(listId);

    // Check if apartment exists
    const apartment = await this.db.apartment.findUnique({
      where: { id: apartmentId },
    });

    if (!apartment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Apartment not found',
      });
    }

    // Add to list (upsert to handle duplicates gracefully)
    return await this.db.apartmentList.upsert({
      where: {
        apartmentId_listId: {
          apartmentId,
          listId,
        },
      },
      update: {}, // No update needed if it already exists
      create: {
        apartmentId,
        listId,
      },
    });
  }

  /**
   * Remove apartment from list
   * 
   * @param listId - The list to remove from
   * @param apartmentId - The apartment to remove
   * @returns Success confirmation
   * @throws {NOT_FOUND} If association doesn't exist
   * @throws {FORBIDDEN} If user doesn't own the list
   */
  async removeApartment(listId: string, apartmentId: string) {
    // Verify list ownership
    await this.verifyListOwnership(listId);

    await this.db.apartmentList.delete({
      where: {
        apartmentId_listId: {
          apartmentId,
          listId,
        },
      },
    });

    return { success: true };
  }

  /**
   * Bulk add apartments to list
   * 
   * @param listId - The list to add to
   * @param apartmentIds - Array of apartment IDs to add
   * @returns Operation result with counts
   * @throws {NOT_FOUND} If list doesn't exist
   * @throws {FORBIDDEN} If user doesn't own the list
   * 
   * @remarks
   * Efficiently adds multiple apartments in one operation.
   * Skips duplicates automatically.
   * 
   * @example
   * const result = await listService.bulkAddApartments('list123', ['apt1', 'apt2', 'apt3']);
   * console.log(`Added ${result.added} apartments`);
   */
  async bulkAddApartments(listId: string, apartmentIds: string[]) {
    // Verify list ownership
    await this.verifyListOwnership(listId);

    // Create many, skip duplicates
    const createData = apartmentIds.map(apartmentId => ({
      apartmentId,
      listId,
    }));

    await this.db.apartmentList.createMany({
      data: createData,
      skipDuplicates: true,
    });

    return { 
      success: true,
      added: apartmentIds.length,
    };
  }

  /**
   * Mark apartment as seen
   * 
   * @param listId - The list containing the apartment
   * @param apartmentId - The apartment to mark
   * @returns Updated apartment-list association
   * @throws {NOT_FOUND} If association doesn't exist
   * @throws {FORBIDDEN} If user doesn't own the list
   * 
   * @remarks
   * Used for browse mode to track which apartments user has viewed
   */
  async markSeen(listId: string, apartmentId: string) {
    // Verify list ownership
    await this.verifyListOwnership(listId);

    return await this.db.apartmentList.update({
      where: {
        apartmentId_listId: {
          apartmentId,
          listId,
        },
      },
      data: {
        seen: true,
        seenAt: new Date(),
      },
    });
  }

  /**
   * Update apartment scores
   * 
   * @param listId - The list containing the apartment
   * @param apartmentId - The apartment to score
   * @param locationScore - Score for location (0-5)
   * @param designScore - Score for design (0-5)
   * @param spaceScore - Score for space (0-5)
   * @returns Updated apartment-list association
   * @throws {NOT_FOUND} If association doesn't exist
   * @throws {FORBIDDEN} If user doesn't own the list
   * 
   * @remarks
   * Scores are stored per list-apartment association, allowing different
   * scores for the same apartment in different lists
   * 
   * @example
   * await listService.updateApartmentScore('list123', 'apt456', 4, 5, 3);
   */
  async updateApartmentScore(
    listId: string,
    apartmentId: string,
    locationScore: number | null,
    designScore: number | null,
    spaceScore: number | null
  ) {
    // Verify list ownership
    await this.verifyListOwnership(listId);

    return await this.db.apartmentList.update({
      where: {
        apartmentId_listId: {
          apartmentId,
          listId,
        },
      },
      data: {
        locationScore,
        designScore,
        spaceScore,
        scoredAt: new Date(),
      },
    });
  }

  /**
   * Check if apartment is in user's lists
   * 
   * @param apartmentId - The apartment to check
   * @param listTypes - Optional filter by list types
   * @returns Map of list type to list ID for lists containing the apartment
   * 
   * @example
   * const lists = await listService.checkApartmentInLists('apt123', ['LIKED', 'HIDDEN']);
   * if (lists.LIKED) {
   *   console.log('Apartment is liked');
   * }
   */
  async checkApartmentInLists(apartmentId: string, listTypes?: ListType[]) {
    const whereClause: any = {
      userId: this.session.user.id,
      apartments: {
        some: {
          apartmentId,
        },
      },
    };

    if (listTypes && listTypes.length > 0) {
      whereClause.type = { in: listTypes };
    }

    const lists = await this.db.list.findMany({
      where: whereClause,
      select: {
        id: true,
        type: true,
      },
    });

    // Return a map of list types to list IDs for easy lookup
    const listMap: Record<string, string> = {};
    lists.forEach(list => {
      listMap[list.type] = list.id;
    });

    return listMap;
  }

  /**
   * Get next unseen apartment in list (for browse mode)
   * 
   * @param listId - The list to browse
   * @param currentId - Current apartment ID (optional)
   * @returns Next unseen apartment with remaining count, or null if none
   * @throws {NOT_FOUND} If list doesn't exist
   * @throws {FORBIDDEN} If user doesn't own the list
   * 
   * @remarks
   * Used for browse mode to get apartments one at a time.
   * Returns full apartment details with images and stations.
   * 
   * @example
   * const next = await listService.getNextUnseen('list123');
   * if (next) {
   *   console.log(`${next.unseenCount} apartments remaining`);
   * }
   */
  async getNextUnseen(listId: string, currentId?: string) {
    // Verify list ownership
    await this.verifyListOwnership(listId);

    // Find next unseen apartment
    const nextApartment = await this.db.apartmentList.findFirst({
      where: {
        listId,
        seen: false,
      },
      orderBy: { addedAt: 'asc' },
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
            },
            preferredStation: true,
          },
        },
      },
    });

    if (!nextApartment) {
      return null;
    }

    // Get count of remaining unseen
    const unseenCount = await this.db.apartmentList.count({
      where: {
        listId,
        seen: false,
      },
    });

    return {
      apartment: nextApartment.apartment,
      unseenCount,
    };
  }

  /**
   * Update preferred station for all apartments in a list
   * 
   * @param listId - The list containing apartments to update
   * @param stationId - The station ID to set as preferred (null to clear)
   * @returns Operation result with update count
   * @throws {NOT_FOUND} If list doesn't exist or user doesn't have access
   * 
   * @remarks
   * Bulk updates all apartments in a list to use the same preferred station.
   * Useful for commute-based lists where all apartments should calculate
   * routes from the same station.
   * 
   * @example
   * const result = await listService.updateAllApartmentsPreferredStation('list123', 'station456');
   * console.log(`Updated ${result.updatedCount} apartments`);
   */
  async updateAllApartmentsPreferredStation(listId: string, stationId: string | null) {
    // Verify ownership or public access
    await this.verifyListAccess(listId);

    // Get all apartment IDs in the list
    const apartmentListItems = await this.db.apartmentList.findMany({
      where: { listId },
      select: { apartmentId: true },
    });

    const apartmentIds = apartmentListItems.map(item => item.apartmentId);

    // Update all apartments in bulk
    const result = await this.db.apartment.updateMany({
      where: {
        id: { in: apartmentIds },
      },
      data: {
        preferredStationId: stationId,
      },
    });

    return {
      success: true,
      updatedCount: result.count,
    };
  }
  
  /**
   * Get a specific list with apartments (legacy endpoint)
   * @deprecated Use getById + ListQueryService.getApartments instead
   */
  async getListWithApartments(
    listId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ListWithApartments | null> {
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId: this.session.user.id,
      },
      include: {
        apartments: {
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { addedAt: 'desc' },
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
                },
              },
            },
          },
        },
      },
    });

    return list;
  }
  
  /**
   * Get list progress including apartment count
   */
  async getListProgress(listId: string) {
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId: this.session.user.id,
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        progress: true,
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!list) {
      return null;
    }

    return {
      ...list,
      apartmentCount: list._count.apartments,
    };
  }
}