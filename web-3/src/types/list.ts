import type { List, ApartmentList, ListType } from '@prisma/client';
import type { ApartmentWithRelations } from './apartment';

// List with apartment count
export interface ListWithMeta extends List {
  _count?: {
    apartments: number;
  };
  totalApartments?: number;
  seenCount?: number;
  apartmentsWithoutRoutes?: number;
  relatedStationId?: string;
}

// List with apartments
export interface ListWithApartments extends List {
  apartments: (ApartmentList & {
    apartment: ApartmentWithRelations;
  })[];
}

// Create list input
export interface CreateListInput {
  name: string;
  type: ListType;
  isPublic?: boolean;
  searchParams?: any;
}

// Update list input
export interface UpdateListInput {
  name?: string;
  isPublic?: boolean;
  status?: string;
  progress?: number;
}

// Add apartment to list input
export interface AddApartmentToListInput {
  listId: string;
  apartmentId: string;
}

// Remove apartment from list input
export interface RemoveApartmentFromListInput {
  listId: string;
  apartmentId: string;
}

// Mark apartment as seen input
export interface MarkApartmentSeenInput {
  listId: string;
  apartmentId: string;
}