import { readFile } from 'fs/promises';
import path from 'path';
import { cacheService, cacheKeys, cacheTTL, cacheUtils } from '../lib/cache';

// TypeScript interfaces for the transit system
export interface Station {
  id: string;
  name: string;
  name_ja: string;
  lines: string[];
  coordinates?: [number, number];
}

export interface ReachableStation {
  station_id: string;
  name: string;
  name_ja: string;
  travel_time: number;
  coordinates?: [number, number];
  transfers: number;
  path: PathSegment[];
}

export interface PathSegment {
  from: string;
  to: string;
  line: string;
  line_id: string;
  train_type: string;
  time: number;
  transfer: boolean;
}

export interface TransitGraph {
  stations: { [id: string]: Station };
  edges: { [fromId: string]: { [toId: string]: Connection[] } };
  metadata: {
    total_stations: number;
    total_edges: number;
    generated_at: string;
  };
}

export interface Connection {
  line_id: string;
  line_name: string;
  train_type: string;
  travel_time: number;
}

export class TransitService {
  private graph: TransitGraph | null = null;
  private readonly TRANSFER_PENALTY = 5;

  constructor() {}

  /**
   * Initialize the transit service by loading the graph
   */
  async initialize(): Promise<void> {
    if (this.graph) return; // Already initialized

    try {
      // Try to get from cache first
      const cachedGraph = await cacheService.get<TransitGraph>(cacheKeys.transitGraph());
      if (cachedGraph) {
        this.graph = cachedGraph;
        console.log('Transit graph loaded from cache');
        return;
      }

      // Load from file if not in cache
      const graphPath = path.join(
        process.cwd(),
        '..',
        'lines',
        'tokyo_transit_graph_complete.json'
      );
      
      const graphData = await readFile(graphPath, 'utf-8');
      this.graph = JSON.parse(graphData);
      
      // Cache the graph for future use
      await cacheService.set(cacheKeys.transitGraph(), this.graph, cacheTTL.daily);
      
      console.log(
        `Transit graph loaded from file: ${Object.keys(this.graph!.stations).length} stations, ${this.graph!.metadata.total_edges} edges`
      );
    } catch (error) {
      console.error('Failed to load transit graph:', error);
      throw new Error('Transit service initialization failed');
    }
  }

  /**
   * Search for stations by name (fuzzy search)
   */
  async findStations(query: string): Promise<Station[]> {
    await this.initialize();
    
    if (!query || query.length < 2) return [];

    const results: Station[] = [];
    const lowerQuery = query.toLowerCase();

    Object.entries(this.graph!.stations).forEach(([stationId, station]) => {
      if (
        station.name.toLowerCase().includes(lowerQuery) ||
        (station.name_ja && station.name_ja.includes(query))
      ) {
        results.push({ id: stationId, ...station });
      }
    });

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Get station by ID
   */
  async getStationById(stationId: string): Promise<Station | null> {
    await this.initialize();
    
    const station = this.graph!.stations[stationId];
    if (!station) return null;

    return { id: stationId, ...station };
  }

  /**
   * Find all stations reachable within the specified time
   */
  async findReachableStations(
    startStationId: string,
    maxMinutes: number
  ): Promise<ReachableStation[]> {
    await this.initialize();

    if (!this.graph!.stations[startStationId]) {
      throw new Error(`Station ${startStationId} not found`);
    }

    // Check cache first
    const cacheKey = cacheKeys.reachableStations(startStationId, maxMinutes);
    const cached = await cacheService.get<ReachableStation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const bestPaths: { [stationId: string]: {
      distance: number;
      path: PathSegment[];
      transfers: number;
    } } = {};
    
    const visited = new Set<string>();
    const queue: Array<{
      station: string;
      distance: number;
      currentLine: string | null;
      currentTrainType: string | null;
      path: PathSegment[];
    }> = [];

    // Initialize with start station
    queue.push({
      station: startStationId,
      distance: 0,
      currentLine: null,
      currentTrainType: null,
      path: []
    });

    while (queue.length > 0) {
      // Sort by distance (priority queue)
      queue.sort((a, b) => a.distance - b.distance);
      const current = queue.shift()!;

      // Create unique state key
      const stateKey = `${current.station}-${current.currentLine || 'start'}-${current.currentTrainType || 'start'}`;
      if (visited.has(stateKey)) continue;
      visited.add(stateKey);

      // Get edges from current station
      const edges = this.graph!.edges[current.station] || {};

      Object.entries(edges).forEach(([toStation, connections]) => {
        connections.forEach(conn => {
          // Calculate travel time with transfer penalty
          let travelTime = conn.travel_time;
          const changingTrain = current.currentLine && (
            current.currentLine !== conn.line_id ||
            current.currentTrainType !== conn.train_type
          );

          if (changingTrain) {
            travelTime += this.TRANSFER_PENALTY;
          }

          const newDistance = current.distance + travelTime;

          // Only process if within time limit
          if (newDistance <= maxMinutes) {
            // Check if this is a better path to the destination
            const currentBest = bestPaths[toStation];
            if (!currentBest || newDistance < currentBest.distance) {
              // Create new path segment
              const newPath = [...current.path, {
                from: current.station,
                to: toStation,
                line: conn.line_name,
                line_id: conn.line_id,
                train_type: conn.train_type,
                time: conn.travel_time,
                transfer: Boolean(changingTrain)
              }];

              // Update best path
              bestPaths[toStation] = {
                distance: newDistance,
                path: newPath,
                transfers: newPath.filter(seg => seg.transfer).length
              };

              // Add to queue for further exploration
              queue.push({
                station: toStation,
                distance: newDistance,
                currentLine: conn.line_id,
                currentTrainType: conn.train_type,
                path: newPath
              });
            }
          }
        });
      });
    }

    // Build results from best paths
    const reachableStations: ReachableStation[] = [];
    Object.entries(bestPaths).forEach(([stationId, pathInfo]) => {
      const station = this.graph!.stations[stationId];
      if (station && pathInfo.distance > 0) {
        reachableStations.push({
          station_id: stationId,
          name: station.name,
          name_ja: station.name_ja,
          travel_time: pathInfo.distance,
          coordinates: station.coordinates,
          transfers: pathInfo.transfers,
          path: pathInfo.path
        });
      }
    });

    const results = reachableStations.sort((a, b) => {
      if (a.travel_time === b.travel_time) {
        return a.transfers - b.transfers;
      }
      return a.travel_time - b.travel_time;
    });

    // Cache the results
    await cacheService.set(cacheKey, results, cacheTTL.long);
    
    return results;
  }

  /**
   * Get popular stations (stations with most apartments)
   */
  async getPopularStations(limit: number = 10): Promise<Station[]> {
    await this.initialize();
    
    // For now, return a sample of major stations
    // In a real implementation, this would query the database for stations with most apartments
    const majorStations = [
      '00006668', // Tokyo
      '00004464', // Kanda
      '00002296', // Ochanomizu
      '00006664', // Shinjuku
      '00006667', // Shibuya
      '00006655', // Ikebukuro
      '00006658', // Ueno
      '00006665', // Akihabara
      '00006669', // Ginza
      '00006666', // Roppongi
    ];

    const results: Station[] = [];
    for (const stationId of majorStations.slice(0, limit)) {
      const station = this.graph!.stations[stationId];
      if (station) {
        results.push({ id: stationId, ...station });
      }
    }

    return results;
  }

  /**
   * Calculate travel time between two stations
   */
  async calculateTravelTime(
    fromStationId: string,
    toStationId: string
  ): Promise<{
    travel_time: number;
    transfers: number;
    path: PathSegment[];
  } | null> {
    const reachableStations = await this.findReachableStations(fromStationId, 120);
    const destination = reachableStations.find(s => s.station_id === toStationId);
    
    if (!destination) return null;

    return {
      travel_time: destination.travel_time,
      transfers: destination.transfers,
      path: destination.path
    };
  }

  /**
   * Get all stations (paginated)
   */
  async getAllStations(
    offset: number = 0,
    limit: number = 50
  ): Promise<{ stations: Station[]; total: number }> {
    await this.initialize();
    
    const allStations = Object.entries(this.graph!.stations).map(([stationId, station]) => ({
      id: stationId,
      ...station
    }));

    const total = allStations.length;
    const stations = allStations.slice(offset, offset + limit);

    return { stations, total };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: string; stationCount: number }> {
    try {
      await this.initialize();
      return {
        status: 'healthy',
        stationCount: Object.keys(this.graph!.stations).length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        stationCount: 0
      };
    }
  }
}

// Export singleton instance
export const transitService = new TransitService();