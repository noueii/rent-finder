import { spawn } from 'child_process';
import path from 'path';

export interface ReachableStation {
  station_id: string;
  name: string;
  name_ja: string;
  travel_time: number;
  transfers: number;
  coordinates?: [number, number];
  path?: any[];
}

export interface Station {
  id: string;
  name: string;
  name_ja: string;
  lines?: string[];
  coordinates?: [number, number];
}

/**
 * Service to interact with the CLI transit tool
 */
export class TransitService {
  private transitToolPath: string;

  constructor() {
    // Path to the CLI tool - handle both dev and production paths
    // In development, we're running from /web directory
    // The lines directory is at the same level as web
    const baseDir = process.cwd().endsWith('/web') 
      ? path.resolve(process.cwd(), '..') 
      : process.cwd();
    this.transitToolPath = path.join(baseDir, 'lines');
    console.log('Transit tool path:', this.transitToolPath);
  }

  /**
   * Find all stations reachable within maxMinutes from startStationId
   */
  async findReachableStations(startStationId: string, maxMinutes: number): Promise<ReachableStation[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.transitToolPath, 'query_reachability.js');
      
      // Run the CLI tool programmatically
      const child = spawn('node', [scriptPath], {
        cwd: this.transitToolPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Transit tool failed: ${errorOutput}`));
          return;
        }

        try {
          // Parse the JSON output from the CLI tool
          const lines = output.split('\n');
          const jsonLine = lines.find(line => line.startsWith('[') || line.startsWith('{'));
          
          if (!jsonLine) {
            resolve([]);
            return;
          }

          const results = JSON.parse(jsonLine) as ReachableStation[];
          resolve(results);
        } catch (error) {
          reject(new Error(`Failed to parse transit results: ${error}`));
        }
      });

      // Send commands to the CLI tool
      child.stdin.write(`from ${startStationId}\n`);
      child.stdin.write(`time ${maxMinutes}\n`);
      child.stdin.write('exit\n');
      child.stdin.end();
    });
  }

  /**
   * Search for stations by name
   */
  async searchStations(query: string): Promise<Station[]> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(this.transitToolPath, 'query_reachability.js');
      
      const child = spawn('node', [scriptPath], {
        cwd: this.transitToolPath,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Station search failed: ${errorOutput}`));
          return;
        }

        try {
          // Parse the output to extract station search results
          const lines = output.split('\n');
          const stations: Station[] = [];
          
          let inResults = false;
          for (const line of lines) {
            if (line.includes('Found') && line.includes('station(s):')) {
              inResults = true;
              continue;
            }
            
            if (inResults && line.trim().startsWith('  ')) {
              // Parse station line: "  tokyo_central: Tokyo (東京) - 5 line(s)"
              const match = line.match(/^\s+(.+?):\s+(.+?)\s+\((.+?)\)\s+-/);
              if (match) {
                stations.push({
                  id: match[1],
                  name: match[2],
                  name_ja: match[3]
                });
              }
            }
            
            if (inResults && line.trim() === '') {
              break;
            }
          }
          
          resolve(stations);
        } catch (error) {
          reject(new Error(`Failed to parse station search: ${error}`));
        }
      });

      // Send search command
      child.stdin.write(`search ${query}\n`);
      child.stdin.write('exit\n');
      child.stdin.end();
    });
  }

  /**
   * Use a simpler approach - load the graph data directly
   */
  async findReachableStationsSync(startStationId: string, maxMinutes: number): Promise<ReachableStation[]> {
    // Import the transit graph service
    const { transitGraph } = await import('./transitGraph');
    return transitGraph.findReachableStations(startStationId, maxMinutes);
  }

  /**
   * Search stations synchronously
   */
  async searchStationsSync(query: string): Promise<Station[]> {
    // Import the transit graph service
    const { transitGraph } = await import('./transitGraph');
    return transitGraph.searchStations(query);
  }
}

export const transitService = new TransitService();