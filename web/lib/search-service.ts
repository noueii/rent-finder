import { db } from './db';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface SearchFilters {
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  layouts?: string[];
  features?: string[];
  maxWalkingMinutes?: number;
}

export interface SearchResult {
  apartment: {
    id: string;
    title: string;
    rentMonthly: number;
    size: number;
    layout: string;
    address: string;
    walkingMinutes: number;
    features: string[];
    imageUrls: string[];
    sourceUrl: string;
    station: {
      id: string;
      name: string;
      nameJa: string;
    };
  };
  commute: {
    totalMinutes: number;
    transferCount: number;
    route?: string;
  };
}

export class SearchService {
  /**
   * Main search function that combines transit and apartment data
   */
  async searchByCommute(
    targetStationId: string,
    maxCommuteMinutes: number,
    filters: SearchFilters = {},
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    results: SearchResult[];
    total: number;
    stationsSearched: number;
    searchDurationMs: number;
  }> {
    const startTime = Date.now();

    try {
      // Step 1: Find all stations within commute range using the existing transit tool
      const reachableStations = await this.findReachableStations(
        targetStationId,
        maxCommuteMinutes
      );

      const stationIds = reachableStations.map(s => s.stationId);
      const stationsSearched = stationIds.length;

      if (stationIds.length === 0) {
        return {
          results: [],
          total: 0,
          stationsSearched: 0,
          searchDurationMs: Date.now() - startTime
        };
      }

      // Step 2: Search apartments near those stations
      const apartmentSearch = await this.searchApartments(
        stationIds,
        filters,
        limit,
        offset
      );

      // Step 3: Combine apartment data with commute information
      const results: SearchResult[] = apartmentSearch.apartments.map(apartment => {
        const stationCommute = reachableStations.find(
          s => s.stationId === apartment.stationId
        );

        return {
          apartment: {
            id: apartment.id,
            title: apartment.title,
            rentMonthly: apartment.rentMonthly,
            size: apartment.size,
            layout: apartment.layout,
            address: apartment.address,
            walkingMinutes: apartment.walkingMinutes,
            features: apartment.features ? JSON.parse(apartment.features) : [],
            imageUrls: apartment.imageUrls ? JSON.parse(apartment.imageUrls) : [],
            sourceUrl: apartment.sourceUrl,
            station: apartment.station
          },
          commute: {
            totalMinutes: (stationCommute?.commuteMinutes || 0) + apartment.walkingMinutes,
            transferCount: stationCommute?.transferCount || 0,
            route: stationCommute?.route
          }
        };
      });

      // Step 4: Sort by total commute time (including walking)
      results.sort((a, b) => a.commute.totalMinutes - b.commute.totalMinutes);

      const searchDurationMs = Date.now() - startTime;

      // Step 5: Record search for analytics
      await this.recordSearch(
        targetStationId,
        maxCommuteMinutes,
        filters,
        stationsSearched,
        apartmentSearch.total,
        results.length,
        searchDurationMs
      );

      return {
        results,
        total: apartmentSearch.total,
        stationsSearched,
        searchDurationMs
      };

    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Search failed');
    }
  }

  /**
   * Find all stations reachable within the specified time using the existing transit tool
   */
  private async findReachableStations(
    targetStationId: string,
    maxMinutes: number
  ): Promise<Array<{
    stationId: string;
    commuteMinutes: number;
    transferCount: number;
    route?: string;
  }>> {
    try {
      // Call the existing transit query tool
      const transitToolPath = path.join(__dirname, '..', 'lines', 'query_reachability.js');
      const command = `cd ${path.dirname(transitToolPath)} && node query_reachability.js ${targetStationId} ${maxMinutes}`;
      
      const { stdout } = await execAsync(command);
      
      // Parse the output (this would need to be adapted based on the actual output format)
      // For now, we'll return a mock structure
      const lines = stdout.trim().split('\n');
      const results: Array<{
        stationId: string;
        commuteMinutes: number;
        transferCount: number;
        route?: string;
      }> = [];

      for (const line of lines) {
        if (line.includes('→')) {
          // Parse the line format from the existing tool
          // This is a simplified parser - would need to match the actual output format
          const match = line.match(/(\w+)\s+.*?(\d+)\s*min.*?(\d+)\s*transfer/);
          if (match) {
            results.push({
              stationId: match[1],
              commuteMinutes: parseInt(match[2]),
              transferCount: parseInt(match[3]),
              route: line
            });
          }
        }
      }

      return results;

    } catch (error) {
      console.error('Transit query error:', error);
      // Fallback: return just the target station
      return [{
        stationId: targetStationId,
        commuteMinutes: 0,
        transferCount: 0
      }];
    }
  }

  /**
   * Search apartments by station IDs with filters
   */
  private async searchApartments(
    stationIds: string[],
    filters: SearchFilters,
    limit: number,
    offset: number
  ) {
    const where: any = {
      stationId: { in: stationIds },
      isAvailable: true
    };

    // Apply filters
    if (filters.maxPrice) {
      where.rentMonthly = { lte: filters.maxPrice };
    }

    if (filters.minSize) {
      where.size = { ...where.size, gte: filters.minSize };
    }

    if (filters.maxSize) {
      where.size = { ...where.size, lte: filters.maxSize };
    }

    if (filters.layouts?.length) {
      where.layout = { in: filters.layouts };
    }

    if (filters.features?.length) {
      where.features = { hasSome: filters.features };
    }

    if (filters.maxWalkingMinutes) {
      where.walkingMinutes = { lte: filters.maxWalkingMinutes };
    }

    const [apartments, total] = await Promise.all([
      db.apartment.findMany({
        where,
        include: {
          station: {
            select: { id: true, name: true, nameJa: true }
          }
        },
        orderBy: { rentMonthly: 'asc' },
        skip: offset,
        take: limit
      }),
      db.apartment.count({ where })
    ]);

    return { apartments, total };
  }

  /**
   * Record search for analytics
   */
  private async recordSearch(
    targetStationId: string,
    maxCommuteMinutes: number,
    filters: SearchFilters,
    stationsSearched: number,
    totalResults: number,
    resultsReturned: number,
    searchDurationMs: number
  ) {
    try {
      // Get target station name
      const targetStation = await db.station.findUnique({
        where: { id: targetStationId },
        select: { name: true }
      });

      await db.search.create({
        data: {
          targetStationId,
          targetStationName: targetStation?.name || 'Unknown',
          maxCommuteMinutes,
          filters: JSON.stringify(filters),
          stationsSearched,
          totalResults,
          resultsReturned,
          searchDurationMs
        }
      });
    } catch (error) {
      console.error('Failed to record search:', error);
      // Don't throw - analytics failure shouldn't break search
    }
  }

  /**
   * Get search suggestions based on station names
   */
  async getStationSuggestions(query: string, limit: number = 10) {
    if (!query || query.length < 2) return [];

    return await db.station.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { nameJa: { contains: query } }
        ]
      },
      select: {
        id: true,
        name: true,
        nameJa: true,
        _count: { select: { apartments: true } }
      },
      orderBy: { name: 'asc' },
      take: limit
    });
  }

  /**
   * Get popular search stations
   */
  async getPopularStations(limit: number = 10) {
    const searches = await db.search.groupBy({
      by: ['targetStationId', 'targetStationName'],
      _count: { targetStationId: true },
      orderBy: { _count: { targetStationId: 'desc' } },
      take: limit
    });

    return searches.map(s => ({
      stationId: s.targetStationId,
      name: s.targetStationName,
      searchCount: s._count.targetStationId
    }));
  }

  /**
   * Get apartment by ID with commute information
   */
  async getApartmentById(
    apartmentId: string,
    fromStationId?: string
  ): Promise<SearchResult | null> {
    const apartment = await db.apartment.findUnique({
      where: { id: apartmentId },
      include: {
        station: {
          select: { id: true, name: true, nameJa: true }
        }
      }
    });

    if (!apartment) return null;

    let commute = {
      totalMinutes: apartment.walkingMinutes,
      transferCount: 0
    };

    // If origin station is provided, calculate commute
    if (fromStationId && fromStationId !== apartment.stationId) {
      const reachableStations = await this.findReachableStations(fromStationId, 120);
      const stationCommute = reachableStations.find(s => s.stationId === apartment.stationId);
      
      if (stationCommute) {
        commute = {
          totalMinutes: stationCommute.commuteMinutes + apartment.walkingMinutes,
          transferCount: stationCommute.transferCount
        };
      }
    }

    return {
      apartment: {
        id: apartment.id,
        title: apartment.title,
        rentMonthly: apartment.rentMonthly,
        size: apartment.size,
        layout: apartment.layout,
        address: apartment.address,
        walkingMinutes: apartment.walkingMinutes,
        features: apartment.features ? JSON.parse(apartment.features) : [],
        imageUrls: apartment.imageUrls ? JSON.parse(apartment.imageUrls) : [],
        sourceUrl: apartment.sourceUrl,
        station: apartment.station
      },
      commute
    };
  }
}