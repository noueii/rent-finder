/**
 * Apartment Service Implementation
 * 
 * Handles all apartment-related business logic
 */

import type { IApartmentService, ApartmentFilters, PaginationOptions, SortOptions } from "./interfaces";
import type { ApartmentWithRelations, PaginatedApartments } from "~/types";
import type { IContainer } from "~/core/di/types";
import type { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

export class ApartmentService implements IApartmentService {
  private db: PrismaClient;

  constructor(container: IContainer) {
    // In a real implementation, we'd inject the database through the container
    // For now, we'll require it to be passed during registration
    this.db = container.resolve({ name: 'PrismaClient' }) as PrismaClient;
  }

  async getById(id: string): Promise<ApartmentWithRelations | null> {
    const apartment = await this.db.apartment.findUnique({
      where: { id },
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
        routes: {
          include: {
            toStation: true,
          },
          orderBy: { duration: 'asc' },
        },
        preferredStation: true,
      },
    });

    return apartment;
  }

  async getByIds(ids: string[]): Promise<ApartmentWithRelations[]> {
    if (ids.length > 50) {
      throw new Error('Maximum 50 apartments can be fetched at once');
    }

    const apartments = await this.db.apartment.findMany({
      where: {
        id: { in: ids },
        removed: false,
      },
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
    });

    return apartments;
  }

  async search(
    filters: ApartmentFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedApartments> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortField = sort?.field ?? 'createdAt';
    const sortOrder = sort?.order ?? 'desc';

    // Build where clause
    const where = this.buildWhereClause(filters);

    // Execute queries in parallel
    const [apartments, total] = await Promise.all([
      this.db.apartment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortField]: sortOrder,
        },
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
      }),
      this.db.apartment.count({ where }),
    ]);

    const hasMore = skip + limit < total;
    const nextCursor = hasMore ? apartments[apartments.length - 1]?.id : undefined;

    return {
      apartments,
      total,
      page,
      limit,
      hasMore,
      nextCursor,
    };
  }

  async getRoutes(
    apartmentId: string,
    destinationIds: string[]
  ): Promise<{
    routes: any[];
    missingDestinations: string[];
  }> {
    if (destinationIds.length > 10) {
      throw new Error('Maximum 10 destinations allowed');
    }

    const routes = await this.db.route.findMany({
      where: {
        apartmentId,
        toStationId: { in: destinationIds },
      },
      orderBy: { duration: 'asc' },
    });

    // Return existing routes and indicate which destinations need calculation
    const existingDestinations = routes.map(r => r.toStationId);
    const missingDestinations = destinationIds.filter(
      id => !existingDestinations.includes(id)
    );

    return {
      routes,
      missingDestinations,
    };
  }

  async create(data: any): Promise<ApartmentWithRelations> {
    const { images, nearestStations, ...apartmentData } = data;

    const apartment = await this.db.apartment.create({
      data: {
        ...apartmentData,
        scrapedAt: new Date(),
        images: {
          create: images,
        },
        nearestStations: {
          create: nearestStations,
        },
      },
      include: {
        images: true,
        nearestStations: {
          include: {
            station: true,
          },
        },
      },
    });

    return apartment;
  }

  async updateAvailability(
    id: string,
    availability: 'available' | 'occupied' | 'unknown'
  ): Promise<any> {
    const apartment = await this.db.apartment.update({
      where: { id },
      data: { availability },
    });

    return apartment;
  }

  async updatePreferredStation(
    id: string,
    stationId: string | null
  ): Promise<any> {
    const apartment = await this.db.apartment.update({
      where: { id },
      data: { preferredStationId: stationId },
      include: {
        preferredStation: true,
      },
    });

    return apartment;
  }

  async delete(id: string): Promise<void> {
    await this.db.apartment.delete({
      where: { id },
    });
  }

  async getAvailableWards(): Promise<string[]> {
    const wards = await this.db.apartment.findMany({
      select: { ward: true },
      distinct: ['ward'],
      where: { 
        AND: [
          { ward: { not: null } },
          { ward: { not: '' } }
        ]
      },
      orderBy: { ward: 'asc' },
    });

    // Extract unique ward names and filter out nulls
    const wardNames = wards
      .map(w => w.ward)
      .filter((ward): ward is string => ward !== null && ward !== '');

    return wardNames;
  }

  async refreshData(id: string, userId?: string): Promise<{
    success: boolean;
    jobId: string;
    message: string;
  }> {
    // Get the apartment details
    const apartment = await this.db.apartment.findUnique({
      where: { id },
      select: {
        id: true,
        externalId: true,
        sourceUrl: true,
        sourceSite: true,
      },
    });

    if (!apartment) {
      throw new Error('Apartment not found');
    }

    // Import job queue and ensure processors are initialized
    const { getJobQueue } = await import('~/lib/jobs/queue');
    const { ensureProcessorsInitialized } = await import('~/lib/jobs/processors');
    ensureProcessorsInitialized();
    const jobQueue = getJobQueue();

    // Create a job to update this specific apartment
    // Map source site to scraper type
    let scraperType = this.mapSourceToScraperType(apartment.sourceSite);
    
    const jobId = await jobQueue.add('update-apartments-by-urls', {
      urls: [apartment.sourceUrl],
      scraperType,
      scraperName: scraperType,
      scraperUrl: '',
      userId: userId || 'system',
      userName: 'System',
      timestamp: new Date(),
      action: 'refresh-single',
      expectedLimit: 1,
    });

    return {
      success: true,
      jobId,
      message: `Refreshing apartment data. Job ID: ${jobId}`,
    };
  }

  /**
   * Build Prisma where clause from filters
   */
  private buildWhereClause(filters: ApartmentFilters): Prisma.ApartmentWhereInput {
    const where: Prisma.ApartmentWhereInput = {
      removed: false,
      AND: [],
    };

    // Price filters
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      (where.AND as any[]).push({
        price: {
          ...(filters.priceMin !== undefined && { gte: filters.priceMin }),
          ...(filters.priceMax !== undefined && { lte: filters.priceMax }),
        },
      });
    }

    // Size filters
    if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) {
      (where.AND as any[]).push({
        size: {
          ...(filters.sizeMin !== undefined && { gte: filters.sizeMin }),
          ...(filters.sizeMax !== undefined && { lte: filters.sizeMax }),
        },
      });
    }

    // Layout filter
    if (filters.layout && filters.layout.length > 0) {
      (where.AND as any[]).push({
        layout: { in: filters.layout },
      });
    }

    // Amenities filter
    if (filters.amenities && filters.amenities.length > 0) {
      (where.AND as any[]).push({
        amenities: { hasSome: filters.amenities },
      });
    }

    // Availability filter
    if (filters.availability) {
      (where.AND as any[]).push({
        availability: filters.availability,
      });
    }

    // Station proximity filter
    if (filters.stationIds && filters.stationIds.length > 0) {
      (where.AND as any[]).push({
        nearestStations: {
          some: {
            stationId: { in: filters.stationIds },
          },
        },
      });
    }

    // Ward exclusion filter
    if (filters.excludeWards && filters.excludeWards.length > 0) {
      (where.AND as any[]).push({
        ward: { notIn: filters.excludeWards },
      });
    }

    // Remove empty AND array if no filters
    if ((where.AND as any[]).length === 0) {
      delete where.AND;
    }

    return where;
  }

  /**
   * Map source site to scraper type
   */
  private mapSourceToScraperType(sourceSite: string): string {
    const mappings: Record<string, string> = {
      'realestate.co.jp': 'realestate',
      'yolo-japan.com': 'yolo-japan',
      'wagaya-japan.com': 'wagaya-japan',
      'e-housing.co.jp': 'e-housing',
      'metro-residences.com': 'metro-residences',
    };

    return mappings[sourceSite] || sourceSite;
  }
}