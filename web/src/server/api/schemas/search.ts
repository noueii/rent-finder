import { z } from 'zod';

export const stationSearchSchema = z.object({
  query: z.string().min(1).max(50),
  limit: z.number().min(1).max(50).optional().default(10),
});

export const searchFiltersSchema = z.object({
  maxPrice: z.number().min(0).max(1000000).optional(),
  minPrice: z.number().min(0).max(1000000).optional(),
  minSize: z.number().min(0).max(1000).optional(),
  maxSize: z.number().min(0).max(1000).optional(),
  layouts: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  maxWalkingMinutes: z.number().min(1).max(30).optional(),
  buildingTypes: z.array(z.string()).optional(),
  maxBuildingAge: z.number().min(0).max(100).optional(),
  hasImages: z.boolean().optional(),
  petFriendly: z.boolean().optional(),
});

export const apartmentSearchSchema = z.object({
  targetStationId: z.string().min(1, 'Target station ID is required'),
  maxCommuteMinutes: z.number().min(1).max(120, 'Maximum commute time is 120 minutes'),
  filters: searchFiltersSchema.optional(),
  limit: z.number().min(1).max(50).optional().default(20),
  offset: z.number().min(0).optional().default(0),
  sortBy: z.enum(['price', 'size', 'commute_time', 'building_age']).optional().default('commute_time'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const apartmentByIdSchema = z.object({
  apartmentId: z.string().min(1, 'Apartment ID is required'),
  fromStationId: z.string().optional(),
});

export const stationByIdSchema = z.object({
  stationId: z.string().min(1, 'Station ID is required'),
});

export const reachableStationsSchema = z.object({
  stationId: z.string().min(1, 'Station ID is required'),
  maxMinutes: z.number().min(1).max(120, 'Maximum time is 120 minutes'),
});

export const travelTimeSchema = z.object({
  fromStationId: z.string().min(1, 'From station ID is required'),
  toStationId: z.string().min(1, 'To station ID is required'),
});

export const paginationSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

export const popularStationsSchema = z.object({
  limit: z.number().min(1).max(50).optional().default(10),
  days: z.number().min(1).max(365).optional().default(30),
});

export const stationSuggestionsSchema = z.object({
  query: z.string().min(2).max(50),
  limit: z.number().min(1).max(20).optional().default(10),
});

export const healthCheckSchema = z.object({
  includeDatabase: z.boolean().optional().default(false),
  includeTransit: z.boolean().optional().default(false),
});

// Type exports for use in other files
export type StationSearchInput = z.infer<typeof stationSearchSchema>;
export type SearchFiltersInput = z.infer<typeof searchFiltersSchema>;
export type ApartmentSearchInput = z.infer<typeof apartmentSearchSchema>;
export type ApartmentByIdInput = z.infer<typeof apartmentByIdSchema>;
export type StationByIdInput = z.infer<typeof stationByIdSchema>;
export type ReachableStationsInput = z.infer<typeof reachableStationsSchema>;
export type TravelTimeInput = z.infer<typeof travelTimeSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type PopularStationsInput = z.infer<typeof popularStationsSchema>;
export type StationSuggestionsInput = z.infer<typeof stationSuggestionsSchema>;
export type HealthCheckInput = z.infer<typeof healthCheckSchema>;