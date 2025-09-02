// Cache interface
export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// No-op cache implementation - disables all caching
class NoOpCacheService implements CacheService {
  async get<T>(key: string): Promise<T | null> {
    return null; // Always return cache miss
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Do nothing
  }

  async del(key: string): Promise<void> {
    // Do nothing
  }

  async clear(): Promise<void> {
    // Do nothing
  }

  async has(key: string): Promise<boolean> {
    return false; // Always return false
  }
}

// Export cache service instance - always use no-op
export const cacheService: CacheService = new NoOpCacheService();

// Cache key generators (kept for compatibility but won't be used)
export const cacheKeys = {
  // Transit service cache keys
  transitGraph: () => 'transit:graph',
  stationById: (stationId: string) => `station:${stationId}`,
  reachableStations: (stationId: string, maxMinutes: number) => 
    `reachable:${stationId}:${maxMinutes}`,
  travelTime: (from: string, to: string) => `travel:${from}:${to}`,
  
  // Apartment search cache keys
  apartmentSearch: (stationId: string, maxMinutes: number, filters: string) => 
    `search:${stationId}:${maxMinutes}:${filters}`,
  apartmentById: (apartmentId: string) => `apartment:${apartmentId}`,
  apartmentFilters: () => 'apartment:filters',
  
  // Station search cache keys
  stationSearch: (query: string, limit: number) => 
    `stations:search:${query}:${limit}`,
  popularStations: (limit: number) => `stations:popular:${limit}`,
  
  // System cache keys
  systemHealth: () => 'system:health',
  dbStats: () => 'db:stats',
};

// Cache TTL constants (in seconds) - kept for compatibility
export const cacheTTL = {
  short: 0,
  medium: 0,
  long: 0,
  veryLong: 0,
  daily: 0,
};

// Performance monitoring - disabled
export const cacheMetrics = {
  hits: 0,
  misses: 0,
  errors: 0,
  
  recordHit() {},
  recordMiss() {},
  recordError() {},
  
  getHitRate() {
    return 0;
  },
  
  reset() {},
  
  getStats() {
    return {
      hits: 0,
      misses: 0,
      errors: 0,
      hitRate: 0,
    };
  },
};

// Cache utilities - disabled
export const cacheUtils = {
  generateKeyHash(obj: any): string {
    return '';
  },
  
  // Wrap function with caching - now just calls the function directly
  withCache<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    keyGenerator: (...args: T) => string,
    ttl: number = 0
  ) {
    return async (...args: T): Promise<R> => {
      return await fn(...args); // Just call the function directly, no caching
    };
  },
  
  async invalidatePattern(pattern: string): Promise<void> {
    // Do nothing
  },
};