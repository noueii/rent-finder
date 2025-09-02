/**
 * Central export point for all validation schemas
 * Import schemas from here to ensure consistency
 */

// Re-export all common schemas
export * from './common';

// Re-export all apartment schemas
export * from './apartment';

// Re-export all user schemas
export * from './user';

// Re-export all search schemas
export * from './search';

// Re-export scraper schemas
export * from './scraper';

// Re-export admin schemas
export * from './admin';

/**
 * Schema collections for easy access
 */
import * as common from './common';
import * as apartment from './apartment';
import * as user from './user';
import * as search from './search';
import * as scraper from './scraper';
import * as admin from './admin';

export const commonSchemas = common;
export const apartmentSchemas = apartment;
export const userSchemas = user;
export const searchSchemas = search;
export const scraperSchemas = scraper;
export const adminSchemas = admin;

/**
 * Re-export commonly used combinations
 */

// Common form schemas
export const formSchemas = {
  // From user schemas
  registration: user.userRegistrationSchema,
  login: user.userLoginSchema,
  profile: user.userProfileUpdateSchema,
  preferences: user.userPreferencesSchema,
  
  // From apartment schemas
  apartmentFilter: apartment.apartmentFilterSchema,
  
  // From search schemas
  standardSearch: search.standardSearchSchema,
  commuteSearch: search.commuteSearchSchema,
  
  // Issue reporting
  reportIssue: user.reportIssueSchema,
} as const;

// API input schemas
export const apiSchemas = {
  // Pagination
  pagination: common.paginationSchema,
  cursorPagination: common.cursorPaginationSchema,
  
  // Sorting
  sortOrder: common.sortOrderSchema,
  
  // Filters
  apartmentFilter: apartment.apartmentFilterSchema,
  priceRange: common.priceRangeSchema,
  
  // Search
  standardSearch: search.standardSearchSchema,
  commuteSearch: search.commuteSearchSchema,
  stationSearch: search.stationSearchSchema,
  
  // CRUD operations
  apartmentCreate: apartment.apartmentCreateSchema,
  apartmentUpdate: apartment.apartmentUpdateSchema,
  
  // User operations
  scoreWeights: user.scoreWeightsSchema,
  targetValues: user.targetValuesSchema,
} as const;