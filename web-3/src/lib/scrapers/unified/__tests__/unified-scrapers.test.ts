import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedSuumoScraper } from '../suumo-unified';
import { UnifiedHomesAtScraper } from '../homes-at-unified';
import { UnifiedHomesRoomScraper } from '../homes-room-unified';
import { UnifiedAptsJpScraper } from '../apts-jp-unified';
import { UnifiedAtHomeScraper } from '../at-home-unified';
import { UnifiedChintaiScraper } from '../chintai-unified';
import { UnifiedRStore47Scraper } from '../r-store47-unified';
import { UnifiedTokyoSharehavenScraper } from '../tokyo-sharehaven-unified';
import { CheerioScraper } from '../../core/cheerio-scraper';
import type { ScraperConfig, Property } from '../../types';

// Mock CheerioScraper
jest.mock('../../core/cheerio-scraper');

describe('Unified Scrapers', () => {
  const mockHtml = `
    <html>
      <body>
        <div class="property-unit">
          <h3>Test Apartment</h3>
          <div class="price">100,000円</div>
          <div class="station">Tokyo Station 10 min walk</div>
          <div class="details">25.5 m²</div>
          <a href="/property/123">Details</a>
        </div>
      </body>
    </html>
  `;

  const config: ScraperConfig = {
    baseUrl: 'https://example.com',
    pageSize: 20,
    maxRetries: 3,
    retryDelay: 1000,
    rateLimit: { requests: 10, period: 60000 },
    userAgent: 'Test Agent',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('UnifiedSuumoScraper', () => {
    it('should scrape listings successfully', async () => {
      const scraper = new UnifiedSuumoScraper(config);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('suumo.jp'),
        expect.any(Object)
      );
      expect(results).toBeDefined();
      expect(results.properties).toBeInstanceOf(Array);
    });

    it('should scrape details successfully', async () => {
      const scraper = new UnifiedSuumoScraper(config);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const details = await scraper.scrapeDetails('https://suumo.jp/property/123');

      expect(details).toBeDefined();
      expect(details.title).toBeTruthy();
      expect(details.rent).toBeGreaterThan(0);
    });

    it('should handle fast mode correctly', async () => {
      const scraper = new UnifiedSuumoScraper({ ...config, fastMode: true });
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      await scraper.scrapeListings({ page: 1 });

      // In fast mode, should use minimal selectors
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('UnifiedHomesAtScraper', () => {
    it('should scrape with area-specific URLs', async () => {
      const scraper = new UnifiedHomesAtScraper(config);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      await scraper.scrapeListings({ area: 'tokyo', page: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('homes.co.jp/chintai/tokyo'),
        expect.any(Object)
      );
    });

    it('should extract station data correctly', async () => {
      const scraper = new UnifiedHomesAtScraper(config);
      const stationHtml = `
        <div class="bukkennUnit">
          <div class="bukkenSpec">
            <dd class="bukkenStation">
              <span>JR山手線「渋谷」駅 徒歩5分</span>
            </dd>
          </div>
        </div>
      `;
      const mockFetch = jest.fn().mockResolvedValue(stationHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });
      const property = results.properties[0];

      expect(property.nearestStation).toBe('渋谷');
      expect(property.walkingTime).toBe(5);
    });
  });

  describe('UnifiedAptsJpScraper', () => {
    it('should handle JSON API responses', async () => {
      const scraper = new UnifiedAptsJpScraper(config);
      const mockJsonResponse = {
        apartments: [
          {
            id: '123',
            title: 'Modern Apartment',
            rent: 120000,
            size: 30,
            station: 'Shinjuku',
            walkTime: 8,
          },
        ],
      };
      
      const mockFetch = jest.fn().mockResolvedValue(JSON.stringify(mockJsonResponse));
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(results.properties).toHaveLength(1);
      expect(results.properties[0].title).toBe('Modern Apartment');
      expect(results.properties[0].rent).toBe(120000);
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits across scrapers', async () => {
      const rateLimitedConfig = {
        ...config,
        rateLimit: { requests: 2, period: 1000 },
      };

      const scraper = new UnifiedSuumoScraper(rateLimitedConfig);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const startTime = Date.now();

      // Make 3 requests
      await Promise.all([
        scraper.scrapeListings({ page: 1 }),
        scraper.scrapeListings({ page: 2 }),
        scraper.scrapeListings({ page: 3 }),
      ]);

      const duration = Date.now() - startTime;

      // Should take at least 1 second due to rate limiting
      expect(duration).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Proxy Support', () => {
    it('should use proxy when configured', async () => {
      const proxyConfig = {
        ...config,
        proxy: {
          host: 'proxy.example.com',
          port: 8080,
          username: 'user',
          password: 'pass',
        },
      };

      const scraper = new UnifiedSuumoScraper(proxyConfig);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      await scraper.scrapeListings({ page: 1 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          proxy: expect.objectContaining({
            host: 'proxy.example.com',
            port: 8080,
          }),
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should retry on failure', async () => {
      const scraper = new UnifiedSuumoScraper({ ...config, maxRetries: 2 });
      const mockFetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results).toBeDefined();
    });

    it('should throw after max retries', async () => {
      const scraper = new UnifiedSuumoScraper({ ...config, maxRetries: 1 });
      const mockFetch = jest.fn()
        .mockRejectedValue(new Error('Persistent error'));
      (scraper as any).fetchPage = mockFetch;

      await expect(scraper.scrapeListings({ page: 1 }))
        .rejects.toThrow('Persistent error');
      
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Data Validation', () => {
    it('should filter out invalid properties', async () => {
      const scraper = new UnifiedSuumoScraper(config);
      const invalidHtml = `
        <div class="property-unit">
          <h3></h3> <!-- Empty title -->
          <div class="price">invalid</div> <!-- Invalid price -->
        </div>
        <div class="property-unit">
          <h3>Valid Apartment</h3>
          <div class="price">80,000円</div>
        </div>
      `;
      const mockFetch = jest.fn().mockResolvedValue(invalidHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(results.properties).toHaveLength(1);
      expect(results.properties[0].title).toBe('Valid Apartment');
      expect(results.properties[0].rent).toBe(80000);
    });
  });

  describe('All Scrapers Coverage', () => {
    const scraperClasses = [
      { name: 'Suumo', class: UnifiedSuumoScraper },
      { name: 'Homes At', class: UnifiedHomesAtScraper },
      { name: 'Homes Room', class: UnifiedHomesRoomScraper },
      { name: 'Apts.jp', class: UnifiedAptsJpScraper },
      { name: 'At Home', class: UnifiedAtHomeScraper },
      { name: 'Chintai', class: UnifiedChintaiScraper },
      { name: 'R-Store 47', class: UnifiedRStore47Scraper },
      { name: 'Tokyo ShareHaven', class: UnifiedTokyoSharehavenScraper },
    ];

    scraperClasses.forEach(({ name, class: ScraperClass }) => {
      it(`${name} should implement required methods`, async () => {
        const scraper = new ScraperClass(config);
        
        expect(scraper.scrapeListings).toBeDefined();
        expect(scraper.scrapeDetails).toBeDefined();
        expect(typeof scraper.scrapeListings).toBe('function');
        expect(typeof scraper.scrapeDetails).toBe('function');
      });

      it(`${name} should handle empty results gracefully`, async () => {
        const scraper = new ScraperClass(config);
        const mockFetch = jest.fn().mockResolvedValue('<html></html>');
        (scraper as any).fetchPage = mockFetch;

        const results = await scraper.scrapeListings({ page: 1 });

        expect(results).toBeDefined();
        expect(results.properties).toEqual([]);
        expect(results.hasNextPage).toBe(false);
      });
    });
  });
});