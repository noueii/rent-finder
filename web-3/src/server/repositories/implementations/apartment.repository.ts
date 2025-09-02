import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaBaseRepository } from '../base.repository';
import type { IApartmentRepository } from '../interfaces/apartment.repository.interface';
import type {
  ApartmentWithRelations,
  ApartmentSearchFilters,
  PaginationOptions,
  ApartmentSortOptions,
  PaginatedApartments
} from '~/types/apartment';
import { TRPCError } from '@trpc/server';

export class ApartmentRepository
  extends PrismaBaseRepository<
    ApartmentWithRelations,
    Prisma.ApartmentCreateInput,
    Prisma.ApartmentUpdateInput,
    Prisma.ApartmentWhereInput,
    Prisma.ApartmentOrderByWithRelationInput
  >
  implements IApartmentRepository {
  
  constructor(prisma: PrismaClient) {
    super(prisma, 'apartment');
  }

  async findById(id: string, includeRelations = true): Promise<ApartmentWithRelations | null> {
    const include = includeRelations ? {
      images: {
        orderBy: { order: 'asc' as const }
      },
      nearestStations: {
        include: {
          station: {
            include: {
              lines: {
                include: {
                  line: true
                }
              }
            }
          }
        },
        orderBy: { walkingMinutes: 'asc' as const }
      },
      routes: {
        include: {
          toStation: true
        }
      },
      preferredStation: includeRelations
    } : undefined;

    return await this.model.findUnique({
      where: { id },
      include
    });
  }

  async findByExternalId(externalId: string, sourceSite: string): Promise<ApartmentWithRelations | null> {
    return await this.model.findUnique({
      where: {
        externalId_sourceSite: {
          externalId,
          sourceSite
        }
      }
    });
  }

  async search(
    filters: ApartmentSearchFilters,
    pagination: PaginationOptions,
    sort?: ApartmentSortOptions
  ): Promise<PaginatedApartments> {
    const where = this.buildWhereClause(filters);
    const orderBy = this.buildOrderBy(sort);
    
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const skip = (page - 1) * limit;

    const [apartments, total] = await Promise.all([
      this.model.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          images: {
            orderBy: { order: 'asc' },
            take: 1 // Only get first image for list view
          },
          nearestStations: {
            include: {
              station: {
                include: {
                  lines: {
                    include: {
                      line: true
                    }
                  }
                }
              }
            },
            orderBy: { walkingMinutes: 'asc' },
            take: 3 // Limit to 3 nearest stations for list view
          },
          routes: {
            include: {
              toStation: true
            },
            take: 1 // Only show primary route
          }
        }
      }),
      this.model.count({ where })
    ]);

    return {
      apartments,
      total,
      page,
      limit,
      hasMore: skip + apartments.length < total,
      nextCursor: skip + apartments.length < total ? 
        apartments[apartments.length - 1]?.id : undefined
    };
  }

  async findByStation(stationId: string, maxWalkingMinutes = 15): Promise<ApartmentWithRelations[]> {
    return await this.model.findMany({
      where: {
        nearestStations: {
          some: {
            stationId,
            walkingMinutes: {
              lte: maxWalkingMinutes
            }
          }
        },
        removed: false
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        },
        nearestStations: {
          include: {
            station: {
              include: {
                lines: {
                  include: {
                    line: true
                  }
                }
              }
            }
          },
          orderBy: { walkingMinutes: 'asc' }
        },
        routes: {
          include: {
            toStation: true
          }
        }
      }
    });
  }

  async findByStations(stationIds: string[], maxWalkingMinutes = 15): Promise<ApartmentWithRelations[]> {
    return await this.model.findMany({
      where: {
        nearestStations: {
          some: {
            stationId: {
              in: stationIds
            },
            walkingMinutes: {
              lte: maxWalkingMinutes
            }
          }
        },
        removed: false
      },
      include: {
        images: {
          orderBy: { order: 'asc' }
        },
        nearestStations: {
          include: {
            station: {
              include: {
                lines: {
                  include: {
                    line: true
                  }
                }
              }
            }
          },
          orderBy: { walkingMinutes: 'asc' }
        },
        routes: {
          include: {
            toStation: true
          }
        }
      }
    });
  }

  async findWithoutRoutes(limit = 100): Promise<ApartmentWithRelations[]> {
    return await this.model.findMany({
      where: {
        routes: {
          none: {}
        },
        removed: false,
        nearestStations: {
          some: {} // Has at least one station
        }
      },
      take: limit,
      include: {
        images: {
          orderBy: { order: 'asc' }
        },
        nearestStations: {
          include: {
            station: {
              include: {
                lines: {
                  include: {
                    line: true
                  }
                }
              }
            }
          },
          orderBy: { walkingMinutes: 'asc' }
        },
        routes: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async updateRoutes(apartmentId: string, routes: any[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Delete existing routes
      await tx.route.deleteMany({
        where: { apartmentId }
      });

      // Create new routes
      if (routes.length > 0) {
        await tx.route.createMany({
          data: routes.map(route => ({
            apartmentId,
            toStationId: route.toStationId,
            commuteMinutes: route.commuteMinutes,
            transferCount: route.transferCount,
            routeDetails: route.routeDetails
          }))
        });
      }
    });
  }

  async markAsRemoved(id: string): Promise<ApartmentWithRelations> {
    return await this.update(id, {
      removed: true,
      lastDetailCheck: new Date()
    }) as unknown as ApartmentWithRelations;
  }

  async markDetailsAsFetched(id: string): Promise<ApartmentWithRelations> {
    return await this.update(id, {
      fetchedDetails: true,
      lastDetailCheck: new Date()
    }) as unknown as ApartmentWithRelations;
  }

  async updateLastDetailCheck(id: string): Promise<ApartmentWithRelations> {
    return await this.update(id, {
      lastDetailCheck: new Date()
    }) as unknown as ApartmentWithRelations;
  }

  async createMany(data: Prisma.ApartmentCreateManyInput[]): Promise<{ count: number }> {
    return await this.model.createMany({
      data,
      skipDuplicates: true
    });
  }

  async updateMany(
    where: Prisma.ApartmentWhereInput,
    data: Prisma.ApartmentUpdateInput
  ): Promise<{ count: number }> {
    return await this.model.updateMany({
      where,
      data
    });
  }

  async countByFilters(filters: ApartmentSearchFilters): Promise<number> {
    const where = this.buildWhereClause(filters);
    return await this.count(where);
  }

  async getAveragePrice(filters?: ApartmentSearchFilters): Promise<number> {
    const where = filters ? this.buildWhereClause(filters) : { removed: false };
    const result = await this.model.aggregate({
      where,
      _avg: {
        price: true
      }
    });
    return result._avg.price || 0;
  }

  async getAverageSize(filters?: ApartmentSearchFilters): Promise<number> {
    const where = filters ? this.buildWhereClause(filters) : { removed: false };
    const result = await this.model.aggregate({
      where,
      _avg: {
        size: true
      }
    });
    return result._avg.size || 0;
  }

  private buildWhereClause(filters: ApartmentSearchFilters): Prisma.ApartmentWhereInput {
    const where: Prisma.ApartmentWhereInput = {
      removed: false
    };

    // Price filters
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      where.price = {};
      if (filters.priceMin !== undefined) where.price.gte = filters.priceMin;
      if (filters.priceMax !== undefined) where.price.lte = filters.priceMax;
    }

    // Two year average cost filters
    if (filters.twoYearAvgMin !== undefined || filters.twoYearAvgMax !== undefined) {
      // Calculate two year total: (monthly rent * 24) + initial fees
      where.AND = where.AND || [];
      
      if (filters.twoYearAvgMin !== undefined) {
        where.AND.push({
          OR: [
            // If feesTotal is available
            {
              feesTotal: { not: null },
              // (price * 24 + feesTotal) / 24 >= twoYearAvgMin
              // price * 24 + feesTotal >= twoYearAvgMin * 24
              // This needs to be done in application logic or with raw query
            },
            // If feesTotal is not available, assume 3 months (typical)
            {
              feesTotal: null,
              price: { gte: filters.twoYearAvgMin - (filters.twoYearAvgMin * 3 / 24) }
            }
          ]
        });
      }
      
      if (filters.twoYearAvgMax !== undefined) {
        where.AND.push({
          OR: [
            {
              feesTotal: { not: null },
              // Similar logic for max
            },
            {
              feesTotal: null,
              price: { lte: filters.twoYearAvgMax - (filters.twoYearAvgMax * 3 / 24) }
            }
          ]
        });
      }
    }

    // Size filters
    if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) {
      where.size = {};
      if (filters.sizeMin !== undefined) where.size.gte = filters.sizeMin;
      if (filters.sizeMax !== undefined) where.size.lte = filters.sizeMax;
    }

    // Layout filter
    if (filters.layout && filters.layout.length > 0) {
      where.layout = { in: filters.layout };
    }

    // Amenities filter
    if (filters.amenities && filters.amenities.length > 0) {
      where.amenities = {
        hasEvery: filters.amenities
      };
    }

    // Station filters
    if (filters.stationIds && filters.stationIds.length > 0) {
      where.nearestStations = {
        some: {
          stationId: { in: filters.stationIds }
        }
      };
    }

    // Building age filter
    if (filters.buildingAge !== undefined) {
      where.buildingAge = { lte: filters.buildingAge };
    }

    // Commute filter
    if (filters.maxCommuteMinutes !== undefined) {
      where.routes = {
        some: {
          commuteMinutes: { lte: filters.maxCommuteMinutes }
        }
      };
    }

    // Availability filter
    if (filters.availability) {
      where.availability = filters.availability;
    }

    // Exclude wards
    if (filters.excludeWards && filters.excludeWards.length > 0) {
      where.ward = {
        notIn: filters.excludeWards
      };
    }

    return where;
  }

  private buildOrderBy(sort?: ApartmentSortOptions): Prisma.ApartmentOrderByWithRelationInput {
    if (!sort) {
      return { createdAt: 'desc' };
    }

    switch (sort.field) {
      case 'price':
        return { price: sort.order };
      case 'size':
        return { size: sort.order };
      case 'createdAt':
        return { createdAt: sort.order };
      case 'scrapedAt':
        return { scrapedAt: sort.order };
      case 'score':
        // Score sorting would need to be handled at the service layer
        // as it requires joining with ApartmentScore table
        return { createdAt: sort.order };
      default:
        return { createdAt: 'desc' };
    }
  }
}