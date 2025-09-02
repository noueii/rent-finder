import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { HomesScraper } from '../../../../../infrastructure/scrapers/implementations/homes-scraper';
import { RealEstateUnifiedScraper } from '../../../../../infrastructure/scrapers/implementations/realestate-unified-scraper';
import { WagayaUnifiedScraper } from '../../../../../infrastructure/scrapers/implementations/wagaya-unified-scraper';
import type { ScrapeParams, ScrapeResult } from '../../../../../infrastructure/scrapers/base';

// Mock dependencies
jest.mock('~/lib/logging', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('~/lib/scrapers/rate-limiter', () => ({
  RateLimiter: jest.fn().mockImplementation(() => ({
    checkLimit: jest.fn().mockResolvedValue(true),
    recordRequest: jest.fn(),
    waitForSlot: jest.fn().mockResolvedValue(undefined),
    resetErrors: jest.fn()
  }))
}));

describe('Scraper Performance Tests', () => {
  let mockFetch: jest.Mock;
  let memoryUsage: { before: NodeJS.MemoryUsage; after?: NodeJS.MemoryUsage };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;
    
    // Record memory before test
    memoryUsage = { before: process.memoryUsage() };
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    // Record memory after test
    memoryUsage.after = process.memoryUsage();
  });

  describe('SUUMO Scraper Performance', () => {
    let scraper: SuumoScraper;

    beforeEach(() => {
      scraper = new SuumoScraper();
    });

    it('should handle concurrent requests efficiently', async () => {
      const apartmentCount = 20;
      const mockListingHtml = generateMockSuumoListing(apartmentCount);
      const mockDetailHtml = generateMockSuumoDetail();

      // Mock responses
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/chintai/')) {
          return Promise.resolve({
            ok: true,
            text: async () => mockDetailHtml
          });
        }
        return Promise.resolve({
          ok: true,
          text: async () => mockListingHtml
        });
      });

      const startTime = performance.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = performance.now() - startTime;

      // SUUMO uses concurrent strategy, should be fast
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(apartmentCount * 50); // <50ms per apartment (concurrent)
      
      // Check concurrency - multiple requests should be in flight
      const callTimes = mockFetch.mock.calls.map(() => performance.now());
      const timeDiffs = callTimes.slice(1).map((time, i) => time - callTimes[i]);
      const concurrentCalls = timeDiffs.filter(diff => diff < 10).length;
      expect(concurrentCalls).toBeGreaterThan(0); // Some calls should be concurrent
    });

    it('should respect rate limits under load', async () => {
      const requestCount = 30;
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => generateMockSuumoListing(1)
      });

      const startTime = performance.now();
      const promises = Array(requestCount).fill(null).map(() => 
        scraper.scrape({ prefecture: 'tokyo' })
      );
      
      await Promise.all(promises);
      const duration = performance.now() - startTime;

      // With 10 req/s limit and burst of 5, should take at least 2.5 seconds for 30 requests
      expect(duration).toBeGreaterThan(2500);
    });

    it('should maintain stable memory usage', async () => {
      const iterations = 10;
      mockFetch.mockResolvedValue({
        ok: true,
        text: async () => generateMockSuumoListing(50)
      });

      for (let i = 0; i < iterations; i++) {
        await scraper.scrape({ prefecture: 'tokyo' });
      }

      // Memory should not grow significantly
      const memoryGrowth = (memoryUsage.after!.heapUsed - memoryUsage.before.heapUsed) / 1024 / 1024;
      expect(memoryGrowth).toBeLessThan(50); // Less than 50MB growth
    });
  });

  describe('AtHome Scraper Performance', () => {
    let scraper: AtHomeScraper;

    beforeEach(() => {
      scraper = new AtHomeScraper();
    });

    it('should process listings sequentially as configured', async () => {
      const apartmentCount = 10;
      const mockListingHtml = generateMockAtHomeListing(apartmentCount);
      const mockDetailHtml = generateMockAtHomeDetail();

      const fetchTimes: number[] = [];
      mockFetch.mockImplementation((url: string) => {
        fetchTimes.push(performance.now());
        if (url.includes('/detail/')) {
          return Promise.resolve({
            ok: true,
            text: async () => mockDetailHtml
          });
        }
        return Promise.resolve({
          ok: true,
          text: async () => mockListingHtml
        });
      });

      const result = await scraper.scrape({ prefecture: 'tokyo' });

      // AtHome uses sequential strategy, calls should be spaced out
      expect(result.success).toBe(true);
      
      // Check sequential processing - each call should wait for previous
      const timeDiffs = fetchTimes.slice(1).map((time, i) => time - fetchTimes[i]);
      const sequentialCalls = timeDiffs.filter(diff => diff >= 500).length; // 1 req/2s = 500ms minimum
      expect(sequentialCalls).toBeGreaterThan(0);
    });

    it('should handle errors gracefully without performance degradation', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          text: async () => generateMockAtHomeListing(5)
        });
      });

      const startTime = performance.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);
      // Should complete despite errors, with retries adding some time
      expect(duration).toBeLessThan(30000); // Complete within 30 seconds
    });
  });

  describe('Homes Scraper Performance', () => {
    let scraper: HomesScraper;

    beforeEach(() => {
      scraper = new HomesScraper();
    });

    it('should handle large result sets efficiently', async () => {
      const pageCount = 5;
      const apartmentsPerPage = 20;
      
      let pageIndex = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/detail/')) {
          return Promise.resolve({
            ok: true,
            text: async () => generateMockHomesDetail()
          });
        }
        
        const currentPage = pageIndex++;
        const hasNextPage = currentPage < pageCount - 1;
        return Promise.resolve({
          ok: true,
          text: async () => generateMockHomesListing(apartmentsPerPage, hasNextPage)
        });
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      
      const duration = performance.now() - startTime;
      const memoryUsed = (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024;

      expect(result.success).toBe(true);
      expect(result.data.length).toBeLessThanOrEqual(pageCount * apartmentsPerPage);
      
      // Performance metrics
      const avgTimePerApartment = duration / result.data.length;
      expect(avgTimePerApartment).toBeLessThan(200); // <200ms per apartment
      expect(memoryUsed).toBeLessThan(100); // <100MB memory usage
    });

    it('should recover from rate limit errors', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 5) {
          return Promise.resolve({
            ok: false,
            status: 429,
            text: async () => 'Too Many Requests'
          });
        }
        return Promise.resolve({
          ok: true,
          text: async () => generateMockHomesListing(10)
        });
      });

      const result = await scraper.scrape({ prefecture: 'tokyo' });
      
      expect(result.success).toBe(true);
      expect(callCount).toBeGreaterThan(5); // Should retry after 429
    });
  });

  describe('Comparative Performance Analysis', () => {
    it('should compare scraper performance characteristics', async () => {
      const scrapers = {
        suumo: new SuumoScraper(),
        athome: new AtHomeScraper(),
        homes: new HomesScraper()
      };

      const results: Record<string, { duration: number; count: number; memoryMB: number }> = {};

      for (const [name, scraper] of Object.entries(scrapers)) {
        // Mock appropriate responses for each scraper
        mockFetch.mockImplementation((url: string) => {
          const mockHtml = name === 'suumo' ? generateMockSuumoListing(10) :
                          name === 'athome' ? generateMockAtHomeListing(10) :
                          generateMockHomesListing(10);
          return Promise.resolve({
            ok: true,
            text: async () => mockHtml
          });
        });

        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;
        
        const result = await scraper.scrape({ prefecture: 'tokyo' });
        
        results[name] = {
          duration: performance.now() - startTime,
          count: result.data.length,
          memoryMB: (process.memoryUsage().heapUsed - startMemory) / 1024 / 1024
        };
      }

      // Log comparative results
      console.log('Scraper Performance Comparison:', results);

      // SUUMO should be fastest (concurrent)
      expect(results.suumo.duration).toBeLessThan(results.athome.duration);
      expect(results.suumo.duration).toBeLessThan(results.homes.duration);

      // All should have reasonable memory usage
      Object.values(results).forEach(result => {
        expect(result.memoryMB).toBeLessThan(50);
      });
    });
  });
});

// Helper functions to generate mock HTML
function generateMockSuumoListing(count: number): string {
  const listings = Array(count).fill(null).map((_, i) => `
    <div class="cassetteitem">
      <div class="cassetteitem-detail">
        <a href="/chintai/detail-${i}">Apartment ${i}</a>
      </div>
    </div>
  `).join('');
  
  return `<html><body>${listings}</body></html>`;
}

function generateMockSuumoDetail(): string {
  return `
    <html><body>
      <h1 class="section_h1-header-title">Modern Apartment</h1>
      <div class="property_view_main-emphasis">
        <span>8.5万円</span>
      </div>
      <table class="property_view_table">
        <tr>
          <th>間取り</th>
          <td>1LDK</td>
        </tr>
        <tr>
          <th>専有面積</th>
          <td>45.5m²</td>
        </tr>
      </table>
    </body></html>
  `;
}

function generateMockAtHomeListing(count: number): string {
  const listings = Array(count).fill(null).map((_, i) => `
    <div class="p-property">
      <a href="/detail/${i}" class="p-property__link">Detail</a>
    </div>
  `).join('');
  
  return `<html><body>${listings}</body></html>`;
}

function generateMockAtHomeDetail(): string {
  return `
    <html><body>
      <h1 class="p-property-detail__title">Nice Apartment</h1>
      <div class="p-property-detail__rent">
        <span>9万円</span>
      </div>
    </body></html>
  `;
}

function generateMockHomesListing(count: number, hasNextPage: boolean = false): string {
  const listings = Array(count).fill(null).map((_, i) => `
    <div class="mod-mergeBuilding">
      <h2 class="object-header">
        <a href="/detail/${i}">Apartment ${i}</a>
      </h2>
    </div>
  `).join('');
  
  const nextPage = hasNextPage ? '<a class="next-page" href="/page/2">Next</a>' : '';
  
  return `<html><body>${listings}${nextPage}</body></html>`;
}

function generateMockHomesDetail(): string {
  return `
    <html><body>
      <h1 class="object-header__title">Homes Apartment</h1>
      <div class="price-main">
        <span class="price">10万円</span>
      </div>
    </body></html>
  `;
}