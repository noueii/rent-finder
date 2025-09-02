import { describe, it, expect, beforeEach } from '@jest/globals';
import { performance } from 'perf_hooks';
import { UnifiedSuumoScraper } from '../suumo-unified';
import { UnifiedHomesAtScraper } from '../homes-at-unified';
import { CheerioScraper } from '../../core/cheerio-scraper';
import type { ScraperConfig } from '../../types';

// Mock data for performance testing
const generateMockHtml = (count: number) => {
  const properties = Array.from({ length: count }, (_, i) => `
    <div class="property-unit">
      <h3>Apartment ${i + 1}</h3>
      <div class="price">${80000 + i * 5000}円</div>
      <div class="station">Station ${i % 10} - ${5 + (i % 15)} min walk</div>
      <div class="details">${20 + i % 30} m²</div>
      <div class="address">Tokyo, District ${i % 23}</div>
      <a href="/property/${i + 1000}">Details</a>
    </div>
  `).join('\n');

  return `
    <html>
      <body>
        <div class="property-list">
          ${properties}
        </div>
      </body>
    </html>
  `;
};

describe('Scraper Performance Tests', () => {
  const config: ScraperConfig = {
    baseUrl: 'https://example.com',
    pageSize: 20,
    maxRetries: 1,
    retryDelay: 100,
    rateLimit: { requests: 100, period: 1000 },
    userAgent: 'Performance Test',
  };

  describe('Parsing Performance', () => {
    it('should parse 100 properties in under 100ms', async () => {
      const scraper = new UnifiedSuumoScraper(config);
      const mockHtml = generateMockHtml(100);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const startTime = performance.now();
      const results = await scraper.scrapeListings({ page: 1 });
      const duration = performance.now() - startTime;

      expect(results.properties).toHaveLength(100);
      expect(duration).toBeLessThan(100); // Should parse in under 100ms
    });

    it('should parse 500 properties in under 500ms', async () => {
      const scraper = new UnifiedHomesAtScraper(config);
      const mockHtml = generateMockHtml(500);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const startTime = performance.now();
      const results = await scraper.scrapeListings({ page: 1 });
      const duration = performance.now() - startTime;

      expect(results.properties).toHaveLength(500);
      expect(duration).toBeLessThan(500); // Should parse in under 500ms
    });
  });

  describe('Fast Mode Performance', () => {
    it('should be at least 2x faster in fast mode', async () => {
      const normalScraper = new UnifiedSuumoScraper(config);
      const fastScraper = new UnifiedSuumoScraper({ ...config, fastMode: true });
      const mockHtml = generateMockHtml(200);
      
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (normalScraper as any).fetchPage = mockFetch;
      (fastScraper as any).fetchPage = mockFetch;

      // Normal mode timing
      const normalStart = performance.now();
      await normalScraper.scrapeListings({ page: 1 });
      const normalDuration = performance.now() - normalStart;

      // Fast mode timing
      const fastStart = performance.now();
      await fastScraper.scrapeListings({ page: 1 });
      const fastDuration = performance.now() - fastStart;

      expect(fastDuration).toBeLessThan(normalDuration / 2);
    });
  });

  describe('Memory Usage', () => {
    it('should handle large datasets without excessive memory usage', async () => {
      const scraper = new UnifiedSuumoScraper(config);
      const mockHtml = generateMockHtml(1000);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const memBefore = process.memoryUsage().heapUsed;
      const results = await scraper.scrapeListings({ page: 1 });
      const memAfter = process.memoryUsage().heapUsed;

      const memoryIncrease = (memAfter - memBefore) / 1024 / 1024; // MB

      expect(results.properties).toHaveLength(1000);
      expect(memoryIncrease).toBeLessThan(50); // Should use less than 50MB
    });
  });

  describe('Concurrent Scraping Performance', () => {
    it('should handle concurrent requests efficiently', async () => {
      const scraper = new UnifiedSuumoScraper({
        ...config,
        rateLimit: { requests: 50, period: 1000 },
      });
      const mockHtml = generateMockHtml(20);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const startTime = performance.now();
      
      // Scrape 10 pages concurrently
      const promises = Array.from({ length: 10 }, (_, i) => 
        scraper.scrapeListings({ page: i + 1 })
      );
      
      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      expect(results).toHaveLength(10);
      expect(results.every(r => r.properties.length === 20)).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete in under 2s
    });
  });

  describe('Selector Performance', () => {
    it('should use efficient selectors', async () => {
      const scraper = new UnifiedSuumoScraper(config);
      const complexHtml = `
        <html>
          <body>
            ${Array.from({ length: 1000 }, (_, i) => `
              <div class="irrelevant-${i}">Noise content ${i}</div>
            `).join('')}
            <div class="property-list">
              ${generateMockHtml(50)}
            </div>
            ${Array.from({ length: 1000 }, (_, i) => `
              <div class="more-noise-${i}">More noise ${i}</div>
            `).join('')}
          </body>
        </html>
      `;
      
      const mockFetch = jest.fn().mockResolvedValue(complexHtml);
      (scraper as any).fetchPage = mockFetch;

      const startTime = performance.now();
      const results = await scraper.scrapeListings({ page: 1 });
      const duration = performance.now() - startTime;

      expect(results.properties.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(200); // Should parse efficiently despite noise
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should maintain consistent throughput with rate limiting', async () => {
      const scraper = new UnifiedSuumoScraper({
        ...config,
        rateLimit: { requests: 5, period: 1000 },
      });
      const mockHtml = generateMockHtml(10);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const timings: number[] = [];
      let lastTime = performance.now();

      for (let i = 0; i < 5; i++) {
        await scraper.scrapeListings({ page: i + 1 });
        const currentTime = performance.now();
        timings.push(currentTime - lastTime);
        lastTime = currentTime;
      }

      // Check that requests are properly spaced
      const avgDelay = timings.slice(1).reduce((a, b) => a + b, 0) / (timings.length - 1);
      expect(avgDelay).toBeGreaterThanOrEqual(180); // ~200ms between requests
      expect(avgDelay).toBeLessThanOrEqual(250);
    });
  });

  describe('Comparison with Old Implementation', () => {
    it('unified scraper should be faster than old implementation', async () => {
      // Simulate old implementation with more complex logic
      const oldStyleParsing = (html: string) => {
        const start = performance.now();
        
        // Simulate inefficient parsing
        const matches = html.match(/<div class="property-unit">([\s\S]*?)<\/div>/g) || [];
        const properties = matches.map(match => {
          // Multiple regex operations (inefficient)
          const title = match.match(/<h3>(.*?)<\/h3>/)?.[1] || '';
          const price = match.match(/<div class="price">(.*?)円<\/div>/)?.[1] || '0';
          const station = match.match(/<div class="station">(.*?)<\/div>/)?.[1] || '';
          const details = match.match(/<div class="details">(.*?)<\/div>/)?.[1] || '';
          
          // Additional processing
          const cleanPrice = price.replace(/[^\d]/g, '');
          const walkTime = station.match(/(\d+)\s*min/)?.[1] || '0';
          
          return {
            title,
            rent: parseInt(cleanPrice, 10),
            walkingTime: parseInt(walkTime, 10),
            details,
          };
        });
        
        return {
          properties,
          duration: performance.now() - start,
        };
      };

      const mockHtml = generateMockHtml(100);
      
      // Old implementation timing
      const oldResult = oldStyleParsing(mockHtml);

      // New unified implementation
      const scraper = new UnifiedSuumoScraper(config);
      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;
      
      const newStart = performance.now();
      const newResult = await scraper.scrapeListings({ page: 1 });
      const newDuration = performance.now() - newStart;

      expect(newDuration).toBeLessThan(oldResult.duration);
      expect(newResult.properties.length).toBe(oldResult.properties.length);
    });
  });
});