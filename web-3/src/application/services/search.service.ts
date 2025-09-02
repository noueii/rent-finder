/**
 * Search Service Implementation
 * 
 * Handles search-related business logic
 */

import type { ISearchService, ApartmentFilters } from "./interfaces";
import type { StandardSearchInput, CommuteSearchInput, SearchSessionWithMeta } from "~/types";
import type { IContainer } from "~/core/di/types";
import type { PrismaClient, Prisma } from "@prisma/client";
import { createScraperLogger } from "~/lib/logging/scraper-logger";

export class SearchService implements ISearchService {
  private db: PrismaClient;

  constructor(container: IContainer) {
    this.db = container.resolve({ name: 'PrismaClient' }) as PrismaClient;
  }

  async search(input: StandardSearchInput): Promise<{
    apartments: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }> {
    // Import cache service
    const { getSearchCache } = await import('~/lib/cache/search-cache');
    const cache = getSearchCache();

    // Generate cache key
    const cacheKey = cache.generateKey(input);
    
    // Check cache first
    const cachedResult = cache.get<any>(cacheKey);
    if (cachedResult) {
      console.log('Returning cached search results');
      return cachedResult;
    }

    const page = input.pagination?.page ?? 1;
    const limit = input.pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = this.buildSearchWhereClause(input.filters);

    // Execute search
    const [apartments, total] = await Promise.all([
      this.db.apartment.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [input.sort?.field ?? 'createdAt']: input.sort?.order ?? 'desc',
        },
        include: {
          images: {
            orderBy: { order: 'asc' },
            take: 1, // Only get the first image for search results
          },
          nearestStations: {
            include: {
              station: true,
            },
            orderBy: { walkingMinutes: 'asc' },
            take: 3, // Only show top 3 nearest stations
          },
        },
      }),
      this.db.apartment.count({ where }),
    ]);

    const result = {
      apartments,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };

    // Cache the result for 30 minutes
    cache.set(cacheKey, result, 1800000);

    return result;
  }

  async searchByCommuteTime(
    input: CommuteSearchInput,
    userId: string
  ): Promise<{
    listId: string;
    jobId: string;
    status: 'pending' | 'processing' | 'completed';
    message: string;
  }> {
    // Use the search integration service
    const { getSearchIntegrationService } = await import('~/lib/search/search-integration');
    const searchService = getSearchIntegrationService(this.db);

    const { listId, jobId } = await searchService.initiateCommuteSearch(
      input,
      userId
    );

    return {
      listId,
      jobId,
      status: 'pending' as const,
      message: 'Search initiated. Results will be available shortly.',
    };
  }

  async getRecentSearches(
    userId: string,
    limit: number = 10
  ): Promise<SearchSessionWithMeta[]> {
    const searches = await this.db.searchSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Enhance with additional metadata
    const enhancedSearches = await Promise.all(
      searches.map(async (search) => {
        let additionalData: Partial<SearchSessionWithMeta> = {};

        if (search.listId) {
          const list = await this.db.list.findUnique({
            where: { id: search.listId },
            select: {
              name: true,
              status: true,
              _count: {
                select: { apartments: true },
              },
            },
          });

          if (list) {
            additionalData = {
              listName: list.name,
              status: list.status as any,
              apartmentCount: list._count.apartments,
            };
          }
        }

        return {
          ...search,
          ...additionalData,
        } as SearchSessionWithMeta;
      })
    );

    return enhancedSearches;
  }

  async getPopularSearches(): Promise<{
    popularStations: any[];
    popularLayouts: string[];
    popularPriceRanges: any[];
  }> {
    // This is a simplified version that returns common search patterns
    // In a real app, you'd analyze search sessions to find popular filters
    const popularStations = await this.db.station.findMany({
      take: 10,
      orderBy: {
        apartments: {
          _count: 'desc',
        },
      },
    });

    return {
      popularStations,
      popularLayouts: ['1K', '1DK', '1LDK', '2K', '2DK', '2LDK'],
      popularPriceRanges: [
        { label: 'Under ¥80,000', min: 0, max: 80000 },
        { label: '¥80,000 - ¥120,000', min: 80000, max: 120000 },
        { label: '¥120,000 - ¥200,000', min: 120000, max: 200000 },
        { label: 'Over ¥200,000', min: 200000, max: null },
      ],
    };
  }

  async getSuggestions(
    query: string,
    type?: 'station' | 'area' | 'amenity'
  ): Promise<{
    stations?: any[];
    amenities?: string[];
  }> {
    const suggestions: any = {};

    // Station suggestions
    if (!type || type === 'station') {
      suggestions.stations = await this.db.station.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { nameEn: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
      });
    }

    // Amenity suggestions (hardcoded for now)
    if (!type || type === 'amenity') {
      const allAmenities = [
        'Elevator', 'Parking', 'Pet Friendly', 'Balcony', 'Air Conditioning',
        'Auto Lock', 'Security Camera', 'Bicycle Parking', 'Storage Room',
      ];
      suggestions.amenities = allAmenities.filter(a =>
        a.toLowerCase().includes(query.toLowerCase())
      );
    }

    return suggestions;
  }

  async refreshApartments(
    filters: ApartmentFilters,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    totalFound: number;
    newlySaved: number;
    updated: number;
  }> {
    // Create logger for this scraping job
    const jobId = `refresh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const logger = createScraperLogger(jobId, 'realestate');
    
    logger.info('Starting apartment refresh', {
      userId,
      filters,
    });
    
    // Import scraper factory
    const { UnifiedScraperFactory } = await import('~/lib/scrapers/scraper-factory');
    
    // Get all active scrapers from database
    const activeSources = await this.db.scrapingSource.findMany({
      where: { isActive: true },
      select: { type: true }
    });

    if (activeSources.length === 0) {
      logger.error('No active scrapers available');
      throw new Error('No active scrapers available');
    }
    
    // Use the first active scraper for now
    const scraperType = activeSources[0]!.type;
    const scraper = UnifiedScraperFactory.create(scraperType as any);

    // Build search parameters
    const searchParams = {
      priceMin: filters.priceMin,
      priceMax: filters.priceMax,
      sizeMin: filters.sizeMin,
      sizeMax: filters.sizeMax,
      layout: filters.layout,
      stationIds: filters.stationIds,
      maxWalkingMinutes: filters.maxWalkingMinutes,
      limit: 100,
      warmupProxies: true,
    };

    try {
      logger.info('Starting scrape with parameters', searchParams);
      
      // Perform the scrape - use the old scraper's search method
      const scrapeResult = await scraper.search(searchParams);
      
      const apartments = scrapeResult.data || [];
      logger.info(`Scraping completed, found ${apartments.length} apartments`);
      
      // Save apartments to database
      let savedCount = 0;
      let updatedCount = 0;
      let errorCount = 0;
      
      for (const apartmentData of apartments) {
        try {
          // Check if apartment already exists
          const existing = await this.db.apartment.findUnique({
            where: {
              externalId_sourceSite: {
                externalId: apartmentData.externalId,
                sourceSite: apartmentData.sourceSite,
              },
            },
          });

          if (existing) {
            // Update existing apartment
            await this.db.apartment.update({
              where: { id: existing.id },
              data: {
                price: apartmentData.price,
                availability: apartmentData.availability,
                updatedAt: new Date(),
              },
            });
            updatedCount++;
          } else {
            // Get the scraping source ID
            const scrapingSource = await this.db.scrapingSource.findFirst({
              where: { 
                type: apartmentData.sourceSite,
                isActive: true
              },
              select: { id: true }
            });
            
            // Create new apartment
            const apartment = await this.db.apartment.create({
              data: {
                externalId: apartmentData.externalId,
                sourceUrl: apartmentData.sourceUrl,
                sourceSite: apartmentData.sourceSite,
                scrapingSourceId: scrapingSource?.id,
                title: apartmentData.title,
                price: apartmentData.price,
                size: apartmentData.size,
                layout: apartmentData.layout,
                floor: apartmentData.floor,
                totalFloors: apartmentData.totalFloors,
                buildingAge: apartmentData.buildingAge,
                address: apartmentData.address,
                area: apartmentData.area,
                ward: apartmentData.ward,
                city: apartmentData.city,
                prefecture: apartmentData.prefecture,
                latitude: apartmentData.latitude,
                longitude: apartmentData.longitude,
                description: apartmentData.description,
                amenities: apartmentData.amenities || [],
                availability: apartmentData.availability,
                nearbyStations: JSON.stringify(apartmentData.nearestStations || []),
                scrapedAt: new Date(),
                images: {
                  create: apartmentData.images.map((img: any) => ({
                    url: img.url,
                    caption: img.caption,
                    order: img.order,
                  })),
                },
              },
            });

            // Create station associations
            for (const stationInfo of apartmentData.nearestStations) {
              // Try to find the station by name
              const station = await this.db.station.findFirst({
                where: {
                  OR: [
                    { name: stationInfo.name },
                    { nameEn: stationInfo.name },
                  ],
                },
              });

              if (station) {
                await this.db.apartmentStation.create({
                  data: {
                    apartmentId: apartment.id,
                    stationId: station.id,
                    walkingMinutes: stationInfo.walkingMinutes,
                    distance: stationInfo.distance,
                  },
                }).catch(() => {
                  // Ignore duplicate errors
                });
              }
            }
            
            savedCount++;
          }
        } catch (error) {
          errorCount++;
          logger.error('Error saving apartment', {
            externalId: apartmentData.externalId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      logger.info('Apartment refresh completed', {
        totalFound: apartments.length,
        newlySaved: savedCount,
        updated: updatedCount,
        errors: errorCount,
      });

      return {
        success: true,
        message: `Refreshed apartments. Found ${apartments.length} apartments, saved ${savedCount} new ones, updated ${updatedCount}.`,
        totalFound: apartments.length,
        newlySaved: savedCount,
        updated: updatedCount,
      };
    } catch (error) {
      logger.error('Error refreshing apartments', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error('Failed to refresh apartments. Please try again later.');
    }
  }

  async getSearchProgress(listId: string, userId: string): Promise<any> {
    // First check if the list belongs to the user
    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        userId,
      },
    });

    if (!list) {
      throw new Error('List not found');
    }

    // Get progress from search integration service
    const { getSearchIntegrationService } = await import('~/lib/search/search-integration');
    const searchService = getSearchIntegrationService(this.db);
    
    const progress = await searchService.getSearchProgress(listId);
    return progress;
  }

  async fastSearch(
    filters: {
      priceMin?: number;
      priceMax?: number;
      sizeMin?: number;
      sizeMax?: number;
      sources?: string[];
    },
    limit: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    stats: any;
    apartments: any[];
  }> {
    const jobId = `fast-search-${Date.now()}`;
    const logger = createScraperLogger(jobId, 'multi-source');
    
    logger.info('Starting fast concurrent search', {
      userId,
      filters,
      limit,
    });

    // Import scraper factory
    const { UnifiedScraperFactory } = await import('~/lib/scrapers/scraper-factory');
    
    // Get active scrapers
    const activeSources = await this.db.scrapingSource.findMany({
      where: { 
        isActive: true,
        ...(filters.sources && {
          type: { in: filters.sources }
        })
      },
      select: { type: true }
    });

    if (activeSources.length === 0) {
      throw new Error('No active scrapers available');
    }

    // Build search parameters
    const searchParams = {
      maxPrice: filters.priceMax,
      minSize: filters.sizeMin,
      limit: Math.ceil(limit / activeSources.length),
      warmupProxies: true,
    };

    // Create scrapers for each source
    const scrapers = activeSources.map(source => ({
      type: source.type,
      scraper: UnifiedScraperFactory.create(source.type as any)
    }));

    logger.info(`Searching ${scrapers.length} sources concurrently`);

    // Execute searches concurrently
    const searchPromises = scrapers.map(async ({ type, scraper }) => {
      try {
        const startTime = Date.now();
        const result = await scraper.search(searchParams);
        const duration = Date.now() - startTime;
        
        logger.info(`Scraper ${type} completed`, {
          found: result.data?.length || 0,
          duration,
        });
        
        return { type, result, duration };
      } catch (error) {
        logger.error(`Scraper ${type} failed`, {
          error: error instanceof Error ? error.message : String(error)
        });
        return { type, result: { success: false, data: [] }, duration: 0, error };
      }
    });

    const results = await Promise.allSettled(searchPromises);
    
    // Aggregate results
    const allApartments: any[] = [];
    const stats = {
      totalFound: 0,
      successfulSources: 0,
      failedSources: 0,
      totalDuration: 0,
      sourceStats: {} as Record<string, any>,
    };

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.result.data && result.value.result.data.length > 0) {
        allApartments.push(...result.value.result.data);
        stats.totalFound += result.value.result.data.length;
        stats.successfulSources++;
        stats.sourceStats[result.value.type] = {
          found: result.value.result.data.length,
          duration: result.value.duration,
          success: true,
        };
      } else {
        stats.failedSources++;
        if (result.status === 'fulfilled') {
          stats.sourceStats[result.value.type] = {
            found: 0,
            duration: result.value.duration,
            success: false,
            error: result.value.error instanceof Error ? result.value.error.message : String(result.value.error),
          };
        }
      }
    }

    // Deduplicate by external ID
    const uniqueApartments = new Map();
    for (const apt of allApartments) {
      const key = `${apt.sourceSite}-${apt.externalId}`;
      if (!uniqueApartments.has(key)) {
        uniqueApartments.set(key, apt);
      }
    }

    logger.info('Fast search completed', {
      totalFound: stats.totalFound,
      uniqueFound: uniqueApartments.size,
      successfulSources: stats.successfulSources,
      failedSources: stats.failedSources,
      sourceStats: stats.sourceStats,
    });

    return {
      success: true,
      message: `Fast search completed. Found ${uniqueApartments.size} unique apartments from ${stats.successfulSources} sources.`,
      stats,
      apartments: Array.from(uniqueApartments.values()).slice(0, limit),
    };
  }

  /**
   * Build Prisma where clause from search filters
   */
  private buildSearchWhereClause(filters: any): Prisma.ApartmentWhereInput {
    const where: Prisma.ApartmentWhereInput = {
      removed: false,
      AND: [],
    };

    // Apply filters
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      (where.AND as any[]).push({
        price: {
          ...(filters.priceMin !== undefined && { gte: filters.priceMin }),
          ...(filters.priceMax !== undefined && { lte: filters.priceMax }),
        },
      });
    }

    if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) {
      (where.AND as any[]).push({
        size: {
          ...(filters.sizeMin !== undefined && { gte: filters.sizeMin }),
          ...(filters.sizeMax !== undefined && { lte: filters.sizeMax }),
        },
      });
    }

    if (filters.layout && filters.layout.length > 0) {
      (where.AND as any[]).push({
        layout: { in: filters.layout },
      });
    }

    if (filters.amenities && filters.amenities.length > 0) {
      (where.AND as any[]).push({
        amenities: { hasSome: filters.amenities },
      });
    }

    if (filters.stationIds && filters.stationIds.length > 0) {
      (where.AND as any[]).push({
        nearestStations: {
          some: {
            stationId: { in: filters.stationIds },
            ...(filters.maxWalkingMinutes !== undefined && {
              walkingMinutes: { lte: filters.maxWalkingMinutes },
            }),
          },
        },
      });
    }

    if ((where.AND as any[]).length === 0) {
      delete where.AND;
    }

    return where;
  }
  
  /**
   * Save a search session for the authenticated user
   */
  async saveSearchSession(
    userId: string,
    filters: any,
    resultCount: number
  ): Promise<void> {
    await this.db.searchSession.create({
      data: {
        userId,
        filters,
        resultCount,
      },
    });
  }
}