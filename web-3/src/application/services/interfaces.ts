/**
 * Application Service Interfaces
 * 
 * These interfaces define the business logic contracts for our services.
 * Services orchestrate domain entities and repositories to implement use cases.
 */

import type { Apartment, ApartmentWithRelations, PaginatedApartments } from "~/types";
import type { User, UserPreference } from "@prisma/client";
import type { StandardSearchInput, CommuteSearchInput, SearchSessionWithMeta } from "~/types";
import type { ListWithMeta, ListWithApartments } from "~/types";
import type { ListType } from "@prisma/client";

/**
 * Apartment search filters
 */
export interface ApartmentFilters {
  priceMin?: number;
  priceMax?: number;
  sizeMin?: number;
  sizeMax?: number;
  layout?: string[];
  amenities?: string[];
  stationIds?: string[];
  maxWalkingMinutes?: number;
  availability?: string;
  excludeWards?: string[];
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  cursor?: string;
}

/**
 * Sort options
 */
export interface SortOptions {
  field?: 'price' | 'size' | 'createdAt' | 'scrapedAt' | 'score';
  order?: 'asc' | 'desc';
}

/**
 * Apartment Service Interface
 * 
 * Handles all apartment-related business logic
 */
export interface IApartmentService {
  /**
   * Get apartment by ID with all relations
   */
  getById(id: string): Promise<ApartmentWithRelations | null>;

  /**
   * Get multiple apartments by IDs
   */
  getByIds(ids: string[]): Promise<ApartmentWithRelations[]>;

  /**
   * Search apartments with filters, pagination and sorting
   */
  search(
    filters: ApartmentFilters,
    pagination?: PaginationOptions,
    sort?: SortOptions
  ): Promise<PaginatedApartments>;

  /**
   * Get routes for an apartment to multiple destinations
   */
  getRoutes(
    apartmentId: string,
    destinationIds: string[]
  ): Promise<{
    routes: any[];
    missingDestinations: string[];
  }>;

  /**
   * Create a new apartment
   */
  create(data: any): Promise<ApartmentWithRelations>;

  /**
   * Update apartment availability
   */
  updateAvailability(
    id: string,
    availability: 'available' | 'occupied' | 'unknown'
  ): Promise<any>;

  /**
   * Update apartment's preferred station
   */
  updatePreferredStation(
    id: string,
    stationId: string | null
  ): Promise<any>;

  /**
   * Delete an apartment
   */
  delete(id: string): Promise<void>;

  /**
   * Get available wards from database
   */
  getAvailableWards(): Promise<string[]>;

  /**
   * Refresh apartment data from source
   */
  refreshData(id: string, userId?: string): Promise<{
    success: boolean;
    jobId: string;
    message: string;
  }>;
}

/**
 * User Service Interface
 * 
 * Handles user-related business logic including preferences
 */
export interface IUserService {
  /**
   * Get user preferences
   */
  getPreferences(userId: string): Promise<UserPreference>;

  /**
   * Create initial preferences for a new user
   */
  createInitialPreferences(userId: string): Promise<UserPreference>;

  /**
   * Get current user with preferences and counts
   */
  getCurrentUser(userId: string): Promise<User & {
    preferences: UserPreference | null;
    _count: {
      lists: number;
      searchSessions: number;
    };
  }>;

  /**
   * Update user preferences including score weights
   */
  updatePreferences(
    userId: string,
    data: Partial<UserPreference>
  ): Promise<UserPreference>;

  /**
   * Update user profile
   */
  updateProfile(
    userId: string,
    data: { name?: string; image?: string }
  ): Promise<User>;

  /**
   * Delete user account
   */
  deleteAccount(userId: string): Promise<void>;

  /**
   * Get score weights for a user
   */
  getScoreWeights(userId: string): Promise<{
    commuteTimeWeight: number;
    priceWeight: number;
    sizeWeight: number;
    ageWeight: number;
    floorWeight: number;
    walkTimeWeight: number;
  }>;
}

/**
 * Search Service Interface
 * 
 * Handles search-related business logic
 */
export interface ISearchService {
  /**
   * Standard apartment search
   */
  search(input: StandardSearchInput): Promise<{
    apartments: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;

  /**
   * Initiate commute-based search
   */
  searchByCommuteTime(
    input: CommuteSearchInput,
    userId: string
  ): Promise<{
    listId: string;
    jobId: string;
    status: 'pending' | 'processing' | 'completed';
    message: string;
  }>;

  /**
   * Get recent searches for a user
   */
  getRecentSearches(
    userId: string,
    limit?: number
  ): Promise<SearchSessionWithMeta[]>;

  /**
   * Get popular searches for suggestions
   */
  getPopularSearches(): Promise<{
    popularStations: any[];
    popularLayouts: string[];
    popularPriceRanges: any[];
  }>;

  /**
   * Get search suggestions based on partial input
   */
  getSuggestions(
    query: string,
    type?: 'station' | 'area' | 'amenity'
  ): Promise<{
    stations?: any[];
    amenities?: string[];
  }>;

  /**
   * Refresh apartments matching criteria
   */
  refreshApartments(
    filters: ApartmentFilters,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    totalFound: number;
    newlySaved: number;
    updated: number;
  }>;

  /**
   * Get search progress for a commute search
   */
  getSearchProgress(listId: string, userId: string): Promise<any>;

  /**
   * Fast concurrent search across multiple sources
   */
  fastSearch(
    filters: {
      priceMin?: number;
      priceMax?: number;
      sizeMin?: number;
      sizeMax?: number;
      sources?: string[];
    },
    limit: number,
    userId: string
  ): Promise<{
    success: boolean;
    message: string;
    stats: any;
    apartments: any[];
  }>;
}

/**
 * List Service Interface
 * 
 * Handles list-related business logic
 */
export interface IListService {
  /**
   * Get a specific list by ID
   */
  getById(id: string, userId: string): Promise<any>;

  /**
   * Get apartments in a list with pagination and filters
   */
  getApartments(
    listId: string,
    userId: string,
    options: {
      pagination?: PaginationOptions;
      filters?: any;
      sort?: any;
      excludeListTypes?: ListType[];
    }
  ): Promise<{
    apartments: any[];
    listItems: any[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  }>;

  /**
   * Check if apartment is in user's lists
   */
  checkApartmentInLists(
    apartmentId: string,
    userId: string,
    listTypes?: ListType[]
  ): Promise<Record<string, string>>;

  /**
   * Get all lists for the current user
   */
  getUserLists(
    userId: string,
    type?: ListType,
    includeCount?: boolean
  ): Promise<ListWithMeta[]>;

  /**
   * Get a specific list with apartments
   */
  getList(
    id: string,
    userId: string,
    page?: number,
    limit?: number
  ): Promise<ListWithApartments | null>;

  /**
   * Get list progress (for search result lists)
   */
  getListProgress(id: string, userId: string): Promise<any>;

  /**
   * Create a new list
   */
  create(
    data: {
      name: string;
      type: ListType;
      isPublic?: boolean;
      searchParams?: any;
    },
    userId: string
  ): Promise<any>;

  /**
   * Update list details
   */
  update(
    id: string,
    data: {
      name?: string;
      isPublic?: boolean;
      status?: string;
      progress?: number;
    },
    userId: string
  ): Promise<any>;

  /**
   * Delete a list
   */
  delete(id: string, userId: string): Promise<void>;

  /**
   * Add apartment to list
   */
  addApartment(
    listId: string,
    apartmentId: string,
    userId: string
  ): Promise<any>;

  /**
   * Remove apartment from list
   */
  removeApartment(
    listId: string,
    apartmentId: string,
    userId: string
  ): Promise<void>;

  /**
   * Update apartment scores in a list
   */
  updateApartmentScore(
    listId: string,
    apartmentId: string,
    scores: {
      locationScore: number | null;
      designScore: number | null;
      spaceScore: number | null;
    },
    userId: string
  ): Promise<any>;

  /**
   * Mark apartment as seen
   */
  markSeen(
    listId: string,
    apartmentId: string,
    userId: string
  ): Promise<any>;

  /**
   * Get next unseen apartment in list
   */
  getNextUnseen(
    listId: string,
    userId: string,
    currentId?: string
  ): Promise<{
    apartment: any;
    unseenCount: number;
  } | null>;

  /**
   * Get apartment stats for a list
   */
  getApartmentStats(
    listId: string,
    userId: string
  ): Promise<{
    total: number;
    needingDetails: number;
    withScores: number;
    withDetails: number;
  }>;
}