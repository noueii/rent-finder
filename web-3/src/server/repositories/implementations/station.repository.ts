import { Prisma, PrismaClient, Station, TrainLine } from '@prisma/client';
import { PrismaBaseRepository } from '../base.repository';
import type { IStationRepository } from '../interfaces/station.repository.interface';
import type { StationWithLines, StationSearchResult } from '~/types/station';

export class StationRepository
  extends PrismaBaseRepository<
    Station,
    Prisma.StationCreateInput,
    Prisma.StationUpdateInput,
    Prisma.StationWhereInput,
    Prisma.StationOrderByWithRelationInput
  >
  implements IStationRepository {
  
  constructor(prisma: PrismaClient) {
    super(prisma, 'station');
  }

  async findById(id: string, includeLines = false): Promise<StationWithLines | Station | null> {
    if (includeLines) {
      return await this.model.findUnique({
        where: { id },
        include: {
          lines: {
            include: {
              line: true
            }
          }
        }
      }) as StationWithLines | null;
    }

    return await this.model.findUnique({
      where: { id }
    });
  }

  async findByName(name: string): Promise<Station[]> {
    return await this.model.findMany({
      where: {
        OR: [
          { name: { contains: name, mode: 'insensitive' } },
          { nameEn: { contains: name, mode: 'insensitive' } }
        ]
      }
    });
  }

  async search(query: string, limit = 10): Promise<StationSearchResult[]> {
    const normalizedQuery = this.normalizeQuery(query);
    
    // Search stations
    const stations = await this.model.findMany({
      where: {
        OR: [
          { name: { contains: normalizedQuery, mode: 'insensitive' } },
          { nameEn: { contains: normalizedQuery, mode: 'insensitive' } }
        ]
      },
      include: {
        lines: {
          include: {
            line: true
          }
        }
      },
      take: limit * 2 // Get more to score and filter
    });

    // Score results
    const scoredResults = stations.map(station => {
      let score = 0;
      
      // Exact match scores highest
      if (station.name.toLowerCase() === normalizedQuery.toLowerCase() ||
          station.nameEn?.toLowerCase() === normalizedQuery.toLowerCase()) {
        score = 100;
      }
      // Starts with query scores high
      else if (station.name.toLowerCase().startsWith(normalizedQuery.toLowerCase()) ||
               station.nameEn?.toLowerCase().startsWith(normalizedQuery.toLowerCase())) {
        score = 80;
      }
      // Contains query scores moderate
      else {
        score = 50;
      }
      
      // Bonus for stations on major lines
      const majorLines = ['山手線', 'Yamanote Line', '中央線', 'Chuo Line'];
      if (station.lines.some(sl => majorLines.includes(sl.line.name) || majorLines.includes(sl.line.nameEn || ''))) {
        score += 10;
      }
      
      return {
        station: station as StationWithLines,
        score
      };
    });

    // Sort by score and return top results
    return scoredResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async findByCoordinates(
    latitude: number,
    longitude: number,
    radiusKm = 5
  ): Promise<Station[]> {
    // Using a simplified distance calculation
    // For more accuracy, consider using PostGIS or a proper geospatial query
    const latDelta = radiusKm / 111; // Rough conversion km to degrees
    const lonDelta = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

    return await this.model.findMany({
      where: {
        latitude: {
          gte: latitude - latDelta,
          lte: latitude + latDelta
        },
        longitude: {
          gte: longitude - lonDelta,
          lte: longitude + lonDelta
        }
      }
    });
  }

  async findByLine(lineId: string): Promise<StationWithLines[]> {
    return await this.model.findMany({
      where: {
        lines: {
          some: {
            lineId
          }
        }
      },
      include: {
        lines: {
          include: {
            line: true
          }
        }
      }
    }) as StationWithLines[];
  }

  async findByLines(lineIds: string[]): Promise<StationWithLines[]> {
    return await this.model.findMany({
      where: {
        lines: {
          some: {
            lineId: { in: lineIds }
          }
        }
      },
      include: {
        lines: {
          include: {
            line: true
          }
        }
      }
    }) as StationWithLines[];
  }

  async getLines(stationId: string): Promise<TrainLine[]> {
    const stationWithLines = await this.model.findUnique({
      where: { id: stationId },
      include: {
        lines: {
          include: {
            line: true
          }
        }
      }
    });

    if (!stationWithLines) return [];

    return stationWithLines.lines.map(sl => sl.line);
  }

  async findManyByIds(stationIds: string[]): Promise<Station[]> {
    return await this.model.findMany({
      where: {
        id: { in: stationIds }
      }
    });
  }

  async createMany(data: Prisma.StationCreateManyInput[]): Promise<{ count: number }> {
    return await this.model.createMany({
      data,
      skipDuplicates: true
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.count({ id });
    return count > 0;
  }

  async findNearbyStations(
    stationId: string,
    maxDistanceKm = 2,
    limit = 10
  ): Promise<Station[]> {
    // Get the reference station
    const refStation = await this.findById(stationId);
    if (!refStation) return [];

    // Find nearby stations
    const nearbyStations = await this.findByCoordinates(
      refStation.latitude,
      refStation.longitude,
      maxDistanceKm
    );

    // Filter out the reference station and calculate distances
    const stationsWithDistance = nearbyStations
      .filter(s => s.id !== stationId)
      .map(station => ({
        station,
        distance: this.calculateDistance(
          refStation.latitude,
          refStation.longitude,
          station.latitude,
          station.longitude
        )
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return stationsWithDistance.map(s => s.station);
  }

  private normalizeQuery(query: string): string {
    // Remove common suffixes and normalize
    return query
      .replace(/駅$/i, '') // Remove "駅" suffix
      .replace(/\s*station$/i, '') // Remove "station" suffix
      .trim();
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}