import { type PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Session } from "next-auth";

interface RefreshResult {
  success: boolean;
  jobsCreated: number;
  apartmentsQueued: number;
  totalInList: number;
  skippedRemoved: number;
  skippedMissingData: number;
  message: string;
}

interface ApartmentWithSource {
  id: string;
  sourceUrl: string | null;
  sourceSite: string | null;
  externalId: string | null;
  removed: boolean;
}

interface RouteCalculationResult {
  apartments: any[];
  listItems: any[];
  total: number;
  listName: string;
  targetStationName: string;
}

export class ListRefreshService {
  constructor(
    private db: PrismaClient,
    private session: Session
  ) {}

  /**
   * Refresh all apartments in a list
   */
  async refreshAllApartments(listId: string, includeRemovalCheck = true): Promise<RefreshResult> {
    // Verify list ownership or admin
    const user = await this.db.user.findUnique({
      where: { id: this.session.user.id },
      select: { role: true },
    });

    const list = await this.db.list.findFirst({
      where: {
        id: listId,
        OR: [
          { userId: this.session.user.id },
          { userId: user?.role === 'ADMIN' ? undefined : this.session.user.id },
        ],
      },
      include: {
        apartments: {
          include: {
            apartment: {
              select: {
                id: true,
                sourceUrl: true,
                sourceSite: true,
                externalId: true,
                removed: true,
              },
            },
          },
        },
      },
    });

    if (!list) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'List not found or access denied',
      });
    }

    // Analyze apartments and group by source
    const analysis = this.analyzeApartments(list.apartments);
    
    // Log analysis results
    this.logRefreshAnalysis(analysis, list.apartments.length);
    
    // Group apartments by source for job creation
    const apartmentsBySource = this.groupApartmentsBySource(analysis.valid);
    
    // Create refresh jobs
    const jobIds = await this.createRefreshJobs(apartmentsBySource, includeRemovalCheck);

    return {
      success: true,
      jobsCreated: jobIds.length,
      apartmentsQueued: analysis.valid.length,
      totalInList: list.apartments.length,
      skippedRemoved: analysis.skipped.removed.length,
      skippedMissingData: analysis.skipped.missingData.length + analysis.skipped.unknownSource.length,
      message: `Refreshing ${analysis.valid.length} apartments (${analysis.skipped.removed.length} removed skipped, ${analysis.skipped.missingData.length + analysis.skipped.unknownSource.length} missing data). ${jobIds.length} update jobs created.`,
    };
  }

  /**
   * Calculate routes for all apartments in a list to a specific station
   */
  async getAllApartmentsWithRoutes(
    listId: string,
    targetStationId: string,
    filters?: any,
    sort?: any
  ): Promise<RouteCalculationResult> {
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

    // Get the target station details
    const targetStation = await this.db.station.findUnique({
      where: { id: targetStationId },
    });

    if (!targetStation) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Target station not found',
      });
    }

    // Build filters and fetch apartments
    const { apartmentListItems, apartments } = await this.fetchApartmentsForRouteCalculation(
      listId,
      targetStationId,
      filters
    );

    // Calculate routes for apartments that don't have them yet
    const apartmentsWithoutRoutes = apartments.filter(
      apt => !apt.routes || apt.routes.length === 0
    );

    if (apartmentsWithoutRoutes.length > 0) {
      await this.calculateMissingRoutes(apartmentsWithoutRoutes, targetStation);
    }
    
    // Apply sorting if needed
    if (sort) {
      this.sortApartmentsForExport(apartments, apartmentListItems, sort);
    }

    return {
      apartments,
      listItems: apartmentListItems,
      total: apartments.length,
      listName: list.name,
      targetStationName: targetStation.name,
    };
  }

  /**
   * Analyze apartments and categorize them
   */
  private analyzeApartments(apartments: any[]) {
    const valid: ApartmentWithSource[] = [];
    const skipped = {
      removed: [] as any[],
      missingData: [] as any[],
      unknownSource: [] as any[],
    };

    // Stats tracking
    const sourceSiteBreakdown: Record<string, number> = {};
    const removedBySource: Record<string, number> = {};

    apartments.forEach(item => {
      if (!item.apartment) {
        skipped.missingData.push({ id: null, reason: 'No apartment data' });
        return;
      }

      const apartment = item.apartment;

      // Track source site stats
      if (apartment.sourceSite) {
        sourceSiteBreakdown[apartment.sourceSite] = (sourceSiteBreakdown[apartment.sourceSite] || 0) + 1;
        if (apartment.removed) {
          removedBySource[apartment.sourceSite] = (removedBySource[apartment.sourceSite] || 0) + 1;
        }
      }

      // Skip if missing required data
      if (!apartment.sourceUrl || !apartment.sourceSite) {
        skipped.missingData.push({
          id: apartment.id,
          hasUrl: !!apartment.sourceUrl,
          hasSite: !!apartment.sourceSite,
          sourceUrl: apartment.sourceUrl,
          sourceSite: apartment.sourceSite,
        });
        return;
      }

      // Skip removed apartments
      if (apartment.removed) {
        skipped.removed.push({
          id: apartment.id,
          externalId: apartment.externalId,
          sourceSite: apartment.sourceSite,
        });
        return;
      }

      // Validate source site
      const scraperType = this.mapSourceSiteToScraperType(apartment.sourceSite);
      if (!scraperType) {
        skipped.unknownSource.push({
          id: apartment.id,
          externalId: apartment.externalId,
          sourceSite: apartment.sourceSite,
          sourceUrl: apartment.sourceUrl,
        });
        return;
      }

      valid.push(apartment);
    });

    return {
      valid,
      skipped,
      stats: {
        sourceSiteBreakdown,
        removedBySource,
      },
    };
  }

  /**
   * Map source site to scraper type
   */
  private mapSourceSiteToScraperType(sourceSite: string): string | null {
    const mappings: Record<string, string> = {
      'realestate.co.jp': 'realestate',
      'yolo-japan.com': 'yolo-japan',
      'home.yolo-japan.com': 'yolo-japan',
      'wagaya-japan.com': 'wagaya-japan',
      'e-housing.co.jp': 'e-housing',
      'metro-residences.com': 'metro-residences',
      // Handle if sourceSite is already the scraper type
      'wagaya-japan': 'wagaya-japan',
      'yolo-japan': 'yolo-japan',
      'realestate': 'realestate',
      'e-housing': 'e-housing',
      'metro-residences': 'metro-residences',
    };

    return mappings[sourceSite] || null;
  }

  /**
   * Group apartments by their scraper type
   */
  private groupApartmentsBySource(apartments: ApartmentWithSource[]): Record<string, string[]> {
    const grouped: Record<string, string[]> = {};

    apartments.forEach(apartment => {
      if (!apartment.sourceSite || !apartment.sourceUrl) return;
      
      const scraperType = this.mapSourceSiteToScraperType(apartment.sourceSite);
      if (!scraperType) return;

      if (!grouped[scraperType]) {
        grouped[scraperType] = [];
      }
      grouped[scraperType].push(apartment.sourceUrl);
    });

    return grouped;
  }

  /**
   * Create refresh jobs for apartments
   */
  private async createRefreshJobs(
    apartmentsBySource: Record<string, string[]>,
    includeRemovalCheck: boolean
  ): Promise<string[]> {
    // Import job queue and ensure processors are initialized
    const { getJobQueue } = await import('~/lib/jobs/queue');
    const { ensureProcessorsInitialized } = await import('~/lib/jobs/processors');
    ensureProcessorsInitialized();
    const jobQueue = getJobQueue();

    const jobIds: string[] = [];
    
    // Create update jobs for each source
    for (const [scraperType, urls] of Object.entries(apartmentsBySource)) {
      // Split into batches of 50 URLs per job
      const batchSize = 50;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const jobId = await jobQueue.add('update-apartments-by-urls', {
          urls: batch,
          scraperType,
          scraperName: scraperType,
          scraperUrl: '',
          userId: this.session.user.id,
          userName: this.session.user.name || this.session.user.email || 'System',
          timestamp: new Date(),
          action: 'refresh-list',
          expectedLimit: batch.length,
          includeRemovalCheck,
        });
        jobIds.push(jobId);
      }
    }

    return jobIds;
  }

  /**
   * Log refresh analysis details
   */
  private logRefreshAnalysis(analysis: any, totalApartments: number) {
    console.log(`[refreshAllApartments] Total apartments in list: ${totalApartments}`);
    console.log(`[refreshAllApartments] Valid apartments to refresh: ${analysis.valid.length}`);
    console.log(`[refreshAllApartments] Source site breakdown:`, analysis.stats.sourceSiteBreakdown);
    console.log(`[refreshAllApartments] Removed apartments by source:`, analysis.stats.removedBySource);
    
    console.log(`[refreshAllApartments] === SKIP DETAILS ===`);
    console.log(`[refreshAllApartments] Removed apartments (${analysis.skipped.removed.length}):`, 
      analysis.skipped.removed.slice(0, 5).map((a: any) => `${a.externalId} (${a.sourceSite})`),
      analysis.skipped.removed.length > 5 ? `... and ${analysis.skipped.removed.length - 5} more` : ''
    );
    console.log(`[refreshAllApartments] Missing data (${analysis.skipped.missingData.length}):`, 
      analysis.skipped.missingData.slice(0, 5)
    );
    console.log(`[refreshAllApartments] Unknown source (${analysis.skipped.unknownSource.length}):`, 
      analysis.skipped.unknownSource.slice(0, 5)
    );
    console.log(`[refreshAllApartments] === END SKIP DETAILS ===`);
  }

  /**
   * Fetch apartments for route calculation
   */
  private async fetchApartmentsForRouteCalculation(
    listId: string,
    targetStationId: string,
    filters?: any
  ) {
    // Build apartment filters (reuse from list-query.service logic)
    const apartmentWhere: any = {};
    
    if (filters) {
      // Apply all the filters...
      // This is simplified - in production you'd want to share this logic
      if (filters.priceMin !== undefined) {
        apartmentWhere.price = { ...apartmentWhere.price, gte: filters.priceMin };
      }
      if (filters.priceMax !== undefined) {
        apartmentWhere.price = { ...apartmentWhere.price, lte: filters.priceMax };
      }
      // ... etc for all filters
    }
    
    const listItemWhere: any = {
      listId,
      apartment: apartmentWhere,
    };
    
    // Add commute time filter if specified
    if (filters?.maxCommuteMinutes !== undefined) {
      listItemWhere.apartment = {
        ...apartmentWhere,
        routes: {
          some: {
            toStationId: targetStationId,
            duration: { lte: filters.maxCommuteMinutes },
          },
        },
      };
    }

    // Fetch all apartments
    const apartmentListItems = await this.db.apartmentList.findMany({
      where: listItemWhere,
      include: {
        apartment: {
          include: {
            images: {
              orderBy: { order: 'asc' },
              take: 1,
            },
            nearestStations: {
              include: {
                station: true,
              },
              orderBy: { walkingMinutes: 'asc' },
              take: 1,
            },
            preferredStation: true,
            routes: {
              where: {
                toStationId: targetStationId,
              },
              include: {
                toStation: true,
              },
              take: 1,
            },
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

    const apartments = apartmentListItems.map(item => item.apartment);
    
    return { apartmentListItems, apartments };
  }

  /**
   * Calculate missing routes for apartments
   */
  private async calculateMissingRoutes(apartments: any[], targetStation: any) {
    // Import simplified OTP service for route calculation
    const { getSimplifiedOTPService } = await import('~/lib/transit/simplified-otp-service');
    const transitService = await getSimplifiedOTPService();
    
    let calculatedCount = 0;
    const batchSize = 10; // Process in batches to avoid overwhelming the service
    
    for (let i = 0; i < apartments.length; i += batchSize) {
      const batch = apartments.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (apartment) => {
          if (!apartment.latitude || !apartment.longitude) return;
          
          try {
            const route = await transitService.getRoute(
              apartment.latitude,
              apartment.longitude,
              targetStation.latitude,
              targetStation.longitude,
              120 // max 2 hours
            );
            
            if (route) {
              // Save the calculated route
              const savedRoute = await this.db.route.create({
                data: {
                  apartmentId: apartment.id,
                  toStationId: targetStation.id,
                  duration: route.totalMinutes,
                  transfers: route.transfers,
                  walkTime: route.walkingMinutes,
                  trainTime: route.transitMinutes,
                  routeData: route,
                },
                include: {
                  toStation: true,
                },
              });
              
              // Add the route to the apartment object
              apartment.routes = [savedRoute];
              calculatedCount++;
            }
          } catch (error) {
            console.error(`Failed to calculate route for apartment ${apartment.id}:`, error);
          }
        })
      );
      
      // Small delay between batches
      if (i + batchSize < apartments.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (calculatedCount > 0) {
      console.log(`Calculated ${calculatedCount} new routes to ${targetStation.name}`);
    }
  }

  /**
   * Sort apartments for export
   */
  private sortApartmentsForExport(apartments: any[], apartmentListItems: any[], sort: any) {
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
        apartments.sort((a, b) => {
          const aRoute = a.routes?.[0];
          const bRoute = b.routes?.[0];
          
          if (!aRoute && !bRoute) return 0;
          if (!aRoute) return 1;
          if (!bRoute) return -1;
          
          const diff = aRoute.duration - bRoute.duration;
          return order === 'asc' ? diff : -diff;
        });
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
  }
}