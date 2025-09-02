import { db } from '~/server/db';
import { ApartmentDetailFetcher } from '../utils/detail-fetcher';
import { ApartmentUpdater } from '../utils/apartment-updater';
import type { DetailFetchResult } from '../utils/detail-fetcher';
import type { ApartmentUpdateResult } from '../utils/apartment-updater';

export interface ApartmentDetailUpdateResult {
  apartmentId: string;
  externalId: string;
  sourceUrl: string;
  fetchSuccess: boolean;
  updateSuccess: boolean;
  updatedFields: string[];
  error?: string;
}

/**
 * Service for fetching and updating apartment details
 * Combines detail fetching with database updates
 */
export class ApartmentDetailService {
  /**
   * Update apartments in a list with detailed information
   * @param listId The list ID to update apartments for
   * @param filters Optional filters (minSize, minScore)
   * @returns Array of update results
   */
  static async updateApartmentDetailsForList(
    listId: string,
    filters?: {
      minSize?: number;
      minScore?: number;
      limit?: number;
      source?: string;
    },
    onProgress?: (current: number, total: number) => void
  ): Promise<ApartmentDetailUpdateResult[]> {
    // First check if the list exists
    const list = await db.list.findUnique({
      where: { id: listId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          }
        }
      }
    });
    
    if (!list) {
      throw new Error('List not found');
    }
    
    // Fetch apartments in the list that need detail updates
    const apartmentListItems = await db.apartmentList.findMany({
      where: { 
        listId: listId 
      },
      include: {
        apartment: {
          include: {
            scores: filters?.minScore ? true : false,
            images: true  // Include images to count them
          }
        }
      }
    });
    
    // Filter apartments based on criteria
    let apartments = apartmentListItems
      .map(item => item.apartment)
      .filter(apt => {
        // Filter by source if specified
        if (filters?.source) {
          // Map scraped site to scraper type
          const sourceMap: Record<string, string> = {
            'yolo-japan.com': 'yolo-japan',
            'home.yolo-japan.com': 'yolo-japan',
            'wagaya-japan.com': 'wagaya-japan',
            'e-housing.jp': 'e-housing',
            'metroresidences.com': 'metro-residences',
            'realestate.co.jp': 'realestate',
          };
          
          const scraperType = sourceMap[apt.sourceSite] || apt.sourceSite;
          if (scraperType !== filters.source) {
            console.log(`[ApartmentDetailService] Skipping apartment ${apt.externalId} from ${apt.sourceSite} - not matching source filter ${filters.source}`);
            return false;
          }
        }
        
        // Special handling for Wagaya - always process regardless of image count
        if (apt.sourceSite === 'wagaya-japan.com') {
          console.log(`[ApartmentDetailService] Processing Wagaya apartment ${apt.externalId} (${apt.images?.length || 0} images)`);
        } else {
          // Only update apartments with 1 or fewer images for other sources
          const imageCount = apt.images?.length || 0;
          if (imageCount > 1) {
            console.log(`[ApartmentDetailService] Skipping apartment ${apt.externalId} from ${apt.sourceSite} - has ${imageCount} images`);
            return false;
          }
        }
        
        // Filter by size
        if (filters?.minSize && apt.size < filters.minSize) return false;
        
        // Filter by score
        if (filters?.minScore && apt.scores) {
          const hasMinScore = apt.scores.some(score => score.score >= filters.minScore);
          if (!hasMinScore) return false;
        }
        
        return true;
      });
    
    // Apply limit after filtering if specified
    if (filters?.limit && filters.limit > 0) {
      apartments = apartments.slice(0, filters.limit);
    }
    
    if (apartments.length === 0) {
      return [];
    }
    
    console.log(`Found ${apartments.length} apartments in list ${listId} that need detail updates`);
    
    // Group apartments by source site for parallel processing
    const apartmentsBySource = new Map<string, typeof apartments>();
    apartments.forEach(apt => {
      const sourceSite = apt.sourceSite;
      if (!apartmentsBySource.has(sourceSite)) {
        apartmentsBySource.set(sourceSite, []);
      }
      apartmentsBySource.get(sourceSite)!.push(apt);
    });
    
    console.log(`[ApartmentDetailService] Grouped apartments by source:`, 
      Array.from(apartmentsBySource.entries()).map(([site, apts]) => `${site}: ${apts.length}`).join(', ')
    );
    
    // Process apartments in parallel by source site
    const updateResults: ApartmentDetailUpdateResult[] = [];
    const totalApartments = apartments.length;
    let processedCount = 0;
    
    // Create promises for each source site
    const sourcePromises = Array.from(apartmentsBySource.entries()).map(async ([sourceSite, sourceApartments]) => {
      const sourceResults: ApartmentDetailUpdateResult[] = [];
      
      console.log(`[ApartmentDetailService] Starting parallel processing for ${sourceSite} (${sourceApartments.length} apartments)`);
      
      // Process apartments for this source sequentially (to respect rate limits)
      for (const apartment of sourceApartments) {
        try {
          console.log(`\n[ApartmentDetailService] [${sourceSite}] Processing apartment ${apartment.externalId}...`);
          
          // Fetch details for this single apartment
          const fetchResult = await ApartmentDetailFetcher.fetchDetailsForApartment({
            externalId: apartment.externalId,
            sourceUrl: apartment.sourceUrl,
            sourceSite: apartment.sourceSite
          });
          
          if (fetchResult.success && fetchResult.data) {
            console.log(`[ApartmentDetailService] [${sourceSite}] Fetch successful, updating apartment ${apartment.externalId}...`);
            
            // Update the apartment immediately with detailed data
            const updateResult = await ApartmentUpdater.updateApartments([fetchResult.data]);
            const update = updateResult[0];
            
            const result = {
              apartmentId: apartment.id,
              externalId: fetchResult.externalId,
              sourceUrl: fetchResult.sourceUrl,
              fetchSuccess: true,
              updateSuccess: update.updated,
              updatedFields: update.updatedFields,
              error: update.error
            };
            
            sourceResults.push(result);
            
            // Update progress atomically
            processedCount++;
            if (onProgress) {
              onProgress(processedCount, totalApartments);
            }
            
            console.log(`[ApartmentDetailService] [${sourceSite}] Apartment ${apartment.externalId} update complete. Updated fields: ${update.updatedFields.join(', ')}`);
          } else {
            console.log(`[ApartmentDetailService] [${sourceSite}] Fetch failed for apartment ${apartment.externalId}: ${fetchResult.error}`);
            
            const result = {
              apartmentId: apartment.id,
              externalId: fetchResult.externalId,
              sourceUrl: fetchResult.sourceUrl,
              fetchSuccess: false,
              updateSuccess: false,
              updatedFields: [],
              error: fetchResult.error
            };
            
            sourceResults.push(result);
            
            // Update progress atomically
            processedCount++;
            if (onProgress) {
              onProgress(processedCount, totalApartments);
            }
          }
        } catch (error) {
          console.error(`[ApartmentDetailService] [${sourceSite}] Error processing apartment ${apartment.externalId}:`, error);
          
          const result = {
            apartmentId: apartment.id,
            externalId: apartment.externalId,
            sourceUrl: apartment.sourceUrl,
            fetchSuccess: false,
            updateSuccess: false,
            updatedFields: [],
            error: error instanceof Error ? error.message : 'Unknown error'
          };
          
          sourceResults.push(result);
          
          // Update progress atomically
          processedCount++;
          if (onProgress) {
            onProgress(processedCount, totalApartments);
          }
        }
      }
      
      return sourceResults;
    });
    
    // Wait for all source sites to complete and merge results
    const allSourceResults = await Promise.all(sourcePromises);
    allSourceResults.forEach(sourceResults => {
      updateResults.push(...sourceResults);
    });
    
    // Log summary
    const successCount = updateResults.filter(r => r.updateSuccess).length;
    const fetchFailCount = updateResults.filter(r => !r.fetchSuccess).length;
    const updateFailCount = updateResults.filter(r => r.fetchSuccess && !r.updateSuccess).length;
    
    console.log(`
Detail Update Summary for List ${listId}:
- Total apartments processed: ${updateResults.length}
- Successfully updated: ${successCount}
- Fetch failures: ${fetchFailCount}
- Update failures: ${updateFailCount}
    `);
    
    return updateResults;
  }
  
  /**
   * Update details for specific apartments
   * @param apartmentIds Array of apartment IDs to update
   * @returns Array of update results
   */
  static async updateApartmentDetailsByIds(
    apartmentIds: string[]
  ): Promise<ApartmentDetailUpdateResult[]> {
    // Fetch apartments from database
    const apartments = await db.apartment.findMany({
      where: {
        id: { in: apartmentIds }
      }
    });
    
    if (apartments.length === 0) {
      return [];
    }
    
    // Fetch details for all apartments
    const fetchResults = await ApartmentDetailFetcher.fetchDetailsForApartments(
      apartments.map(apt => ({
        externalId: apt.externalId,
        sourceUrl: apt.sourceUrl,
        sourceSite: apt.sourceSite
      }))
    );
    
    // Update apartments with fetched details
    const updateResults: ApartmentDetailUpdateResult[] = [];
    
    console.log(`\n[ApartmentDetailService] Starting update phase for ${fetchResults.length} fetched apartments...`);
    
    for (const fetchResult of fetchResults) {
      const apartment = apartments.find(apt => apt.externalId === fetchResult.externalId);
      if (!apartment) continue;
      
      if (fetchResult.success && fetchResult.data) {
        console.log(`[ApartmentDetailService] Updating apartment ${fetchResult.externalId} with fetched data...`);
        
        // Update the apartment with detailed data
        const updateResult = await ApartmentUpdater.updateApartments([fetchResult.data]);
        const update = updateResult[0];
        
        updateResults.push({
          apartmentId: apartment.id,
          externalId: fetchResult.externalId,
          sourceUrl: fetchResult.sourceUrl,
          fetchSuccess: true,
          updateSuccess: update.updated,
          updatedFields: update.updatedFields,
          error: update.error
        });
      } else {
        updateResults.push({
          apartmentId: apartment.id,
          externalId: fetchResult.externalId,
          sourceUrl: fetchResult.sourceUrl,
          fetchSuccess: false,
          updateSuccess: false,
          updatedFields: [],
          error: fetchResult.error
        });
      }
    }
    
    return updateResults;
  }
}