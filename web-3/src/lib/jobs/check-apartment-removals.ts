import { db } from '~/server/db';
import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
import { ApartmentRemovalHandler } from '~/lib/scrapers/utils/apartment-removal-handler';
import type { Apartment } from '@prisma/client';

// Import scrapers to ensure they're registered
import '~/lib/scrapers/sources';

export interface CheckRemovalsJobData {
  apartmentIds?: string[];
  sourceSite?: string;
  batchSize?: number;
  checkOlderThan?: Date;
}

export interface CheckRemovalsResult {
  checked: number;
  removed: number;
  errors: number;
  details: Array<{
    apartmentId: string;
    externalId: string;
    sourceSite: string;
    result: 'removed' | 'available' | 'error';
    reason?: string;
    error?: string;
  }>;
}

/**
 * Job to check if apartments are still available on their source websites
 * This can be run periodically to detect and mark removed listings
 */
export async function checkApartmentRemovals(
  data: CheckRemovalsJobData = {}
): Promise<CheckRemovalsResult> {
  const {
    apartmentIds,
    sourceSite,
    batchSize = 10,
    checkOlderThan = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: 7 days old
  } = data;

  console.log('[CheckRemovals] Starting apartment removal check job');
  
  const result: CheckRemovalsResult = {
    checked: 0,
    removed: 0,
    errors: 0,
    details: [],
  };

  try {
    // Build query for apartments to check
    const where: any = {
      removed: false,
      lastDetailCheck: {
        lt: checkOlderThan,
      },
    };

    if (apartmentIds && apartmentIds.length > 0) {
      where.id = { in: apartmentIds };
    }

    if (sourceSite) {
      where.sourceSite = sourceSite;
    }

    // Get apartments to check
    const apartments = await db.apartment.findMany({
      where,
      take: batchSize,
      orderBy: {
        lastDetailCheck: 'asc', // Check oldest first
      },
      select: {
        id: true,
        externalId: true,
        sourceUrl: true,
        sourceSite: true,
      },
    });

    console.log(`[CheckRemovals] Found ${apartments.length} apartments to check`);

    // Process each apartment
    for (const apartment of apartments) {
      try {
        console.log(`[CheckRemovals] Checking apartment ${apartment.externalId} from ${apartment.sourceSite}`);
        
        // Get the appropriate scraper
        const scraper = UnifiedScraperFactory.getScraper(apartment.sourceSite as any);
        if (!scraper) {
          throw new Error(`No scraper found for source: ${apartment.sourceSite}`);
        }

        // Try to fetch the apartment details
        const details = await scraper.getApartmentDetails(apartment.sourceUrl);
        
        // Update lastDetailCheck timestamp
        await db.apartment.update({
          where: { id: apartment.id },
          data: { lastDetailCheck: new Date() },
        });

        if (!details || (details as any)._isRemoved) {
          // Apartment has been removed
          const removalInfo = (details as any) || {};
          const reason = removalInfo._removalReason || 'Listing no longer available';
          
          console.log(`[CheckRemovals] Apartment ${apartment.externalId} has been removed: ${reason}`);
          
          // Mark as removed in database
          await ApartmentRemovalHandler.markApartmentAsRemovedByExternalId(
            apartment.externalId,
            apartment.sourceSite,
            reason
          );
          
          result.removed++;
          result.details.push({
            apartmentId: apartment.id,
            externalId: apartment.externalId,
            sourceSite: apartment.sourceSite,
            result: 'removed',
            reason,
          });
        } else {
          // Apartment is still available
          console.log(`[CheckRemovals] Apartment ${apartment.externalId} is still available`);
          
          // Update apartment with latest details if needed
          if (details.price || details.availability) {
            await db.apartment.update({
              where: { id: apartment.id },
              data: {
                price: details.price || undefined,
                availability: details.availability || undefined,
                updatedAt: new Date(),
              },
            });
          }
          
          result.details.push({
            apartmentId: apartment.id,
            externalId: apartment.externalId,
            sourceSite: apartment.sourceSite,
            result: 'available',
          });
        }
        
        result.checked++;
        
        // Rate limiting - wait between checks to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
        
      } catch (error) {
        console.error(`[CheckRemovals] Error checking apartment ${apartment.externalId}:`, error);
        result.errors++;
        result.details.push({
          apartmentId: apartment.id,
          externalId: apartment.externalId,
          sourceSite: apartment.sourceSite,
          result: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Log summary
    console.log(`[CheckRemovals] Job completed:
      - Checked: ${result.checked}
      - Removed: ${result.removed}
      - Errors: ${result.errors}
    `);

    // Get removal statistics
    const stats = await ApartmentRemovalHandler.getRemovedApartmentsStats();
    console.log(`[CheckRemovals] Overall removal stats:
      - Total removed: ${stats.totalRemoved}
      - Recently removed (7 days): ${stats.recentlyRemoved}
      - By source: ${JSON.stringify(stats.removedBySource)}
    `);

    return result;

  } catch (error) {
    console.error('[CheckRemovals] Job failed:', error);
    throw error;
  }
}

/**
 * Schedule periodic removal checks
 * This would typically be called by a job scheduler (e.g., cron job, BullMQ)
 */
export async function scheduleRemovalChecks(): Promise<void> {
  console.log('[CheckRemovals] Scheduling periodic removal checks');
  
  // Check different sources on different schedules
  const sources = ['yolo-japan', 'wagaya-japan', 'realestate'] as const;
  
  for (const source of sources) {
    try {
      await checkApartmentRemovals({
        sourceSite: source,
        batchSize: 5, // Small batch to avoid overwhelming the source
        checkOlderThan: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days
      });
    } catch (error) {
      console.error(`[CheckRemovals] Failed to check ${source}:`, error);
    }
    
    // Wait between sources
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}