/**
 * User Domain Entity
 * 
 * Represents a user of the apartment finder application.
 */

/**
 * User entity representing an application user
 */
export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  emailVerified?: Date;
  
  // Preferences
  preferences: UserPreferences;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  
  // Status
  isActive: boolean;
  role: UserRole;
}

/**
 * User role enumeration
 */
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
  MODERATOR = 'MODERATOR'
}

/**
 * User preferences for apartment searching
 */
export interface UserPreferences {
  // Search Defaults
  defaultStationId?: string;
  defaultMaxCommute?: number;
  defaultPriceRange?: {
    min?: number;
    max?: number;
  };
  
  // Score Weights (0-1, must sum to 1)
  scoreWeights: ScoreWeights;
  
  // Display Preferences
  language: 'en' | 'ja';
  currency: 'JPY' | 'USD';
  distanceUnit: 'km' | 'miles';
  
  // Notification Settings
  emailNotifications: boolean;
  savedSearchAlerts: boolean;
  priceDropAlerts: boolean;
}

/**
 * Weights for calculating apartment scores
 */
export interface ScoreWeights {
  /** Weight for commute time (0-1) */
  commuteTime: number;
  /** Weight for price (0-1) */
  price: number;
  /** Weight for size (0-1) */
  size: number;
  /** Weight for building age (0-1) */
  buildingAge: number;
  /** Weight for station distance (0-1) */
  stationDistance: number;
}

/**
 * User authentication credentials
 */
export interface Credentials {
  email: string;
  password: string;
}

/**
 * Authentication result
 */
export interface AuthResult {
  user: User;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

/**
 * User profile update data
 */
export interface ProfileUpdate {
  name?: string;
  image?: string;
  preferences?: Partial<UserPreferences>;
}