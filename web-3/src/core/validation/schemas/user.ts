/**
 * User-related validation schemas
 * Includes authentication, preferences, and scoring
 */

import { z } from 'zod';
import { 
  emailSchema, 
  urlSchema, 
  cuidSchema,
  nonNegativeSchema,
  percentageSchema,
  numericRangeSchema
} from './common';

// ============= Authentication Schemas =============

/**
 * User registration schema
 */
export const userRegistrationSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(1, 'Name is required').max(100),
});

/**
 * User login schema
 */
export const userLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset schema
 */
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

// ============= Profile Schemas =============

/**
 * User profile update schema
 */
export const userProfileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: urlSchema.optional(),
  bio: z.string().max(500).optional(),
  phoneNumber: z
    .string()
    .regex(/^(\+81|0)\d{1,4}-?\d{1,4}-?\d{4}$/, 'Invalid phone number format')
    .optional(),
});

// ============= Preference Schemas =============

/**
 * Commute preferences
 */
export const commutePreferencesSchema = z.object({
  maxCommute: z
    .number()
    .min(5, 'Minimum commute time is 5 minutes')
    .max(120, 'Maximum commute time is 120 minutes')
    .nullable()
    .optional(),
  preferredStations: z.array(cuidSchema).optional(),
  workplaceStationId: cuidSchema.optional(),
});

/**
 * Housing preferences
 */
export const housingPreferencesSchema = z.object({
  priceRange: numericRangeSchema.nullable().optional(),
  sizeRange: numericRangeSchema.nullable().optional(),
  preferredLayouts: z.array(z.string()).optional(),
  preferredAmenities: z.array(z.string()).optional(),
  excludedWards: z.array(z.string()).optional(),
});

/**
 * Complete user preferences schema
 */
export const userPreferencesSchema = z.object({
  // Commute preferences
  maxCommute: z
    .number()
    .min(5)
    .max(120)
    .nullable()
    .optional(),
  preferredStations: z.array(z.string()).optional(),
  workplaceStationId: z.string().optional(),
  
  // Housing preferences
  priceRange: z.object({
    min: nonNegativeSchema.optional(),
    max: nonNegativeSchema.optional(),
  }).nullable().optional(),
  
  sizeRange: z.object({
    min: nonNegativeSchema.optional(),
    max: nonNegativeSchema.optional(),
  }).nullable().optional(),
  
  // Saved filters (flexible JSON)
  savedFilters: z.any().nullable().optional(),
  
  // Notification preferences
  emailNotifications: z.boolean().optional(),
  pushNotifications: z.boolean().optional(),
  notificationFrequency: z.enum(['instant', 'daily', 'weekly', 'never']).optional(),
});

// ============= Scoring Schemas =============

/**
 * Score weight configuration
 * All weights should sum to 100
 */
export const scoreWeightsSchema = z.object({
  commuteTimeWeight: percentageSchema,
  priceWeight: percentageSchema,
  sizeWeight: percentageSchema,
  ageWeight: percentageSchema,
  floorWeight: percentageSchema,
  walkTimeWeight: percentageSchema,
}).refine(data => {
  const sum = Object.values(data).reduce((acc, val) => acc + val, 0);
  return Math.abs(sum - 100) < 0.01; // Allow for floating point errors
}, {
  message: 'All weights must sum to 100',
});

/**
 * Target values for scoring
 */
export const targetValuesSchema = z.object({
  targetPrice: nonNegativeSchema.optional(),
  targetSize: nonNegativeSchema.optional(),
  targetCommute: z.number().min(0).max(120).optional(),
  targetAge: nonNegativeSchema.optional(),
  targetFloor: z.number().min(1).optional(),
  targetWalkTime: z.number().min(0).max(30).optional(),
});

/**
 * Complete scoring configuration
 */
export const scoringConfigSchema = z.object({
  weights: scoreWeightsSchema,
  targets: targetValuesSchema,
  enabled: z.boolean().default(true),
});

// ============= List Management Schemas =============

/**
 * List types enum
 */
export const listTypeEnum = ['MANUAL', 'SEARCH', 'FAVORITE'] as const;
export const listTypeSchema = z.enum(listTypeEnum);

/**
 * Create list schema
 */
export const createListSchema = z.object({
  name: z
    .string()
    .min(1, 'List name is required')
    .max(100, 'List name is too long'),
  type: listTypeSchema,
  isPublic: z.boolean().default(false),
  description: z.string().max(500).optional(),
  searchParams: z.any().optional(), // Flexible for different search types
});

/**
 * Update list schema
 */
export const updateListSchema = createListSchema.partial();

/**
 * Add/remove apartments from list
 */
export const listApartmentOperationSchema = z.object({
  listId: cuidSchema,
  apartmentIds: z.array(cuidSchema).min(1, 'At least one apartment ID is required'),
});

// ============= Issue Reporting Schemas =============

/**
 * Issue types for reporting
 */
export const issueTypeEnum = [
  'incorrect_info',
  'unavailable',
  'duplicate',
  'inappropriate',
  'technical',
  'other'
] as const;
export const issueTypeSchema = z.enum(issueTypeEnum);

/**
 * Report issue schema
 */
export const reportIssueSchema = z.object({
  apartmentId: cuidSchema.optional(),
  issueType: issueTypeSchema,
  title: z
    .string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title is too long'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(1000, 'Description is too long'),
  contactEmail: emailSchema.optional(),
  screenshots: z.array(urlSchema).max(5).optional(),
});

// ============= Utility Types =============

export type UserRegistration = z.infer<typeof userRegistrationSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;
export type UserPreferences = z.infer<typeof userPreferencesSchema>;
export type ScoreWeights = z.infer<typeof scoreWeightsSchema>;
export type TargetValues = z.infer<typeof targetValuesSchema>;
export type CreateList = z.infer<typeof createListSchema>;
export type ReportIssue = z.infer<typeof reportIssueSchema>;