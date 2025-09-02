import { ApartmentScraper } from './apartment-scraper';
import { ScraperConfig } from '~/types/scraper';

export type ScraperType = 'yolo-japan' | 'wagaya-japan' | 'e-housing' | 'metro-residences' |  'realestate' ;
export type ScraperMode = 'fast' | 'normal' | 'auto';

export class UnifiedScraperFactory {
  private static scrapers: Map<string, typeof ApartmentScraper> = new Map();
  private static instances: Map<string, ApartmentScraper> = new Map();

  /**
   * Register a scraper class
   */
  static register(type: ScraperType, scraperClass: typeof ApartmentScraper, mode: 'fast' | 'normal' = 'normal'): void {
    const key = `${type}:${mode}`;
    this.scrapers.set(key, scraperClass);
    
    // Also register without mode suffix for backward compatibility
    if (mode === 'normal') {
      this.scrapers.set(type, scraperClass);
    }
  }

  /**
   * Create or get a scraper instance
   * @param type The scraper type
   * @param config Optional configuration
   * @param mode Optional mode ('fast' or 'normal'), defaults based on environment
   */
  static getScraper(type: ScraperType, config?: Partial<ScraperConfig>, mode?: ScraperMode): ApartmentScraper {
    return this.create(type, config, mode);
  }

  /**
   * Create a new scraper instance (alias for getScraper)
   * @param type The scraper type
   * @param config Optional configuration
   * @param mode Optional mode ('fast' or 'normal'), defaults based on environment
   */
  static create(type: ScraperType, config?: Partial<ScraperConfig>, mode?: ScraperMode): ApartmentScraper {
    // Determine the actual mode to use
    let actualMode: 'fast' | 'normal' = 'normal';
    
    if (mode === 'fast' || mode === 'normal') {
      actualMode = mode;
    } else if (mode === 'auto' || !mode) {
      // Auto-detect based on environment
      actualMode = this.shouldUseFastMode() ? 'fast' : 'normal';
    }
    
    // Build the key for looking up the scraper
    const key = `${type}:${actualMode}`;
    const cacheKey = `${type}:${actualMode}:${JSON.stringify(config || {})}`;
    
    // Check if we have a cached instance
    let instance = this.instances.get(cacheKey);
    
    if (!instance) {
      // Try to get the scraper class with mode suffix first
      let ScraperClass = this.scrapers.get(key);
      
      // Fall back to without mode suffix (for backward compatibility)
      if (!ScraperClass) {
        ScraperClass = this.scrapers.get(type);
      }
      
      if (!ScraperClass) {
        throw new Error(`Scraper type "${type}" with mode "${actualMode}" not registered`);
      }
      
      // Create default config for the scraper type and mode
      const defaultConfig = this.getDefaultConfig(type, actualMode);
      const finalConfig = { ...defaultConfig, ...config };
      
      // @ts-expect-error - TypeScript doesn't understand that ScraperClass is a constructor
      instance = new ScraperClass(finalConfig);
      instance.scraperType = type;
      
      // Enable robots.txt bypass for development/testing
      // WARNING: Only use with proper authorization from website owners
      if (process.env.NODE_ENV === 'development' || process.env.BYPASS_ROBOTS_TXT === 'true') {
        instance.setBypassRobotsTxt(true);
      }
      
      this.instances.set(cacheKey, instance);
    }
    
    return instance;
  }

  /**
   * Get all registered scraper types
   */
  static getRegisteredTypes(): ScraperType[] {
    // Extract unique types without mode suffixes
    const types = new Set<ScraperType>();
    for (const key of this.scrapers.keys()) {
      const type = key.split(':')[0] as ScraperType;
      types.add(type);
    }
    return Array.from(types);
  }

  /**
   * Clear cached instances
   */
  static clearInstances(): void {
    this.instances.clear();
  }

  /**
   * Check if fast mode should be used based on environment
   */
  private static shouldUseFastMode(): boolean {
    return process.env.USE_FAST_SCRAPERS === 'true' || 
           process.env.NODE_ENV === 'production' ||
           process.env.ENABLE_FAST_MODE === 'true';
  }

  /**
   * Get default configuration for a scraper type
   * @param type The scraper type
   * @param mode The mode to use ('fast' or 'normal')
   */
  private static getDefaultConfig(type: ScraperType, mode: 'fast' | 'normal' = 'normal'): ScraperConfig {
    
    // Fast configs for optimized performance
    const fastConfigs: Record<ScraperType, ScraperConfig> = {
      'realestate': {
        name: 'Fast RealEstate.co.jp',
        baseUrl: 'https://realestate.co.jp',
        rateLimit: 50, // 50ms between requests (20 req/s)
        maxRetries: 2,
        timeout: 10000, // 10 second timeout
        headers: {
          'Accept-Language': 'en,ja;q=0.9',
        },
      },
      'yolo-japan': {
        name: 'Fast YOLO Japan',
        baseUrl: 'https://home.yolo-japan.com',
        rateLimit: 50,
        maxRetries: 2,
        timeout: 10000,
      },
      'wagaya-japan': {
        name: 'Fast Wagaya Japan',
        baseUrl: 'https://wagaya-japan.com',
        rateLimit: 50,
        maxRetries: 2,
        timeout: 10000,
      },
      'e-housing': {
        name: 'E-Housing',
        baseUrl: 'https://e-housing.jp',
        rateLimit: 500, // Slightly faster for non-fast version
        maxRetries: 2,
        timeout: 15000,
      },
      'metro-residences': {
        name: 'Metro Residences',
        baseUrl: 'https://metroresidences.com',
        rateLimit: 0, // Local data, no rate limit needed
        maxRetries: 3,
        timeout: 30000,
      },
    };
    
    // Standard configs for compatibility
    const standardConfigs: Record<ScraperType, ScraperConfig> = {
      'realestate': {
        name: 'RealEstate.co.jp',
        baseUrl: 'https://realestate.co.jp',
        rateLimit: 1000, // 1 second between requests
        maxRetries: 3,
        timeout: 30000,
        headers: {
          'Accept-Language': 'en,ja;q=0.9',
        },
      },
      'yolo-japan': {
        name: 'YOLO Japan',
        baseUrl: 'https://home.yolo-japan.com',
        rateLimit: 1000, // 1 second between requests
        maxRetries: 3,
        timeout: 30000,
      },
      'wagaya-japan': {
        name: 'Wagaya Japan',
        baseUrl: 'https://wagaya-japan.com',
        rateLimit: 1000, // 1 second between requests
        maxRetries: 3,
        timeout: 30000,
      },
      'e-housing': {
        name: 'E-Housing',
        baseUrl: 'https://e-housing.jp',
        rateLimit: 1000, // 1 second between requests
        maxRetries: 3,
        timeout: 30000,
      },
      'metro-residences': {
        name: 'Metro Residences',
        baseUrl: 'https://metroresidences.com',
        rateLimit: 0, // Local data, no rate limit needed
        maxRetries: 3,
        timeout: 30000,
      },
    };
    
    return mode === 'fast' ? fastConfigs[type] : standardConfigs[type];
  }
}