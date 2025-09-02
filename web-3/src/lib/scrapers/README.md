# Scraper Infrastructure

This directory contains the base infrastructure for web scraping apartment listings.

## Architecture

### Base Classes

1. **BaseScraper** - Core scraping functionality
   - Rate limiting
   - Proxy rotation
   - Error handling and retry logic
   - Request queuing
   - robots.txt checking

2. **ApartmentScraper** - Apartment-specific scraping
   - Search functionality
   - Data extraction patterns
   - Validation
   - Progress tracking

### Utilities

1. **ProxyManager** - Manage proxy rotation
   - Health checking
   - Load balancing
   - Statistics tracking

2. **RateLimiter** - Control request rates
   - Window-based limiting
   - Token bucket algorithm
   - Exponential backoff

3. **ScraperFactory** - Create scraper instances
   - Centralized configuration
   - Instance caching

4. **Validation** - Data validation and sanitization
   - Zod schemas
   - Data quality scoring
   - Sanitization utilities

5. **ErrorHandler** - Specialized error handling
   - Error categorization
   - Retry strategies
   - Circuit breaking

## Usage

### Creating a New Scraper

```typescript
import { ApartmentScraper } from '@/lib/scrapers';
import type { CheerioAPI } from 'cheerio';
import type { ScrapedApartmentData, ScraperSearchParams } from '@/types/scraper';

export class MySiteScraper extends ApartmentScraper {
  getName(): string {
    return 'My Site Scraper';
  }

  protected async buildSearchUrls(params: ScraperSearchParams): Promise<string[]> {
    // Build search URLs based on parameters
    return [`${this.config.baseUrl}/search?...`];
  }

  protected async scrapeSearchPage(
    url: string,
    params: ScraperSearchParams
  ): Promise<string[]> {
    // Extract listing URLs from search page
    const result = await this.fetchAndParse(url);
    // ... extract URLs
    return listingUrls;
  }

  protected async extractApartmentData(
    $: CheerioAPI,
    url: string
  ): Promise<ScrapedApartmentData | null> {
    // Extract apartment data from listing page
    // Use helper methods like:
    // - this.cleanText()
    // - this.extractPrice()
    // - this.extractNumber()
    // - this.parseWalkingMinutes()
    return apartmentData;
  }
}
```

### Using the Scraper

```typescript
import { ScraperFactory } from '@/lib/scrapers';

// Register your scraper
ScraperFactory.register('my-site', MySiteScraper);

// Get scraper instance
const scraper = ScraperFactory.getScraper('my-site', {
  rateLimit: 2000, // 2 seconds between requests
  maxRetries: 3,
  timeout: 30000,
});

// Search for apartments
const result = await scraper.search({
  minPrice: 50000,
  maxPrice: 150000,
  minSize: 20,
  limit: 50,
}, (progress) => {
  console.log(`Progress: ${progress.completed}/${progress.total}`);
});

if (result.success) {
  console.log(`Found ${result.data.length} apartments`);
}
```

### With Proxy Support

```typescript
import { ProxyManager } from '@/lib/scrapers';

const proxyManager = new ProxyManager([
  { host: 'proxy1.example.com', port: 8080 },
  { host: 'proxy2.example.com', port: 8080 },
]);

const scraper = ScraperFactory.getScraper('my-site', {
  proxies: proxyManager.getHealthyProxies(),
});
```

### Rate Limiting

```typescript
import { RateLimiter } from '@/lib/scrapers';

const rateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000, // 10 requests per minute
  minDelayMs: 1000, // At least 1 second between requests
});

// In your scraper
await rateLimiter.waitForSlot();
// Make request
rateLimiter.recordRequest();
```

## Best Practices

1. **Respect robots.txt** - The base scraper checks robots.txt automatically
2. **Use appropriate rate limits** - Don't overwhelm target servers
3. **Handle errors gracefully** - Use the error handler for retry logic
4. **Validate scraped data** - Use the validation utilities
5. **Monitor scraper health** - Track success/failure rates
6. **Use proxies responsibly** - Only when necessary and allowed

## Adding New Scrapers

1. Create a new file in `scrapers/sites/[site-name].ts`
2. Extend `ApartmentScraper`
3. Implement the required abstract methods
4. Register with `ScraperFactory`
5. Add to the scraper configuration in the database

## Testing

```typescript
// Test a scraper
const scraper = new MySiteScraper({
  name: 'Test',
  baseUrl: 'https://example.com',
  rateLimit: 1000,
  maxRetries: 1,
  timeout: 10000,
});

// Test single apartment
const apartment = await scraper.scrapeApartment('https://example.com/property/123');

// Validate the data
const validation = validateApartmentData(apartment);
if (!validation.success) {
  console.error('Validation errors:', validation.errors);
}
```