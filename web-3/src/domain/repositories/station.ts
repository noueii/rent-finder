/**
 * Station Repository Interface
 * 
 * Provides data access methods for train/subway stations.
 */

import type { BaseRepository } from './base';
import type { Station, StationWithDistance } from '../entities/station';
import type { Coordinates } from '../types/common';

/**
 * Repository interface for station data access
 */
export interface StationRepository extends BaseRepository<Station> {
  /**
   * Find stations by name (supports partial matching)
   * @param name - Station name or partial name
   * @param limit - Maximum results to return
   * @returns Matching stations
   */
  findByName(name: string, limit?: number): Promise<Station[]>;

  /**
   * Find stations on a specific line
   * @param lineName - Name of the train/subway line
   * @returns Stations on the line
   */
  findByLine(lineName: string): Promise<Station[]>;

  /**
   * Find stations within a geographic area
   * @param center - Center coordinates
   * @param radiusKm - Search radius in kilometers
   * @returns Stations within the radius with distance information
   */
  findNearby(center: Coordinates, radiusKm: number): Promise<StationWithDistance[]>;

  /**
   * Find the nearest station to a location
   * @param location - Geographic coordinates
   * @returns The nearest station with distance
   */
  findNearest(location: Coordinates): Promise<StationWithDistance | null>;

  /**
   * Find stations in a specific ward or city
   * @param location - Location filter
   * @returns Stations in the area
   */
  findByLocation(location: {
    prefecture?: string;
    city?: string;
    ward?: string;
  }): Promise<Station[]>;

  /**
   * Get all unique train/subway lines
   * @returns List of line names
   */
  getAllLines(): Promise<string[]>;

  /**
   * Get stations that connect multiple lines (transfer stations)
   * @param minLines - Minimum number of lines (default: 2)
   * @returns Transfer stations
   */
  getTransferStations(minLines?: number): Promise<Station[]>;

  /**
   * Search stations with fuzzy matching
   * @param query - Search query
   * @param limit - Maximum results
   * @returns Stations matching the query
   */
  search(query: string, limit?: number): Promise<Station[]>;

  /**
   * Batch find stations by IDs
   * @param ids - Array of station IDs
   * @returns Map of ID to Station
   */
  findByIds(ids: string[]): Promise<Map<string, Station>>;
}