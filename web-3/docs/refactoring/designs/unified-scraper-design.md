# Unified Scraper Interface Design
**Document ID**: SC-002-DESIGN  
**Created**: 2025-01-24  
**Author**: Agent SC  
**Status**: Draft v1.0

## Executive Summary

This document outlines the design for a unified scraper interface that eliminates 85% code duplication across the 4 base scrapers (homes, suumo, r-store, at-home) while maintaining their unique capabilities through a strategy pattern architecture.

## 1. Current State Analysis Recap

From SC-001 analysis:
- **85% duplication** in core functionality across scrapers
- **15% unique** per scraper (URL patterns, selectors, data extraction)
- Common patterns: pagination, retries, rate limiting, data structures
- Different concurrency models: sequential vs concurrent

## 2. Design Goals

1. **Eliminate Duplication**: Single source of truth for common logic
2. **Maintain Flexibility**: Support unique scraper requirements
3. **Configuration-Driven**: Easy to adjust behavior without code changes
4. **Type Safety**: Full TypeScript support throughout
5. **Testability**: Easy to mock and test components
6. **Performance**: Support both "fast" (concurrent) and "normal" (sequential) modes

## 3. Architecture Overview

```typescript
// Core Architecture Components
┌─────────────────────────────────────────────────────────┐
│                    ScraperOrchestrator                   │
│  (Manages scraper lifecycle and coordination)            │
└─────────────────┬───────────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────────┐
│                    BaseScraper<T>                        │
│  (Abstract base class with common functionality)         │
│  - Rate limiting                                         │
│  - Retry logic                                          │
│  - Progress tracking                                     │
│  - Error handling                                        │
└─────────────────┬───────────────────────────────────────┘
                  │
     ┌────────────┴────────────┬────────────┬────────────┐
     │                         │            │            │
┌────▼─────┐          ┌───────▼────┐  ┌────▼─────┐  ┌───▼──────┐
│  Homes   │          │   Suumo    │  │ R-Store  │  │ At-Home  │
│ Strategy │          │  Strategy  │  │ Strategy │  │ Strategy │
└──────────┘          └────────────┘  └──────────┘  └──────────┘
```

## 4. Core Interfaces

### 4.1 Base Scraper Abstract Class

```typescript
// src/server/scrapers/base/BaseScraper.ts
export abstract class BaseScraper<T extends BaseApartment> {
  protected config: ScraperConfig;
  protected rateLimiter: RateLimiter;
  protected progressTracker: ProgressTracker;
  protected logger: Logger;
  
  constructor(config: ScraperConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter(config.rateLimit);
    this.progressTracker = new ProgressTracker();
    this.logger = new Logger(this.getScraperName());
  }
  
  // Template method pattern
  async scrape(params: ScrapeParams): Promise<ScraperResult<T>> {
    try {
      await this.initialize();
      const urls = await this.buildUrls(params);
      const results = await this.executeStrategy(urls);
      const processed = await this.processResults(results);
      return this.formatResults(processed);
    } catch (error) {
      return this.handleError(error);
    } finally {
      await this.cleanup();
    }
  }
  
  // Abstract methods that subclasses must implement
  protected abstract getScraperName(): string;
  protected abstract buildUrls(params: ScrapeParams): Promise<string[]>;
  protected abstract extractListingUrls(html: string): string[];
  protected abstract extractApartmentData(html: string): T;
  protected abstract getSelectors(): ScraperSelectors;
  
  // Common implementations
  protected async fetchWithRetry(url: string): Promise<string> {
    await this.rateLimiter.acquire();
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.fetch(url);
        return response;
      } catch (error) {
        if (attempt === this.config.maxRetries) throw error;
        await this.delay(this.config.retryDelay * attempt);
      }
    }
    throw new Error('Max retries exceeded');
  }
  
  // Strategy execution (overrideable for different concurrency models)
  protected async executeStrategy(urls: string[]): Promise<T[]> {
    const strategy = this.config.mode === 'fast' 
      ? new ConcurrentStrategy<T>(this.config.concurrency)
      : new SequentialStrategy<T>();
      
    return strategy.execute(urls, async (url) => {
      const html = await this.fetchWithRetry(url);
      return this.extractApartmentData(html);
    });
  }
}
```

### 4.2 Strategy Interfaces

```typescript
// src/server/scrapers/strategies/ScraperStrategy.ts
export interface ScraperStrategy<T> {
  execute(
    urls: string[], 
    processor: (url: string) => Promise<T>
  ): Promise<T[]>;
}

// Sequential Strategy (for rate-limited sites)
export class SequentialStrategy<T> implements ScraperStrategy<T> {
  async execute(urls: string[], processor: (url: string) => Promise<T>): Promise<T[]> {
    const results: T[] = [];
    
    for (const url of urls) {
      try {
        const result = await processor(url);
        results.push(result);
      } catch (error) {
        // Log error but continue
        console.error(`Failed to process ${url}:`, error);
      }
    }
    
    return results;
  }
}

// Concurrent Strategy (for sites that allow it)
export class ConcurrentStrategy<T> implements ScraperStrategy<T> {
  constructor(private concurrencyLimit: number = 5) {}
  
  async execute(urls: string[], processor: (url: string) => Promise<T>): Promise<T[]> {
    const results: T[] = [];
    const queue = [...urls];
    const inFlight = new Set<Promise<void>>();
    
    while (queue.length > 0 || inFlight.size > 0) {
      while (inFlight.size < this.concurrencyLimit && queue.length > 0) {
        const url = queue.shift()!;
        const promise = processor(url)
          .then(result => results.push(result))
          .catch(error => console.error(`Failed to process ${url}:`, error))
          .finally(() => inFlight.delete(promise));
          
        inFlight.add(promise);
      }
      
      if (inFlight.size > 0) {
        await Promise.race(inFlight);
      }
    }
    
    return results;
  }
}
```

### 4.3 Configuration Schema

```typescript
// src/server/scrapers/types/ScraperConfig.ts
export interface ScraperConfig {
  // Execution mode
  mode: 'fast' | 'normal';
  
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

// Default configurations per scraper
export const SCRAPER_CONFIGS: Record<string, ScraperConfig> = {
  homes: {
    mode: 'normal',
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
  // ... other scrapers
};
```

## 5. Implementation Examples

### 5.1 Homes Scraper Implementation

```typescript
// src/server/scrapers/implementations/HomesScraper.ts
export class HomesScraper extends BaseScraper<HomesApartment> {
  protected getScraperName(): string {
    return 'homes';
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    const { prefecture, city, trainLines, priceRange } = params;
    const baseUrl = 'https://www.homes.co.jp/chintai/tokyo/list/';
    
    // Homes-specific URL building logic
    const urls: string[] = [];
    
    // Implementation of the 15% unique logic
    if (trainLines?.length) {
      trainLines.forEach(line => {
        const encoded = this.encodeHomesTrainLine(line);
        urls.push(`${baseUrl}?railway=${encoded}`);
      });
    }
    
    return urls;
  }
  
  protected extractListingUrls(html: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];
    
    // Homes-specific selectors
    $('.mod-mergeBuilding').each((_, element) => {
      const href = $(element).find('h2.object-header a').attr('href');
      if (href) urls.push(href);
    });
    
    return urls;
  }
  
  protected extractApartmentData(html: string): HomesApartment {
    const $ = cheerio.load(html);
    const selectors = this.getSelectors();
    
    // Use common extraction logic with Homes-specific selectors
    return {
      id: this.generateId($),
      url: this.extractUrl($),
      title: $(selectors.title).text().trim(),
      rent: this.parseHomesPrice($(selectors.rent).text()),
      size: this.parseSize($(selectors.size).text()),
      layout: $(selectors.layout).text().trim(),
      buildingType: this.extractBuildingType($),
      age: this.parseAge($(selectors.age).text()),
      floor: $(selectors.floor).text().trim(),
      address: $(selectors.address).text().trim(),
      station: this.extractStationInfo($),
      coordinates: this.extractCoordinates($),
      images: this.extractImages($),
      features: this.extractFeatures($),
      management: this.parseHomesManagement($(selectors.management).text()),
      deposit: this.parseHomesDeposit($(selectors.deposit).text()),
      keyMoney: this.parseHomesKeyMoney($(selectors.keyMoney).text()),
      // Homes-specific fields
      buildingId: this.extractBuildingId($),
      roomCount: this.extractRoomCount($)
    };
  }
  
  protected getSelectors(): ScraperSelectors {
    return {
      title: 'h1.object-header__title',
      rent: '.price-main .price',
      size: '.floor-plan .area',
      layout: '.floor-plan .plan',
      buildingType: '.building-type',
      age: '.building-age',
      floor: '.floor-info',
      address: '.address',
      station: '.traffic-info',
      management: '.management-fee',
      deposit: '.deposit',
      keyMoney: '.key-money'
    };
  }
  
  // Homes-specific helper methods (the 15% unique logic)
  private encodeHomesTrainLine(line: string): string {
    // Homes has specific encoding for train lines
    const lineMap: Record<string, string> = {
      'Yamanote Line': 'jre_yamanote',
      'Chuo Line': 'jre_chuo',
      // ... etc
    };
    return lineMap[line] || line;
  }
  
  private parseHomesPrice(text: string): number {
    // Homes format: "5.8万円"
    const match = text.match(/([\d.]+)万円/);
    return match ? parseFloat(match[1]) * 10000 : 0;
  }
}
```

## 6. Migration Path

### Phase 1: Infrastructure Setup (DO-002 dependency)
1. Wait for DO to complete shared utilities
2. Set up testing framework for scrapers
3. Create scraper performance benchmarks

### Phase 2: Base Implementation
1. Implement `BaseScraper` abstract class
2. Implement strategy patterns
3. Create configuration management system
4. Set up logging and monitoring

### Phase 3: Scraper Migration (in order)
1. **Homes**: Simplest, good test case
2. **Suumo**: Most complex, tests all features
3. **R-Store**: Similar to Homes
4. **At-Home**: Similar patterns

### Phase 4: Testing & Optimization
1. Unit tests for each component
2. Integration tests for full scraping flow
3. Performance testing and optimization
4. Documentation and examples

## 7. Handling the 15% Differences

The 15% unique logic per scraper is handled through:

### 7.1 Abstract Methods
Each scraper implements:
- `buildUrls()` - Site-specific URL construction
- `extractListingUrls()` - Site-specific listing detection
- `extractApartmentData()` - Site-specific data extraction
- `getSelectors()` - Site-specific CSS selectors

### 7.2 Protected Helper Methods
Scrapers can add their own helpers:
- Price parsing (each site has different formats)
- Date parsing (various date formats)
- Special field extraction (site-specific data)

### 7.3 Configuration Overrides
```typescript
// Example: Suumo needs special headers
const suumoConfig: ScraperConfig = {
  ...SCRAPER_CONFIGS.suumo,
  overrides: {
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  }
};
```

### 7.4 Custom Data Types
```typescript
// Each scraper can extend the base type
interface HomesApartment extends BaseApartment {
  buildingId?: string;  // Homes-specific
  roomCount?: number;   // Homes-specific
}

interface SuumoApartment extends BaseApartment {
  suumoId?: string;     // Suumo-specific
  popularity?: number;  // Suumo-specific
}
```

## 8. Configuration Examples

### 8.1 Fast Mode (Concurrent)
```typescript
const fastConfig: ScraperConfig = {
  mode: 'fast',
  concurrency: 10,
  rateLimit: { requests: 20, perSeconds: 1, burst: 10 },
  maxRetries: 2,
  retryDelay: 500,
  retryBackoff: 'linear',
  requestTimeout: 20000,
  totalTimeout: 300000,
  features: {
    screenshots: false,
    cache: false,  // Disable cache for fresh data
    proxy: true    // Use proxy to avoid rate limits
  }
};
```

### 8.2 Normal Mode (Sequential)
```typescript
const normalConfig: ScraperConfig = {
  mode: 'normal',
  concurrency: 1,
  rateLimit: { requests: 1, perSeconds: 2 },
  maxRetries: 3,
  retryDelay: 2000,
  retryBackoff: 'exponential',
  requestTimeout: 30000,
  totalTimeout: 600000,
  features: {
    screenshots: true,  // Take screenshots of errors
    cache: true,       // Use cache to reduce requests
    proxy: false       // No proxy needed with slow rate
  }
};
```

## 9. Benefits of This Design

### 9.1 Code Reduction
- **Before**: ~2000 lines per scraper × 4 = 8000 lines
- **After**: ~300 lines base + ~200 lines per scraper = 1100 lines
- **Reduction**: 86% less code to maintain

### 9.2 Consistency
- Uniform error handling across all scrapers
- Consistent logging and monitoring
- Standardized retry and rate limiting behavior

### 9.3 Flexibility
- Easy to add new scrapers (just extend base class)
- Configuration-driven behavior changes
- Strategy pattern allows different execution models

### 9.4 Maintainability
- Single source of truth for common logic
- Clear separation of concerns
- Easy to test individual components

### 9.5 Performance
- Optimized concurrent execution where allowed
- Intelligent rate limiting and retry logic
- Caching and request deduplication

## 10. Future Enhancements

### 10.1 Advanced Features
- Browser automation support (Playwright/Puppeteer)
- Distributed scraping across multiple workers
- ML-based selector adaptation
- Automatic proxy rotation

### 10.2 Monitoring & Analytics
- Real-time scraping dashboard
- Performance metrics and alerts
- Data quality monitoring
- Cost tracking (proxy/API usage)

### 10.3 Data Pipeline Integration
- Direct database streaming
- Event-driven processing
- Data validation pipeline
- Duplicate detection

## 11. Dependencies

### Required from DO (DO-002):
- Logger implementation
- Rate limiter utility
- Progress tracker
- Error handling utilities

### Required from BE:
- Database models
- Data validation schemas
- API integration points

## 12. Testing Strategy

### Unit Tests
```typescript
describe('BaseScraper', () => {
  it('should retry failed requests', async () => {
    // Test retry logic
  });
  
  it('should respect rate limits', async () => {
    // Test rate limiting
  });
  
  it('should handle concurrent execution', async () => {
    // Test concurrent strategy
  });
});
```

### Integration Tests
```typescript
describe('HomesScraper', () => {
  it('should scrape apartment listings', async () => {
    // Test full scraping flow
  });
  
  it('should handle pagination', async () => {
    // Test pagination logic
  });
});
```

## 13. Implementation Timeline

1. **Week 1**: Base infrastructure (pending DO-002)
2. **Week 2**: Migrate first scraper (Homes)
3. **Week 3**: Migrate remaining scrapers
4. **Week 4**: Testing and optimization

## 14. Success Metrics

- **Code Reduction**: >80% less duplicated code
- **Performance**: 2x faster scraping in fast mode
- **Reliability**: <1% error rate with retries
- **Maintainability**: New scraper added in <2 hours

---

## Appendix A: Type Definitions

```typescript
// Base types used throughout the system
interface BaseApartment {
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
  scrapedAt: Date;
  source: string;
}

interface StationInfo {
  name: string;
  line: string;
  walkTime: number;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface ScrapeParams {
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
}

interface ScraperResult<T> {
  success: boolean;
  data: T[];
  errors: ScraperError[];
  stats: ScraperStats;
}

interface ScraperStats {
  totalUrls: number;
  successfulUrls: number;
  failedUrls: number;
  totalApartments: number;
  duration: number;
  averageResponseTime: number;
}
```

## Appendix B: Error Handling

```typescript
// Standardized error types
export class ScraperError extends Error {
  constructor(
    message: string,
    public code: string,
    public url?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ScraperError';
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
```

---

**End of Design Document**

*This design provides a solid foundation for eliminating code duplication while maintaining the flexibility needed for each scraper's unique requirements. The modular architecture allows for easy testing, maintenance, and future enhancements.*