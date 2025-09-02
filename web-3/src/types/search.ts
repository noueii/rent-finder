import type { SearchSession } from '@prisma/client';

// Standard search input
export interface StandardSearchInput {
  filters: {
    priceMin?: number;
    priceMax?: number;
    sizeMin?: number;
    sizeMax?: number;
    layout?: string[];
    amenities?: string[];
    stationIds?: string[];
    maxWalkingMinutes?: number;
    buildingAge?: number;
  };
  sort?: {
    field: 'price' | 'size' | 'createdAt';
    order: 'asc' | 'desc';
  };
  pagination?: {
    page?: number;
    limit?: number;
  };
}

// Commute search input
export interface CommuteSearchInput {
  workplaceStationId: string;
  maxCommuteMinutes: number;
  filters?: {
    priceMin?: number;
    priceMax?: number;
    sizeMin?: number;
    sizeMax?: number;
    layout?: string[];
    amenities?: string[];
  };
  listName?: string;
  listDescription?: string;
}

// Search session with metadata
export interface SearchSessionWithMeta extends SearchSession {
  apartmentCount?: number;
  listName?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

// Legacy type aliases for backward compatibility
export type SearchFilters = StandardSearchInput['filters'];
export type CommuteSearch = CommuteSearchInput;

// Reachable station result from commute calculation
export interface ReachableStation {
  stationId: string;
  commuteMinutes: number;
  transfers: number;
  routeData?: any; // Detailed route information
}