/**
 * Unified Scraper Factory
 * Creates instances of unified scrapers that support both fast and normal modes
 */

import { UnifiedRealEstateScraper } from '../../infrastructure/scrapers/implementations/realestate-unified-scraper';
import { UnifiedYoloJapanScraper } from '../../infrastructure/scrapers/implementations/yolo-unified-scraper';
import { UnifiedWagayaJapanScraper } from '../../infrastructure/scrapers/implementations/wagaya-unified-scraper';
import { UnifiedMetroResidencesScraper } from '../../infrastructure/scrapers/implementations/metro-residences-unified-scraper';
import { BaseScraper, ScraperConfig } from '../../infrastructure/scrapers/base/unified-scraper';
import type { BaseApartment } from '../../infrastructure/scrapers/base/unified-scraper';

export type UnifiedScraperType = 'realestate' | 'yolo-japan' | 'wagaya-japan' | 'metro-residences';
export type ScraperMode = 'fast' | 'normal' | 'auto';

/**
 * Factory for creating unified scrapers
 */
export class UnifiedScraperFactory {
  private static scrapers: Map<UnifiedScraperType, typeof BaseScraper> = new Map();
  private static instances: Map<string, BaseScraper<any>> = new Map();
  
  static {
    // Register all unified scrapers
    this.register('realestate', UnifiedRealEstateScraper as any);
    this.register('yolo-japan', UnifiedYoloJapanScraper as any);
    this.register('wagaya-japan', UnifiedWagayaJapanScraper as any);
    this.register('metro-residences', UnifiedMetroResidencesScraper as any);
  }
  
  /**
   * Register a scraper class
   */
  static register(type: UnifiedScraperType, scraperClass: typeof BaseScraper): void {
    this.scrapers.set(type, scraperClass);
  }
  
  /**
   * Create or get a scraper instance
   * @param type The scraper type
   * @param config Optional configuration
   * @param mode Optional mode ('fast' or 'normal'), defaults based on environment
   */
  static getScraper<T extends BaseApartment = BaseApartment>(
    type: UnifiedScraperType, 
    config?: Partial<ScraperConfig>, 
    mode?: ScraperMode
  ): BaseScraper<T> {
    return this.create<T>(type, config, mode);
  }
  
  /**
   * Create a new scraper instance (alias for getScraper)
   * @param type The scraper type
   * @param config Optional configuration
   * @param mode Optional mode ('fast' or 'normal'), defaults based on environment
   */
  static create<T extends BaseApartment = BaseApartment>(
    type: UnifiedScraperType, 
    config?: Partial<ScraperConfig>, 
    mode?: ScraperMode
  ): BaseScraper<T> {
    // Determine the actual mode to use
    let actualMode: 'fast' | 'normal' = 'normal';
    
    if (mode === 'fast' || mode === 'normal') {
      actualMode = mode;
    } else if (mode === 'auto' || !mode) {
      // Auto-detect based on environment
      actualMode = this.shouldUseFastMode() ? 'fast' : 'normal';
    }
    
    // Build cache key
    const cacheKey = `${type}:${actualMode}:${JSON.stringify(config || {})}`;
    
    // Check if we have a cached instance
    let instance = this.instances.get(cacheKey);
    
    if (!instance) {
      // Get the scraper class
      const ScraperClass = this.scrapers.get(type);
      
      if (!ScraperClass) {
        throw new Error(`Scraper type "${type}" not registered`);
      }
      
      // Create instance with mode configuration
      const scraperConfig: Partial<ScraperConfig> = {
        mode: actualMode,
        ...config
      };
      
      // @ts-expect-error - TypeScript doesn't understand that ScraperClass is a constructor
      instance = new ScraperClass(scraperConfig);
      
      // Cache the instance
      this.instances.set(cacheKey, instance);
    }
    
    return instance as BaseScraper<T>;
  }
  
  /**
   * Get all registered scraper types
   */
  static getRegisteredTypes(): UnifiedScraperType[] {
    return Array.from(this.scrapers.keys());
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
}