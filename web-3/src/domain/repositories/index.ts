/**
 * Domain Repository Interfaces
 * 
 * This module exports all repository interfaces that define
 * the contract for data access in the domain layer.
 */

// Base repository and types
export * from './base';
export * from '../types/repository';

// Entity repositories
export * from './apartment';
export * from './user';
export * from './list';
export * from './station';

// Re-export for convenience
export type { BaseRepository } from './base';
export type { ApartmentRepository } from './apartment';
export type { UserRepository } from './user';
export type { ListRepository } from './list';
export type { StationRepository } from './station';