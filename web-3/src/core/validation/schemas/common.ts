/**
 * Common validation schemas used across the application
 * These are reusable building blocks for more complex schemas
 */

import { z } from 'zod';

// ============= Primitive Schemas =============

/**
 * Email validation with common patterns
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .toLowerCase()
  .trim();

/**
 * URL validation with protocol requirement
 */
export const urlSchema = z
  .string()
  .url('Invalid URL')
  .trim();

/**
 * CUID validation for IDs
 */
export const cuidSchema = z
  .string()
  .cuid('Invalid ID format');

/**
 * Positive integer validation
 */
export const positiveIntSchema = z
  .number()
  .int('Must be a whole number')
  .positive('Must be a positive number');

/**
 * Non-negative number validation
 */
export const nonNegativeSchema = z
  .number()
  .min(0, 'Cannot be negative');

/**
 * Percentage validation (0-100)
 */
export const percentageSchema = z
  .number()
  .min(0, 'Percentage must be between 0 and 100')
  .max(100, 'Percentage must be between 0 and 100');

// ============= Date/Time Schemas =============

/**
 * Date string in ISO format
 */
export const dateStringSchema = z
  .string()
  .datetime('Invalid date format');

/**
 * Date object validation
 */
export const dateSchema = z.date();

/**
 * Time range validation
 */
export const timeRangeSchema = z.object({
  start: dateSchema,
  end: dateSchema,
}).refine(data => data.start <= data.end, {
  message: 'Start date must be before or equal to end date',
  path: ['end'],
});

// ============= Range Schemas =============

/**
 * Generic numeric range schema
 */
export const numericRangeSchema = z.object({
  min: nonNegativeSchema.optional(),
  max: nonNegativeSchema.optional(),
}).refine(data => {
  if (data.min !== undefined && data.max !== undefined) {
    return data.min <= data.max;
  }
  return true;
}, {
  message: 'Minimum value must be less than or equal to maximum value',
  path: ['max'],
});

/**
 * Price range specifically for monetary values
 */
export const priceRangeSchema = z.object({
  min: z.number().min(0, 'Price cannot be negative').optional(),
  max: z.number().min(0, 'Price cannot be negative').optional(),
}).refine(data => {
  if (data.min !== undefined && data.max !== undefined) {
    return data.min <= data.max;
  }
  return true;
}, {
  message: 'Minimum price must be less than or equal to maximum price',
  path: ['max'],
});

// ============= Pagination Schemas =============

/**
 * Standard pagination parameters
 */
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Cursor-based pagination
 */
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

/**
 * Combined pagination (supports both cursor and page-based)
 */
export const flexiblePaginationSchema = z.object({
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// ============= Sorting Schemas =============

/**
 * Generic sort order
 */
export const sortOrderSchema = z.enum(['asc', 'desc']);

/**
 * Generic sort parameters
 */
export function createSortSchema<T extends string>(fields: readonly [T, ...T[]]) {
  return z.object({
    field: z.enum(fields),
    order: sortOrderSchema.default('desc'),
  });
}

// ============= Search Schemas =============

/**
 * Text search with optional fuzzy matching
 */
export const textSearchSchema = z.object({
  query: z.string().min(1).trim(),
  fuzzy: z.boolean().optional(),
  fields: z.array(z.string()).optional(),
});

// ============= Location Schemas =============

/**
 * Geographic coordinates
 */
export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/**
 * Japanese address components
 */
export const japaneseAddressSchema = z.object({
  prefecture: z.string().optional(),
  city: z.string().optional(),
  ward: z.string().optional(),
  area: z.string().optional(),
  block: z.string().optional(),
  building: z.string().optional(),
  full: z.string(),
});

// ============= Contact Schemas =============

/**
 * Phone number validation (Japanese format)
 */
export const phoneNumberSchema = z
  .string()
  .regex(/^(\+81|0)\d{1,4}-?\d{1,4}-?\d{4}$/, 'Invalid phone number format')
  .transform(val => val.replace(/-/g, ''));

// ============= File Schemas =============

/**
 * File upload validation
 */
export const fileUploadSchema = z.object({
  name: z.string(),
  size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  type: z.string(),
  url: urlSchema.optional(),
});

/**
 * Image file validation
 */
export const imageFileSchema = fileUploadSchema.extend({
  type: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
});

// ============= Utility Functions =============

/**
 * Make all properties of a schema optional
 */
export function makeOptional<T extends z.ZodObject<any>>(schema: T) {
  return schema.partial();
}

/**
 * Make specific properties required
 */
export function makeRequired<T extends z.ZodObject<any>, K extends keyof T['shape']>(
  schema: T,
  keys: K[]
) {
  const shape = schema.shape;
  const newShape: any = {};
  
  for (const key in shape) {
    if (keys.includes(key as K)) {
      newShape[key] = shape[key];
    } else {
      newShape[key] = shape[key].optional();
    }
  }
  
  return z.object(newShape);
}

/**
 * Create a schema that validates string enums
 */
export function createEnumSchema<T extends string>(
  values: readonly T[],
  errorMessage?: string
) {
  return z.enum(values as [T, ...T[]], {
    errorMap: () => ({ message: errorMessage || `Must be one of: ${values.join(', ')}` }),
  });
}