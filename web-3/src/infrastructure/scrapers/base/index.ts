/**
 * Base scraper exports
 */

export * from './unified-scraper';

// Re-export commonly used types
export type {
  ScraperConfig,
  ScrapeParams,
  BaseApartment,
  StationInfo,
  Coordinates,
  ScraperResult,
  ScraperStats,
  ScraperSelectors
} from './unified-scraper';

// Re-export error types
export { ScraperError, ERROR_CODES } from './unified-scraper';

// Re-export utility classes
export { ProgressTracker } from './unified-scraper';

// Re-export default configurations
export { SCRAPER_CONFIGS } from './unified-scraper';