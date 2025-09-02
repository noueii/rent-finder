import type { Apartment, ApartmentImage, ApartmentStation, Station, Route } from '@prisma/client';

// Re-export Prisma types for convenience
export type { Apartment, ApartmentImage, ApartmentStation, Station, Route } from '@prisma/client';

// Extended apartment type with relations
export interface ApartmentWithRelations extends Apartment {
  images: ApartmentImage[];
  nearestStations: (ApartmentStation & {
    station: Station;
  })[];
  routes?: (Route & {
    toStation: Station;
  })[];
}


// Search filters for apartments
export interface ApartmentSearchFilters {
  priceMin?: number;
  priceMax?: number;
  twoYearAvgMin?: number;
  twoYearAvgMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  layout?: string[];
  amenities?: string[];
  stationIds?: string[];
  buildingAge?: number;
  maxCommuteMinutes?: number;
  availability?: string;
  excludeWards?: string[]; // Wards to exclude from results
}

// Pagination options
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

// Sort options for apartment queries
export interface ApartmentSortOptions {
  field: 'price' | 'size' | 'createdAt' | 'scrapedAt' | 'score';
  order: 'asc' | 'desc';
}

// Response type for paginated results
export interface PaginatedApartments {
  apartments: ApartmentWithRelations[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  nextCursor?: string;
}