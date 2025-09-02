/**
 * Integration Tests for Unified Scrapers
 * Tests the complete scraper system including all components working together
 */


import { UnifiedRealEstateScraper } from '../implementations/realestate-unified-scraper';
import { UnifiedProxyManager } from '../proxy/UnifiedProxyManager';
import { createStrategy } from '../strategies';
import type { ScrapeParams, ScraperConfig } from '../base/unified-scraper';

// Mock external dependencies
jest.mock('~/lib/logging', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

// Real rate limiter for integration tests
jest.mock('~/lib/scrapers/rate-limiter', async () => {
  const actual = await jest.importActual('~/lib/scrapers/rate-limiter');
  return actual;
});

describe('Scraper Integration Tests', () => {
  let scraper: UnifiedRealEstateScraper;
  
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    if (scraper) {
      scraper.stop();
    }
  });
  
  describe('Complete Scraping Flow', () => {
    it('should handle full scraping cycle with all components', async () => {
      // Configure scraper with all features
      const config: ScraperConfig = {
        mode: 'fast',
        strategy: 'concurrent',
        strategyConfig: {
          rampUpDelay: 100
        },
        rateLimit: {
          requests: 5,
          perSeconds: 1,
          burst: 3
        },
        maxRetries: 2,
        retryDelay: 100,
        retryBackoff: 'exponential',
        concurrency: 3,
        requestTimeout: 5000,
        totalTimeout: 60000,
        features: {
          screenshots: false,
          cache: true,
          proxy: false
        }
      };
      
      scraper = new UnifiedRealEstateScraper(config);
      
      // Mock search results
      const searchHtml = `
        <div class="search-results">
          ${Array(10).fill(0).map((_, i) => 
            `<a href="/apartment/${i + 1}" class="listing-link">Apartment ${i + 1}</a>`
          ).join('')}
        </div>
      `;
      
      // Mock apartment details
      const detailHtml = (id: number) => `
        <div class="listing">
          <h2>Apartment ${id}</h2>
          <div class="price">¥${80000 + id * 10000}</div>
          <div class="size">${25 + id}m²</div>
          <div class="layout">${id % 2 === 0 ? '1K' : '1LDK'}</div>
          <div class="station">Shibuya Station ${5 + id} min walk</div>
          <div class="address">東京都渋谷区道玄坂${id}-1-1</div>
        </div>
      `;
      
      let fetchCount = 0;
      (global.fetch as any).mockImplementation(async (url: string) => {
        fetchCount++;
        
        // Simulate some failures for retry testing
        if (fetchCount === 3 || fetchCount === 7) {
          throw new Error('Network error');
        }
        
        if (url.includes('search')) {
          return { ok: true, text: async () => searchHtml };
        } else {
          const id = parseInt(url.match(/apartment\/(\d+)/)?.[1] || '1');
          return { ok: true, text: async () => detailHtml(id) };
        }
      });
      
      // Override buildUrls to return search URL
      scraper['buildUrls'] = async () => ['http://test.com/search'];
      
      const params: ScrapeParams = {
        prefecture: 'tokyo',
        city: 'shibuya',
        priceRange: { min: 50000, max: 200000 }
      };
      
      const result = await scraper.scrape(params);
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.length).toBeLessThanOrEqual(10);
      
      // Verify data extraction
      const firstApartment = result.data[0];
      expect(firstApartment.title).toContain('Apartment');
      expect(firstApartment.rent).toBeGreaterThan(0);
      expect(firstApartment.size).toBeGreaterThan(0);
      expect(firstApartment.station.walkTime).toBeGreaterThan(0);
      
      // Verify stats
      expect(result.stats.totalUrls).toBe(11); // 1 search + 10 details
      expect(result.stats.successfulUrls).toBeGreaterThan(8); // Some might fail
      expect(result.stats.duration).toBeGreaterThan(0);
      expect(result.stats.averageResponseTime).toBeGreaterThan(0);
    });
  });
  
  describe('Proxy Integration', () => {
    it('should work with proxy manager', async () => {
      // Mock proxy environment
      process.env.PROXY_LIST = 'http://proxy1.test:8080,http://proxy2.test:8080';
      
      scraper = new UnifiedRealEstateScraper({
        mode: 'normal',
        features: {
          screenshots: false,
          cache: false,
          proxy: true
        }
      });
      
      // Mock axios for proxy requests
      const mockAxios = {
        get: jest.fn().mockResolvedValue({
          data: '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
        })
      };
      jest.doMock('axios', () => ({ default: mockAxios }));
      
      scraper['buildUrls'] = async () => ['http://test.com/apartment/1'];
      
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      
      expect(result.success).toBe(true);
      
      // Check proxy stats
      const proxyStats = scraper.getProxyStats();
      expect(proxyStats.enabled).toBe(true);
      expect(proxyStats.summary?.total).toBe(2);
      
      // Cleanup
      delete process.env.PROXY_LIST;
    });
  });
  
  describe('Strategy Integration', () => {
    it('should switch strategies dynamically', async () => {
      // Start with sequential
      scraper = new UnifiedRealEstateScraper({
        mode: 'normal',
        strategy: 'sequential'
      });
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
      });
      
      scraper['buildUrls'] = async () => Array(5).fill('http://test.com');
      
      const result1 = await scraper.scrape({ prefecture: 'tokyo' });
      expect(result1.success).toBe(true);
      
      // Create new scraper with queue strategy
      scraper = new UnifiedRealEstateScraper({
        mode: 'normal',
        strategy: 'queue',
        strategyConfig: {
          processingOrder: 'priority',
          priorityFunction: (url: string) => url.includes('premium') ? 10 : 1
        }
      });
      
      scraper['buildUrls'] = async () => [
        'http://test.com/normal/1',
        'http://test.com/premium/1',
        'http://test.com/normal/2',
        'http://test.com/premium/2'
      ];
      
      const processOrder: string[] = [];
      (global.fetch as any).mockImplementation(async (url: string) => {
        processOrder.push(url);
        return {
          ok: true,
          text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
        };
      });
      
      const result2 = await scraper.scrape({ prefecture: 'tokyo' });
      
      expect(result2.success).toBe(true);
      // Premium URLs should be processed first
      expect(processOrder[0]).toContain('premium');
      expect(processOrder[1]).toContain('premium');
    });
  });
  
  describe('Error Handling Integration', () => {
    it('should handle various error scenarios', async () => {
      scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 2,
        maxRetries: 1,
        retryDelay: 50
      });
      
      const responses = [
        { ok: true, text: async () => '<html><a href="/apt/1">Apt 1</a><a href="/apt/2">Apt 2</a><a href="/apt/3">Apt 3</a></html>' },
        { ok: false, status: 404, statusText: 'Not Found' },
        { ok: true, text: async () => '<html><div class="listing"><h2>Good</h2><div class="price">¥100,000</div></div></html>' },
        new Error('Network timeout'),
        { ok: true, text: async () => '<html>Invalid HTML</html>' }
      ];
      
      let callIndex = 0;
      (global.fetch as any).mockImplementation(async () => {
        const response = responses[callIndex % responses.length];
        callIndex++;
        if (response instanceof Error) {
          throw response;
        }
        return response;
      });
      
      scraper['buildUrls'] = async () => ['http://test.com/search'];
      
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      
      // Should handle errors gracefully
      expect(result.data.length).toBeGreaterThanOrEqual(1);
      expect(result.errors.length).toBe(0); // Errors are logged but don't bubble up
      expect(result.stats.failedUrls).toBeGreaterThan(0);
    });
  });
  
  describe('Performance under Load', () => {
    it('should handle large number of URLs efficiently', async () => {
      scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        strategy: 'stream',
        strategyConfig: {
          highWaterMark: 50,
          lowWaterMark: 20
        },
        concurrency: 5,
        rateLimit: {
          requests: 10,
          perSeconds: 1,
          burst: 5
        }
      });
      
      const urlCount = 100;
      scraper['buildUrls'] = async () => Array(urlCount).fill('http://test.com/apartment');
      
      let processedCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        processedCount++;
        return {
          ok: true,
          text: async () => `<html><div class="listing"><h2>Apt ${processedCount}</h2><div class="price">¥100,000</div></div></html>`
        };
      });
      
      const results: any[] = [];
      const start = Date.now();
      
      for await (const apartment of scraper.scrapeStream({ prefecture: 'tokyo' })) {
        results.push(apartment);
        
        // Simulate slow consumer
        if (results.length % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const duration = Date.now() - start;
      
      expect(results).toHaveLength(urlCount);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Verify streaming worked correctly
      const titles = results.map(r => r.title);
      expect(new Set(titles).size).toBe(urlCount); // All unique
    });
  });
  
  describe('Abort and Cleanup', () => {
    it('should properly clean up resources on abort', async () => {
      scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 3,
        features: {
          screenshots: false,
          cache: false,
          proxy: true
        }
      });
      
      scraper['buildUrls'] = async () => Array(50).fill('http://test.com');
      
      let processedCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        processedCount++;
        if (processedCount === 10) {
          // Abort after 10 requests
          scraper.stop();
        }
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          ok: true,
          text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
        };
      });
      
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      
      expect(result.data.length).toBeLessThan(50);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Verify cleanup
      const proxyStats = scraper.getProxyStats();
      if (proxyStats.enabled) {
        // Proxy manager should be destroyed
        expect(() => scraper['proxyManager']?.getNextProxy()).toThrow();
      }
    });
  });
  
  describe('Multi-Scraper Coordination', () => {
    it('should run multiple scrapers concurrently without interference', async () => {
      const scraper1 = new UnifiedRealEstateScraper({ mode: 'fast', concurrency: 2 });
      const scraper2 = new UnifiedRealEstateScraper({ mode: 'normal' });
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
      });
      
      scraper1['buildUrls'] = async () => Array(5).fill('http://test1.com');
      scraper2['buildUrls'] = async () => Array(5).fill('http://test2.com');
      
      // Run both scrapers concurrently
      const [result1, result2] = await Promise.all([
        scraper1.scrape({ prefecture: 'tokyo' }),
        scraper2.scrape({ prefecture: 'osaka' })
      ]);
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data.length).toBe(5);
      expect(result2.data.length).toBe(5);
      
      // Cleanup
      scraper1.stop();
      scraper2.stop();
    });
  });
});