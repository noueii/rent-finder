import type { Apartment, Prisma } from '@prisma/client';
import type {
  ApartmentWithRelations,
  ApartmentSearchFilters,
  PaginationOptions,
  ApartmentSortOptions,
  PaginatedApartments
} from '~/types/apartment';

/**
 * Repository interface for apartment data access
 * 
 * Defines the contract for all apartment-related database operations.
 * Implementations should handle error transformation and maintain
 * consistency in return types.
 */
export interface IApartmentRepository {
  // Basic CRUD
  /**
   * Find apartment by internal ID
   * @param id - Apartment ID
   * @param includeRelations - Whether to include related data (images, stations, routes)
   */
  findById(id: string, includeRelations?: boolean): Promise<ApartmentWithRelations | null>;
  
  /**
   * Find apartment by external source ID
   * @param externalId - ID from the source website
   * @param sourceSite - Source website identifier
   */
  findByExternalId(externalId: string, sourceSite: string): Promise<Apartment | null>;
  
  /** Create a new apartment */
  create(data: Prisma.ApartmentCreateInput): Promise<Apartment>;
  
  /** Update an existing apartment */
  update(id: string, data: Prisma.ApartmentUpdateInput): Promise<Apartment>;
  
  /** Delete an apartment */
  delete(id: string): Promise<Apartment>;
  
  // Batch operations
  /**
   * Create multiple apartments in one operation
   * @param data - Array of apartments to create
   * @returns Count of created apartments
   */
  createMany(data: Prisma.ApartmentCreateManyInput[]): Promise<{ count: number }>;
  
  /**
   * Update multiple apartments matching criteria
   * @param where - Filter criteria
   * @param data - Update data to apply
   * @returns Count of updated apartments
   */
  updateMany(where: Prisma.ApartmentWhereInput, data: Prisma.ApartmentUpdateInput): Promise<{ count: number }>;
  
  // Search and filtering
  /**
   * Search apartments with filters, pagination, and sorting
   * @param filters - Search criteria (price, size, location, etc.)
   * @param pagination - Page and limit options
   * @param sort - Sort field and order
   * @returns Paginated apartment results
   */
  search(
    filters: ApartmentSearchFilters,
    pagination: PaginationOptions,
    sort?: ApartmentSortOptions
  ): Promise<PaginatedApartments>;
  
  // Station-related queries
  /**
   * Find apartments near a specific station
   * @param stationId - Station ID to search near
   * @param maxWalkingMinutes - Maximum walking distance (default: 15)
   */
  findByStation(stationId: string, maxWalkingMinutes?: number): Promise<ApartmentWithRelations[]>;
  
  /**
   * Find apartments near multiple stations
   * @param stationIds - Array of station IDs
   * @param maxWalkingMinutes - Maximum walking distance (default: 15)
   */
  findByStations(stationIds: string[], maxWalkingMinutes?: number): Promise<ApartmentWithRelations[]>;
  
  // Route-related operations
  /**
   * Find apartments that need route calculation
   * @param limit - Maximum number to return (default: 100)
   * @returns Apartments with stations but no calculated routes
   */
  findWithoutRoutes(limit?: number): Promise<ApartmentWithRelations[]>;
  
  /**
   * Update apartment routes (replaces existing)
   * @param apartmentId - Apartment to update
   * @param routes - New route data
   */
  updateRoutes(apartmentId: string, routes: any[]): Promise<void>;
  
  // Status operations
  /**
   * Mark apartment as removed (no longer available)
   * @param id - Apartment ID
   */
  markAsRemoved(id: string): Promise<Apartment>;
  
  /**
   * Mark apartment details as fetched
   * @param id - Apartment ID
   */
  markDetailsAsFetched(id: string): Promise<Apartment>;
  
  /**
   * Update last detail check timestamp
   * @param id - Apartment ID
   */
  updateLastDetailCheck(id: string): Promise<Apartment>;
  
  // Statistics
  /**
   * Count apartments matching filters
   * @param filters - Search criteria
   */
  countByFilters(filters: ApartmentSearchFilters): Promise<number>;
  
  /**
   * Calculate average price for apartments
   * @param filters - Optional filters to apply
   * @returns Average price in yen
   */
  getAveragePrice(filters?: ApartmentSearchFilters): Promise<number>;
  
  /**
   * Calculate average size for apartments
   * @param filters - Optional filters to apply
   * @returns Average size in square meters
   */
  getAverageSize(filters?: ApartmentSearchFilters): Promise<number>;
}