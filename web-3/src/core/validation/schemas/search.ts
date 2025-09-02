/**
 * Search-related validation schemas
 * Includes standard search, commute search, and station search
 */

import { z } from 'zod';
import { 
  cuidSchema,
  paginationSchema,
  sortOrderSchema,
  createSortSchema
} from './common';
import { apartmentFilterSchema } from './apartment';

// ============= Sort Field Schemas =============

/**
 * Fields that can be used for sorting apartments
 */
export const apartmentSortFields = [
  'price',
  'size',
  'createdAt',
  'scrapedAt',
  'score',
  'walkingMinutes',
  'buildingAge'
] as const;

export const apartmentSortSchema = createSortSchema(apartmentSortFields);

// ============= Standard Search Schema =============

/**
 * Standard apartment search parameters
 */
export const standardSearchSchema = z.object({
  // Filters
  filters: apartmentFilterSchema,
  
  // Sorting
  sort: apartmentSortSchema.default({
    field: 'createdAt',
    order: 'desc',
  }),
  
  // Pagination
  pagination: paginationSchema,
  
  // Additional options
  includeStats: z.boolean().optional(),
});

// ============= Commute Search Schema =============

/**
 * Search apartments by commute time
 */
export const commuteSearchSchema = z.object({
  // Required commute parameters
  workplaceStationId: cuidSchema,
  maxCommuteMinutes: z
    .number()
    .min(5, 'Minimum commute time is 5 minutes')
    .max(120, 'Maximum commute time is 120 minutes'),
  
  // Optional filters
  filters: apartmentFilterSchema.default({}),
  
  // Sorting (defaults to sorting by commute time)
  sort: apartmentSortSchema.default({
    field: 'price',
    order: 'asc',
  }),
  
  // Pagination
  pagination: paginationSchema,
  
  // List creation options
  listName: z.string().max(100).optional(),
  listDescription: z.string().max(500).optional(),
  createList: z.boolean().optional(),
  
  // Additional options
  includeRouteDetails: z.boolean().optional(),
  preferredTransportModes: z.array(
    z.enum(['train', 'subway', 'bus', 'walk'])
  ).optional(),
});

// ============= Station Search Schema =============

/**
 * Search for stations
 */
export const stationSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required').trim(),
  limit: z.number().min(1).max(50).default(10),
  includeLines: z.boolean().optional(),
  nearCoordinates: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radiusKm: z.number().min(0.1).max(50).default(10),
  }).optional(),
});

// ============= Area Search Schema =============

/**
 * Search apartments by area/ward
 */
export const areaSearchSchema = z.object({
  // Location parameters
  wards: z.array(z.string()).min(1, 'At least one ward is required'),
  
  // Optional filters
  filters: apartmentFilterSchema.default({}),
  
  // Sorting
  sort: apartmentSortSchema,
  
  // Pagination
  pagination: paginationSchema,
});

// ============= Saved Search Schema =============

/**
 * Save search criteria for later use
 */
export const savedSearchSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  searchType: z.enum(['standard', 'commute', 'area']),
  criteria: z.union([
    standardSearchSchema,
    commuteSearchSchema,
    areaSearchSchema,
  ]),
  notifyOnNewMatches: z.boolean().default(false),
  notificationFrequency: z.enum(['instant', 'daily', 'weekly']).optional(),
});

// ============= Search Results Schema =============

/**
 * Search statistics
 */
export const searchStatsSchema = z.object({
  totalResults: z.number(),
  priceRange: z.object({
    min: z.number(),
    max: z.number(),
    average: z.number(),
    median: z.number(),
  }),
  sizeRange: z.object({
    min: z.number(),
    max: z.number(),
    average: z.number(),
  }),
  layoutDistribution: z.record(z.string(), z.number()),
  wardDistribution: z.record(z.string(), z.number()),
});

/**
 * Search results response
 */
export const searchResultsSchema = z.object({
  apartments: z.array(z.any()), // Actual apartment schema would be imported
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
    hasNext: z.boolean(),
    hasPrevious: z.boolean(),
  }),
  stats: searchStatsSchema.optional(),
  searchId: z.string().optional(),
  executionTime: z.number().optional(),
});

// ============= Quick Search Schema =============

/**
 * Quick search for autocomplete/suggestions
 */
export const quickSearchSchema = z.object({
  query: z.string().min(1).max(100),
  types: z.array(
    z.enum(['apartments', 'stations', 'areas', 'amenities'])
  ).default(['apartments', 'stations']),
  limit: z.number().min(1).max(20).default(5),
});

// ============= Utility Types =============

export type StandardSearch = z.infer<typeof standardSearchSchema>;
export type CommuteSearch = z.infer<typeof commuteSearchSchema>;
export type StationSearch = z.infer<typeof stationSearchSchema>;
export type AreaSearch = z.infer<typeof areaSearchSchema>;
export type SavedSearch = z.infer<typeof savedSearchSchema>;
export type SearchResults = z.infer<typeof searchResultsSchema>;
export type SearchStats = z.infer<typeof searchStatsSchema>;
export type QuickSearch = z.infer<typeof quickSearchSchema>;