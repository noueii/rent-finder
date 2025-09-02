/**
 * Apartment Repository Interface
 * 
 * Extends the base repository with apartment-specific data access methods.
 */

import type { BaseRepository } from './base';
import type { 
  Apartment, 
  CommuteSearchParams, 
  PriceUpdate,
  ApartmentSummary 
} from '../entities/apartment';
import type { StationWithDistance } from '../entities/station';

/**
 * Repository interface for apartment data access
 */
export interface ApartmentRepository extends BaseRepository<Apartment> {
  /**
   * Find an apartment by its source URL
   * @param url - The apartment listing URL
   * @returns The apartment if found
   */
  findByUrl(url: string): Promise<Apartment | null>;

  /**
   * Find apartments near a specific station
   * @param stationId - The station identifier
   * @param radiusKm - Search radius in kilometers
   * @returns Apartments within the radius
   */
  findNearStation(stationId: string, radiusKm: number): Promise<Apartment[]>;

  /**
   * Find apartments by commute time to a target station
   * @param params - Search parameters including max commute time
   * @returns Apartments matching the criteria
   */
  findByCommuteTime(params: CommuteSearchParams): Promise<Apartment[]>;

  /**
   * Mark an apartment as no longer available
   * @param id - The apartment identifier
   */
  markAsRemoved(id: string): Promise<void>;

  /**
   * Update apartment pricing information
   * @param id - The apartment identifier
   * @param prices - New pricing information
   */
  updatePrices(id: string, prices: PriceUpdate): Promise<void>;

  /**
   * Get apartments that haven't been scraped recently
   * @param source - Scraper source name
   * @param olderThan - Date threshold
   * @param limit - Maximum number to return
   * @returns Apartments needing update
   */
  findStaleApartments(source: string, olderThan: Date, limit: number): Promise<Apartment[]>;

  /**
   * Find apartments with missing geocoding data
   * @param limit - Maximum number to return
   * @returns Apartments without coordinates
   */
  findUngeocoded(limit: number): Promise<Apartment[]>;

  /**
   * Find apartments without assigned stations
   * @param limit - Maximum number to return
   * @returns Apartments without nearest station
   */
  findWithoutStation(limit: number): Promise<Apartment[]>;

  /**
   * Get apartment summaries for list display
   * @param ids - Array of apartment IDs
   * @returns Summary information for each apartment
   */
  getSummaries(ids: string[]): Promise<ApartmentSummary[]>;

  /**
   * Update apartment availability in bulk
   * @param updates - Map of apartment ID to availability status
   */
  bulkUpdateAvailability(updates: Map<string, boolean>): Promise<void>;

  /**
   * Find similar apartments based on criteria
   * @param apartmentId - Reference apartment
   * @param criteria - Similarity criteria
   * @param limit - Maximum results
   * @returns Similar apartments
   */
  findSimilar(
    apartmentId: string, 
    criteria: {
      priceRange?: number; // +/- percentage
      sizeRange?: number; // +/- percentage
      sameStation?: boolean;
      sameLayout?: boolean;
    },
    limit: number
  ): Promise<Apartment[]>;

  /**
   * Get price statistics for an area or station
   * @param params - Filter parameters
   * @returns Price statistics
   */
  getPriceStats(params: {
    stationId?: string;
    ward?: string;
    roomLayout?: string;
  }): Promise<{
    min: number;
    max: number;
    avg: number;
    median: number;
    count: number;
  }>;

  /**
   * Find the nearest station for an apartment
   * @param apartmentId - The apartment identifier
   * @param maxDistanceKm - Maximum search distance
   * @returns The nearest station with distance info
   */
  findNearestStation(apartmentId: string, maxDistanceKm: number): Promise<StationWithDistance | null>;
}