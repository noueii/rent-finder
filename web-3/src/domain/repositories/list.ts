/**
 * List Repository Interface
 * 
 * Extends the base repository with list-specific data access methods.
 */

import type { BaseRepository } from './base';
import type { List, ListSummary, ListApartment } from '../entities/list';

/**
 * Repository interface for list data access
 */
export interface ListRepository extends BaseRepository<List> {
  /**
   * Find all lists owned by a user
   * @param userId - The user identifier
   * @param includePrivate - Whether to include private lists
   * @returns User's lists
   */
  findByUser(userId: string, includePrivate: boolean): Promise<List[]>;

  /**
   * Find a list by its share token
   * @param shareToken - The unique share token
   * @returns The list if found and shareable
   */
  findByShareToken(shareToken: string): Promise<List | null>;

  /**
   * Get list summaries for display
   * @param userId - The user identifier
   * @returns Summary information for each list
   */
  getUserListSummaries(userId: string): Promise<ListSummary[]>;

  /**
   * Add an apartment to a list
   * @param listId - The list identifier
   * @param apartmentId - The apartment identifier
   * @param position - Optional position in the list
   * @param notes - Optional user notes
   */
  addApartment(
    listId: string, 
    apartmentId: string, 
    position?: number,
    notes?: string
  ): Promise<void>;

  /**
   * Remove an apartment from a list
   * @param listId - The list identifier
   * @param apartmentId - The apartment identifier
   */
  removeApartment(listId: string, apartmentId: string): Promise<void>;

  /**
   * Update apartment position in a list
   * @param listId - The list identifier
   * @param apartmentId - The apartment identifier
   * @param newPosition - New position
   */
  updateApartmentPosition(
    listId: string, 
    apartmentId: string, 
    newPosition: number
  ): Promise<void>;

  /**
   * Update notes for an apartment in a list
   * @param listId - The list identifier
   * @param apartmentId - The apartment identifier
   * @param notes - Updated notes
   */
  updateApartmentNotes(
    listId: string,
    apartmentId: string,
    notes: string
  ): Promise<void>;

  /**
   * Check if an apartment is in a list
   * @param listId - The list identifier
   * @param apartmentId - The apartment identifier
   * @returns True if the apartment is in the list
   */
  hasApartment(listId: string, apartmentId: string): Promise<boolean>;

  /**
   * Get apartments in a list with their metadata
   * @param listId - The list identifier
   * @returns Apartment-list relationships
   */
  getListApartments(listId: string): Promise<ListApartment[]>;

  /**
   * Reorder apartments in a list
   * @param listId - The list identifier
   * @param apartmentIds - Ordered array of apartment IDs
   */
  reorderApartments(listId: string, apartmentIds: string[]): Promise<void>;

  /**
   * Generate a unique share token
   * @returns A unique token for sharing
   */
  generateShareToken(): Promise<string>;

  /**
   * Update list view statistics
   * @param listId - The list identifier
   */
  incrementViewCount(listId: string): Promise<void>;

  /**
   * Get popular public lists
   * @param limit - Maximum number to return
   * @returns Most viewed public lists
   */
  getPopularLists(limit: number): Promise<ListSummary[]>;

  /**
   * Find lists containing a specific apartment
   * @param apartmentId - The apartment identifier
   * @param userId - Optional user filter
   * @returns Lists containing the apartment
   */
  findByApartment(apartmentId: string, userId?: string): Promise<List[]>;

  /**
   * Duplicate a list
   * @param listId - Source list identifier
   * @param newUserId - New owner's user ID
   * @param newName - Name for the duplicated list
   * @returns The new list
   */
  duplicate(listId: string, newUserId: string, newName: string): Promise<List>;
}