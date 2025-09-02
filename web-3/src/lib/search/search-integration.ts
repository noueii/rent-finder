import { PrismaClient, ListType } from '@prisma/client';
import { getTransitService, type ReachableStation, getSimplifiedOTPService } from '../transit';
import { getJobQueue } from '../jobs/queue';
import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
import { createScraperLogger } from '../logging/scraper-logger';
import type { CommuteSearchInput, ScrapedApartmentData } from '~/types';
// Import scrapers to trigger registration
import '../scrapers/sources';

export interface CommuteSearchJobData {
  listId: string;
  userId: string;
  workplaceStationId: string;
  maxCommuteMinutes: number;
  filters?: CommuteSearchInput['filters'];
}

export interface CommuteRoutePruneJobData {
  listId: string;
  workplaceStationId: string;
  maxCommuteMinutes: number;
}

export interface SearchProgress {
  phase: 'calculating_stations' | 'scraping' | 'saving_results' | 'completed';
  progress: number;
  message: string;
  stationsFound?: number;
  apartmentsFound?: number;
  apartmentsSaved?: number;
}

/**
 * Service for integrating commute calculation with apartment search
 */
export class SearchIntegrationService {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
    this.setupJobProcessors();
  }

  /**
   * Get scraping source ID from database based on scraper type
   */
  private async getScrapingSourceId(scraperType: string): Promise<string | null> {
    const source = await this.db.scrapingSource.findFirst({
      where: { 
        type: scraperType,
        isActive: true
      },
      select: { id: true }
    });
    return source?.id ?? null;
  }

  /**
   * Setup job processors for background search tasks
   */
  private setupJobProcessors(): void {
    const queue = getJobQueue();

    // Register commute search processor
    queue.process<CommuteSearchJobData>('commute_search', async (job, updateProgress) => {
      const logger = createScraperLogger(job.id, 'commute_search');
      return this.processCommuteSearch(job.data, updateProgress, logger);
    });

    // Register route calculation and pruning processor
    queue.process<CommuteRoutePruneJobData>('commute_route_prune', async (job, updateProgress) => {
      const logger = createScraperLogger(job.id, 'commute_route_prune');
      return this.processRoutePrune(job.data, updateProgress, logger);
    });
  }

  /**
   * Initiate a commute-based search
   */
  async initiateCommuteSearch(input: CommuteSearchInput, userId: string): Promise<{
    listId: string;
    jobId: string;
  }> {
    // Create a search result list
    const list = await this.db.list.create({
      data: {
        userId,
        name: input.listName || `Commute search to ${input.workplaceStationId} (max ${input.maxCommuteMinutes}min)`,
        description: input.listDescription,
        type: ListType.SEARCH_RESULT,
        searchParams: input,
        status: 'pending',
        progress: 0,
      },
    });

    // Create search session
    await this.db.searchSession.create({
      data: {
        userId,
        filters: input,
        listId: list.id,
      },
    });

    // Queue the background job
    const queue = getJobQueue();
    const jobId = await queue.add<CommuteSearchJobData>('commute_search', {
      listId: list.id,
      userId,
      workplaceStationId: input.workplaceStationId,
      maxCommuteMinutes: input.maxCommuteMinutes,
      filters: input.filters,
    });

    return { listId: list.id, jobId };
  }

  /**
   * Process a commute search job
   */
  private async processCommuteSearch(
    data: CommuteSearchJobData,
    updateProgress: (progress: number) => void,
    logger: ReturnType<typeof createScraperLogger>
  ): Promise<void> {
    try {
      logger.info('Starting commute search job', {
        listId: data.listId,
        workplaceStationId: data.workplaceStationId,
        maxCommuteMinutes: data.maxCommuteMinutes,
        filters: data.filters,
      });

      // Update list status
      await this.db.list.update({
        where: { id: data.listId },
        data: { status: 'processing', progress: 0 },
      });

      // Get workplace station details from database
      const workplaceStationDb = await this.db.station.findUnique({
        where: { id: data.workplaceStationId }
      });
      
      if (!workplaceStationDb) {
        logger.error(`Workplace station not found in database: ${data.workplaceStationId}`);
        throw new Error(`Workplace station ${data.workplaceStationId} not found`);
      }
      
      logger.info(`Workplace station: ${workplaceStationDb.name} (${workplaceStationDb.nameEn})`);

      // Phase 1: Get all apartments that match criteria
      logger.info('Phase 1: Finding apartments that match criteria...');
      updateProgress(10);
      const apartments = await this.getApartmentsMatchingFilters(
        data.filters,
        data.workplaceStationId
      );

      logger.info(`Found ${apartments.length} apartments matching filters`);

      await this.db.list.update({
        where: { id: data.listId },
        data: { 
          progress: 20,
          status: 'processing',
        },
      });

      // Phase 2: Add all matching apartments to the list (20-50% of progress)
      logger.info('Phase 2: Adding apartments to list...');
      logger.info(`Total apartments to process: ${apartments.length}`);
      updateProgress(20);
      
      // Use createMany for bulk insert - much more efficient
      const apartmentListData = apartments.map(apartment => ({
        apartmentId: apartment.id,
        listId: data.listId,
      }));
      
      try {
        const result = await this.db.apartmentList.createMany({
          data: apartmentListData,
          skipDuplicates: true, // This will skip any apartments already in the list
        });
        
        logger.info(`Added ${result.count} new apartments to the list`);
        updateProgress(50);
      } catch (error) {
        logger.error('Error bulk adding apartments to list', {
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }

      // Phase 3: Queue job to calculate missing routes and prune (50-100% of progress)
      logger.info('Phase 3: Queueing route calculation and pruning job...');
      updateProgress(50);
      
      // Queue a separate job to calculate routes and prune
      const queue = getJobQueue();
      await queue.add<CommuteRoutePruneJobData>('commute_route_prune', {
        listId: data.listId,
        workplaceStationId: data.workplaceStationId,
        maxCommuteMinutes: data.maxCommuteMinutes,
      });

      // Update progress to show initial phase completed
      updateProgress(60);

      // Mark as completed
      await this.db.list.update({
        where: { id: data.listId },
        data: { 
          status: 'completed',
          progress: 100,
        },
      });

      updateProgress(100);
      logger.info('Commute search completed successfully', {
        listId: data.listId,
        apartmentsFound: apartments.length,
        apartmentsSaved: apartmentListData.length,
        pruningJobQueued: true
      });

    } catch (error) {
      logger.error('Error processing commute search', {
        listId: data.listId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Update list status to failed
      await this.db.list.update({
        where: { id: data.listId },
        data: { 
          status: 'failed',
        },
      });

      throw error;
    }
  }

  /**
   * Process route calculation and pruning job
   */
  private async processRoutePrune(
    data: CommuteRoutePruneJobData,
    updateProgress: (progress: number) => void,
    logger: ReturnType<typeof createScraperLogger>
  ): Promise<void> {
    try {
      logger.info('Starting route calculation and pruning job', {
        listId: data.listId,
        workplaceStationId: data.workplaceStationId,
        maxCommuteMinutes: data.maxCommuteMinutes,
      });

      // STEP 1: Remove apartments without coordinates (can't calculate routes)
      const deletedNoCoords = await this.db.apartmentList.deleteMany({
        where: {
          listId: data.listId,
          apartment: {
            OR: [
              { latitude: null },
              { longitude: null },
            ],
          },
        },
      });
      
      if (deletedNoCoords.count > 0) {
        logger.info(`Removed ${deletedNoCoords.count} apartments without coordinates`);
      }

      // STEP 2: Remove apartments with existing routes that exceed max commute time
      const apartmentsWithExcessiveCommute = await this.db.apartmentList.findMany({
        where: {
          listId: data.listId,
          apartment: {
            routes: {
              some: {
                toStationId: data.workplaceStationId,
                duration: {
                  gt: data.maxCommuteMinutes,
                },
              },
            },
          },
        },
        select: {
          apartmentId: true,
        },
      });

      if (apartmentsWithExcessiveCommute.length > 0) {
        const deletedExcessive = await this.db.apartmentList.deleteMany({
          where: {
            listId: data.listId,
            apartmentId: {
              in: apartmentsWithExcessiveCommute.map(item => item.apartmentId),
            },
          },
        });
        logger.info(`Removed ${deletedExcessive.count} apartments with commute time > ${data.maxCommuteMinutes} minutes`);
      }

      // STEP 3: Find apartments that need route calculation (have coordinates but no route to workplace)
      const apartmentsNeedingRoutes = await this.db.apartmentList.findMany({
        where: {
          listId: data.listId,
          apartment: {
            AND: [
              { latitude: { not: null } },
              { longitude: { not: null } },
              {
                routes: {
                  none: {
                    toStationId: data.workplaceStationId,
                  },
                },
              },
            ],
          },
        },
        include: {
          apartment: true,
        },
      });

      logger.info(`${apartmentsNeedingRoutes.length} apartments need route calculation`);

      // Get workplace station details from database
      const workplaceStationDb = await this.db.station.findUnique({
        where: { id: data.workplaceStationId }
      });
      
      if (!workplaceStationDb) {
        throw new Error(`Workplace station ${data.workplaceStationId} not found`);
      }
      
      if (!workplaceStationDb.latitude || !workplaceStationDb.longitude) {
        throw new Error(`Workplace station ${data.workplaceStationId} has no coordinates`);
      }
      
      // Store workplace station coordinates for OTP service
      const workplaceLatitude = workplaceStationDb.latitude;
      const workplaceLongitude = workplaceStationDb.longitude;
      
      logger.info(`Workplace station coordinates: lat=${workplaceLatitude}, lon=${workplaceLongitude}`);

      // Calculate routes for apartments without them
      const transitService = await getSimplifiedOTPService();
      let processed = 0;
      let routesCalculated = 0;
      let routesExceedingMax = 0;
      let noRouteFound = 0;

      const LOG_PREFIX = 'commute_route_prune';
      const LOG_SUFFIX = 'commute_';

      // Process in batches to avoid overwhelming the OTP service
      const BATCH_SIZE = 10;
      
      for (let i = 0; i < apartmentsNeedingRoutes.length; i += BATCH_SIZE) {
        const batch = apartmentsNeedingRoutes.slice(i, Math.min(i + BATCH_SIZE, apartmentsNeedingRoutes.length));
        const apartmentIdsToRemove: string[] = [];
        
        await Promise.all(batch.map(async (item) => {
          try {
            const apartment = item.apartment;
            
            // Calculate route with a higher time limit to find any possible route
            const route = await transitService.getRoute(
              apartment.latitude,
              apartment.longitude,
              workplaceLatitude,
              workplaceLongitude,
              180 // Use 3 hours to find any possible route
            );

            if (!route) {
              logger.info(`[${LOG_PREFIX}:${LOG_SUFFIX}] No route found for apartment ${apartment.id}`);
              apartmentIdsToRemove.push(apartment.id);
              noRouteFound++;
              return;
            }

            // Validate that the route actually reaches the destination
            if (route.legs && route.legs.length > 0) {
              const lastLeg = route.legs[route.legs.length - 1];
              const endLat = lastLeg.to?.lat;
              const endLon = lastLeg.to?.lon;
              
              if (endLat && endLon) {
                // Calculate distance between route end and workplace
                const distance = this.calculateDistance(endLat, endLon, workplaceLatitude, workplaceLongitude);
                
                // If route ends more than 1km from workplace, it's invalid
                if (distance > 1000) {
                  logger.warn(`[${LOG_PREFIX}:${LOG_SUFFIX}] Route for apartment ${apartment.id} doesn't reach workplace (${distance.toFixed(0)}m away)`);
                  apartmentIdsToRemove.push(apartment.id);
                  noRouteFound++;
                  return;
                }
              }
            }

            // Use the times from OTP directly (in seconds) for validation
            const durationSeconds = route.duration;
            const walkTimeSeconds = route.walkTime || 0;
            const transitTimeSeconds = route.transitTime || 0;
            const waitingTimeSeconds = route.waitingTime || 0;
            
            // Validate that times add up (with small tolerance for rounding)
            const totalTimeSeconds = walkTimeSeconds + transitTimeSeconds + waitingTimeSeconds;
            const timeDifference = Math.abs(durationSeconds - totalTimeSeconds);
            
            if (timeDifference > 5) { // More than 5 seconds difference
              logger.warn(`[${LOG_PREFIX}:${LOG_SUFFIX}] Route times don't add up: walk=${walkTimeSeconds}s + transit=${transitTimeSeconds}s + wait=${waitingTimeSeconds}s = ${totalTimeSeconds}s, but duration=${durationSeconds}s (diff=${timeDifference}s) for apartment ${apartment.id}`);
            }
            
            // Now calculate the rounded minutes for storage
            const commuteMinutes = Math.ceil(durationSeconds / 60);
            const walkTime = Math.ceil(walkTimeSeconds / 60);
            const trainTime = Math.ceil(transitTimeSeconds / 60);
            
            // Additional validation after rounding
            if (trainTime > 0 && route.legs.every(leg => leg.mode === 'WALK')) {
              logger.warn(`[${LOG_PREFIX}:${LOG_SUFFIX}] Route has trainTime=${trainTime}min but only WALK legs for apartment ${apartment.id}`);
            }
            
            // Store the route regardless of duration to establish the link
            await this.db.route.create({
              data: {
                apartmentId: apartment.id,
                toStationId: data.workplaceStationId,
                duration: commuteMinutes,
                transfers: route.transfers,
                walkTime,
                trainTime,
                routeData: route,
                calculatedAt: new Date(),
              },
            });
            routesCalculated++;

            // Check if apartment should be removed based on max commute time
            if (commuteMinutes > data.maxCommuteMinutes) {
              apartmentIdsToRemove.push(apartment.id);
              routesExceedingMax++;
              logger.info(`[${LOG_PREFIX}:${LOG_SUFFIX}] Apartment ${apartment.id} exceeds max commute: ${commuteMinutes} > ${data.maxCommuteMinutes} min`);
            }

          } catch (error) {
            logger.error(`[${LOG_PREFIX}:${LOG_SUFFIX}] Error calculating route for apartment`, {
              apartmentId: item.apartment.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }));
        
        // Remove apartments from this batch that need to be pruned
        if (apartmentIdsToRemove.length > 0) {
          await this.db.apartmentList.deleteMany({
            where: {
              listId: data.listId,
              apartmentId: { in: apartmentIdsToRemove },
            },
          });
        }
        
        processed += batch.length;
        const progress = 20 + (processed / apartmentsNeedingRoutes.length) * 70;
        updateProgress(progress);
      }

      // Summary of pruning results
      logger.info('Route calculation and pruning summary:', {
        totalProcessed: apartmentsNeedingRoutes.length,
        routesCalculated,
        noRouteFound,
        routesExceedingMax,
        totalRemoved: noRouteFound + routesExceedingMax,
      });

      updateProgress(90);

      // Update list status to completed
      await this.db.list.update({
        where: { id: data.listId },
        data: { 
          status: 'completed',
          progress: 100,
        },
      });

      updateProgress(100);
      logger.info('Route calculation and pruning completed successfully');

    } catch (error) {
      logger.error('Error processing route prune job', {
        listId: data.listId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Update list status to failed
      await this.db.list.update({
        where: { id: data.listId },
        data: { 
          status: 'failed',
        },
      });

      throw error;
    }
  }

  /**
   * Get all apartments that match filters, including their routes to the workplace station
   */
  private async getApartmentsMatchingFilters(
    filters: CommuteSearchInput['filters'],
    workplaceStationId: string
  ): Promise<any[]> {
    // Build where clause for filters
    const where: any = {
      removed: false,
      AND: [],
    };

    if (filters) {
      if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
        where.AND.push({
          price: {
            ...(filters.priceMin !== undefined && { gte: filters.priceMin }),
            ...(filters.priceMax !== undefined && { lte: filters.priceMax }),
          },
        });
      }

      if (filters.sizeMin !== undefined || filters.sizeMax !== undefined) {
        where.AND.push({
          size: {
            ...(filters.sizeMin !== undefined && { gte: filters.sizeMin }),
            ...(filters.sizeMax !== undefined && { lte: filters.sizeMax }),
          },
        });
      }

      if (filters.layout && filters.layout.length > 0) {
        where.AND.push({
          layout: { in: filters.layout },
        });
      }

      if (filters.amenities && filters.amenities.length > 0) {
        where.AND.push({
          amenities: { hasSome: filters.amenities },
        });
      }
    }

    // Only get apartments that have coordinates
    where.AND.push({
      latitude: { not: null },
      longitude: { not: null },
    });

    if (where.AND.length === 0) {
      delete where.AND;
    }

    // Get all apartments matching filters
    // We'll calculate routes to the workplace station later
    const apartments = await this.db.apartment.findMany({
      where,
      include: {
        routes: {
          where: {
            toStationId: workplaceStationId,
          },
        },
      },
      // Remove the limit - we want all matching apartments
    });

    return apartments;
  }

  /**
   * Calculate distance between two points in meters using Haversine formula
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Calculate reachable stations from a workplace
   */
  private async calculateReachableStations(
    workplaceStationId: string,
    maxCommuteMinutes: number
  ): Promise<ReachableStation[]> {
    try {
      // Use simplified transit service with automatic fallback
      const transitService = await getSimplifiedOTPService();
      const graphService = await getTransitService();
      
      // Get workplace station coordinates
      const workplaceStation = graphService.getStation(workplaceStationId);
      if (!workplaceStation) {
        throw new Error(`Station ${workplaceStationId} not found`);
      }

      // Extract coordinates based on format
      let stationLat: number;
      let stationLon: number;
      
      if (Array.isArray(workplaceStation.coordinates)) {
        stationLon = workplaceStation.coordinates[0];
        stationLat = workplaceStation.coordinates[1];
      } else {
        stationLat = workplaceStation.coordinates.lat;
        stationLon = workplaceStation.coordinates.lon;
      }

      // Use simplified service to find reachable locations
      const reachableStations = await transitService.findReachableLocations(
        stationLat,
        stationLon,
        maxCommuteMinutes
      );

      console.log(`Transit service found ${reachableStations.length} reachable stations`);
      
      // Filter to only include stations within reasonable walking distance
      // (we'll search for apartments within 15 minutes walk of these stations)
      return reachableStations.filter(station => station.travel_time <= maxCommuteMinutes);
      
    } catch (error) {
      console.error('Error calculating reachable stations:', error);
      
      // Fallback to basic transit service
      const transitService = await getTransitService();
      const reachableStations = transitService.findReachableStations(
        workplaceStationId,
        maxCommuteMinutes
      );
      
      return reachableStations.filter(station => station.travel_time <= maxCommuteMinutes);
    }
  }

  /**
   * Search for apartments near reachable stations
   */
  private async searchApartmentsNearStations(
    stations: ReachableStation[],
    filters?: CommuteSearchInput['filters'],
    onProgress?: (phase: string, progress: number) => void
  ): Promise<ScrapedApartmentData[]> {
    const allApartments: ScrapedApartmentData[] = [];
    const processedUrls = new Set<string>();

    // Get all active scrapers from database
    const activeSources = await this.db.scrapingSource.findMany({
      where: { isActive: true },
      select: { type: true }
    });

    if (activeSources.length === 0) {
      throw new Error('No active scrapers available');
    }

    // Group stations by area to optimize scraping
    const stationGroups = this.groupStationsByArea(stations);
    
    // Process each scraper
    let scraperIndex = 0;
    for (const source of activeSources) {
      try {
        const scraper = UnifiedScraperFactory.create(source.type as any);
        let groupsProcessed = 0;

        for (const group of stationGroups) {
          try {
            // Build search parameters for this group of stations
            const searchParams = {
              stationIds: group.map(s => s.station_id),
              maxWalkingMinutes: 15, // 15 minutes walk from station
              priceMin: filters?.priceMin,
              priceMax: filters?.priceMax,
              sizeMin: filters?.sizeMin,
              sizeMax: filters?.sizeMax,
              layout: filters?.layout,
              amenities: filters?.amenities,
              limit: 50, // Limit per area group
            };

            // Search apartments
            const result = await scraper.search(searchParams);
            const apartments = result.success && result.data ? result.data : [];

            // Deduplicate by URL
            for (const apartment of apartments) {
              if (!processedUrls.has(apartment.sourceUrl)) {
                processedUrls.add(apartment.sourceUrl);
                allApartments.push(apartment);
              }
            }

            groupsProcessed++;
            if (onProgress) {
              const totalProgress = (scraperIndex + (groupsProcessed / stationGroups.length)) / activeSources.length;
              onProgress('scraping', totalProgress * 100);
            }

          } catch (error) {
            console.error(`Error searching apartments for station group with ${source.type}:`, error);
            // Continue with other groups
          }
        }

        scraperIndex++;
      } catch (error) {
        console.error(`Error with scraper ${source.type}:`, error);
        // Continue with other scrapers
      }
    }

    return allApartments;
  }

  /**
   * Group stations by area to optimize scraping
   */
  private groupStationsByArea(stations: ReachableStation[]): ReachableStation[][] {
    // Simple grouping by proximity
    // In a real implementation, we'd use proper clustering
    const groups: ReachableStation[][] = [];
    const maxGroupSize = 10;

    for (let i = 0; i < stations.length; i += maxGroupSize) {
      groups.push(stations.slice(i, i + maxGroupSize));
    }

    return groups;
  }

  /**
   * Save scraped apartments to the list
   */
  private async saveApartmentsToList(
    listId: string,
    apartments: ScrapedApartmentData[],
    reachableStations: ReachableStation[],
    onProgress?: (saved: number, total: number) => void
  ): Promise<void> {
    let saved = 0;
    const total = apartments.length;

    // Create a map of station names to IDs for quick lookup
    const stationMap = new Map<string, string>();
    reachableStations.forEach(s => {
      stationMap.set(s.name, s.station_id);
      stationMap.set(s.name_ja, s.station_id);
    });

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

        let apartmentId: string;

        if (existing) {
          // Update existing apartment
          apartmentId = existing.id;
          await this.db.apartment.update({
            where: { id: apartmentId },
            data: {
              price: apartmentData.price,
              availability: apartmentData.availability,
              updatedAt: new Date(),
            },
          });
        } else {
          // Get the scraping source ID
          const scrapingSourceId = await this.getScrapingSourceId(apartmentData.sourceSite);
          
          // Log the apartment data before database insertion
          console.log('\n🏠 APARTMENT DATA BEFORE DB INSERT:');
          console.log('================================');
          console.log('External ID:', apartmentData.externalId);
          console.log('Title:', apartmentData.title);
          console.log('Price:', `¥${apartmentData.price.toLocaleString()}`);
          console.log('Size:', `${apartmentData.size}m²`);
          console.log('Address:', apartmentData.address);
          console.log('Area:', apartmentData.area || 'N/A');
          console.log('Ward:', apartmentData.ward || 'N/A');
          console.log('City:', apartmentData.city || 'N/A');
          console.log('Prefecture:', apartmentData.prefecture || 'N/A');
          console.log('Layout:', apartmentData.layout || 'N/A');
          console.log('Floor:', apartmentData.floor ? `${apartmentData.floor}/${apartmentData.totalFloors || '?'}F` : 'N/A');
          console.log('Building Age:', apartmentData.buildingAge ? `${apartmentData.buildingAge} years` : 'N/A');
          console.log('Nearest Stations:', apartmentData.nearestStations.map(s => `${s.name} (${s.walkingMinutes}min)`).join(', ') || 'None');
          console.log('Images:', apartmentData.images.length);
          console.log('================================\n');
          
          // Create new apartment
          const apartment = await this.db.apartment.create({
            data: {
              externalId: apartmentData.externalId,
              sourceUrl: apartmentData.sourceUrl,
              sourceSite: apartmentData.sourceSite,
              scrapingSourceId,
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
              nearbyStations: apartmentData.nearestStations,
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
          apartmentId = apartment.id;

          // Create station associations
          for (const stationInfo of apartmentData.nearestStations) {
            const stationId = stationMap.get(stationInfo.name) || stationMap.get(stationInfo.name);
            if (stationId) {
              await this.db.apartmentStation.create({
                data: {
                  apartmentId,
                  stationId,
                  walkingMinutes: stationInfo.walkingMinutes,
                  distance: stationInfo.distance,
                },
              }).catch(() => {
                // Ignore duplicate errors
              });
            }
          }
        }

        // Add to list
        await this.db.apartmentList.create({
          data: {
            apartmentId,
            listId,
          },
        }).catch(() => {
          // Ignore if already in list
        });

        saved++;
        if (onProgress) {
          onProgress(saved, total);
        }

      } catch (error) {
        console.error('Error saving apartment:', error);
        // Continue with other apartments
      }
    }
  }

  /**
   * Get search progress
   */
  async getSearchProgress(listId: string): Promise<SearchProgress | null> {
    const list = await this.db.list.findUnique({
      where: { id: listId },
      include: {
        _count: {
          select: { apartments: true },
        },
      },
    });

    if (!list) return null;

    const queue = getJobQueue();
    const jobs = queue.getJobsByType('commute_search');
    const job = jobs.find(j => j.data.listId === listId);

    let phase: SearchProgress['phase'] = 'calculating_stations';
    let message = 'Initializing search...';

    if (list.status === 'completed') {
      phase = 'completed';
      message = `Search completed. Found ${list._count.apartments} apartments.`;
    } else if (list.status === 'failed') {
      phase = 'completed';
      message = 'Search failed. Please try again.';
    } else if (job) {
      if (job.progress < 10) {
        phase = 'calculating_stations';
        message = 'Finding apartments that match your criteria...';
      } else if (job.progress < 20) {
        phase = 'calculating_stations';
        message = 'Preparing to calculate commute times...';
      } else if (job.progress < 80) {
        phase = 'scraping';
        message = 'Calculating commute times for each apartment...';
      } else {
        phase = 'saving_results';
        message = 'Saving results to your list...';
      }
    }

    return {
      phase,
      progress: list.progress || 0,
      message,
      apartmentsFound: list._count.apartments,
      apartmentsSaved: list._count.apartments,
    };
  }
}

// Cache integration service instance per database
const serviceCache = new WeakMap<PrismaClient, SearchIntegrationService>();

export function getSearchIntegrationService(db: PrismaClient): SearchIntegrationService {
  let service = serviceCache.get(db);
  if (!service) {
    service = new SearchIntegrationService(db);
    serviceCache.set(db, service);
  }
  return service;
}