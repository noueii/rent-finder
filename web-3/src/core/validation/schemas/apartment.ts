/**
 * Apartment-related validation schemas
 * Extracted and standardized from various parts of the application
 */

import { z } from 'zod';
import { 
  positiveIntSchema, 
  nonNegativeSchema, 
  urlSchema,
  cuidSchema,
  numericRangeSchema,
  createEnumSchema
} from './common';

// ============= Enums =============

/**
 * Apartment availability status
 */
export const availabilityEnum = ['available', 'occupied', 'unknown'] as const;
export const availabilitySchema = createEnumSchema(availabilityEnum);

/**
 * Common room layouts in Japanese apartments
 */
export const roomLayoutEnum = [
  '1R', '1K', '1DK', '1LDK', 
  '2K', '2DK', '2LDK',
  '3K', '3DK', '3LDK',
  '4K', '4DK', '4LDK',
  '5K+', 'OTHER'
] as const;
export const roomLayoutSchema = createEnumSchema(roomLayoutEnum);

// ============= Filter Schemas =============

/**
 * Price filter with min/max validation
 */
export const priceFilterSchema = z.object({
  priceMin: nonNegativeSchema.optional(),
  priceMax: nonNegativeSchema.optional(),
}).refine(data => {
  if (data.priceMin !== undefined && data.priceMax !== undefined) {
    return data.priceMin <= data.priceMax;
  }
  return true;
}, {
  message: 'Minimum price must be less than or equal to maximum price',
  path: ['priceMax'],
});

/**
 * Size filter with min/max validation (in m²)
 */
export const sizeFilterSchema = z.object({
  sizeMin: nonNegativeSchema.optional(),
  sizeMax: nonNegativeSchema.optional(),
}).refine(data => {
  if (data.sizeMin !== undefined && data.sizeMax !== undefined) {
    return data.sizeMin <= data.sizeMax;
  }
  return true;
}, {
  message: 'Minimum size must be less than or equal to maximum size',
  path: ['sizeMax'],
});

/**
 * Walking time from station filter
 */
export const walkingTimeFilterSchema = z
  .number()
  .min(1, 'Walking time must be at least 1 minute')
  .max(30, 'Walking time cannot exceed 30 minutes')
  .optional();

/**
 * Building age filter (in years)
 */
export const buildingAgeFilterSchema = z
  .number()
  .min(0, 'Building age cannot be negative')
  .max(100, 'Building age seems unrealistic')
  .optional();

/**
 * Complete apartment filter schema
 */
export const apartmentFilterSchema = z.object({
  // Price filters
  priceMin: nonNegativeSchema.optional(),
  priceMax: nonNegativeSchema.optional(),
  
  // Size filters
  sizeMin: nonNegativeSchema.optional(),
  sizeMax: nonNegativeSchema.optional(),
  
  // Layout filters
  layout: z.array(roomLayoutSchema).optional(),
  
  // Location filters
  stationIds: z.array(cuidSchema).optional(),
  excludeWards: z.array(z.string()).optional(),
  
  // Property filters
  maxAge: buildingAgeFilterSchema,
  minFloor: positiveIntSchema.optional(),
  
  // Feature filters
  amenities: z.array(z.string()).optional(),
  availability: availabilitySchema.optional(),
}).refine(data => {
  // Validate price range
  if (data.priceMin !== undefined && data.priceMax !== undefined) {
    return data.priceMin <= data.priceMax;
  }
  return true;
}, {
  message: 'Minimum price must be less than or equal to maximum price',
  path: ['priceMax'],
}).refine(data => {
  // Validate size range
  if (data.sizeMin !== undefined && data.sizeMax !== undefined) {
    return data.sizeMin <= data.sizeMax;
  }
  return true;
}, {
  message: 'Minimum size must be less than or equal to maximum size',
  path: ['sizeMax'],
});

// ============= Station Schemas =============

/**
 * Station information for an apartment
 */
export const apartmentStationSchema = z.object({
  name: z.string().min(1, 'Station name is required'),
  walkingMinutes: positiveIntSchema,
  distance: z.number().positive().optional(),
  lines: z.array(z.string()).optional(),
});

// ============= Image Schemas =============

/**
 * Apartment image data
 */
export const apartmentImageSchema = z.object({
  url: urlSchema,
  caption: z.string().optional(),
  order: z.number().int().min(0).optional(),
  isPrimary: z.boolean().optional(),
});

// ============= Fee Schemas =============

/**
 * Japanese apartment fee structure
 */
export const apartmentFeesSchema = z.object({
  deposit: nonNegativeSchema.optional(), // 敷金
  keyMoney: nonNegativeSchema.optional(), // 礼金
  agencyFee: nonNegativeSchema.optional(), // 仲介手数料
  guarantorFee: nonNegativeSchema.optional(), // 保証料
  insurance: nonNegativeSchema.optional(), // 保険料
  renewalFee: nonNegativeSchema.optional(), // 更新料
  managementFee: nonNegativeSchema.optional(), // 管理費
  commonAreaFee: nonNegativeSchema.optional(), // 共益費
  parkingFee: nonNegativeSchema.optional(), // 駐車場代
  other: z.record(z.string(), nonNegativeSchema).optional(),
});

// ============= Main Apartment Schemas =============

/**
 * Base apartment data (common fields)
 */
export const apartmentBaseSchema = z.object({
  // Identification
  externalId: z.string().min(1, 'External ID is required'),
  sourceUrl: urlSchema,
  sourceSite: z.string().min(1, 'Source site is required'),
  
  // Basic info
  title: z.string().min(1, 'Title is required'),
  price: positiveIntSchema,
  size: z.number().positive('Size must be positive'),
  layout: roomLayoutSchema.optional(),
  
  // Building info
  floor: z.number().int().optional(),
  totalFloors: positiveIntSchema.optional(),
  buildingAge: nonNegativeSchema.optional(),
  
  // Location
  address: z.string().min(1, 'Address is required'),
  area: z.string().optional(),
  ward: z.string().optional(),
  city: z.string().optional(),
  prefecture: z.string().optional(),
  
  // Status
  availability: availabilitySchema,
});

/**
 * Complete apartment data for creation
 */
export const apartmentCreateSchema = apartmentBaseSchema.extend({
  // Additional required fields for creation
  description: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  
  // Location details
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Related data
  images: z.array(apartmentImageSchema).default([]),
  nearestStations: z.array(apartmentStationSchema).min(1, 'At least one station is required'),
  
  // Fees
  feesTotal: nonNegativeSchema.optional(),
  feesJson: apartmentFeesSchema.optional(),
});

/**
 * Apartment update schema (all fields optional)
 */
export const apartmentUpdateSchema = apartmentCreateSchema.partial();

/**
 * Apartment search result schema
 */
export const apartmentSearchResultSchema = z.object({
  id: cuidSchema,
  title: z.string(),
  price: z.number(),
  size: z.number(),
  layout: z.string().nullable(),
  address: z.string(),
  nearestStation: z.string(),
  walkingMinutes: z.number(),
  primaryImage: urlSchema.nullable(),
  availability: availabilitySchema,
  score: z.number().optional(),
  matchReasons: z.array(z.string()).optional(),
});

// ============= Utility Types =============

export type ApartmentFilter = z.infer<typeof apartmentFilterSchema>;
export type ApartmentCreate = z.infer<typeof apartmentCreateSchema>;
export type ApartmentUpdate = z.infer<typeof apartmentUpdateSchema>;
export type ApartmentSearchResult = z.infer<typeof apartmentSearchResultSchema>;
export type ApartmentFees = z.infer<typeof apartmentFeesSchema>;
export type ApartmentStation = z.infer<typeof apartmentStationSchema>;
export type ApartmentImage = z.infer<typeof apartmentImageSchema>;