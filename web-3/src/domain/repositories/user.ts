/**
 * User Repository Interface
 * 
 * Extends the base repository with user-specific data access methods.
 */

import type { BaseRepository } from './base';
import type { User, UserPreferences, ScoreWeights } from '../entities/user';

/**
 * Repository interface for user data access
 */
export interface UserRepository extends BaseRepository<User> {
  /**
   * Find a user by email address
   * @param email - The user's email
   * @returns The user if found
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Update user preferences
   * @param userId - The user identifier
   * @param preferences - Updated preferences
   * @returns The updated user
   */
  updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<User>;

  /**
   * Update user's score weights
   * @param userId - The user identifier
   * @param weights - New score weights
   * @returns The updated user
   */
  updateScoreWeights(userId: string, weights: ScoreWeights): Promise<User>;

  /**
   * Update user's last login timestamp
   * @param userId - The user identifier
   * @param timestamp - Login timestamp
   */
  updateLastLogin(userId: string, timestamp: Date): Promise<void>;

  /**
   * Find users with specific preferences
   * @param criteria - Search criteria
   * @returns Users matching the criteria
   */
  findByPreferences(criteria: {
    hasDefaultStation?: boolean;
    emailNotifications?: boolean;
    savedSearchAlerts?: boolean;
    language?: 'en' | 'ja';
  }): Promise<User[]>;

  /**
   * Get users who have saved a specific apartment
   * @param apartmentId - The apartment identifier
   * @returns Users with the apartment in their lists
   */
  findBySavedApartment(apartmentId: string): Promise<User[]>;

  /**
   * Verify user email
   * @param userId - The user identifier
   * @param verifiedAt - Verification timestamp
   */
  verifyEmail(userId: string, verifiedAt: Date): Promise<void>;

  /**
   * Deactivate a user account
   * @param userId - The user identifier
   */
  deactivate(userId: string): Promise<void>;

  /**
   * Reactivate a user account
   * @param userId - The user identifier
   */
  reactivate(userId: string): Promise<void>;

  /**
   * Get user statistics
   * @param userId - The user identifier
   * @returns User activity statistics
   */
  getStats(userId: string): Promise<{
    totalLists: number;
    totalSavedApartments: number;
    totalSearches: number;
    lastActiveAt: Date;
  }>;

  /**
   * Check if a user has a specific permission
   * @param userId - The user identifier
   * @param permission - Permission to check
   * @returns True if user has the permission
   */
  hasPermission(userId: string, permission: string): Promise<boolean>;
}