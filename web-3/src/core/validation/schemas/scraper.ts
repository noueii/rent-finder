/**
 * Scraper-related validation schemas
 * For validating scraped data and scraper configurations
 */

import { z } from 'zod';
import { 
  urlSchema, 
  positiveIntSchema,
  nonNegativeSchema,
  createEnumSchema
} from './common';
import { 
  apartmentStationSchema,
  apartmentImageSchema,
  apartmentFeesSchema,
  availabilitySchema
} from './apartment';

// ============= Scraper Configuration =============

/**
 * Proxy configuration for scrapers
 */
export const proxyConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  protocol: z.enum(['http', 'https', 'socks4', 'socks5']).optional(),
});

/**
 * Scraper configuration
 */
export const scraperConfigSchema = z.object({
  name: z.string().min(1),
  baseUrl: urlSchema,
  rateLimit: z.number().min(100), // milliseconds between requests
  maxRetries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().min(1000).max(60000).default(30000), // request timeout
  headers: z.record(z.string()).optional(),
  proxies: z.array(proxyConfigSchema).optional(),
  userAgent: z.string().optional(),
});

// ============= Scraper Error Types =============

export const scraperErrorCodeEnum = [
  'RATE_LIMIT',
  'TIMEOUT',
  'NETWORK_ERROR',
  'PARSE_ERROR',
  'VALIDATION_ERROR',
  'BLOCKED',
  'NOT_FOUND',
  'UNKNOWN'
] as const;

export const scraperErrorCodeSchema = createEnumSchema(scraperErrorCodeEnum);

/**
 * Scraper error information
 */
export const scraperErrorSchema = z.object({
  code: scraperErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
  retryable: z.boolean(),
  statusCode: z.number().optional(),
});

// ============= Scraped Data Schemas =============

/**
 * Raw scraped apartment data before processing
 */
export const scrapedApartmentDataSchema = z.object({
  // Identification
  externalId: z.string().min(1, 'External ID is required'),
  sourceUrl: urlSchema,
  sourceSite: z.string().min(1, 'Source site is required'),
  
  // Basic info
  title: z.string().min(1, 'Title is required'),
  price: positiveIntSchema,
  size: z.number().positive('Size must be positive'),
  layout: z.string().optional(),
  
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
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  
  // Details
  description: z.string().optional(),
  amenities: z.array(z.string()).default([]),
  availability: availabilitySchema,
  
  // Fees
  feesTotal: nonNegativeSchema.optional(),
  feesJson: apartmentFeesSchema.optional(),
  
  // Related data
  images: z.array(apartmentImageSchema).default([]),
  nearestStations: z.array(apartmentStationSchema).min(1, 'At least one station is required'),
  
  // Metadata
  scrapedAt: z.date().optional(),
  raw: z.record(z.unknown()).optional(), // Raw HTML/JSON data
});

/**
 * Scrape result wrapper
 */
export const scrapeResultSchema = z.object({
  success: z.boolean(),
  data: scrapedApartmentDataSchema.optional(),
  error: scraperErrorSchema.optional(),
  metadata: z.object({
    url: urlSchema,
    scrapedAt: z.date(),
    duration: z.number(), // milliseconds
    retries: z.number(),
    proxy: z.string().optional(),
  }).optional(),
});

/**
 * Batch scrape results
 */
export const batchScrapeResultSchema = z.object({
  totalUrls: z.number(),
  successCount: z.number(),
  failureCount: z.number(),
  results: z.array(scrapeResultSchema),
  startedAt: z.date(),
  completedAt: z.date(),
  totalDuration: z.number(),
});

// ============= Scraper Status Schemas =============

/**
 * Scraper health status
 */
export const scraperHealthSchema = z.object({
  name: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  lastCheck: z.date(),
  successRate: z.number().min(0).max(100),
  averageResponseTime: z.number(),
  recentErrors: z.array(scraperErrorSchema),
});

/**
 * Scraper statistics
 */
export const scraperStatsSchema = z.object({
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  totalApartmentsScraped: z.number(),
  averageRequestDuration: z.number(),
  errorBreakdown: z.record(scraperErrorCodeSchema, z.number()),
  lastRun: z.date().nullable(),
  nextScheduledRun: z.date().nullable(),
});

// ============= Data Quality Schemas =============

/**
 * Data quality metrics
 */
export const dataQualitySchema = z.object({
  score: z.number().min(0).max(100),
  hasCoordinates: z.boolean(),
  hasImages: z.boolean(),
  hasDescription: z.boolean(),
  hasAmenities: z.boolean(),
  hasFees: z.boolean(),
  imageCount: z.number(),
  descriptionLength: z.number(),
  amenityCount: z.number(),
});

/**
 * Data validation result
 */
export const dataValidationResultSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  quality: dataQualitySchema,
  missingFields: z.array(z.string()),
  invalidFields: z.array(z.string()),
});

// ============= Utility Types =============

export type ProxyConfig = z.infer<typeof proxyConfigSchema>;
export type ScraperConfig = z.infer<typeof scraperConfigSchema>;
export type ScraperError = z.infer<typeof scraperErrorSchema>;
export type ScrapedApartmentData = z.infer<typeof scrapedApartmentDataSchema>;
export type ScrapeResult = z.infer<typeof scrapeResultSchema>;
export type BatchScrapeResult = z.infer<typeof batchScrapeResultSchema>;
export type ScraperHealth = z.infer<typeof scraperHealthSchema>;
export type ScraperStats = z.infer<typeof scraperStatsSchema>;
export type DataQuality = z.infer<typeof dataQualitySchema>;