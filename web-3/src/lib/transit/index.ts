import { promises as fs } from 'fs';
import path from 'path';

export interface TransitStation {
  id: string;
  name: string;
  name_ja: string;
  lines: string[];
  coordinates: {
    lat: number;
    lon: number;
  } | [number, number]; // Support both object format and array format [lon, lat]
}

export interface TransitGraph {
  stations: Record<string, TransitStation>;
  edges: Record<string, Record<string, Array<{
    line_id: string;
    line_name: string;
    train_type: string;
    travel_time: number;
  }>>>;
  metadata: {
    total_stations: number;
    total_edges: number;
    lines: string[];
  };
}

export interface ReachableStation {
  station_id: string;
  name: string;
  name_ja: string;
  travel_time: number;
  coordinates: {
    lat: number;
    lon: number;
  };
  transfers: number;
  path: Array<{
    from: string;
    to: string;
    line: string;
    line_id: string;
    train_type: string;
    time: number;
    transfer: boolean;
  }>;
}

const TRANSFER_PENALTY = 5; // minutes penalty for transfers

export class TransitService {
  private graph: TransitGraph | null = null;
  private graphPath: string;

  constructor() {
    // Path to the transit graph data
    this.graphPath = path.join(process.cwd(), '..', 'lines', 'tokyo_transit_graph_complete.json');
  }

  /**
   * Load the transit graph data
   */
  async loadGraph(): Promise<void> {
    if (this.graph) return; // Already loaded

    try {
      const data = await fs.readFile(this.graphPath, 'utf-8');
      this.graph = JSON.parse(data);
      console.log(`Transit graph loaded: ${this.graph!.metadata.total_stations} stations`);
    } catch (error) {
      console.error('Failed to load transit graph:', error);
      throw new Error('Transit graph data not available');
    }
  }

  /**
   * Find stations by name
   */
  findStation(query: string): Array<TransitStation & { id: string }> {
    if (!this.graph) throw new Error('Graph not loaded');

    const results: Array<TransitStation & { id: string }> = [];
    const lowerQuery = query.toLowerCase();

    Object.entries(this.graph.stations).forEach(([id, station]) => {
      if (
        station.name.toLowerCase().includes(lowerQuery) ||
        (station.name_ja && station.name_ja.includes(query))
      ) {
        results.push({ id, ...station });
      }
    });

    return results;
  }

  /**
   * Find all stations reachable within a given time limit
   */
  findReachableStations(startStationId: string, maxMinutes: number): ReachableStation[] {
    if (!this.graph) throw new Error('Graph not loaded');
    if (!this.graph.stations[startStationId]) {
      throw new Error(`Station ${startStationId} not found`);
    }

    const bestPaths: Record<string, {
      distance: number;
      path: ReachableStation['path'];
      transfers: number;
    }> = {};
    
    const visited = new Set<string>();
    const queue: Array<{
      station: string;
      distance: number;
      currentLine: string | null;
      currentTrainType: string | null;
      path: ReachableStation['path'];
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
      const edges = this.graph.edges[current.station] || {};

      Object.entries(edges).forEach(([toStation, connections]) => {
        connections.forEach(conn => {
          // Calculate travel time with transfer penalty
          let travelTime = conn.travel_time;
          const changingTrain = current.currentLine && (
            current.currentLine !== conn.line_id ||
            current.currentTrainType !== conn.train_type
          );

          if (changingTrain) {
            travelTime += TRANSFER_PENALTY;
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
                transfer: changingTrain
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
    const results: ReachableStation[] = [];
    Object.entries(bestPaths).forEach(([stationId, pathInfo]) => {
      const station = this.graph!.stations[stationId];
      if (station && pathInfo.distance > 0) {
        results.push({
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

    return results.sort((a, b) => {
      if (a.travel_time === b.travel_time) {
        return a.transfers - b.transfers;
      }
      return a.travel_time - b.travel_time;
    });
  }

  /**
   * Get station by ID
   */
  getStation(stationId: string): (TransitStation & { id: string }) | null {
    if (!this.graph) throw new Error('Graph not loaded');
    const station = this.graph.stations[stationId];
    return station ? { id: stationId, ...station } : null;
  }

  /**
   * Get all stations
   */
  getAllStations(): Array<TransitStation & { id: string }> {
    if (!this.graph) throw new Error('Graph not loaded');
    return Object.entries(this.graph.stations).map(([id, station]) => ({
      id,
      ...station
    }));
  }
}

// Singleton instance
let transitServiceInstance: TransitService | null = null;

export async function getTransitService(): Promise<TransitService> {
  if (!transitServiceInstance) {
    transitServiceInstance = new TransitService();
    await transitServiceInstance.loadGraph();
  }
  return transitServiceInstance;
}

// Re-export OTP service for convenience
export { getOTPService, type OTPRoute } from './otp-service';

// Export simplified OTP service
export { getSimplifiedOTPService, SimplifiedOTPService } from './simplified-otp-service';
export type { OTPRoute as SimplifiedOTPRoute } from './simplified-otp-service';