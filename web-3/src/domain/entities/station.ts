/**
 * Station Domain Entity
 * 
 * Represents a train/subway station in the transit system.
 */

/**
 * Station entity representing a transit station
 */
export interface Station {
  id: string;
  name: string;
  nameKana?: string;
  nameEnglish?: string;
  lines: string[];
  latitude: number;
  longitude: number;
  prefecture?: string;
  city?: string;
  ward?: string;
}

/**
 * Station with distance information
 */
export interface StationWithDistance extends Station {
  /** Distance in kilometers from a reference point */
  distanceKm: number;
  /** Walking time in minutes (estimated) */
  walkingMinutes: number;
}