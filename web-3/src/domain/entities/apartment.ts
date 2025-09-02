/**
 * Apartment Domain Entity
 * 
 * Represents an apartment listing in the domain model.
 * This is a pure domain object with no persistence concerns.
 */

import type { Station } from './station';

/**
 * Apartment entity representing a rental property
 */
export interface Apartment {
  // Identity
  id: string;
  
  // Basic Information
  title: string;
  url: string;
  description?: string;
  
  // Location
  address: string;
  latitude?: number;
  longitude?: number;
  nearestStation?: Station;
  walkingMinutes?: number;
  
  // Property Details
  price: number;
  managementFee?: number;
  depositMonths?: number;
  keyMoneyMonths?: number;
  roomLayout: string;
  size: number; // in square meters
  floor?: number;
  totalFloors?: number;
  age?: number; // building age in years
  
  // Features
  features: string[];
  images: string[];
  
  // Metadata
  source: string; // scraper source
  agent?: string; // Real estate agent or source name
  isAvailable: boolean;
  lastScraped: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Calculated Fields
  totalMonthlyCost?: number; // price + management fee
  totalInitialCost?: number; // deposit + key money + first month
}

/**
 * Parameters for searching apartments by commute time
 */
export interface CommuteSearchParams {
  /** Target station ID to commute to */
  targetStationId: string;
  /** Maximum commute time in minutes */
  maxMinutes: number;
  /** Price range filter */
  priceRange?: {
    min?: number;
    max?: number;
  };
  /** Room type filters */
  roomTypes?: string[];
  /** Size range in square meters */
  sizeRange?: {
    min?: number;
    max?: number;
  };
  /** Features to include */
  requiredFeatures?: string[];
}

/**
 * Price update data
 */
export interface PriceUpdate {
  price: number;
  managementFee?: number;
  depositMonths?: number;
  keyMoneyMonths?: number;
  updatedAt: Date;
}

/**
 * Apartment details including computed fields
 */
export interface ApartmentDetails extends Apartment {
  /** Commute information to various stations */
  commuteInfo?: CommuteInfo[];
  /** Quality score (0-100) */
  qualityScore?: number;
  /** Price competitiveness score (0-100) */
  priceScore?: number;
  /** Similar apartments */
  similarApartments?: ApartmentSummary[];
}

/**
 * Summary view of an apartment for lists
 */
export interface ApartmentSummary {
  id: string;
  title: string;
  price: number;
  address: string;
  nearestStation?: string;
  walkingMinutes?: number;
  roomLayout: string;
  size: number;
  mainImage?: string;
  isAvailable: boolean;
}

/**
 * Commute information to a specific station
 */
export interface CommuteInfo {
  stationId: string;
  stationName: string;
  commuteMinutes: number;
  transferCount: number;
  routeDescription?: string;
}