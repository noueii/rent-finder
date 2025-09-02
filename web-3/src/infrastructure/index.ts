/**
 * Infrastructure Layer
 * 
 * This layer contains all external dependencies and infrastructure concerns
 * such as database access, external APIs, and file system operations.
 * 
 * Owner: SC (Scraper Agent) and IN (Integration Agent)
 */

// Database infrastructure
export * from './database';

// Scraper infrastructure
export * from './scrapers/base';

// Export specific scraper implementations
export { HomesScraper } from './scrapers/implementations/homes-scraper';

// Infrastructure exports will be added by SC and IN agents