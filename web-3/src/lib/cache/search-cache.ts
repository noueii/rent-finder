import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  createdAt: Date;
  expiresAt: Date;
  hits: number;
}

/**
 * Simple in-memory cache for search results
 * In production, this would be Redis or similar
 */
export class SearchCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 3600000; // 1 hour default
    this.maxSize = options.maxSize || 1000;
    this.startCleanup();
  }

  /**
   * Generate cache key from search parameters
   */
  generateKey(params: any): string {
    const sortedParams = this.sortObject(params);
    const jsonString = JSON.stringify(sortedParams);
    return crypto.createHash('md5').update(jsonString).digest('hex');
  }

  /**
   * Sort object keys recursively for consistent hashing
   */
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item)).sort();
    
    const sorted: any = {};
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = this.sortObject(obj[key]);
    });
    return sorted;
  }

  /**
   * Get cached data
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Update hit count
    entry.hits++;
    
    return entry.data as T;
  }

  /**
   * Set cache data
   */
  set<T = any>(key: string, data: T, ttl?: number): void {
    // Check size limit
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl || this.ttl));
    
    this.cache.set(key, {
      key,
      data,
      createdAt: now,
      expiresAt,
      hits: 0,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Delete cached data
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
  } {
    let totalHits = 0;
    this.cache.forEach(entry => {
      totalHits += entry.hits;
    });
    
    return {
      size: this.cache.size,
      hits: totalHits,
      misses: 0, // Would need to track this separately
      hitRate: 0, // Would need to calculate based on hits/misses
    };
  }

  /**
   * Evict oldest entry (LRU)
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime: Date | null = null;
    
    this.cache.forEach((entry, key) => {
      if (!oldestTime || entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    });
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Stop cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SearchCache {
    return getSearchCache();
  }
}

/**
 * Database-backed cache for persistent caching
 */
export class DatabaseSearchCache {
  private db: PrismaClient;
  private memoryCache: SearchCache;

  constructor(db: PrismaClient, options?: CacheOptions) {
    this.db = db;
    this.memoryCache = new SearchCache(options);
  }

  /**
   * Get from cache (memory first, then database)
   */
  async get<T = any>(key: string): Promise<T | null> {
    // Check memory cache first
    const memoryResult = this.memoryCache.get<T>(key);
    if (memoryResult) return memoryResult;

    // Check database cache
    const dbResult = await this.db.searchSession.findFirst({
      where: {
        filters: {
          path: ['cacheKey'],
          equals: key,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (dbResult && dbResult.resultCount !== null) {
      // Store in memory cache for faster access
      this.memoryCache.set(key, dbResult.filters);
      return dbResult.filters as T;
    }

    return null;
  }

  /**
   * Set in both memory and database cache
   */
  async set<T = any>(key: string, data: T, userId?: string): Promise<void> {
    // Set in memory cache
    this.memoryCache.set(key, data);

    // Store in database for persistence
    if (userId) {
      await this.db.searchSession.create({
        data: {
          userId,
          filters: {
            ...data,
            cacheKey: key,
          },
          resultCount: 0, // Will be updated when results are fetched
        },
      });
    }
  }

  /**
   * Check if exists in cache
   */
  async has(key: string): Promise<boolean> {
    return this.memoryCache.has(key) || await this.existsInDb(key);
  }

  /**
   * Check if exists in database
   */
  private async existsInDb(key: string): Promise<boolean> {
    const count = await this.db.searchSession.count({
      where: {
        filters: {
          path: ['cacheKey'],
          equals: key,
        },
      },
    });
    return count > 0;
  }

  /**
   * Clear old cache entries from database
   */
  async cleanupDatabase(olderThan: Date): Promise<number> {
    const result = await this.db.searchSession.deleteMany({
      where: {
        createdAt: {
          lt: olderThan,
        },
      },
    });
    return result.count;
  }
}

// Singleton instances
let searchCacheInstance: SearchCache | null = null;
const dbCacheInstances = new WeakMap<PrismaClient, DatabaseSearchCache>();

export function getSearchCache(): SearchCache {
  if (!searchCacheInstance) {
    searchCacheInstance = new SearchCache({
      ttl: 3600000, // 1 hour
      maxSize: 1000,
    });
  }
  return searchCacheInstance;
}

export function getDatabaseSearchCache(db: PrismaClient): DatabaseSearchCache {
  let cache = dbCacheInstances.get(db);
  if (!cache) {
    cache = new DatabaseSearchCache(db);
    dbCacheInstances.set(db, cache);
  }
  return cache;
}