// Base classes
export { BaseScraper } from './base-scraper';
export { ApartmentScraper } from './apartment-scraper';
export { GeocodingEnhancedScraper } from './geocoding-enhanced-scraper';

// Utilities
export { ProxyManager } from './proxy-manager';
export { RateLimiter, TokenBucketRateLimiter } from './rate-limiter';
export { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
export { ScraperErrorHandler } from './error-handler';

// Validation
export {
  validateApartmentData,
  sanitizeApartmentData,
  mergeApartmentData,
  isCompleteApartmentData,
  calculateDataQuality,
  apartmentSchema,
  imageSchema,
  stationSchema,
} from './validation';

// Re-export types
export type { ProxyStats } from './proxy-manager';
export type { RateLimiterConfig } from './rate-limiter';
export type { ScraperType } from '~/lib/scrapers/unified-scraper-factory';

// Import and register all scraper implementations
import './sources';