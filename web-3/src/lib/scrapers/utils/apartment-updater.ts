import type { ScrapedApartmentData } from '~/types/scraper';
import type { Apartment, Station, ApartmentStation, ApartmentImage } from '@prisma/client';
import { db } from '~/server/db';

export interface ApartmentUpdateResult {
  apartmentId: string;
  externalId: string;
  updated: boolean;
  updatedFields: string[];
  error?: string;
}

/**
 * Update existing apartments with fresh data from scrapers
 * Focuses on updating station distances and images
 */
export class ApartmentUpdater {
  /**
   * Update multiple apartments with fresh data
   * @param scrapedApartments Fresh apartment data from scrapers
   * @returns Array of update results
   */
  static async updateApartments(
    scrapedApartments: ScrapedApartmentData[]
  ): Promise<ApartmentUpdateResult[]> {
    const results: ApartmentUpdateResult[] = [];
    
    for (const scrapedData of scrapedApartments) {
      try {
        const result = await this.updateSingleApartment(scrapedData);
        results.push(result);
      } catch (error) {
        results.push({
          apartmentId: '',
          externalId: scrapedData.externalId,
          updated: false,
          updatedFields: [],
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    
    return results;
  }
  
  /**
   * Update a single apartment with fresh data
   */
  private static async updateSingleApartment(
    scrapedData: ScrapedApartmentData
  ): Promise<ApartmentUpdateResult> {
    
    console.log(`[ApartmentUpdater] Looking for apartment with externalId: ${scrapedData.externalId}, sourceSite: ${scrapedData.sourceSite}`);
    
    // Find the existing apartment
    const existingApartment = await db.apartment.findFirst({
      where: {
        externalId: scrapedData.externalId,
        sourceSite: scrapedData.sourceSite
      },
      include: {
        images: true
      }
    });
    
    if (!existingApartment) {
      console.log(`[ApartmentUpdater] Apartment not found - externalId: ${scrapedData.externalId}, sourceSite: ${scrapedData.sourceSite}`);
      return {
        apartmentId: '',
        externalId: scrapedData.externalId,
        updated: false,
        updatedFields: [],
        error: 'Apartment not found in database'
      };
    }
    
    console.log(`[ApartmentUpdater] Found apartment ${existingApartment.id} for update`);
    
    // Special handling for removed apartments
    if ((scrapedData as any)._isRemoved) {
      console.log(`[ApartmentUpdater] Apartment ${scrapedData.externalId} marked as removed`);
      
      const updateData: any = {
        removed: true,
        lastDetailCheck: new Date(),
        updatedAt: new Date(),
      };
      
      await db.apartment.update({
        where: { id: existingApartment.id },
        data: updateData
      });
      
      return {
        apartmentId: existingApartment.id,
        externalId: scrapedData.externalId,
        updated: true,
        updatedFields: ['removed', 'lastDetailCheck', 'updatedAt']
      };
    }
    
    
    const updatedFields: string[] = [];
    
    // Update images
    if (scrapedData.images && scrapedData.images.length > 0) {
      console.log(`[ApartmentUpdater] Processing images for ${scrapedData.externalId}: ${scrapedData.images.length} images found`);
      
      // Convert string array to object array if needed
      const normalizedImages = scrapedData.images.map((img, index) => {
        if (typeof img === 'string') {
          return {
            url: img,
            caption: undefined,
            order: index
          };
        }
        return img;
      });
      
      const imageUpdateResult = await this.updateImages(
        existingApartment.id,
        existingApartment.images,
        normalizedImages
      );
      if (imageUpdateResult.updated) {
        updatedFields.push('images');
      }
    } else {
      console.log(`[ApartmentUpdater] No images found for ${scrapedData.externalId}`);
    }
    
    // Update other fields that might have changed
    const fieldsToUpdate: Partial<typeof existingApartment> = {};
    
    // Update location coordinates if available
    if (scrapedData.latitude && scrapedData.longitude && 
        (!existingApartment.latitude || !existingApartment.longitude)) {
      fieldsToUpdate.latitude = scrapedData.latitude;
      fieldsToUpdate.longitude = scrapedData.longitude;
      updatedFields.push('coordinates');
    }
    
    // Update price if it has changed (important for reflecting updated rent/management fees)
    if (scrapedData.price && scrapedData.price !== existingApartment.price) {
      fieldsToUpdate.price = scrapedData.price;
      updatedFields.push('price');
    }
    
    // Update building age if available
    if (scrapedData.buildingAge !== undefined && scrapedData.buildingAge !== existingApartment.buildingAge) {
      fieldsToUpdate.buildingAge = scrapedData.buildingAge;
      updatedFields.push('buildingAge');
    }
    
    // Update fees information if available
    // Always update feesTotal even if it's 0 (apartment might have no initial fees)
    if (scrapedData.feesTotal !== undefined && scrapedData.feesTotal !== existingApartment.feesTotal) {
      fieldsToUpdate.feesTotal = scrapedData.feesTotal;
      updatedFields.push('feesTotal');
    }
    
    // Update feesJson if it has changed
    if (scrapedData.feesJson && JSON.stringify(scrapedData.feesJson) !== JSON.stringify(existingApartment.feesJson)) {
      // Update if we have any fee data (even if all fees are 0)
      fieldsToUpdate.feesJson = scrapedData.feesJson;
      updatedFields.push('feesJson');
    }
    
    // Update description if available from detail page
    if (scrapedData.description && scrapedData.description !== existingApartment.description) {
      fieldsToUpdate.description = scrapedData.description;
      updatedFields.push('description');
    }
    
    // Update amenities if available from detail page
    if (scrapedData.amenities && scrapedData.amenities.length > 0 && 
        JSON.stringify(scrapedData.amenities) !== JSON.stringify(existingApartment.amenities)) {
      fieldsToUpdate.amenities = scrapedData.amenities;
      updatedFields.push('amenities');
    }
    
    // Update total floors if available from detail page
    if (scrapedData.totalFloors && scrapedData.totalFloors !== existingApartment.totalFloors) {
      fieldsToUpdate.totalFloors = scrapedData.totalFloors;
      updatedFields.push('totalFloors');
    }
    
    // Update floor if available from detail page
    if (scrapedData.floor !== undefined && scrapedData.floor !== existingApartment.floor) {
      fieldsToUpdate.floor = scrapedData.floor;
      updatedFields.push('floor');
    }
    
    // Update nearby stations if available from detail page
    if (scrapedData.nearestStations && scrapedData.nearestStations.length > 0) {
      fieldsToUpdate.nearbyStations = scrapedData.nearestStations;
      updatedFields.push('nearbyStations');
    }
    
    // Update agent if available
    if (scrapedData.agent && scrapedData.agent !== existingApartment.agent) {
      fieldsToUpdate.agent = scrapedData.agent;
      updatedFields.push('agent');
    }
    
    // Mark that we've fetched detailed data
    fieldsToUpdate.fetchedDetails = true;
    if (!existingApartment.fetchedDetails) {
      updatedFields.push('fetchedDetails');
    }
    
    // Always update lastDetailCheck to indicate we've checked this apartment
    fieldsToUpdate.lastDetailCheck = new Date();
    updatedFields.push('lastDetailCheck');
    
    // Check if the apartment was marked as removed (from the scraped data)
    if (scrapedData._isRemoved) {
      fieldsToUpdate.removed = true;
      updatedFields.push('removed');
    } else if (existingApartment.removed && !scrapedData._isRemoved) {
      // If it was previously removed but now it's back
      fieldsToUpdate.removed = false;
      updatedFields.push('removed (restored)');
    }
    
    // Update the apartment - always update because we at least update lastDetailCheck
    console.log(`[ApartmentUpdater] Updating apartment ${existingApartment.id} with fields:`, Object.keys(fieldsToUpdate));
    
    await db.apartment.update({
      where: { id: existingApartment.id },
      data: fieldsToUpdate
    });
    
    console.log(`[ApartmentUpdater] Successfully updated apartment ${existingApartment.id} - ${updatedFields.length} fields changed`);
    
    return {
      apartmentId: existingApartment.id,
      externalId: scrapedData.externalId,
      updated: updatedFields.length > 0,
      updatedFields
    };
  }
  
  
  /**
   * Update images for an apartment
   */
  private static async updateImages(
    apartmentId: string,
    existingImages: ApartmentImage[],
    newImages: ScrapedApartmentData['images']
  ): Promise<{ updated: boolean }> {
    let updated = false;
    
    console.log(`[ApartmentUpdater] Updating images for apartment ${apartmentId}`);
    console.log(`[ApartmentUpdater] Existing images: ${existingImages.length}`);
    console.log(`[ApartmentUpdater] New images from scraper: ${newImages.length}`);
    
    // Create a set of existing image URLs for comparison
    const existingImageUrls = new Set(existingImages.map(img => img.url));
    
    // Log existing URLs
    if (existingImages.length > 0) {
      console.log(`[ApartmentUpdater] Existing image URLs:`, existingImages.map(img => img.url));
    }
    
    // Add new images that don't exist
    let addedCount = 0;
    let skippedCount = 0;
    
    for (const newImage of newImages) {
      if (!existingImageUrls.has(newImage.url)) {
        console.log(`[ApartmentUpdater] Adding new image: ${newImage.url}`);
        await db.apartmentImage.create({
          data: {
            apartmentId,
            url: newImage.url,
            caption: newImage.caption,
            order: newImage.order || 0
          }
        });
        updated = true;
        addedCount++;
      } else {
        console.log(`[ApartmentUpdater] Skipping existing image: ${newImage.url}`);
        skippedCount++;
      }
    }
    
    console.log(`[ApartmentUpdater] Image update summary: Added ${addedCount}, Skipped ${skippedCount}`)
    
    // Optional: Remove images that no longer exist in the scraped data
    // This is commented out by default to preserve historical data
    /*
    const newImageUrls = new Set(newImages.map(img => img.url));
    for (const existingImage of existingImages) {
      if (!newImageUrls.has(existingImage.url)) {
        await db.apartmentImage.delete({
          where: { id: existingImage.id }
        });
        updated = true;
      }
    }
    */
    
    return { updated };
  }
}