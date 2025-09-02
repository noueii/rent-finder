/**
 * Unified Base Scraper
 * Implements 85% common functionality across all scrapers
 * Uses strategy pattern for execution models
 */

import { z } from 'zod';
import * as cheerio from 'cheerio';
import { BaseError } from '~/core/errors/base-error';
import { errorHandler } from '~/core/errors/error-handler';
import { createValidator } from '~/core/validation/validators';
import type { Validator } from '~/core/validation/types';
import { RateLimiter, TokenBucketRateLimiter } from '~/lib/scrapers/rate-limiter';
import { createLogger } from '~/lib/logging';
import { UnifiedProxyManager } from '../proxy';
import type { ProxyConfig } from '~/types/scraper';

// Types
export interface ScraperConfig {
  // Execution mode
  mode: 'fast' | 'normal';
  
  // Strategy configuration
  strategy?: StrategyType;
  strategyConfig?: {
    priorityFunction?: (url: string) => number;
    maxQueueSize?: number;
    processingOrder?: 'fifo' | 'lifo' | 'priority';
    batchSize?: number;
    batchDelay?: number;
    highWaterMark?: number;
    lowWaterMark?: number;
    rampUpDelay?: number;
  };
  
  // Rate limiting
  rateLimit: {
    requests: number;
    perSeconds: number;
    burst?: number;
  };
  
  // Retry configuration
  maxRetries: number;
  retryDelay: number;
  retryBackoff: 'linear' | 'exponential';
  
  // Concurrency (for fast mode)
  concurrency: number;
  
  // Timeouts
  requestTimeout: number;
  totalTimeout: number;
  
  // Features
  features: {
    screenshots: boolean;
    cache: boolean;
    proxy: boolean;
  };
  
  // Site-specific overrides
  overrides?: {
    userAgent?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  };
}

export interface ScrapeParams {
  prefecture?: string;
  city?: string;
  trainLines?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  updatedWithin?: number; // Days - e.g., 14 or 30 (RealEstate.co.jp specific)
  page?: number; // Starting page number
  limit?: number; // Maximum number of results to return
}

export interface BaseApartment {
  id: string;
  url: string;
  title: string;
  rent: number;
  size: number;
  layout: string;
  buildingType: string;
  age: number;
  floor: string;
  address: string;
  station: StationInfo;
  coordinates?: Coordinates;
  images: string[];
  features: string[];
  management?: number;
  deposit?: number;
  keyMoney?: number;
  agent?: string;
  scrapedAt: Date;
  source: string;
}

export interface StationInfo {
  name: string;
  line: string;
  walkTime: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ScraperResult<T> {
  success: boolean;
  data: T[];
  errors: ScraperError[];
  stats: ScraperStats;
}

export interface ScraperStats {
  totalUrls: number;
  successfulUrls: number;
  failedUrls: number;
  totalApartments: number;
  duration: number;
  averageResponseTime: number;
}

export interface ScraperSelectors {
  title: string;
  rent: string;
  size: string;
  layout: string;
  buildingType: string;
  age: string;
  floor: string;
  address: string;
  station: string;
  management: string;
  deposit: string;
  keyMoney: string;
}

// Error types
export class ScraperError extends BaseError {
  constructor(
    message: string,
    public code: string,
    public url?: string,
    cause?: Error
  ) {
    super(code, 500, true, message);
    this.cause = cause;
  }
}

export const ERROR_CODES = {
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  PARSE_ERROR: 'PARSE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  BLOCKED: 'BLOCKED',
  INVALID_RESPONSE: 'INVALID_RESPONSE'
} as const;

// Import strategies
import { 
  createStrategy, 
  StreamStrategy,
  type IScrapingStrategy,
  type ScraperContext,
  type ExecutionResult,
  type StrategyType
} from '../strategies';

// Progress tracking
export class ProgressTracker {
  private total: number = 0;
  private completed: number = 0;
  private failed: number = 0;
  private startTime: number = Date.now();
  
  setTotal(total: number): void {
    this.total = total;
  }
  
  recordSuccess(): void {
    this.completed++;
  }
  
  recordFailure(): void {
    this.failed++;
  }
  
  getProgress(): {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
    duration: number;
    estimatedTimeRemaining: number;
  } {
    const percentage = this.total > 0 ? (this.completed + this.failed) / this.total * 100 : 0;
    const duration = Date.now() - this.startTime;
    const rate = (this.completed + this.failed) / (duration / 1000);
    const remaining = this.total - this.completed - this.failed;
    const estimatedTimeRemaining = rate > 0 ? remaining / rate * 1000 : 0;
    
    return {
      total: this.total,
      completed: this.completed,
      failed: this.failed,
      percentage,
      duration,
      estimatedTimeRemaining
    };
  }
  
  reset(): void {
    this.total = 0;
    this.completed = 0;
    this.failed = 0;
    this.startTime = Date.now();
  }
}

/**
 * Base Scraper Abstract Class
 * Implements common functionality for all scrapers
 */
export abstract class BaseScraper<T extends BaseApartment> {
  protected config: ScraperConfig;
  protected rateLimiter: RateLimiter | TokenBucketRateLimiter;
  protected progressTracker: ProgressTracker;
  protected logger: ReturnType<typeof createLogger>;
  protected abortController: AbortController;
  protected proxyManager?: UnifiedProxyManager;
  private isInitialized: boolean = false;
  
  constructor(config: ScraperConfig) {
    this.config = config;
    this.progressTracker = new ProgressTracker();
    this.logger = createLogger(this.getScraperName());
    this.abortController = new AbortController();
    
    // Initialize rate limiter based on config
    if (config.rateLimit.burst) {
      this.rateLimiter = new TokenBucketRateLimiter(
        config.rateLimit.burst,
        config.rateLimit.requests / config.rateLimit.perSeconds
      );
    } else {
      this.rateLimiter = new RateLimiter({
        maxRequests: config.rateLimit.requests,
        windowMs: config.rateLimit.perSeconds * 1000,
        minDelayMs: 100,
        maxDelayMs: 60000,
        backoffMultiplier: config.retryBackoff === 'exponential' ? 2 : 1
      });
    }
    
    // Initialize proxy manager if enabled
    if (config.features.proxy && process.env.DISABLE_SCRAPERS_PROXY !== 'true') {
      console.log('[BaseScraper] Initializing proxy manager (proxy feature enabled)');
      this.proxyManager = UnifiedProxyManager.fromEnv({
        rotationStrategy: config.mode === 'fast' ? 'performance' : 'round-robin',
        healthCheckInterval: 0, // Disable automatic health checks
        blacklistDuration: 300000,
        maxFailures: 3
      });
      console.log('[BaseScraper] Proxy manager initialized, hasProxies:', this.proxyManager?.hasProxies());
    } else {
      console.log('[BaseScraper] Proxy disabled:', {
        featureProxy: config.features.proxy,
        disableScrapersProxy: process.env.DISABLE_SCRAPERS_PROXY
      });
    }
  }
  
  /**
   * Template method pattern - main scraping flow
   */
  async scrape(params: ScrapeParams): Promise<ScraperResult<T>> {
    const startTime = Date.now();
    const errors: ScraperError[] = [];
    let data: T[] = [];
    
    try {
      // Initialize
      await this.initialize();
      
      // Build URLs
      const urls = await this.buildUrls(params);
      this.progressTracker.setTotal(urls.length);
      
      this.logger.info(`Starting scrape with ${urls.length} URLs`, {
        params,
        mode: this.config.mode
      });
      
      // Execute strategy
      data = await this.executeStrategy(urls);
      
      // Process results
      data = await this.processResults(data);
      
      // Format and return results
      return this.formatResults(data, errors, startTime);
      
    } catch (error) {
      this.logger.error('Scraping failed', { error });
      errors.push(this.handleError(error));
      return this.formatResults(data, errors, startTime);
    } finally {
      await this.cleanup();
    }
  }
  
  /**
   * Abstract methods that subclasses must implement
   */
  protected abstract getScraperName(): string;
  protected abstract buildUrls(params: ScrapeParams): Promise<string[]>;
  protected abstract extractListingUrls(html: string): string[];
  protected abstract extractApartmentData(html: string, url: string): T;
  protected abstract getSelectors(): ScraperSelectors;
  
  /**
   * Optional hooks for subclasses
   */
  protected async initialize(): Promise<void> {
    // Override in subclass if needed
    this.isInitialized = true;
  }
  
  protected async cleanup(): Promise<void> {
    // Override in subclass if needed
    this.abortController.abort();
    
    // Cleanup proxy manager
    if (this.proxyManager) {
      this.proxyManager.destroy();
    }
  }
  
  protected async processResults(results: T[]): Promise<T[]> {
    // Override in subclass for additional processing
    return results;
  }
  
  /**
   * Common implementation: fetch with retry
   */
  protected async fetchWithRetry(url: string): Promise<string> {
    console.log('[BaseScraper] fetchWithRetry called for URL:', url);
    
    // Rate limiting
    if (this.rateLimiter instanceof TokenBucketRateLimiter) {
      console.log('[BaseScraper] Using TokenBucketRateLimiter');
      await this.rateLimiter.waitForTokens(1);
    } else {
      console.log('[BaseScraper] Using standard RateLimiter');
      await this.rateLimiter.waitForSlot();
      this.rateLimiter.recordRequest();
    }
    
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      console.log(`[BaseScraper] Fetch attempt ${attempt}/${this.config.maxRetries} for URL:`, url);
      try {
        const response = await this.fetch(url);
        console.log('[BaseScraper] Fetch successful, response length:', response?.length || 0);
        
        // Reset errors on success
        if (this.rateLimiter instanceof RateLimiter) {
          this.rateLimiter.resetErrors();
        }
        
        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (this.rateLimiter instanceof RateLimiter) {
          this.rateLimiter.recordError();
        }
        
        if (attempt === this.config.maxRetries) {
          throw error;
        }
        
        // Calculate delay
        const delay = this.config.retryBackoff === 'exponential'
          ? this.config.retryDelay * Math.pow(2, attempt - 1)
          : this.config.retryDelay * attempt;
          
        this.logger.warn(`Retry attempt ${attempt} for ${url}`, {
          error: error instanceof Error ? error.message : String(error),
          delay
        });
        
        await this.delay(Math.min(delay, 30000)); // Cap at 30s
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
  }
  
  /**
   * Fetch implementation
   */
  protected async fetch(url: string): Promise<string> {
    console.log('[BaseScraper] fetch called for URL:', url);
    console.log('[BaseScraper] Config:', {
      requestTimeout: this.config.requestTimeout,
      mode: this.config.mode,
      proxy: this.config.features.proxy,
      userAgent: this.config.overrides?.userAgent?.substring(0, 50) + '...'
    });
    
    // Get proxy if enabled
    let proxy: ProxyConfig | undefined;
    let proxyStartTime: number | undefined;
    
    if (this.proxyManager?.hasProxies()) {
      console.log('[BaseScraper] Proxy manager has proxies, getting next proxy');
      proxy = this.proxyManager.getNextProxy();
      if (!proxy) {
        console.log('[BaseScraper] No available proxies, falling back to direct connection');
        this.logger.warn('No available proxies, falling back to direct connection');
      } else {
        console.log('[BaseScraper] Using proxy:', proxy.host);
        proxyStartTime = Date.now();
      }
    } else {
      console.log('[BaseScraper] No proxy manager or no proxies available, using direct connection');
    }
    
    try {
      // Use axios if proxy is enabled, otherwise use fetch
      if (proxy) {
        console.log('[BaseScraper] Using axios with proxy');
        const axios = (await import('axios')).default;
        const proxyAgents = this.proxyManager!.createProxyAgents(url, proxy);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': this.config.overrides?.userAgent || 
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...this.config.overrides?.headers
          },
          timeout: this.config.requestTimeout,
          ...proxyAgents
        });
        
        // Report proxy success
        if (proxyStartTime) {
          this.proxyManager!.reportSuccess(proxy, Date.now() - proxyStartTime);
        }
        
        return response.data;
      } else {
        // Direct fetch
        console.log('[BaseScraper] Using direct fetch without proxy');
        console.log('[BaseScraper] Request URL:', url);
        console.log('[BaseScraper] Request timeout:', this.config.requestTimeout, 'ms');
        
        // Create an AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.error('[BaseScraper] Request timeout reached, aborting...');
          controller.abort();
        }, this.config.requestTimeout);
        
        try {
          console.log('[BaseScraper] Starting fetch request...');
          const startTime = Date.now();
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': this.config.overrides?.userAgent || 
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate, br',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache',
              ...this.config.overrides?.headers
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          const fetchTime = Date.now() - startTime;
          console.log('[BaseScraper] Fetch completed in', fetchTime, 'ms');
          console.log('[BaseScraper] Response status:', response.status, response.statusText);
          console.log('[BaseScraper] Response headers:', Object.fromEntries(response.headers.entries()));
          
          if (!response.ok) {
            console.error('[BaseScraper] Response not OK:', response.status, response.statusText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          console.log('[BaseScraper] Reading response text...');
          const text = await response.text();
          console.log('[BaseScraper] Response text length:', text.length);
          console.log('[BaseScraper] First 200 chars:', text.substring(0, 200));
          
          return text;
        } catch (fetchError) {
          clearTimeout(timeoutId);
          console.error('[BaseScraper] Fetch failed:', {
            error: fetchError instanceof Error ? {
              message: fetchError.message,
              name: fetchError.name,
              stack: fetchError.stack?.split('\n').slice(0, 5).join('\n')
            } : fetchError,
            url
          });
          throw fetchError;
        }
      }
    } catch (error) {
      console.error('[BaseScraper] Fetch error details:', {
        url,
        errorType: error instanceof Error ? error.constructor.name : typeof error,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          cause: (error as any).cause,
          code: (error as any).code,
          syscall: (error as any).syscall,
          errno: (error as any).errno,
          stack: error.stack?.split('\n').slice(0, 5).join('\n')
        } : error
      });
      
      // Report proxy failure if applicable
      if (proxy && this.proxyManager) {
        this.proxyManager.reportFailure(proxy, error instanceof Error ? error.message : 'Unknown error');
      }
      
      if (error instanceof Error) {
        // Check for specific error types
        if (error.name === 'AbortError' || error.message.includes('abort')) {
          console.error('[BaseScraper] Request aborted (timeout)');
          throw new ScraperError(`Request timeout after ${this.config.requestTimeout}ms`, ERROR_CODES.TIMEOUT, url, error);
        }
        if (error.message.includes('ECONNREFUSED')) {
          console.error('[BaseScraper] Connection refused');
          throw new ScraperError('Connection refused - server may be down', ERROR_CODES.NETWORK_ERROR, url, error);
        }
        if (error.message.includes('ETIMEDOUT')) {
          console.error('[BaseScraper] Connection timeout');
          throw new ScraperError('Connection timeout', ERROR_CODES.TIMEOUT, url, error);
        }
        if (error.message.includes('ENOTFOUND')) {
          console.error('[BaseScraper] DNS lookup failed');
          throw new ScraperError('DNS lookup failed - domain not found', ERROR_CODES.NETWORK_ERROR, url, error);
        }
        if (error.message.includes('CERT') || error.message.includes('certificate')) {
          console.error('[BaseScraper] SSL/TLS certificate error');
          throw new ScraperError('SSL/TLS certificate error', ERROR_CODES.NETWORK_ERROR, url, error);
        }
        
        // Generic network error
        console.error('[BaseScraper] Generic network error');
        throw new ScraperError(`Network error: ${error.message}`, ERROR_CODES.NETWORK_ERROR, url, error);
      }
      throw error;
    }
  }
  
  /**
   * Strategy execution
   */
  protected async executeStrategy(urls: string[]): Promise<T[]> {
    const strategy = this.createStrategy();
    const context: ScraperContext = {
      abortSignal: this.abortController.signal,
      logger: this.logger,
      onProgress: (progress) => {
        this.logger.debug('Progress update', progress);
      }
    };
    
    const result = await strategy.execute(
      urls,
      async (url) => {
        const html = await this.fetchWithRetry(url);
        const apartment = this.extractApartmentData(html, url);
        return apartment;
      },
      context
    );
    
    // Update progress tracker with results
    this.progressTracker.setTotal(result.success.length + result.failed.length);
    result.success.forEach(() => this.progressTracker.recordSuccess());
    result.failed.forEach(() => this.progressTracker.recordFailure());
    
    // Log failed URLs
    if (result.failed.length > 0) {
      this.logger.warn(`${result.failed.length} URLs failed to process`, {
        failed: result.failed.map(f => ({ url: f.url, error: f.error.message }))
      });
    }
    
    // Log skipped URLs
    if (result.skipped.length > 0) {
      this.logger.info(`${result.skipped.length} URLs were skipped`, {
        skipped: result.skipped
      });
    }
    
    return result.success;
  }
  
  /**
   * Create strategy based on mode
   */
  protected createStrategy(): IScrapingStrategy<T> {
    // Determine strategy type
    let strategyType: StrategyType;
    if (this.config.strategy) {
      strategyType = this.config.strategy;
    } else {
      strategyType = this.config.mode === 'fast' ? 'concurrent' : 'sequential';
    }
    
    return createStrategy<T>({
      type: strategyType,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay,
      retryBackoff: this.config.retryBackoff,
      timeout: this.config.requestTimeout,
      continueOnError: true,
      concurrency: this.config.concurrency,
      warmupDelay: 1000, // 1 second warmup
      ...this.config.strategyConfig // Merge any strategy-specific config
    });
  }
  
  /**
   * Format results
   */
  protected formatResults(
    data: T[], 
    errors: ScraperError[], 
    startTime: number
  ): ScraperResult<T> {
    const progress = this.progressTracker.getProgress();
    
    return {
      success: errors.length === 0,
      data,
      errors,
      stats: {
        totalUrls: progress.total,
        successfulUrls: progress.completed,
        failedUrls: progress.failed,
        totalApartments: data.length,
        duration: Date.now() - startTime,
        averageResponseTime: progress.duration / (progress.completed + progress.failed)
      }
    };
  }
  
  /**
   * Error handling
   */
  protected handleError(error: unknown): ScraperError {
    if (error instanceof ScraperError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new ScraperError(
        error.message,
        ERROR_CODES.INVALID_RESPONSE,
        undefined,
        error
      );
    }
    
    return new ScraperError(
      'Unknown error occurred',
      ERROR_CODES.INVALID_RESPONSE
    );
  }
  
  /**
   * Utility: delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Utility: generate apartment ID
   */
  protected generateId($: cheerio.CheerioAPI): string {
    // Override in subclass for site-specific ID generation
    return `${this.getScraperName()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Fetch multiple apartments by their URLs
   * Used for updating existing apartments with fresh data
   */
  async fetchApartmentsByUrls(
    urls: string[], 
    onProgress?: (progress: ScrapeProgress) => void,
    onApartmentFetched?: (apartment: T) => Promise<void>
  ): Promise<ScraperResult<T>> {
    const startTime = Date.now();
    const apartments: T[] = [];
    const errors: ScraperError[] = [];
    let completed = 0;
    let failed = 0;

    try {
      // Initialize if needed
      await this.initialize();

      for (const url of urls) {
        try {
          const apartment = await this.getApartmentDetails(url);
          apartments.push(apartment);
          completed++;
          
          // Call the callback for real-time processing
          if (onApartmentFetched) {
            try {
              await onApartmentFetched(apartment);
              console.log(`[BaseScraper] Successfully processed apartment ${apartment.id} in real-time`);
            } catch (callbackError) {
              console.error(`[BaseScraper] Error in onApartmentFetched callback for ${apartment.id}:`, callbackError);
              // Don't fail the whole process if the callback fails
            }
          }
        } catch (error) {
          failed++;
          if (error instanceof ScraperError) {
            errors.push(error);
          } else {
            errors.push(new ScraperError(
              `Failed to fetch ${url}`,
              ERROR_CODES.UNKNOWN_ERROR,
              url,
              error as Error
            ));
          }
        }

        // Report progress
        if (onProgress) {
          onProgress({
            completed,
            failed,
            total: urls.length,
            currentPage: completed + failed,
            totalPages: urls.length,
            estimatedTimeRemaining: 0
          });
        }
      }

      return {
        success: errors.length === 0,
        data: apartments,
        errors: errors,
        stats: {
          totalUrls: urls.length,
          successfulUrls: completed,
          failedUrls: failed,
          totalApartments: apartments.length,
          duration: Date.now() - startTime,
          averageResponseTime: urls.length > 0 ? (Date.now() - startTime) / urls.length : 0
        }
      };
    } catch (error) {
      const errorObj = error instanceof ScraperError ? error : new ScraperError(
        error instanceof Error ? error.message : 'Unknown error',
        ERROR_CODES.NETWORK_ERROR
      );
      
      return {
        success: false,
        data: apartments, // Return any apartments that were successfully fetched
        errors: [errorObj, ...errors],
        stats: {
          totalUrls: urls.length,
          successfulUrls: completed,
          failedUrls: failed + 1,
          totalApartments: apartments.length,
          duration: Date.now() - startTime,
          averageResponseTime: urls.length > 0 ? (Date.now() - startTime) / urls.length : 0
        }
      };
    }
  }

  /**
   * Get apartment details from a specific URL
   * This method is for compatibility with the ScraperManagementService
   */
  async getApartmentDetails(url: string): Promise<T> {
    try {
      console.log('[BaseScraper] getApartmentDetails called for URL:', url);
      
      // Validate URL
      try {
        const urlObj = new URL(url);
        console.log('[BaseScraper] URL parsed successfully:', {
          protocol: urlObj.protocol,
          host: urlObj.host,
          pathname: urlObj.pathname
        });
      } catch (urlError) {
        console.error('[BaseScraper] Invalid URL format:', url);
        throw new ScraperError(
          `Invalid URL format: ${url}`,
          ERROR_CODES.INVALID_RESPONSE,
          url,
          urlError as Error
        );
      }
      
      this.logger.info('Fetching apartment details', { url });
      
      // Initialize if not already done
      if (!this.isInitialized) {
        console.log('[BaseScraper] Initializing scraper...');
        await this.initialize();
      }
      
      console.log('[BaseScraper] Calling fetchWithRetry for URL:', url);
      const html = await this.fetchWithRetry(url);
      console.log('[BaseScraper] HTML fetched, length:', html?.length || 0);
      
      if (!html || html.length === 0) {
        console.error('[BaseScraper] Empty response received');
        throw new ScraperError(
          'Empty response received from server',
          ERROR_CODES.INVALID_RESPONSE,
          url
        );
      }
      
      console.log('[BaseScraper] Extracting apartment data...');
      const apartment = this.extractApartmentData(html, url);
      console.log('[BaseScraper] Apartment data extracted:', apartment ? 'success' : 'null');
      
      if (!apartment) {
        console.error('[BaseScraper] Failed to extract apartment data');
        throw new ScraperError(
          'Failed to extract apartment data from HTML',
          ERROR_CODES.PARSE_ERROR,
          url
        );
      }
      
      // Add metadata for debugging
      return {
        ...apartment,
        _rawHtml: html,
        _httpResponse: {
          status: 200,
          headers: {},
          url
        }
      } as T;
    } catch (error) {
      console.error('[BaseScraper] getApartmentDetails error:', {
        url,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n')
        } : error
      });
      
      this.logger.error('Failed to fetch apartment details', { 
        url, 
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack
        } : error 
      });
      
      // Re-throw with more context
      if (error instanceof ScraperError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new ScraperError(
          `Failed to fetch details from ${url}: ${error.message}`,
          ERROR_CODES.NETWORK_ERROR,
          url,
          error
        );
      }
      
      throw new ScraperError(
        `Failed to fetch details from ${url}`,
        ERROR_CODES.NETWORK_ERROR,
        url
      );
    }
  }
  
  /**
   * Stop scraping
   */
  stop(): void {
    this.abortController.abort();
  }
  
  /**
   * Get proxy statistics
   */
  getProxyStats(): { enabled: boolean; summary?: ReturnType<UnifiedProxyManager['getSummary']> } {
    if (!this.proxyManager) {
      return { enabled: false };
    }
    
    return {
      enabled: true,
      summary: this.proxyManager.getSummary()
    };
  }
  
  /**
   * Stream results as they are processed (only works with stream strategy)
   */
  async *scrapeStream(params: ScrapeParams): AsyncIterable<T> {
    if (this.config.strategy !== 'stream') {
      throw new Error('Stream method only works with stream strategy');
    }
    
    const startTime = Date.now();
    
    try {
      // Initialize
      await this.initialize();
      
      // Build URLs
      const urls = await this.buildUrls(params);
      this.progressTracker.setTotal(urls.length);
      
      this.logger.info(`Starting stream scrape with ${urls.length} URLs`, {
        params,
        strategy: 'stream'
      });
      
      // Create stream strategy
      const strategy = new StreamStrategy<T>({
        ...this.config.strategyConfig,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay,
        retryBackoff: this.config.retryBackoff,
        timeout: this.config.requestTimeout,
        continueOnError: true,
        concurrency: this.config.concurrency
      });
      
      const context: ScraperContext = {
        abortSignal: this.abortController.signal,
        logger: this.logger,
        onProgress: (progress) => {
          this.logger.debug('Stream progress', progress);
        }
      };
      
      // Stream results
      for await (const result of strategy.stream(
        urls,
        async (url) => {
          const html = await this.fetchWithRetry(url);
          return this.extractApartmentData(html, url);
        },
        context
      )) {
        if (result.data) {
          this.progressTracker.recordSuccess();
          yield result.data;
        } else if (result.error) {
          this.progressTracker.recordFailure();
          this.logger.error(`Stream error for ${result.url}`, {
            error: result.error.message
          });
        }
      }
      
    } catch (error) {
      this.logger.error('Stream scraping failed', { error });
      throw error;
    } finally {
      await this.cleanup();
    }
  }
}


/**
 * Default configurations per scraper
 */
export const SCRAPER_CONFIGS: Record<string, ScraperConfig> = {
  homes: {
    mode: 'normal',
    strategy: 'sequential', // Strict rate limiting
    rateLimit: { requests: 1, perSeconds: 1 },
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoff: 'exponential',
    concurrency: 1,
    requestTimeout: 30000,
    totalTimeout: 600000,
    features: {
      screenshots: false,
      cache: true,
      proxy: false
    }
  },
  suumo: {
    mode: 'fast',
    strategy: 'concurrent', // Can handle concurrent requests
    strategyConfig: {
      rampUpDelay: 200 // Gentle ramp-up
    },
    rateLimit: { requests: 10, perSeconds: 1, burst: 5 },
    maxRetries: 3,
    retryDelay: 500,
    retryBackoff: 'linear',
    concurrency: 5,
    requestTimeout: 30000,
    totalTimeout: 600000,
    features: {
      screenshots: false,
      cache: true,
      proxy: false
    }
  },
  'r-store': {
    mode: 'normal',
    strategy: 'queue', // Priority-based processing
    strategyConfig: {
      processingOrder: 'priority',
      batchSize: 5,
      batchDelay: 2000,
      priorityFunction: (url: string) => {
        // Premium listings get higher priority
        if (url.includes('/premium/')) return 10;
        if (url.includes('/featured/')) return 5;
        return 1;
      }
    },
    rateLimit: { requests: 2, perSeconds: 1 },
    maxRetries: 3,
    retryDelay: 1500,
    retryBackoff: 'exponential',
    concurrency: 2,
    requestTimeout: 30000,
    totalTimeout: 600000,
    features: {
      screenshots: false,
      cache: true,
      proxy: false
    }
  },
  'at-home': {
    mode: 'fast',
    strategy: 'stream', // High volume, streaming results
    strategyConfig: {
      highWaterMark: 100,
      lowWaterMark: 50
    },
    rateLimit: { requests: 5, perSeconds: 1, burst: 3 },
    maxRetries: 2,
    retryDelay: 1000,
    retryBackoff: 'linear',
    concurrency: 3,
    requestTimeout: 20000,
    totalTimeout: 300000,
    features: {
      screenshots: false,
      cache: false,
      proxy: true
    }
  }
};