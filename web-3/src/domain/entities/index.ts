/**
 * Domain Entities
 * 
 * Central export point for all domain entities.
 * These are pure domain objects with no persistence concerns.
 */

// Core entities
export * from './apartment';
export * from './user';
export * from './list';
export * from './station';

// Re-export main interfaces for convenience
export type { Apartment, ApartmentDetails, ApartmentSummary } from './apartment';
export type { User, UserPreferences, ScoreWeights } from './user';
export type { List, ListSummary, ListApartment } from './list';
export type { Station, StationWithDistance } from './station';