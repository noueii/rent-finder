/**
 * Export unified scrapers from the infrastructure directory
 */

// Import unified scrapers from infrastructure
import { UnifiedRealEstateScraper } from '~/infrastructure/scrapers/implementations/realestate-unified-scraper';
import { UnifiedYoloJapanScraper } from '~/infrastructure/scrapers/implementations/yolo-unified-scraper';
import { UnifiedWagayaJapanScraper } from '~/infrastructure/scrapers/implementations/wagaya-unified-scraper';
import { UnifiedMetroResidencesScraper } from '~/infrastructure/scrapers/implementations/metro-residences-unified-scraper';
import { EHousingScraper } from './ehousing-scraper';

// Import the unified factory
import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';

// Register all scrapers with the factory
// The unified scrapers handle both fast and normal modes internally
UnifiedScraperFactory.register('realestate', UnifiedRealEstateScraper as any);
UnifiedScraperFactory.register('yolo-japan', UnifiedYoloJapanScraper as any);
UnifiedScraperFactory.register('wagaya-japan', UnifiedWagayaJapanScraper as any);
UnifiedScraperFactory.register('metro-residences', UnifiedMetroResidencesScraper as any);
UnifiedScraperFactory.register('e-housing', EHousingScraper);

// Re-export the scrapers for direct import if needed
export {
  UnifiedRealEstateScraper,
  UnifiedYoloJapanScraper,
  UnifiedWagayaJapanScraper,
  UnifiedMetroResidencesScraper,
  EHousingScraper,
};