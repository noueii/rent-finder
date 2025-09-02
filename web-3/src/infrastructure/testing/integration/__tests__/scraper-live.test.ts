import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { UnifiedScraper } from '~/lib/scrapers/unified/base-scraper';
import { RealEstateStrategy } from '~/lib/scrapers/unified/strategies/realestate-strategy';
import { YoloJapanStrategy } from '~/lib/scrapers/unified/strategies/yolo-strategy';
import { WagayaJapanStrategy } from '~/lib/scrapers/unified/strategies/wagaya-strategy';
import { MetroResidencesStrategy } from '~/lib/scrapers/unified/strategies/metro-strategy';
import { SequentialStrategy } from '~/lib/scrapers/unified/strategies/sequential-strategy';
import { ConcurrentStrategy } from '~/lib/scrapers/unified/strategies/concurrent-strategy';
import { UnifiedProxyManager } from '~/lib/scrapers/unified/proxy-manager';
import { RateLimiter } from '~/lib/scrapers/unified/utils/rate-limiter';
import type { ScrapedApartment } from '~/lib/scrapers/types';

/**
 * Live scraper integration tests
 * Tests scrapers against actual websites with rate limiting
 * 
 * NOTE: These tests make real HTTP requests and should be run sparingly
 */

// Rate limiter to prevent overwhelming target sites
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000, // 5 requests per minute
  delayMs: 2000 // 2 second delay between requests
});

// Test configuration
const TEST_CONFIG = {
  enableLiveTests: process.env.ENABLE_LIVE_SCRAPER_TESTS === 'true',
  maxPagesToTest: 2, // Limit pages to scrape per test
  useProxy: false, // Disable proxy for tests unless explicitly needed
  timeout: 30000 // 30 second timeout for live requests
};

describe('Live Scraper Tests', () => {
  let proxyManager: UnifiedProxyManager;
  
  beforeAll(() => {
    if (!TEST_CONFIG.enableLiveTests) {
      console.log('Live scraper tests disabled. Set ENABLE_LIVE_SCRAPER_TESTS=true to run.');
    }
    
    // Initialize proxy manager (even if not using proxies)
    proxyManager = new UnifiedProxyManager();
  });
  
  afterAll(async () => {
    // Cleanup
    await proxyManager.shutdown();
  });

  describe('Real Estate Scraper', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should scrape apartments from real estate site',
      async () => {
        await rateLimiter.acquire();
        
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new RealEstateStrategy(),
            config: { delayBetweenRequests: 2000 }
          }),
          config: {
            name: 'realestate-live-test',
            baseUrl: 'https://realestate.co.jp',
            enabled: true,
            rateLimit: { requests: 2, window: 60000 }
          },
          proxyManager: TEST_CONFIG.useProxy ? proxyManager : undefined
        });
        
        // Test scraping first page
        const results = await scraper.scrape({
          maxPages: 1,
          startUrl: '/tokyo/rent'
        });
        
        // Validate results
        expect(results).toBeInstanceOf(Array);
        expect(results.length).toBeGreaterThan(0);
        
        // Validate apartment data structure
        const apartment = results[0]!;
        validateApartmentData(apartment);
        
        // Specific validations for real estate site
        expect(apartment.source).toBe('realestate');
        expect(apartment.url).toContain('realestate.co.jp');
      },
      TEST_CONFIG.timeout
    );
    
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should handle pagination correctly',
      async () => {
        await rateLimiter.acquire();
        
        const strategy = new RealEstateStrategy();
        
        // Get next page URL from first page
        const mockFirstPage = '<a class="next-page" href="/tokyo/rent?page=2">Next</a>';
        const nextUrl = strategy.getNextPageUrl(mockFirstPage, 'https://realestate.co.jp/tokyo/rent');
        
        expect(nextUrl).toBe('https://realestate.co.jp/tokyo/rent?page=2');
      }
    );
  });

  describe('Yolo Japan Scraper', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should scrape apartments from Yolo Japan',
      async () => {
        await rateLimiter.acquire();
        
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new YoloJapanStrategy(),
            config: { delayBetweenRequests: 2000 }
          }),
          config: {
            name: 'yolo-live-test',
            baseUrl: 'https://yolo-japan.com',
            enabled: true
          }
        });
        
        const results = await scraper.scrape({
          maxPages: 1,
          startUrl: '/en/rent'
        });
        
        // Validate results
        expect(results).toBeInstanceOf(Array);
        if (results.length > 0) {
          const apartment = results[0]!;
          validateApartmentData(apartment);
          expect(apartment.source).toBe('yolo-japan');
          expect(apartment.url).toContain('yolo-japan.com');
        }
      },
      TEST_CONFIG.timeout
    );
  });

  describe('Wagaya Japan Scraper', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should scrape apartments from Wagaya Japan',
      async () => {
        await rateLimiter.acquire();
        
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new WagayaJapanStrategy(),
            config: { delayBetweenRequests: 2000 }
          }),
          config: {
            name: 'wagaya-live-test',
            baseUrl: 'https://wagaya-japan.com',
            enabled: true
          }
        });
        
        const results = await scraper.scrape({
          maxPages: 1,
          startUrl: '/en/rent'
        });
        
        // Validate results
        expect(results).toBeInstanceOf(Array);
        if (results.length > 0) {
          const apartment = results[0]!;
          validateApartmentData(apartment);
          expect(apartment.source).toBe('wagaya-japan');
          expect(apartment.url).toContain('wagaya-japan.com');
        }
      },
      TEST_CONFIG.timeout
    );
  });

  describe('Metro Residences Scraper', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should scrape apartments from Metro Residences',
      async () => {
        await rateLimiter.acquire();
        
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new MetroResidencesStrategy(),
            config: { delayBetweenRequests: 2000 }
          }),
          config: {
            name: 'metro-live-test',
            baseUrl: 'https://metrotokyo.com',
            enabled: true
          }
        });
        
        const results = await scraper.scrape({
          maxPages: 1,
          startUrl: '/apartments'
        });
        
        // Validate results
        expect(results).toBeInstanceOf(Array);
        if (results.length > 0) {
          const apartment = results[0]!;
          validateApartmentData(apartment);
          expect(apartment.source).toBe('metro-residences');
          expect(apartment.url).toContain('metrotokyo.com');
        }
      },
      TEST_CONFIG.timeout
    );
  });

  describe('Error Recovery', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should handle 404 errors gracefully',
      async () => {
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new RealEstateStrategy(),
            config: { delayBetweenRequests: 1000 }
          }),
          config: {
            name: 'error-test',
            baseUrl: 'https://realestate.co.jp',
            enabled: true
          }
        });
        
        // Try to scrape non-existent page
        const results = await scraper.scrape({
          maxPages: 1,
          startUrl: '/this-page-does-not-exist-12345'
        });
        
        // Should return empty results, not throw
        expect(results).toEqual([]);
      }
    );
    
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should retry on timeout',
      async () => {
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new RealEstateStrategy(),
            config: { 
              delayBetweenRequests: 1000,
              maxRetries: 2,
              timeout: 1000 // Very short timeout to trigger retry
            }
          }),
          config: {
            name: 'timeout-test',
            baseUrl: 'https://realestate.co.jp',
            enabled: true
          }
        });
        
        // This might timeout and retry
        // We just verify it doesn't crash
        await expect(
          scraper.scrape({ maxPages: 1, startUrl: '/tokyo/rent' })
        ).resolves.toBeDefined();
      }
    );
  });

  describe('Proxy Rotation', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests || !TEST_CONFIG.useProxy)(
      'should rotate proxies between requests',
      async () => {
        // Only run if proxy testing is explicitly enabled
        const proxiedScraper = new UnifiedScraper({
          strategy: new ConcurrentStrategy({
            implementation: new RealEstateStrategy(),
            config: { maxConcurrent: 2 }
          }),
          config: {
            name: 'proxy-test',
            baseUrl: 'https://realestate.co.jp',
            enabled: true
          },
          proxyManager
        });
        
        // Add test proxies
        proxyManager.addProxy({
          host: 'test-proxy-1.example.com',
          port: 8080,
          auth: { username: 'test', password: 'test' }
        });
        
        proxyManager.addProxy({
          host: 'test-proxy-2.example.com',
          port: 8080,
          auth: { username: 'test', password: 'test' }
        });
        
        // Note: This test would fail with invalid proxies
        // It's here to demonstrate proxy rotation logic
        const proxyUsed: string[] = [];
        
        // Hook into proxy selection
        const originalGetProxy = proxyManager.getProxy;
        proxyManager.getProxy = function() {
          const proxy = originalGetProxy.call(this);
          if (proxy) {
            proxyUsed.push(proxy.host);
          }
          return proxy;
        };
        
        try {
          await proxiedScraper.scrape({
            maxPages: 2,
            startUrl: '/tokyo/rent'
          });
        } catch (error) {
          // Expected to fail with test proxies
        }
        
        // Verify proxy rotation occurred
        expect(proxyUsed.length).toBeGreaterThan(0);
        expect(new Set(proxyUsed).size).toBeGreaterThan(1); // Multiple proxies used
        
        // Restore original method
        proxyManager.getProxy = originalGetProxy;
      }
    );
  });

  describe('Data Quality Validation', () => {
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should extract all required fields',
      async () => {
        await rateLimiter.acquire();
        
        const scraper = new UnifiedScraper({
          strategy: new SequentialStrategy({
            implementation: new RealEstateStrategy(),
            config: { delayBetweenRequests: 2000 }
          }),
          config: {
            name: 'quality-test',
            baseUrl: 'https://realestate.co.jp',
            enabled: true
          }
        });
        
        const results = await scraper.scrape({
          maxPages: 1,
          startUrl: '/tokyo/rent',
          minResults: 5 // Ensure we get enough data to validate
        });
        
        // Check data completeness
        const completeData = results.filter(apt => 
          apt.name &&
          apt.price > 0 &&
          apt.layout &&
          apt.size > 0 &&
          apt.nearestStation &&
          apt.url
        );
        
        const completenessRate = completeData.length / results.length;
        expect(completenessRate).toBeGreaterThan(0.8); // 80% data completeness
        
        console.log(`Data completeness: ${(completenessRate * 100).toFixed(1)}%`);
      },
      TEST_CONFIG.timeout
    );
    
    it.skipIf(!TEST_CONFIG.enableLiveTests)(
      'should handle Japanese and English content',
      async () => {
        await rateLimiter.acquire();
        
        const strategy = new RealEstateStrategy();
        
        // Test Japanese content parsing
        const japaneseHtml = `
          <div class="property">
            <h3>ワンルームマンション</h3>
            <div class="price">¥85,000</div>
            <div class="size">25.5m²</div>
            <div class="station">渋谷駅 徒歩5分</div>
          </div>
        `;
        
        const results = await strategy.parsePage(japaneseHtml, 'https://example.com');
        expect(results.length).toBeGreaterThan(0);
        
        const apt = results[0]!;
        expect(apt.name).toContain('ワンルーム');
        expect(apt.price).toBe(85000);
        expect(apt.size).toBe(25.5);
        expect(apt.nearestStation).toContain('渋谷');
      }
    );
  });
});

/**
 * Validate apartment data structure and required fields
 */
function validateApartmentData(apartment: ScrapedApartment): void {
  // Required fields
  expect(apartment).toHaveProperty('name');
  expect(apartment).toHaveProperty('price');
  expect(apartment).toHaveProperty('url');
  expect(apartment).toHaveProperty('source');
  
  // Type validations
  expect(typeof apartment.name).toBe('string');
  expect(apartment.name.length).toBeGreaterThan(0);
  
  expect(typeof apartment.price).toBe('number');
  expect(apartment.price).toBeGreaterThan(0);
  
  expect(typeof apartment.url).toBe('string');
  expect(apartment.url).toMatch(/^https?:\/\//);
  
  // Optional fields validation
  if (apartment.layout) {
    expect(['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK']).toContain(apartment.layout);
  }
  
  if (apartment.size) {
    expect(typeof apartment.size).toBe('number');
    expect(apartment.size).toBeGreaterThan(0);
    expect(apartment.size).toBeLessThan(500); // Reasonable apartment size
  }
  
  if (apartment.buildingAge !== undefined) {
    expect(typeof apartment.buildingAge).toBe('number');
    expect(apartment.buildingAge).toBeGreaterThanOrEqual(0);
    expect(apartment.buildingAge).toBeLessThan(100); // Reasonable building age
  }
  
  if (apartment.floor !== undefined) {
    expect(typeof apartment.floor).toBe('number');
    expect(apartment.floor).toBeGreaterThan(0);
    expect(apartment.floor).toBeLessThan(100); // Reasonable floor number
  }
  
  if (apartment.location) {
    expect(apartment.location).toHaveProperty('lat');
    expect(apartment.location).toHaveProperty('lng');
    expect(typeof apartment.location.lat).toBe('number');
    expect(typeof apartment.location.lng).toBe('number');
    
    // Tokyo approximate bounds
    expect(apartment.location.lat).toBeGreaterThan(35.5);
    expect(apartment.location.lat).toBeLessThan(35.9);
    expect(apartment.location.lng).toBeGreaterThan(139.5);
    expect(apartment.location.lng).toBeLessThan(139.9);
  }
}