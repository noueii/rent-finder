import { db } from '~/server/db';
import { geocodingService } from '~/lib/geocoding/geocoding-service';

/**
 * Batch geocode apartments missing coordinates
 */
export async function batchGeocodeApartments(limit = 100): Promise<void> {
  console.log('[Geocoding Batch] Starting batch geocoding process...');
  
  try {
    // Find apartments missing coordinates but with addresses
    const apartmentsToGeocode = await db.apartment.findMany({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
        NOT: {
          address: null,
        },
        address: {
          not: '',
        },
      },
      select: {
        id: true,
        address: true,
        externalId: true,
        sourceSite: true,
      },
      take: limit,
    });

    console.log(`[Geocoding Batch] Found ${apartmentsToGeocode.length} apartments to geocode`);

    if (apartmentsToGeocode.length === 0) {
      console.log('[Geocoding Batch] No apartments need geocoding');
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const apartment of apartmentsToGeocode) {
      try {
        console.log(`[Geocoding Batch] Processing apartment ${apartment.externalId} from ${apartment.sourceSite}`);
        
        const result = await geocodingService.geocodeAddress(apartment.address!);
        
        if (result && result.confidence > 0.6) {
          await db.apartment.update({
            where: { id: apartment.id },
            data: {
              latitude: result.latitude,
              longitude: result.longitude,
            },
          });
          
          successCount++;
          console.log(`[Geocoding Batch] ✓ Updated coordinates for ${apartment.externalId}: ${result.latitude}, ${result.longitude}`);
        } else {
          failedCount++;
          console.warn(`[Geocoding Batch] ✗ Failed to geocode ${apartment.externalId} - low confidence or no result`);
        }
      } catch (error) {
        failedCount++;
        console.error(`[Geocoding Batch] ✗ Error geocoding ${apartment.externalId}:`, error);
      }
    }

    console.log(`[Geocoding Batch] Completed: ${successCount} succeeded, ${failedCount} failed`);
    
    // Log cache statistics
    const cacheStats = geocodingService.getCacheStats();
    console.log(`[Geocoding Batch] Cache stats:`, cacheStats);
    
  } catch (error) {
    console.error('[Geocoding Batch] Fatal error:', error);
    throw error;
  }
}

/**
 * Get statistics about apartments missing coordinates
 */
export async function getGeocodingStats() {
  const [total, missingCoords, hasAddress] = await Promise.all([
    db.apartment.count(),
    db.apartment.count({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
    }),
    db.apartment.count({
      where: {
        OR: [
          { latitude: null },
          { longitude: null },
        ],
        NOT: {
          address: null,
        },
        address: {
          not: '',
        },
      },
    }),
  ]);

  const bySource = await db.apartment.groupBy({
    by: ['sourceSite'],
    where: {
      OR: [
        { latitude: null },
        { longitude: null },
      ],
    },
    _count: true,
  });

  return {
    total,
    missingCoords,
    hasAddress,
    percentMissing: ((missingCoords / total) * 100).toFixed(2) + '%',
    canGeocode: hasAddress,
    bySource: bySource.map(s => ({
      source: s.sourceSite,
      count: s._count,
    })),
  };
}