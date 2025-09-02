/**
 * List Service Implementation
 * 
 * Handles list-related business logic
 */

import type { IListService, PaginationOptions } from "./interfaces";
import type { ListWithMeta, ListWithApartments } from "~/types";
import type { ListType } from "@prisma/client";
import type { IContainer } from "~/core/di/types";
import type { PrismaClient, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";

export class ListService implements IListService {
  private db: PrismaClient;

  constructor(container: IContainer) {
    this.db = container.resolve({ name: 'PrismaClient' }) as PrismaClient;
  }

  async getById(id: string, userId: string): Promise<any> {
    const list = await this.db.list.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { isPublic: true },
        ],
      },
      include: {
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    // For commute search lists, get count of apartments without routes
    let apartmentsWithoutRoutes = 0;
    let apartmentsWithoutCoordinates = 0;
    
    if (list.type === 'SEARCH_RESULT' && list.searchParams) {
      const searchParams = list.searchParams as any;
      const workplaceStationId = searchParams.workplaceStationId;
      
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
    }

    return {
      ...list,
      apartmentsWithoutRoutes,
      apartmentsWithoutCoordinates,
    };
  }

  async getApartments(
    listId: string,
    userId: string,
    options: {
      pagination?: PaginationOptions;
      filters?: any;
      sort?: any;
      excludeListTypes?: ListType[];
    }
  ): Promise<{
    apartments: any[];
    listItems: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    const page = options.pagination?.page ?? 1;
    const limit = options.pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Verify list access
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId },
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
    const apartmentWhere = this.buildApartmentWhereClause(options.filters);
    
    // Build the list item where clause
    let listItemWhere: any = {
      listId,
      apartment: apartmentWhere,
    };
    
    // Exclude apartments that are in user's specified list types
    if (options.excludeListTypes && options.excludeListTypes.length > 0) {
      const excludeApartmentIds = await this.getExcludedApartmentIds(
        userId,
        options.excludeListTypes
      );
      
      if (excludeApartmentIds.length > 0) {
        listItemWhere.apartmentId = { notIn: excludeApartmentIds };
      }
    }
    
    // Add commute time filter at the list item level
    if (options.filters?.maxCommuteMinutes !== undefined && workplaceStationId) {
      listItemWhere.apartment = {
        ...apartmentWhere,
        routes: {
          some: {
            toStationId: workplaceStationId,
            duration: { lte: options.filters.maxCommuteMinutes },
          },
        },
      };
    }

    // Handle sorting
    const { orderBy, needsManualSort } = this.buildOrderBy(options.sort);

    // Get apartments
    let apartmentListItems;
    let total;
    
    if (needsManualSort && options.sort?.field === 'score') {
      // Handle score sorting
      const result = await this.handleScoreSort(
        listItemWhere,
        orderBy,
        workplaceStationId,
        userId,
        listId,
        options.sort.order,
        skip,
        limit
      );
      apartmentListItems = result.apartmentListItems;
      total = result.total;
    } else if (needsManualSort && options.sort?.field === 'commuteTime' && workplaceStationId) {
      // Handle commute time sorting
      const result = await this.handleCommuteTimeSort(
        listItemWhere,
        orderBy,
        workplaceStationId,
        options.sort.order,
        skip,
        limit
      );
      apartmentListItems = result.apartmentListItems;
      total = result.total;
    } else {
      // Normal query with pagination
      [apartmentListItems, total] = await Promise.all([
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
    }

    // Extract apartments from the join table
    const apartments = apartmentListItems.map(item => item.apartment);

    return {
      apartments,
      listItems: apartmentListItems,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  async checkApartmentInLists(
    apartmentId: string,
    userId: string,
    listTypes?: ListType[]
  ): Promise<Record<string, string>> {
    const whereClause: any = {
      userId,
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

  async getUserLists(
    userId: string,
    type?: ListType,
    includeCount: boolean = true
  ): Promise<ListWithMeta[]> {
    const lists = await this.db.list.findMany({
      where: {
        userId,
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

  async getList(
    id: string,
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<ListWithApartments | null> {
    const list = await this.db.list.findFirst({
      where: {
        id,
        userId,
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

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    return list;
  }

  async getListProgress(id: string, userId: string): Promise<any> {
    const list = await this.db.list.findFirst({
      where: {
        id,
        userId,
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
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    return {
      ...list,
      apartmentCount: list._count.apartments,
    };
  }

  async create(
    data: {
      name: string;
      type: ListType;
      isPublic?: boolean;
      searchParams?: any;
    },
    userId: string
  ): Promise<any> {
    const list = await this.db.list.create({
      data: {
        ...data,
        userId,
      },
    });

    return list;
  }

  async getApartmentStats(
    listId: string,
    userId: string
  ): Promise<{
    total: number;
    needingDetails: number;
    withScores: number;
    withDetails: number;
  }> {
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
      where: { id: userId },
      select: { role: true },
    });

    if (list.userId !== userId && user?.role !== 'ADMIN') {
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
              userId,
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

  async update(
    id: string,
    data: {
      name?: string;
      isPublic?: boolean;
      status?: string;
      progress?: number;
    },
    userId: string
  ): Promise<any> {
    // Verify ownership
    const existing = await this.db.list.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    const updatedList = await this.db.list.update({
      where: { id },
      data,
    });

    return updatedList;
  }

  async delete(id: string, userId: string): Promise<void> {
    // Verify ownership
    const existing = await this.db.list.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    await this.db.list.delete({
      where: { id },
    });
  }

  async addApartment(
    listId: string,
    apartmentId: string,
    userId: string
  ): Promise<any> {
    // Verify list ownership
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

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
    const apartmentList = await this.db.apartmentList.upsert({
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

    return apartmentList;
  }

  async removeApartment(
    listId: string,
    apartmentId: string,
    userId: string
  ): Promise<void> {
    // Verify list ownership
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    await this.db.apartmentList.delete({
      where: {
        apartmentId_listId: {
          apartmentId,
          listId,
        },
      },
    });
  }

  async updateApartmentScore(
    listId: string,
    apartmentId: string,
    scores: {
      locationScore: number | null;
      designScore: number | null;
      spaceScore: number | null;
    },
    userId: string
  ): Promise<any> {
    // Verify list ownership
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    // Update the scores
    const updatedItem = await this.db.apartmentList.update({
      where: {
        apartmentId_listId: {
          apartmentId,
          listId,
        },
      },
      data: {
        locationScore: scores.locationScore,
        designScore: scores.designScore,
        spaceScore: scores.spaceScore,
        scoredAt: new Date(),
      },
    });

    return updatedItem;
  }

  async markSeen(
    listId: string,
    apartmentId: string,
    userId: string
  ): Promise<any> {
    // Verify list ownership
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

    const apartmentList = await this.db.apartmentList.update({
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

    return apartmentList;
  }

  async getNextUnseen(
    listId: string,
    userId: string,
    currentId?: string
  ): Promise<{
    apartment: any;
    unseenCount: number;
  } | null> {
    // Verify list ownership
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found',
      });
    }

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
   * Helper: Build apartment where clause
   */
  private buildApartmentWhereClause(filters?: any): Prisma.ApartmentWhereInput {
    const apartmentWhere: any = {
      // Always exclude removed apartments
      removed: false,
    };
    
    if (filters) {
      if (filters.priceMin !== undefined) {
        apartmentWhere.price = { ...apartmentWhere.price, gte: filters.priceMin };
      }
      if (filters.priceMax !== undefined) {
        apartmentWhere.price = { ...apartmentWhere.price, lte: filters.priceMax };
      }
      if (filters.sizeMin !== undefined) {
        apartmentWhere.size = { ...apartmentWhere.size, gte: filters.sizeMin };
      }
      if (filters.sizeMax !== undefined) {
        apartmentWhere.size = { ...apartmentWhere.size, lte: filters.sizeMax };
      }
      if (filters.layout && filters.layout.length > 0) {
        apartmentWhere.layout = { in: filters.layout };
      }
      if (filters.buildingAge !== undefined) {
        apartmentWhere.age = { lte: filters.buildingAge };
      }
      if (filters.maxWalkingMinutes !== undefined) {
        apartmentWhere.nearestStations = {
          some: {
            walkingMinutes: { lte: filters.maxWalkingMinutes },
          },
        };
      }
      if (filters.excludeWards && filters.excludeWards.length > 0) {
        apartmentWhere.ward = { notIn: filters.excludeWards };
      }
    }

    return apartmentWhere;
  }

  /**
   * Helper: Get excluded apartment IDs
   */
  private async getExcludedApartmentIds(
    userId: string,
    excludeListTypes: ListType[]
  ): Promise<string[]> {
    // Find user's lists of the specified types
    const userLists = await this.db.list.findMany({
      where: {
        userId,
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
   * Helper: Build order by clause
   */
  private buildOrderBy(sort?: any): {
    orderBy: any;
    needsManualSort: boolean;
  } {
    let orderBy: any = [{ addedAt: 'desc' }, { apartmentId: 'asc' }]; // default with secondary sort
    let needsManualSort = false;
    
    if (sort) {
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
        case 'commuteTime':
        case 'score':
          needsManualSort = true;
          orderBy = [{ addedAt: 'asc' }, { apartmentId: 'asc' }]; // Temporary order
          break;
      }
    }

    return { orderBy, needsManualSort };
  }

  /**
   * Helper: Handle score sorting
   */
  private async handleScoreSort(
    listItemWhere: any,
    orderBy: any,
    workplaceStationId: string | undefined,
    userId: string,
    listId: string,
    sortOrder: 'asc' | 'desc',
    skip: number,
    limit: number
  ) {
    // For score sorting, fetch all apartments with their scores
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
            scores: {
              where: {
                userId,
                listId,
              },
            },
          },
        },
      },
    });
    
    // Sort by score
    allApartmentListItems.sort((a, b) => {
      const aScore = a.apartment.scores?.[0]?.score ?? 0;
      const bScore = b.apartment.scores?.[0]?.score ?? 0;
      
      // Primary sort by score
      const scoreDiff = bScore - aScore; // Descending by default
      if (scoreDiff !== 0) {
        return sortOrder === 'asc' ? -scoreDiff : scoreDiff;
      }
      
      // Secondary sort by price (always ascending for consistency)
      const priceDiff = a.apartment.price - b.apartment.price;
      if (priceDiff !== 0) return priceDiff;
      
      // Tertiary sort by ID for absolute consistency
      return a.apartment.id.localeCompare(b.apartment.id);
    });
    
    // Apply pagination after sorting
    const total = allApartmentListItems.length;
    const apartmentListItems = allApartmentListItems.slice(skip, skip + limit);

    return { apartmentListItems, total };
  }

  /**
   * Helper: Handle commute time sorting
   */
  private async handleCommuteTimeSort(
    listItemWhere: any,
    orderBy: any,
    workplaceStationId: string,
    sortOrder: 'asc' | 'desc',
    skip: number,
    limit: number
  ) {
    // Fetch all apartments for manual sorting
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
            routes: {
              where: {
                toStationId: workplaceStationId,
              },
              include: {
                toStation: true,
              },
            },
          },
        },
      },
    });
    
    // Sort by commute time with secondary sorting for consistency
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
        return sortOrder === 'asc' ? durationDiff : -durationDiff;
      }
      
      // Secondary sort by price (always ascending for consistency)
      const priceDiff = a.apartment.price - b.apartment.price;
      if (priceDiff !== 0) return priceDiff;
      
      // Tertiary sort by ID for absolute consistency
      return a.apartment.id.localeCompare(b.apartment.id);
    });
    
    // Apply pagination after sorting
    const total = allApartmentListItems.length;
    const apartmentListItems = allApartmentListItems.slice(skip, skip + limit);

    return { apartmentListItems, total };
  }
}