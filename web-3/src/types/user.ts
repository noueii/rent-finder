import type { User, UserPreference } from '@prisma/client';

// User with preferences
export interface UserWithPreferences extends User {
  preferences: UserPreference | null;
}

// Price range type
export interface PriceRange {
  min?: number;
  max?: number;
}

// Size range type
export interface SizeRange {
  min?: number;
  max?: number;
}

// Update user preferences input
export interface UpdateUserPreferencesInput {
  maxCommute?: number | null;
  preferredStations?: string[];
  priceRange?: PriceRange | null;
  sizeRange?: SizeRange | null;
  savedFilters?: any | null;
}

// User profile update input
export interface UpdateUserProfileInput {
  name?: string;
  image?: string;
}