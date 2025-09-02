/**
 * Geocoding-Enhanced Apartment Scraper
 * 
 * Extends the base apartment scraper to automatically geocode addresses
 * during the scraping process.
 */

import { ApartmentScraper } from './apartment-scraper';
import { geocodingService, type GeocodingResult } from '../geocoding';
import type { ScrapedApartmentData, ScrapeProgressCallback } from '~/types/scraper';

export abstract class GeocodingEnhancedScraper extends ApartmentScraper {
  protected geocodingEnabled = true;
  protected geocodingBatchSize = 10;
  private geocodingQueue: Array<{
    apartment: ScrapedApartmentData;
    resolve: (apartment: ScrapedApartmentData) => void;
  }> = [];

  /**
   * Override the validateApartmentData method to add geocoding
   */
  protected async validateApartmentData(
    data: ScrapedApartmentData
  ): Promise<ScrapedApartmentData | null> {
    // First validate using parent method
    const validated = await super.validateApartmentData(data);
    if (!validated) return null;

    // If geocoding is disabled or coordinates already exist, return as is
    if (!this.geocodingEnabled || (validated.latitude && validated.longitude)) {
      return validated;
    }

    // For now, skip geocoding to avoid the queue deadlock issue
    // TODO: Implement proper batch geocoding after all apartments are validated
    console.log(`[GeocodingEnhanced] Skipping geocoding for ${validated.address} (would cause deadlock)`);
    return validated;
  }

  /**
   * Process the geocoding queue
   */
  private async processGeocodingQueue(): Promise<void> {
    if (this.geocodingQueue.length === 0) return;

    const batch = this.geocodingQueue.splice(0, this.geocodingBatchSize);
    console.log(`[GeocodingEnhanced] Processing ${batch.length} addresses for geocoding`);

    // Process each item in the batch
    await Promise.all(
      batch.map(async ({ apartment, resolve }) => {
        try {
          const result = await this.geocodeApartment(apartment);
          resolve(result);
        } catch (error) {
          console.error(`[GeocodingEnhanced] Error geocoding apartment:`, error);
          resolve(apartment); // Return apartment without coordinates on error
        }
      })
    );
  }

  /**
   * Geocode a single apartment
   */
  private async geocodeApartment(
    apartment: ScrapedApartmentData
  ): Promise<ScrapedApartmentData> {
    try {
      // Try to geocode the address
      const geocodeResult = await geocodingService.geocode(apartment.address, {
        language: 'ja',
        useCache: true,
      });

      if (geocodeResult) {
        console.log(
          `[GeocodingEnhanced] Successfully geocoded: ${apartment.address} -> ${geocodeResult.latitude}, ${geocodeResult.longitude}`
        );
        
        return {
          ...apartment,
          latitude: geocodeResult.latitude,
          longitude: geocodeResult.longitude,
        };
      } else {
        console.log(`[GeocodingEnhanced] No results for: ${apartment.address}`);
        return apartment;
      }
    } catch (error) {
      console.error(`[GeocodingEnhanced] Geocoding error for ${apartment.address}:`, error);
      return apartment;
    }
  }

  /**
   * Override search method to ensure all geocoding is completed
   */
  async search(
    params: any,
    progressCallback?: ScrapeProgressCallback
  ): Promise<any> {
    const result = await super.search(params, progressCallback);

    // Process any remaining items in the geocoding queue
    if (this.geocodingQueue.length > 0) {
      console.log(`[GeocodingEnhanced] Processing remaining ${this.geocodingQueue.length} geocoding requests`);
      await this.processGeocodingQueue();
    }

    return result;
  }

  /**
   * Enable or disable geocoding
   */
  setGeocodingEnabled(enabled: boolean): void {
    this.geocodingEnabled = enabled;
  }

  /**
   * Set the batch size for geocoding requests
   */
  setGeocodingBatchSize(size: number): void {
    this.geocodingBatchSize = Math.max(1, size);
  }

  /**
   * Get geocoding statistics
   */
  getGeocodingStats(): any {
    return geocodingService.getCacheStats();
  }
}