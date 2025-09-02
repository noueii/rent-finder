// Server-side only module
import transitGraphData from '../data/tokyo_transit_graph_complete.json';

interface Station {
  id: string;
  name: string;
  name_ja: string;
  lines: string[];
  transfers: string[];
  coordinates: [number, number];
}

interface EdgeConnection {
  line_id: string;
  line_name: string;
  train_type: string;
  travel_time: number;
}

interface TransitGraphData {
  metadata: any;
  stations: { [key: string]: Station };
  edges: { [fromStationId: string]: { [toStationId: string]: EdgeConnection[] } };
}

export interface ReachableStation {
  station_id: string;
  name: string;
  name_ja: string;
  travel_time: number;
  transfers: number;
  path: string[];
}

class TransitGraphService {
  private graph: TransitGraphData;
  private adjacencyList: Map<string, Array<{ to: string; time: number; line: string }>>;
  private static instance: TransitGraphService | null = null;

  constructor() {
    // Type assertion to ensure we have the correct structure
    this.graph = {
      metadata: transitGraphData.metadata || {},
      stations: transitGraphData.stations || {},
      edges: transitGraphData.edges || {}
    };
    
    this.adjacencyList = new Map();
    
    // Validate the data
    if (!this.graph.edges || typeof this.graph.edges !== 'object') {
      console.error('Transit graph edges not found or invalid format');
      this.graph.edges = {};
    }
    
    this.buildAdjacencyList();
  }

  static getInstance(): TransitGraphService {
    if (!TransitGraphService.instance) {
      TransitGraphService.instance = new TransitGraphService();
    }
    return TransitGraphService.instance;
  }

  private buildAdjacencyList() {
    // Build adjacency list from the nested edge structure
    for (const [fromStationId, destinations] of Object.entries(this.graph.edges)) {
      if (!this.adjacencyList.has(fromStationId)) {
        this.adjacencyList.set(fromStationId, []);
      }
      
      for (const [toStationId, connections] of Object.entries(destinations)) {
        // Get the fastest connection for each station pair
        let minTime = Infinity;
        let bestConnection: EdgeConnection | null = null;
        
        for (const conn of connections) {
          if (conn.travel_time < minTime) {
            minTime = conn.travel_time;
            bestConnection = conn;
          }
        }
        
        if (bestConnection) {
          this.adjacencyList.get(fromStationId)!.push({
            to: toStationId,
            time: bestConnection.travel_time,
            line: bestConnection.line_name
          });
        }
      }
    }
  }

  findReachableStations(startStationId: string, maxMinutes: number): ReachableStation[] {
    const visited = new Map<string, { time: number; transfers: number; path: string[]; lastLine: string }>();
    const queue: Array<{ stationId: string; time: number; transfers: number; path: string[]; lastLine: string }> = [];
    
    // Initialize with start station
    queue.push({
      stationId: startStationId,
      time: 0,
      transfers: 0,
      path: [startStationId],
      lastLine: ''
    });
    
    visited.set(startStationId, {
      time: 0,
      transfers: 0,
      path: [startStationId],
      lastLine: ''
    });

    // Dijkstra's algorithm with transfer counting
    while (queue.length > 0) {
      // Sort by time (priority queue simulation)
      queue.sort((a, b) => a.time - b.time);
      const current = queue.shift()!;

      // Skip if we've already found a better path
      const visitedInfo = visited.get(current.stationId);
      if (visitedInfo && visitedInfo.time < current.time) {
        continue;
      }

      // Explore neighbors
      const neighbors = this.adjacencyList.get(current.stationId) || [];
      for (const neighbor of neighbors) {
        const newTime = current.time + neighbor.time;
        
        // Skip if exceeds max time
        if (newTime > maxMinutes) {
          continue;
        }

        // Count transfers
        const isTransfer = current.lastLine !== '' && current.lastLine !== neighbor.line;
        const newTransfers = current.transfers + (isTransfer ? 1 : 0);
        
        // Check if we found a better path
        const existingPath = visited.get(neighbor.to);
        if (!existingPath || existingPath.time > newTime || 
            (existingPath.time === newTime && existingPath.transfers > newTransfers)) {
          
          const newPath = [...current.path, neighbor.to];
          visited.set(neighbor.to, {
            time: newTime,
            transfers: newTransfers,
            path: newPath,
            lastLine: neighbor.line
          });
          
          queue.push({
            stationId: neighbor.to,
            time: newTime,
            transfers: newTransfers,
            path: newPath,
            lastLine: neighbor.line
          });
        }
      }
    }

    // Convert results
    const results: ReachableStation[] = [];
    for (const [stationId, info] of visited.entries()) {
      if (stationId !== startStationId) {
        const station = this.graph.stations[stationId];
        if (station) {
          results.push({
            station_id: stationId,
            name: station.name,
            name_ja: station.name_ja,
            travel_time: info.time,
            transfers: info.transfers,
            path: info.path
          });
        }
      }
    }

    return results;
  }

  searchStations(query: string): Station[] {
    const results: Station[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const [id, station] of Object.entries(this.graph.stations)) {
      if (station.name.toLowerCase().includes(lowerQuery) || 
          station.name_ja.toLowerCase().includes(lowerQuery)) {
        results.push({
          id,
          ...station
        });
      }
    }
    
    return results;
  }

  getStation(stationId: string): Station | null {
    return this.graph.stations[stationId] || null;
  }
}

// Export singleton instance
export const transitGraph = TransitGraphService.getInstance();