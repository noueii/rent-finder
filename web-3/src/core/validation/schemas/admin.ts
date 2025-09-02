/**
 * Admin-related validation schemas
 * For admin panel operations and monitoring
 */

import { z } from 'zod';
import { 
  cuidSchema,
  dateStringSchema,
  paginationSchema,
  createEnumSchema,
  timeRangeSchema
} from './common';

// ============= Job Management Schemas =============

/**
 * Job types in the system
 */
export const jobTypeEnum = [
  'SCRAPE_APARTMENTS',
  'UPDATE_PRICES',
  'CHECK_REMOVALS',
  'GEOCODE_ADDRESSES',
  'CALCULATE_SCORES',
  'CLEANUP_OLD_DATA',
  'GENERATE_REPORTS'
] as const;

export const jobTypeSchema = createEnumSchema(jobTypeEnum);

/**
 * Job status enum
 */
export const jobStatusEnum = [
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
] as const;

export const jobStatusSchema = createEnumSchema(jobStatusEnum);

/**
 * Create job schema
 */
export const createJobSchema = z.object({
  type: jobTypeSchema,
  priority: z.number().int().min(0).max(10).default(5),
  scheduledFor: dateStringSchema.optional(),
  config: z.record(z.unknown()).optional(),
  retryOnFailure: z.boolean().default(true),
  maxRetries: z.number().int().min(0).max(5).default(3),
});

/**
 * Job filter schema
 */
export const jobFilterSchema = z.object({
  types: z.array(jobTypeSchema).optional(),
  statuses: z.array(jobStatusSchema).optional(),
  dateRange: timeRangeSchema.optional(),
  priority: z.object({
    min: z.number().int().min(0).max(10).optional(),
    max: z.number().int().min(0).max(10).optional(),
  }).optional(),
});

// ============= System Monitoring Schemas =============

/**
 * System metrics schema
 */
export const systemMetricsSchema = z.object({
  cpu: z.object({
    usage: z.number().min(0).max(100),
    cores: z.number().int().positive(),
  }),
  memory: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number().min(0).max(100),
  }),
  disk: z.object({
    used: z.number(),
    total: z.number(),
    percentage: z.number().min(0).max(100),
  }),
  uptime: z.number(), // seconds
  timestamp: dateStringSchema,
});

/**
 * Performance metrics schema
 */
export const performanceMetricsSchema = z.object({
  requestsPerMinute: z.number(),
  averageResponseTime: z.number(), // milliseconds
  errorRate: z.number().min(0).max(100),
  activeUsers: z.number(),
  databaseConnections: z.number(),
  cacheHitRate: z.number().min(0).max(100),
});

// ============= Data Management Schemas =============

/**
 * Bulk operation types
 */
export const bulkOperationEnum = [
  'DELETE',
  'UPDATE_STATUS',
  'RECALCULATE_SCORES',
  'REFRESH_DATA',
  'EXPORT'
] as const;

export const bulkOperationSchema = createEnumSchema(bulkOperationEnum);

/**
 * Bulk operation request
 */
export const bulkOperationRequestSchema = z.object({
  operation: bulkOperationSchema,
  targetIds: z.array(cuidSchema).min(1).max(1000),
  options: z.record(z.unknown()).optional(),
  dryRun: z.boolean().default(false),
});

/**
 * Data cleanup configuration
 */
export const dataCleanupConfigSchema = z.object({
  deleteOlderThan: z.number().min(1), // days
  excludeTypes: z.array(z.string()).optional(),
  batchSize: z.number().int().min(10).max(1000).default(100),
  dryRun: z.boolean().default(true),
});

// ============= Scraper Control Schemas =============

/**
 * Scraper control actions
 */
export const scraperActionEnum = [
  'START',
  'STOP',
  'PAUSE',
  'RESUME',
  'RESTART',
  'TEST'
] as const;

export const scraperActionSchema = createEnumSchema(scraperActionEnum);

/**
 * Scraper control request
 */
export const scraperControlSchema = z.object({
  scraperName: z.string(),
  action: scraperActionSchema,
  config: z.object({
    urls: z.array(z.string().url()).optional(),
    useProxy: z.boolean().optional(),
    rateLimit: z.number().min(100).optional(),
    maxPages: z.number().int().positive().optional(),
  }).optional(),
});

/**
 * Scraper test request
 */
export const scraperTestSchema = z.object({
  scraperName: z.string(),
  testUrl: z.string().url(),
  useProxy: z.boolean().default(false),
  validateOnly: z.boolean().default(false),
});

// ============= Report Generation Schemas =============

/**
 * Report types
 */
export const reportTypeEnum = [
  'DAILY_SUMMARY',
  'WEEKLY_ANALYTICS',
  'MONTHLY_REPORT',
  'SCRAPER_PERFORMANCE',
  'USER_ACTIVITY',
  'ERROR_ANALYSIS',
  'CUSTOM'
] as const;

export const reportTypeSchema = createEnumSchema(reportTypeEnum);

/**
 * Generate report request
 */
export const generateReportSchema = z.object({
  type: reportTypeSchema,
  dateRange: timeRangeSchema,
  format: z.enum(['JSON', 'CSV', 'PDF']).default('JSON'),
  includeCharts: z.boolean().default(false),
  emailTo: z.array(z.string().email()).optional(),
  customParams: z.record(z.unknown()).optional(),
});

// ============= Admin User Management =============

/**
 * Admin role types
 */
export const adminRoleEnum = [
  'SUPER_ADMIN',
  'ADMIN',
  'MODERATOR',
  'SUPPORT',
  'VIEWER'
] as const;

export const adminRoleSchema = createEnumSchema(adminRoleEnum);

/**
 * Admin action log schema
 */
export const adminActionLogSchema = z.object({
  adminId: cuidSchema,
  action: z.string(),
  targetType: z.string(),
  targetId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  ipAddress: z.string().ip().optional(),
  userAgent: z.string().optional(),
  timestamp: dateStringSchema,
});

// ============= Cache Management =============

/**
 * Cache operations
 */
export const cacheOperationEnum = [
  'CLEAR_ALL',
  'CLEAR_PATTERN',
  'WARM_UP',
  'INSPECT',
  'STATS'
] as const;

export const cacheOperationSchema = createEnumSchema(cacheOperationEnum);

/**
 * Cache management request
 */
export const cacheManagementSchema = z.object({
  operation: cacheOperationSchema,
  pattern: z.string().optional(),
  ttl: z.number().min(0).optional(), // seconds
  force: z.boolean().default(false),
});

// ============= Utility Types =============

export type CreateJob = z.infer<typeof createJobSchema>;
export type JobFilter = z.infer<typeof jobFilterSchema>;
export type SystemMetrics = z.infer<typeof systemMetricsSchema>;
export type BulkOperationRequest = z.infer<typeof bulkOperationRequestSchema>;
export type ScraperControl = z.infer<typeof scraperControlSchema>;
export type GenerateReport = z.infer<typeof generateReportSchema>;
export type AdminActionLog = z.infer<typeof adminActionLogSchema>;
export type CacheManagement = z.infer<typeof cacheManagementSchema>;