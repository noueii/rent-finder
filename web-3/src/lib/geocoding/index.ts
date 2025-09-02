/**
 * Geocoding Service for Tokyo Apartment Finder
 * 
 * This service provides geocoding capabilities for converting Japanese addresses
 * to latitude/longitude coordinates. It uses OpenStreetMap's Nominatim service
 * as the primary provider with built-in caching and rate limiting.
 */

import { z } from 'zod';

// Types
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName?: string;
  confidence?: number;
  provider: 'nominatim' | 'cache';
}

export interface GeocodingOptions {
  language?: 'ja' | 'en';
  timeout?: number;
  useCache?: boolean;
}

// Validation schemas
const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const geocodingResultSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  displayName: z.string().optional(),
  confidence: z.number().optional(),
  provider: z.enum(['nominatim', 'cache']),
});

// Cache implementation
interface CacheEntry {
  result: GeocodingResult;
  timestamp: number;
  address: string;
}

class GeocodingCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly MAX_SIZE = 10000; // Maximum cache entries

  private getCacheKey(address: string): string {
    // Normalize address for consistent caching
    return address.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  get(address: string): GeocodingResult | null {
    const key = this.getCacheKey(address);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if cache entry is expired
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    // Return cached result with provider marked as 'cache'
    return { ...entry.result, provider: 'cache' };
  }

  set(address: string, result: GeocodingResult): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.MAX_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }
    
    const key = this.getCacheKey(address);
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      address,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Rate limiter implementation
class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 1, windowMs = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    
    // Remove old requests outside the window
    this.requests = this.requests.filter(time => now - time < this.windowMs);
    
    // If we're at the limit, wait
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = (oldestRequest! + this.windowMs) - now;
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.waitForSlot(); // Recursively check again
      }
    }
    
    // Add current request
    this.requests.push(now);
  }
}

// Japanese address normalization utilities
export class JapaneseAddressNormalizer {
  // Common prefecture suffixes
  private static readonly PREFECTURE_SUFFIXES = ['都', '道', '府', '県'];
  
  // Common city suffixes
  private static readonly CITY_SUFFIXES = ['市', '区', '町', '村'];
  
  // Number conversions (full-width to half-width)
  private static readonly FULLWIDTH_TO_HALFWIDTH: Record<string, string> = {
    '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
    '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
    'ー': '-', '－': '-', '‐': '-',
  };

  /**
   * Normalize a Japanese address for better geocoding results
   */
  static normalize(address: string): string {
    let normalized = address;
    
    // Convert full-width numbers to half-width
    for (const [full, half] of Object.entries(this.FULLWIDTH_TO_HALFWIDTH)) {
      normalized = normalized.replace(new RegExp(full, 'g'), half);
    }
    
    // Remove extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();
    
    // Add Japan suffix if not present (helps with international geocoding)
    if (!normalized.includes('日本') && !normalized.toLowerCase().includes('japan')) {
      normalized = `${normalized}, 日本`;
    }
    
    return normalized;
  }

  /**
   * Extract components from a Japanese address
   */
  static extractComponents(address: string): {
    prefecture?: string;
    city?: string;
    ward?: string;
    rest?: string;
  } {
    const components: any = {};
    let remaining = address;
    
    // Extract prefecture
    for (const suffix of this.PREFECTURE_SUFFIXES) {
      const match = remaining.match(new RegExp(`([^${suffix}]+${suffix})`));
      if (match) {
        components.prefecture = match[1];
        remaining = remaining.replace(match[1], '').trim();
        break;
      }
    }
    
    // Extract city/ward
    for (const suffix of this.CITY_SUFFIXES) {
      const match = remaining.match(new RegExp(`([^${suffix}]+${suffix})`));
      if (match) {
        if (suffix === '区') {
          components.ward = match[1];
        } else {
          components.city = match[1];
        }
        remaining = remaining.replace(match[1], '').trim();
        break;
      }
    }
    
    components.rest = remaining;
    return components;
  }
}

// Main Geocoding Service
export class GeocodingService {
  private cache = new GeocodingCache();
  private rateLimiter = new RateLimiter(1, 1000); // 1 request per second for Nominatim
  private readonly nominatimUrl = 'https://nominatim.openstreetmap.org/search';
  private readonly userAgent = 'TokyoApartmentFinder/1.0';

  /**
   * Geocode a Japanese address to coordinates
   */
  async geocode(
    address: string,
    options: GeocodingOptions = {}
  ): Promise<GeocodingResult | null> {
    const { useCache = true, timeout = 10000, language = 'ja' } = options;
    
    // Check cache first
    if (useCache) {
      const cached = this.cache.get(address);
      if (cached) {
        console.log(`[Geocoding] Cache hit for: ${address}`);
        return cached;
      }
    }
    
    // Normalize the address
    const normalizedAddress = JapaneseAddressNormalizer.normalize(address);
    console.log(`[Geocoding] Geocoding address: ${normalizedAddress}`);
    
    try {
      // Rate limit the request
      await this.rateLimiter.waitForSlot();
      
      // Make request to Nominatim
      const params = new URLSearchParams({
        q: normalizedAddress,
        format: 'json',
        limit: '1',
        'accept-language': language,
        countrycodes: 'jp', // Restrict to Japan
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`${this.nominatimUrl}?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log(`[Geocoding] No results found for: ${address}`);
        return null;
      }
      
      const result = data[0];
      const geocoded: GeocodingResult = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        confidence: result.importance || 0.5,
        provider: 'nominatim',
      };
      
      // Validate coordinates
      try {
        coordinatesSchema.parse(geocoded);
      } catch (error) {
        console.error('[Geocoding] Invalid coordinates received:', error);
        return null;
      }
      
      // Cache the result
      if (useCache) {
        this.cache.set(address, geocoded);
      }
      
      console.log(`[Geocoding] Successfully geocoded: ${address} -> ${geocoded.latitude}, ${geocoded.longitude}`);
      return geocoded;
      
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('[Geocoding] Request timeout:', address);
        } else {
          console.error('[Geocoding] Error geocoding address:', error.message);
        }
      }
      return null;
    }
  }

  /**
   * Batch geocode multiple addresses with progress tracking
   */
  async batchGeocode(
    addresses: string[],
    options: GeocodingOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, GeocodingResult | null>> {
    const results = new Map<string, GeocodingResult | null>();
    let completed = 0;
    
    for (const address of addresses) {
      const result = await this.geocode(address, options);
      results.set(address, result);
      
      completed++;
      if (onProgress) {
        onProgress(completed, addresses.length);
      }
    }
    
    return results;
  }

  /**
   * Reverse geocode coordinates to an address
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
    options: GeocodingOptions = {}
  ): Promise<string | null> {
    const { timeout = 10000, language = 'ja' } = options;
    
    try {
      // Validate coordinates
      coordinatesSchema.parse({ latitude, longitude });
      
      // Rate limit the request
      await this.rateLimiter.waitForSlot();
      
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lon: longitude.toString(),
        format: 'json',
        'accept-language': language,
        zoom: '18', // Street level detail
      });
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?${params}`,
        {
          headers: {
            'User-Agent': this.userAgent,
          },
          signal: controller.signal,
        }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Nominatim error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log(`[Geocoding] Reverse geocoding error: ${data.error}`);
        return null;
      }
      
      return data.display_name || null;
      
    } catch (error) {
      console.error('[Geocoding] Error reverse geocoding:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two points using Haversine formula
   */
  static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size(),
      maxSize: 10000,
    };
  }

  /**
   * Clear the geocoding cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const geocodingService = new GeocodingService();

// Export default
export default geocodingService;