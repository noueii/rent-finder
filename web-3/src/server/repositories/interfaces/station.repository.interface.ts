import type { Station, TrainLine, Prisma } from '@prisma/client';
import type { StationWithLines, StationSearchResult } from '~/types/station';

export interface IStationRepository {
  // Basic CRUD
  findById(id: string, includeLines?: boolean): Promise<StationWithLines | Station | null>;
  findByName(name: string): Promise<Station[]>;
  create(data: Prisma.StationCreateInput): Promise<Station>;
  update(id: string, data: Prisma.StationUpdateInput): Promise<Station>;
  delete(id: string): Promise<Station>;
  
  // Search operations
  search(query: string, limit?: number): Promise<StationSearchResult[]>;
  findByCoordinates(
    latitude: number,
    longitude: number,
    radiusKm?: number
  ): Promise<Station[]>;
  
  // Line operations
  findByLine(lineId: string): Promise<StationWithLines[]>;
  findByLines(lineIds: string[]): Promise<StationWithLines[]>;
  getLines(stationId: string): Promise<TrainLine[]>;
  
  // Batch operations
  findManyByIds(stationIds: string[]): Promise<Station[]>;
  createMany(data: Prisma.StationCreateManyInput[]): Promise<{ count: number }>;
  
  // Utility queries
  exists(id: string): Promise<boolean>;
  count(where?: Prisma.StationWhereInput): Promise<number>;
  
  // Nearby stations
  findNearbyStations(
    stationId: string,
    maxDistanceKm?: number,
    limit?: number
  ): Promise<Station[]>;
}