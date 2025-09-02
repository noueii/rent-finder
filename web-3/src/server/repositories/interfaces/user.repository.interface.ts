import type { User, UserPreference, Prisma } from '@prisma/client';
import type { UserWithPreferences, UpdateUserPreferencesInput, UpdateUserProfileInput } from '~/types/user';

export interface IUserRepository {
  // Basic CRUD
  findById(id: string, includePreferences?: boolean): Promise<UserWithPreferences | null>;
  findByEmail(email: string, includePreferences?: boolean): Promise<UserWithPreferences | null>;
  create(data: Prisma.UserCreateInput): Promise<User>;
  update(id: string, data: UpdateUserProfileInput): Promise<User>;
  delete(id: string): Promise<User>;
  
  // Preference management
  getPreferences(userId: string): Promise<UserPreference | null>;
  createPreferences(userId: string, data: UpdateUserPreferencesInput): Promise<UserPreference>;
  updatePreferences(userId: string, data: UpdateUserPreferencesInput): Promise<UserPreference>;
  deletePreferences(userId: string): Promise<UserPreference>;
  
  // User queries
  findMany(args?: {
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<User[]>;
  count(where?: Prisma.UserWhereInput): Promise<number>;
  
  // Auth-related
  updateLastLogin(id: string): Promise<User>;
  verifyEmail(id: string): Promise<User>;
  updatePassword(id: string, hashedPassword: string): Promise<User>;
}