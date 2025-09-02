import { getTransitService, type ReachableStation, type TransitStation } from './index';

/**
 * OTP Route Response Type
 */
export interface OTPRoute {
  duration: number; // Total duration in seconds
  walkTime: number; // Total walking time in seconds
  transitTime: number; // Total time on transit in seconds
  waitingTime: number; // Total waiting time in seconds
  transfers: number;
  legs: Array<{
    mode: 'WALK' | 'TRANSIT';
    from: {
      name: string;
      lat: number;
      lon: number;
    };
    to: {
      name: string;
      lat: number;
      lon: number;
    };
    duration: number; // Leg duration in seconds
    distance?: number; // Distance in meters (for walking)
    route?: {
      id: string;
      shortName: string;
      longName: string;
      type: string;
    };
  }>;
}

/**
 * Simplified OTP Service
 * 
 * This service provides transit routing with optional OTP integration.
 * It always falls back to the local transit graph when OTP is unavailable.
 * 
 * Key simplifications:
 * - Removed complex caching (let the client cache if needed)
 * - Removed health checks (just try OTP and fallback)
 * - Simplified coordinate handling
 * - Cleaner error handling
 */
export class SimplifiedOTPService {
  private otpEndpoint: string;
  private transitService: ReturnType<typeof getTransitService> | null = null;
  private otpAvailable: boolean | null = null;

  constructor(otpEndpoint?: string) {
    this.otpEndpoint = otpEndpoint || process.env.OTP_ENDPOINT || '';
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Always initialize transit service as fallback
    this.transitService = await getTransitService();
    
    // Check OTP availability if endpoint is configured
    if (this.otpEndpoint) {
      try {
        const response = await fetch(`${this.otpEndpoint}/index/routes`, {
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        this.otpAvailable = response.ok;
      } catch {
        this.otpAvailable = false;
      }
    } else {
      this.otpAvailable = false;
    }
  }

  /**
   * Calculate commute time between two coordinates
   * Returns time in minutes, or null if no route found
   */
  async calculateCommute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number = 120
  ): Promise<number | null> {
    const route = await this.getRoute(fromLat, fromLon, toLat, toLon, maxMinutes);
    return route ? Math.ceil(route.duration / 60) : null;
  }

  /**
   * Get detailed route between two coordinates
   */
  async getRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number = 120
  ): Promise<OTPRoute | null> {
    // Try OTP first if available
    if (this.otpAvailable && this.otpEndpoint) {
      try {
        const route = await this.getOTPRoute(fromLat, fromLon, toLat, toLon, maxMinutes);
        if (route) return route;
      } catch (error) {
        console.warn('OTP request failed, using fallback:', error);
      }
    }

    // Fallback to transit graph
    return this.getTransitGraphRoute(fromLat, fromLon, toLat, toLon, maxMinutes);
  }

  /**
   * Get route from OTP
   */
  private async getOTPRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number
  ): Promise<OTPRoute | null> {
    const params = new URLSearchParams({
      fromPlace: `${fromLat},${fromLon}`,
      toPlace: `${toLat},${toLon}`,
      mode: 'TRANSIT,WALK',
      maxWalkDistance: '1000',
      numItineraries: '3',
      locale: 'ja'
    });

    const response = await fetch(`${this.otpEndpoint}/plan?${params}`, {
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`OTP request failed: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle OTP errors
    if (data.error) {
      // Special case: TOO_CLOSE error with walking itinerary is valid
      if (data.error.id === 409 && data.plan?.itineraries?.length > 0) {
        // Continue processing
      } else {
        return null;
      }
    }

    if (!data.plan?.itineraries?.length) {
      return null;
    }

    // Find the fastest itinerary within time limit
    const validItineraries = data.plan.itineraries.filter(
      (it: any) => it.duration <= maxMinutes * 60
    );

    if (validItineraries.length === 0) {
      return null;
    }

    // Select fastest route
    const fastest = validItineraries.reduce((best: any, current: any) => 
      current.duration < best.duration ? current : best
    );

    return {
      duration: fastest.duration,
      walkTime: fastest.walkTime || 0,
      transitTime: fastest.transitTime || 0,
      waitingTime: fastest.waitingTime || 0,
      transfers: fastest.transfers || 0,
      legs: fastest.legs.map((leg: any) => ({
        mode: leg.mode,
        from: {
          name: leg.from.name,
          lat: leg.from.lat,
          lon: leg.from.lon
        },
        to: {
          name: leg.to.name,
          lat: leg.to.lat,
          lon: leg.to.lon
        },
        duration: leg.duration,
        distance: leg.distance,
        route: leg.route ? {
          id: leg.route.id,
          shortName: leg.route.shortName || '',
          longName: leg.route.longName || '',
          type: leg.route.type || ''
        } : undefined
      }))
    };
  }

  /**
   * Get route using transit graph fallback
   */
  private async getTransitGraphRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number
  ): Promise<OTPRoute | null> {
    if (!this.transitService) {
      return null;
    }

    // Find nearest stations
    const fromStation = this.findNearestStation(fromLat, fromLon);
    const toStation = this.findNearestStation(toLat, toLon);

    if (!fromStation || !toStation || fromStation.id === toStation.id) {
      return null;
    }

    // Find reachable stations from origin
    const reachableStations = this.transitService.findReachableStations(
      fromStation.id,
      maxMinutes
    );

    // Check if destination is reachable
    const destination = reachableStations.find(s => s.station_id === toStation.id);
    if (!destination) {
      return null;
    }

    // Convert to OTP route format
    return this.convertToOTPRoute(destination, fromStation, toStation);
  }

  /**
   * Find nearest station to coordinates
   */
  private findNearestStation(lat: number, lon: number): TransitStation & { id: string } | null {
    if (!this.transitService) return null;

    const stations = this.transitService.getAllStations();
    let nearest: (TransitStation & { id: string }) | null = null;
    let minDistance = Infinity;

    for (const station of stations) {
      const coords = this.getStationCoordinates(station);
      if (!coords) continue;

      const distance = this.calculateDistance(lat, lon, coords.lat, coords.lon);
      if (distance < minDistance && distance <= 1000) { // Max 1km walking
        minDistance = distance;
        nearest = station;
      }
    }

    return nearest;
  }

  /**
   * Get station coordinates in a consistent format
   */
  private getStationCoordinates(station: TransitStation): { lat: number; lon: number } | null {
    if (!station.coordinates) return null;

    if (Array.isArray(station.coordinates) && station.coordinates.length === 2) {
      return { lat: station.coordinates[1], lon: station.coordinates[0] };
    }

    if (typeof station.coordinates === 'object' && 'lat' in station.coordinates && 'lon' in station.coordinates) {
      return station.coordinates;
    }

    return null;
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Convert transit graph route to OTP format
   */
  private convertToOTPRoute(
    reachableStation: ReachableStation,
    fromStation: TransitStation & { id: string },
    toStation: TransitStation & { id: string }
  ): OTPRoute {
    const legs: OTPRoute['legs'] = [];
    
    // Add initial walking leg if needed
    const fromCoords = this.getStationCoordinates(fromStation);
    if (fromCoords && reachableStation.path.length > 0) {
      legs.push({
        mode: 'WALK',
        from: { name: 'Origin', lat: fromCoords.lat, lon: fromCoords.lon },
        to: { name: fromStation.name, lat: fromCoords.lat, lon: fromCoords.lon },
        duration: 180, // 3 minutes walking
        distance: 200
      });
    }

    // Convert transit segments
    for (const segment of reachableStation.path) {
      const from = this.transitService!.getStation(segment.from);
      const to = this.transitService!.getStation(segment.to);
      
      if (from && to) {
        const fromCoords = this.getStationCoordinates(from);
        const toCoords = this.getStationCoordinates(to);
        
        if (fromCoords && toCoords) {
          legs.push({
            mode: 'TRANSIT',
            from: { name: from.name, lat: fromCoords.lat, lon: fromCoords.lon },
            to: { name: to.name, lat: toCoords.lat, lon: toCoords.lon },
            duration: segment.time * 60,
            route: {
              id: segment.line_id,
              shortName: segment.line_id,
              longName: segment.line,
              type: segment.train_type
            }
          });
        }
      }
    }

    // Add final walking leg if needed
    const toCoords = this.getStationCoordinates(toStation);
    if (toCoords && legs.length > 0) {
      legs.push({
        mode: 'WALK',
        from: { name: toStation.name, lat: toCoords.lat, lon: toCoords.lon },
        to: { name: 'Destination', lat: toCoords.lat, lon: toCoords.lon },
        duration: 180, // 3 minutes walking
        distance: 200
      });
    }

    // Calculate times
    const walkTime = legs.filter(l => l.mode === 'WALK').reduce((sum, l) => sum + l.duration, 0);
    const transitTime = legs.filter(l => l.mode === 'TRANSIT').reduce((sum, l) => sum + l.duration, 0);
    const totalDuration = reachableStation.travel_time * 60;
    const waitingTime = Math.max(0, totalDuration - walkTime - transitTime);

    return {
      duration: totalDuration,
      walkTime,
      transitTime,
      waitingTime,
      transfers: reachableStation.transfers,
      legs
    };
  }

  /**
   * Find all reachable locations within time limit
   */
  async findReachableLocations(
    fromLat: number,
    fromLon: number,
    maxMinutes: number
  ): Promise<ReachableStation[]> {
    if (!this.transitService) {
      await this.initialize();
    }

    const nearestStation = this.findNearestStation(fromLat, fromLon);
    if (!nearestStation) {
      return [];
    }

    return this.transitService!.findReachableStations(nearestStation.id, maxMinutes);
  }

  /**
   * Get service status
   */
  getStatus(): { otpAvailable: boolean; transitGraphLoaded: boolean } {
    return {
      otpAvailable: this.otpAvailable ?? false,
      transitGraphLoaded: this.transitService !== null
    };
  }
}

// Singleton instance
let serviceInstance: SimplifiedOTPService | null = null;

export async function getSimplifiedOTPService(): Promise<SimplifiedOTPService> {
  if (!serviceInstance) {
    serviceInstance = new SimplifiedOTPService();
    await serviceInstance.initialize();
  }
  return serviceInstance;
}