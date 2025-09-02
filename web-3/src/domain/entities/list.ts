/**
 * List Domain Entity
 * 
 * Represents a user-created list of apartments.
 */

import type { User } from './user';
import type { Apartment } from './apartment';

/**
 * List entity representing a collection of saved apartments
 */
export interface List {
  id: string;
  name: string;
  description?: string;
  
  // Ownership
  userId: string;
  user?: User;
  
  // Privacy
  isPublic: boolean;
  shareToken?: string; // For sharing private lists
  
  // Content
  apartments?: Apartment[];
  apartmentCount: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastViewedAt?: Date;
  viewCount: number;
  
  // Customization
  color?: string;
  icon?: string;
  sortOrder?: ListSortOrder;
}

/**
 * List sort order options
 */
export enum ListSortOrder {
  MANUAL = 'MANUAL', // User-defined order
  PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC',
  SIZE_ASC = 'SIZE_ASC',
  SIZE_DESC = 'SIZE_DESC',
  ADDED_ASC = 'ADDED_ASC', // Oldest first
  ADDED_DESC = 'ADDED_DESC' // Newest first
}

/**
 * List summary for display
 */
export interface ListSummary {
  id: string;
  name: string;
  description?: string;
  apartmentCount: number;
  isPublic: boolean;
  color?: string;
  icon?: string;
  updatedAt: Date;
  previewImages?: string[]; // First few apartment images
}

/**
 * Input for creating a new list
 */
export interface CreateListInput {
  name: string;
  description?: string;
  isPublic?: boolean;
  color?: string;
  icon?: string;
}

/**
 * Input for updating a list
 */
export interface UpdateListInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  color?: string;
  icon?: string;
  sortOrder?: ListSortOrder;
}

/**
 * Apartment-List relationship
 */
export interface ListApartment {
  listId: string;
  apartmentId: string;
  addedAt: Date;
  position: number; // For manual sorting
  notes?: string; // User notes about this apartment
}