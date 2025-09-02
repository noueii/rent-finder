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
 * OTP Plan Response
 */
interface OTPPlanResponse {
  plan?: {
    itineraries: Array<{
      duration: number;
      walkTime: number;
      transitTime: number;
      waitingTime: number;
      transfers: number;
      legs: Array<{
        mode: string;
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
        duration: number;
        distance?: number;
        route?: {
          id: string;
          shortName: string;
          longName: string;
          type: string;
        };
      }>;
    }>;
  };
  error?: {
    message: string;
    code: string;
  };
}

/**
 * Station to Coordinate Mapping Cache
 */
interface StationCoordinateCache {
  [stationId: string]: {
    lat: number;
    lon: number;
    name: string;
    nameJa: string;
  };
}

/**
 * Route Cache Entry
 */
interface CacheEntry {
  route: OTPRoute | null;
  timestamp: number;
  ttl: number;
}

/**
 * OpenTripPlanner Service for Tokyo Transit
 * 
 * This service provides accurate transit routing using OpenTripPlanner.
 * Falls back to the existing transit graph when OTP is unavailable.
 */
export class OTPService {
  private otpEndpoint: string;
  private fallbackService: ReturnType<typeof getTransitService> | null = null;
  private routeCache: Map<string, CacheEntry> = new Map();
  private stationCache: StationCoordinateCache = {};
  private otpAvailable: boolean = true;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000; // 1 minute
  private cacheTTL: number = 3600000; // 1 hour
  private maxCacheSize: number = 10000;

  constructor(otpEndpoint?: string) {
    this.otpEndpoint = otpEndpoint || process.env.OTP_ENDPOINT || 'http://localhost:8080/otp/routers/default';
    console.log(`[OTP] Service constructed with endpoint: ${this.otpEndpoint}`);
    console.log(`[OTP] Environment OTP_ENDPOINT: ${process.env.OTP_ENDPOINT || 'not set'}`);
  }

  /**
   * Initialize the service and check OTP availability
   */
  async initialize(): Promise<void> {
    // Initialize fallback service
    this.fallbackService = await getTransitService();
    
    // Load station coordinates into cache
    const stations = this.fallbackService.getAllStations();
    stations.forEach(station => {
      let lat: number;
      let lon: number;
      
      // Handle both array format [lon, lat] and object format {lat, lon}
      if (Array.isArray(station.coordinates) && station.coordinates.length === 2) {
        lon = station.coordinates[0];
        lat = station.coordinates[1];
      } else if (station.coordinates && typeof station.coordinates === 'object' && 'lat' in station.coordinates && 'lon' in station.coordinates) {
        lat = station.coordinates.lat;
        lon = station.coordinates.lon;
      } else {
        console.warn(`[OTP] Station ${station.id} has invalid coordinate format:`, station.coordinates);
        return; // Skip this station
      }
      
      this.stationCache[station.id] = {
        lat,
        lon,
        name: station.name,
        nameJa: station.name_ja
      };
    });

    // Check OTP availability
    await this.checkOTPHealth();
  }

  /**
   * Check if OTP service is available
   */
  private async checkOTPHealth(): Promise<boolean> {
    const now = Date.now();
    
    // Skip if recently checked
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.otpAvailable;
    }

    this.lastHealthCheck = now;

    try {
      const response = await fetch(`${this.otpEndpoint}/index/routes`, {
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      this.otpAvailable = response.ok;
      
      if (this.otpAvailable) {
        console.log('OTP service is available');
      } else {
        console.warn('OTP service returned non-OK status:', response.status);
      }
    } catch (error) {
      this.otpAvailable = false;
      console.warn('OTP service is not available:', error);
    }

    return this.otpAvailable;
  }

  /**
   * Get route cache key
   */
  private getCacheKey(fromLat: number, fromLon: number, toLat: number, toLon: number): string {
    return `${fromLat.toFixed(6)},${fromLon.toFixed(6)}-${toLat.toFixed(6)},${toLon.toFixed(6)}`;
  }

  /**
   * Clean old cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    const entries = Array.from(this.routeCache.entries());
    
    // Remove expired entries
    entries.forEach(([key, entry]) => {
      if (now - entry.timestamp > entry.ttl) {
        this.routeCache.delete(key);
      }
    });

    // If still over limit, remove oldest entries
    if (this.routeCache.size > this.maxCacheSize) {
      const sortedEntries = entries
        .filter(([key]) => this.routeCache.has(key))
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = sortedEntries.slice(0, this.routeCache.size - this.maxCacheSize);
      toRemove.forEach(([key]) => this.routeCache.delete(key));
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
    const route = await this.getRoute(
      fromLat,
      fromLon,
      toLat,
      toLon,
      maxMinutes
    );
    
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
    console.log(`[OTP] getRoute called with: from=(${fromLat}, ${fromLon}), to=(${toLat}, ${toLon}), maxMinutes=${maxMinutes}`);
    
    // Validate coordinates
    console.log(`[OTP] Validating coordinates - fromLat type: ${typeof fromLat}, fromLon type: ${typeof fromLon}, toLat type: ${typeof toLat}, toLon type: ${typeof toLon}`);
    
    const cacheKey = this.getCacheKey(fromLat, fromLon, toLat, toLon);
    
    // Check cache first
    const cached = this.routeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      console.log(`[OTP] Found cached route for ${cacheKey}`);
      return cached.route;
    }

    // Clean cache periodically
    if (this.routeCache.size > this.maxCacheSize * 0.9) {
      this.cleanCache();
    }

    let route: OTPRoute | null = null;

    // Try OTP first if available
    if (this.otpAvailable && (await this.checkOTPHealth())) {
      console.log(`[OTP] OTP is available, calculating route`);
      route = await this.calculateOTPRoute(fromLat, fromLon, toLat, toLon, maxMinutes);
    } else {
      console.log(`[OTP] OTP not available (otpAvailable=${this.otpAvailable})`);
    }

    // If OTP failed or not available, use fallback
    if (!route && this.fallbackService) {
      try {
        console.log(`[OTP] Using fallback transit service`);
        // Find nearest stations and calculate
        const nearestFrom = this.findNearestStation(fromLat, fromLon);
        const nearestTo = this.findNearestStation(toLat, toLon);
        
        console.log(`[OTP] Nearest stations: from=${nearestFrom?.name || 'none'} (id=${nearestFrom?.id || 'none'}), to=${nearestTo?.name || 'none'} (id=${nearestTo?.id || 'none'})`);
        
        if (nearestFrom && nearestTo) {
          const reachableStations = this.fallbackService.findReachableStations(
            nearestFrom.id,
            maxMinutes
          );
          
          console.log(`[OTP] Found ${reachableStations.length} reachable stations from ${nearestFrom.name}`);
          
          const targetStation = reachableStations.find(s => s.station_id === nearestTo.id);
          if (targetStation) {
            console.log(`[OTP] Found route to target station ${nearestTo.name}`);
            route = this.convertFallbackRoute(targetStation, nearestFrom);
          } else {
            console.log(`[OTP] Target station ${nearestTo.name} not reachable within ${maxMinutes} minutes`);
          }
        } else {
          console.log(`[OTP] Could not find nearest stations`);
        }
      } catch (error) {
        console.error('Error in OTP fallback calculation:', error);
        // Continue without route
      }
    }

    // Cache the result
    this.routeCache.set(cacheKey, {
      route,
      timestamp: Date.now(),
      ttl: route ? 3600000 : 300000 // 1 hour for success, 5 min for failure
    });

    console.log(`[OTP] Returning route: ${route ? 'found' : 'not found'}`);
    return route;
  }

  /**
   * Calculate route using OTP
   */
  private async calculateOTPRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number
  ): Promise<OTPRoute | null> {
    try {
      console.log(`[OTP] calculateOTPRoute called with: from=(${fromLat}, ${fromLon}), to=(${toLat}, ${toLon})`);
      
      const params = new URLSearchParams({
        fromPlace: `${fromLat},${fromLon}`,
        toPlace: `${toLat},${toLon}`,
        mode: 'TRANSIT,WALK',
        maxWalkDistance: '1000', // 1km max walking
        arriveBy: 'false',
        numItineraries: '5',
        locale: 'ja'
      });

      console.log(`[OTP] Query params:`, params.toString());
      
      const url = `${this.otpEndpoint}/plan?${params}`;
      console.log(`[OTP] Making request to: ${url}`);
      console.log(`[OTP] Full URL for manual testing: ${url}`);
      
      const response = await fetch(url, {
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });

      if (!response.ok) {
        console.log(`[OTP] Request failed with status: ${response.status}`);
        throw new Error(`OTP request failed: ${response.status}`);
      }

      const responseText = await response.text();
      console.log(`[OTP] Raw response (first 500 chars):`, responseText.substring(0, 500));
      
      let data: OTPPlanResponse;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`[OTP] Failed to parse response as JSON:`, parseError);
        return null;
      }

      if (data.error) {
        console.log(`[OTP] OTP returned error: ${data.error.message || data.error.msg} (${data.error.id})`);
        console.log(`[OTP] Full error object:`, JSON.stringify(data.error));
        
        // Special handling for TOO_CLOSE error - still process the walking itinerary
        if (data.error.id === 409 && data.error.message === 'TOO_CLOSE' && data.plan?.itineraries?.length > 0) {
          console.log(`[OTP] TOO_CLOSE error but has valid walking itinerary, processing it`);
          // Continue processing instead of returning null
        } else {
          return null;
        }
      }
      
      if (!data.plan?.itineraries?.length) {
        console.log(`[OTP] No itineraries found in OTP response`);
        return null;
      }

      // Find the best itinerary within time limit
      const validItineraries = data.plan.itineraries.filter(
        it => it.duration <= maxMinutes * 60 // Convert to seconds
      );

      if (validItineraries.length === 0) {
        return null;
      }

      // Log all itineraries for debugging
      console.log(`[OTP] Found ${validItineraries.length} valid itineraries:`);
      validItineraries.forEach((it, idx) => {
        const walkTime = it.walkTime || 0;
        const transitTime = it.transitTime || 0;
        const waitingTime = it.waitingTime || 0;
        const totalMinutes = Math.ceil(it.duration / 60);
        console.log(`  ${idx + 1}. Duration: ${totalMinutes}min (walk: ${Math.ceil(walkTime / 60)}min, transit: ${Math.ceil(transitTime / 60)}min, wait: ${Math.ceil(waitingTime / 60)}min), Transfers: ${it.transfers}, Distance: ${it.walkDistance?.toFixed(0)}m`);
      });

      // Select the best itinerary based on total duration
      // For apartment hunting, the fastest route is what matters most
      const scoredItineraries = validItineraries.map(it => {
        const totalMinutes = it.duration / 60;
        
        // Simple scoring: just use duration (fastest route wins)
        const score = it.duration; // Use seconds for more precision
        
        return { itinerary: it, score, totalMinutes };
      });

      // Sort by score (lower is better - i.e., fastest route first)
      scoredItineraries.sort((a, b) => a.score - b.score);
      
      const best = scoredItineraries[0];
      console.log(`[OTP] Selected fastest itinerary: ${best.totalMinutes.toFixed(1)}min (${best.score}s)`);

      return {
        duration: best.itinerary.duration,
        walkTime: best.itinerary.walkTime || 0,
        transitTime: best.itinerary.transitTime || 0,
        waitingTime: best.itinerary.waitingTime || 0,
        transfers: best.itinerary.transfers,
        legs: best.itinerary.legs.map(leg => ({
          mode: leg.mode as 'WALK' | 'TRANSIT',
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
            type: leg.route.type
          } : undefined
        }))
      };
    } catch (error) {
      console.error('OTP route calculation failed:', error);
      return null;
    }
  }

  /**
   * Convert fallback route to OTP format
   */
  private convertFallbackRoute(station: ReachableStation, from: TransitStation & { id: string }): OTPRoute {
    const legs: OTPRoute['legs'] = [];
    
    // Add walking leg to first station if needed
    if (station.path.length > 0) {
      const firstSegment = station.path[0];
      const firstStation = this.stationCache[firstSegment.from];
      
      if (firstStation) {
        // Extract coordinates from the 'from' station
        let fromLat: number;
        let fromLon: number;
        
        if (Array.isArray(from.coordinates) && from.coordinates.length === 2) {
          fromLon = from.coordinates[0];
          fromLat = from.coordinates[1];
        } else if (from.coordinates && typeof from.coordinates === 'object' && 'lat' in from.coordinates && 'lon' in from.coordinates) {
          fromLat = from.coordinates.lat;
          fromLon = from.coordinates.lon;
        } else {
          console.warn(`[OTP] Invalid coordinates for station ${from.id}`);
          return { duration: station.travel_time * 60, transfers: station.transfers, legs: [] };
        }
        
        legs.push({
          mode: 'WALK',
          from: {
            name: from.name,
            lat: fromLat,
            lon: fromLon
          },
          to: {
            name: firstStation.name,
            lat: firstStation.lat,
            lon: firstStation.lon
          },
          duration: 180, // Assume 3 minutes walking
          distance: 200 // Assume 200m
        });
      }
    }

    // Convert transit segments
    station.path.forEach(segment => {
      const fromStation = this.stationCache[segment.from];
      const toStation = this.stationCache[segment.to];
      
      if (fromStation && toStation) {
        legs.push({
          mode: 'TRANSIT',
          from: {
            name: fromStation.name,
            lat: fromStation.lat,
            lon: fromStation.lon
          },
          to: {
            name: toStation.name,
            lat: toStation.lat,
            lon: toStation.lon
          },
          duration: segment.time * 60, // Convert to seconds
          route: {
            id: segment.line_id,
            shortName: segment.line_id,
            longName: segment.line,
            type: segment.train_type
          }
        });
      }
    });

    // Calculate times from the legs
    const walkTimeSeconds = legs.filter(l => l.mode === 'WALK').reduce((sum, l) => sum + l.duration, 0);
    const transitTimeSeconds = legs.filter(l => l.mode === 'TRANSIT').reduce((sum, l) => sum + l.duration, 0);
    const totalDuration = station.travel_time * 60; // Convert to seconds
    const waitingTimeSeconds = Math.max(0, totalDuration - walkTimeSeconds - transitTimeSeconds);
    
    return {
      duration: totalDuration,
      walkTime: walkTimeSeconds,
      transitTime: transitTimeSeconds,
      waitingTime: waitingTimeSeconds,
      transfers: station.transfers,
      legs
    };
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(
    fromLat: number,
    fromLon: number,
    toLat: number,
    toLon: number,
    maxMinutes: number
  ): Promise<OTPRoute | null> {
    // Check cache first
    const cacheKey = this.getCacheKey(fromLat, fromLon, toLat, toLon);
    const cached = this.routeCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.route;
    }

    // Clean cache periodically
    if (this.routeCache.size > this.maxCacheSize) {
      this.cleanCache();
    }

    let route: OTPRoute | null = null;

    // Try OTP first if available
    if (await this.checkOTPHealth()) {
      route = await this.calculateOTPRoute(fromLat, fromLon, toLat, toLon, maxMinutes);
    }

    // Fallback to transit graph if OTP fails or is unavailable
    if (!route && this.fallbackService) {
      console.log('Falling back to transit graph for route calculation');
      
      // Find nearest stations
      const fromStation = this.findNearestStation(fromLat, fromLon);
      const toStation = this.findNearestStation(toLat, toLon);
      
      if (fromStation && toStation && fromStation.id !== toStation.id) {
        const reachableStations = this.fallbackService.findReachableStations(
          fromStation.id,
          maxMinutes
        );
        
        const destination = reachableStations.find(s => s.station_id === toStation.id);
        
        if (destination) {
          route = this.convertFallbackRoute(destination, fromStation);
        }
      }
    }

    // Cache the result
    this.routeCache.set(cacheKey, {
      route,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    });

    return route;
  }

  /**
   * Find nearest station to coordinates
   */
  private findNearestStation(lat: number, lon: number): (TransitStation & { id: string }) | null {
    if (!this.fallbackService) {
      console.log(`[OTP] No fallback service available`);
      return null;
    }

    const stations = this.fallbackService.getAllStations();
    console.log(`[OTP] Total stations available: ${stations.length}`);
    
    let nearest: (TransitStation & { id: string }) | null = null;
    let minDistance = Infinity;
    let validStations = 0;

    stations.forEach(station => {
      // Check if station has valid coordinates
      let stationLat: number | undefined;
      let stationLon: number | undefined;
      
      // Handle both array format [lon, lat] and object format {lat, lon}
      if (Array.isArray(station.coordinates) && station.coordinates.length === 2) {
        stationLon = station.coordinates[0];
        stationLat = station.coordinates[1];
      } else if (station.coordinates && typeof station.coordinates === 'object' && 'lat' in station.coordinates && 'lon' in station.coordinates) {
        stationLat = station.coordinates.lat;
        stationLon = station.coordinates.lon;
      }
      
      if (typeof stationLat !== 'number' || typeof stationLon !== 'number') {
        return; // Skip this station
      }
      
      validStations++;
      
      const distance = this.calculateDistance(
        lat,
        lon,
        stationLat,
        stationLon
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearest = station;
      }
    });

    console.log(`[OTP] Valid stations with coordinates: ${validStations}, nearest distance: ${minDistance}m`);

    // Only return if within reasonable walking distance (5km for debugging)
    const maxWalkingDistance = 5000; // Increased to 5km to ensure we find stations
    console.log(`[OTP] Checking if ${minDistance}m <= ${maxWalkingDistance}m`);
    
    if (nearest && minDistance <= maxWalkingDistance) {
      console.log(`[OTP] Found nearest station: ${nearest.name} at ${minDistance}m`);
      return nearest;
    } else {
      console.log(`[OTP] No station within ${maxWalkingDistance}m. Nearest was at ${minDistance}m`);
      return null;
    }
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Find all reachable locations within time limit
   */
  async findReachableLocations(
    fromLat: number,
    fromLon: number,
    maxMinutes: number
  ): Promise<ReachableStation[]> {
    // For now, use fallback service for bulk reachability
    // OTP isochrone API could be implemented later for more accuracy
    if (!this.fallbackService) {
      await this.initialize();
    }

    const nearestStation = this.findNearestStation(fromLat, fromLon);
    if (!nearestStation) {
      return [];
    }

    return this.fallbackService!.findReachableStations(nearestStation.id, maxMinutes);
  }

  /**
   * Clear route cache
   */
  clearCache(): void {
    this.routeCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    ttl: number;
    otpAvailable: boolean;
  } {
    return {
      size: this.routeCache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL,
      otpAvailable: this.otpAvailable
    };
  }
}

// Singleton instance
let otpServiceInstance: OTPService | null = null;

export async function getOTPService(): Promise<OTPService> {
  if (!otpServiceInstance) {
    otpServiceInstance = new OTPService();
    await otpServiceInstance.initialize();
  }
  return otpServiceInstance;
}