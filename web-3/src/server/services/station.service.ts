import type { PrismaClient } from "@prisma/client";
import { StationRepository } from "~/server/repositories/implementations/station.repository";
import { fuzzySearchStations } from "~/lib/fuzzy-search";

export interface IStationService {
  getAllStations(): Promise<any[]>;
  searchStations(query: string, limit: number): Promise<any[]>;
  getStationById(id: string): Promise<any | null>;
}

export class StationService implements IStationService {
  private stationRepository: StationRepository;
  
  constructor(private readonly db: PrismaClient) {
    this.stationRepository = new StationRepository(db);
  }
  
  async getAllStations() {
    return await this.stationRepository.findMany({
      include: {
        lines: {
          include: {
            line: true,
          },
        },
      },
      orderBy: {
        nameEn: "asc",
      },
    });
  }
  
  async searchStations(query: string, limit: number) {
    // For search, we'll get all stations and filter client-side
    // This is simpler and allows better fuzzy matching
    const allStations = await this.stationRepository.findMany({
      include: {
        lines: {
          include: {
            line: true,
          },
        },
      },
    });
    
    return fuzzySearchStations(allStations, query, limit);
  }
  
  async getStationById(id: string) {
    return await this.stationRepository.findById(id, {
      include: {
        lines: {
          include: {
            line: true,
          },
        },
      },
    });
  }
}