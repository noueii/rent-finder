import type { List, ApartmentList, ListType, Prisma } from '@prisma/client';
import type {
  ListWithMeta,
  ListWithApartments,
  CreateListInput,
  UpdateListInput
} from '~/types/list';

export interface IListRepository {
  // Basic CRUD
  findById(id: string, includeApartments?: boolean): Promise<ListWithApartments | ListWithMeta | null>;
  findByUserId(userId: string): Promise<ListWithMeta[]>;
  create(userId: string, data: CreateListInput): Promise<List>;
  update(id: string, data: UpdateListInput): Promise<List>;
  delete(id: string): Promise<List>;
  
  // List queries
  findByType(userId: string, type: ListType): Promise<ListWithMeta[]>;
  findPublicLists(args?: {
    take?: number;
    skip?: number;
    orderBy?: Prisma.ListOrderByWithRelationInput;
  }): Promise<ListWithMeta[]>;
  
  // Apartment management
  addApartment(listId: string, apartmentId: string): Promise<ApartmentList>;
  removeApartment(listId: string, apartmentId: string): Promise<ApartmentList>;
  hasApartment(listId: string, apartmentId: string): Promise<boolean>;
  getApartmentIds(listId: string): Promise<string[]>;
  
  // Bulk operations
  addApartments(listId: string, apartmentIds: string[]): Promise<{ count: number }>;
  removeApartments(listId: string, apartmentIds: string[]): Promise<{ count: number }>;
  clearApartments(listId: string): Promise<{ count: number }>;
  
  // Seen tracking
  markApartmentAsSeen(listId: string, apartmentId: string): Promise<ApartmentList>;
  getSeenApartmentIds(listId: string): Promise<string[]>;
  getUnseenCount(listId: string): Promise<number>;
  
  // List statistics
  getApartmentCount(listId: string): Promise<number>;
  updateProgress(listId: string, progress: number): Promise<List>;
  updateStatus(listId: string, status: string): Promise<List>;
}