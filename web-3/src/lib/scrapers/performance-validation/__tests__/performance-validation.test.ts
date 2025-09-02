/**
 * Performance Validation Test Suite
 * Validates that unified scrapers perform as well or better than old ones
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { performance } from 'perf_hooks';

// Old scrapers
import { RealEstateScraper } from '../../sources/realestate-scraper';
import { FastRealEstateScraper } from '../../sources/fast-realestate-scraper';
import { YoloJapanScraper } from '../../sources/yolo-japan-scraper';
import { FastYoloScraper } from '../../sources/fast-yolo-scraper';

// New unified scrapers
import { UnifiedScraperFactory } from '../../unified-scraper-factory';

// Mock HTTP responses to ensure consistent testing
jest.mock('axios');
jest.mock('node-fetch');

describe('Performance Validation: Old vs New Scrapers', () => {
  const PERFORMANCE_THRESHOLD = 1.1; // Allow 10% slower performance max
  const MEMORY_THRESHOLD = 1.2; // Allow 20% more memory usage max
  
  beforeAll(() => {
    // Ensure we're testing in a clean environment
    UnifiedScraperFactory.clearInstances();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('Speed Performance', () => {
    it('unified RealEstate scraper should be as fast or faster than old implementation', async () => {
      const mockHtml = generateMockRealEstateHtml(50);
      
      // Test old scraper
      const oldScraper = new RealEstateScraper();
      mockFetchForOldScraper(oldScraper, mockHtml);
      
      const oldStart = performance.now();
      const oldResults = await oldScraper.scrapePage(1, 50);
      const oldDuration = performance.now() - oldStart;
      
      // Test new unified scraper
      const newScraper = UnifiedScraperFactory.create('realestate', {}, 'normal');
      mockFetchForUnifiedScraper(newScraper, mockHtml);
      
      const newStart = performance.now();
      const newResults = await newScraper.scrape({ page: 1, limit: 50 });
      const newDuration = performance.now() - newStart;
      
      // Validate results
      expect(newResults.apartments.length).toBe(oldResults.length);
      expect(newDuration).toBeLessThan(oldDuration * PERFORMANCE_THRESHOLD);
      
      console.log(`RealEstate Speed: Old=${oldDuration.toFixed(2)}ms, New=${newDuration.toFixed(2)}ms, Improvement=${((oldDuration - newDuration) / oldDuration * 100).toFixed(1)}%`);
    });

    it('unified fast mode should be significantly faster than normal mode', async () => {
      const mockHtml = generateMockRealEstateHtml(100);
      
      // Test normal mode
      const normalScraper = UnifiedScraperFactory.create('realestate', {}, 'normal');
      mockFetchForUnifiedScraper(normalScraper, mockHtml);
      
      const normalStart = performance.now();
      await normalScraper.scrape({ page: 1, limit: 100 });
      const normalDuration = performance.now() - normalStart;
      
      // Test fast mode
      const fastScraper = UnifiedScraperFactory.create('realestate', {}, 'fast');
      mockFetchForUnifiedScraper(fastScraper, mockHtml);
      
      const fastStart = performance.now();
      await fastScraper.scrape({ page: 1, limit: 100 });
      const fastDuration = performance.now() - fastStart;
      
      // Fast mode should be at least 30% faster
      expect(fastDuration).toBeLessThan(normalDuration * 0.7);
      
      console.log(`Fast Mode Speed: Normal=${normalDuration.toFixed(2)}ms, Fast=${fastDuration.toFixed(2)}ms, Improvement=${((normalDuration - fastDuration) / normalDuration * 100).toFixed(1)}%`);
    });

    it('concurrent scraping should outperform sequential scraping', async () => {
      const mockHtml = generateMockYoloHtml(20);
      const pages = 5;
      
      // Test sequential scraping
      const sequentialScraper = UnifiedScraperFactory.create('yolo-japan');
      mockFetchForUnifiedScraper(sequentialScraper, mockHtml);
      
      const seqStart = performance.now();
      for (let i = 1; i <= pages; i++) {
        await sequentialScraper.scrape({ page: i, limit: 20 });
      }
      const seqDuration = performance.now() - seqStart;
      
      // Test concurrent scraping
      const concurrentScraper = UnifiedScraperFactory.create('yolo-japan', {
        strategy: 'concurrent',
        concurrent: { maxConcurrent: 3 }
      });
      mockFetchForUnifiedScraper(concurrentScraper, mockHtml, 50); // Add some delay
      
      const conStart = performance.now();
      const promises = Array.from({ length: pages }, (_, i) => 
        concurrentScraper.scrape({ page: i + 1, limit: 20 })
      );
      await Promise.all(promises);
      const conDuration = performance.now() - conStart;
      
      // Concurrent should be significantly faster
      expect(conDuration).toBeLessThan(seqDuration * 0.6);
      
      console.log(`Concurrent Performance: Sequential=${seqDuration.toFixed(2)}ms, Concurrent=${conDuration.toFixed(2)}ms, Improvement=${((seqDuration - conDuration) / seqDuration * 100).toFixed(1)}%`);
    });
  });

  describe('Memory Performance', () => {
    it('unified scrapers should not use significantly more memory', async () => {
      const mockHtml = generateMockRealEstateHtml(200);
      
      // Test old scraper memory usage
      const oldScraper = new FastRealEstateScraper();
      mockFetchForOldScraper(oldScraper, mockHtml);
      
      const oldMemBefore = process.memoryUsage().heapUsed;
      await oldScraper.scrapePage(1, 200);
      const oldMemAfter = process.memoryUsage().heapUsed;
      const oldMemUsed = (oldMemAfter - oldMemBefore) / 1024 / 1024; // MB
      
      // Force garbage collection if available
      if (global.gc) global.gc();
      
      // Test new scraper memory usage
      const newScraper = UnifiedScraperFactory.create('realestate', {}, 'fast');
      mockFetchForUnifiedScraper(newScraper, mockHtml);
      
      const newMemBefore = process.memoryUsage().heapUsed;
      await newScraper.scrape({ page: 1, limit: 200 });
      const newMemAfter = process.memoryUsage().heapUsed;
      const newMemUsed = (newMemAfter - newMemBefore) / 1024 / 1024; // MB
      
      // New scraper should not use significantly more memory
      expect(newMemUsed).toBeLessThan(oldMemUsed * MEMORY_THRESHOLD);
      
      console.log(`Memory Usage: Old=${oldMemUsed.toFixed(2)}MB, New=${newMemUsed.toFixed(2)}MB, Difference=${((newMemUsed - oldMemUsed) / oldMemUsed * 100).toFixed(1)}%`);
    });

    it('streaming strategy should handle large datasets efficiently', async () => {
      const largeDataset = generateMockRealEstateHtml(1000);
      
      const streamingScraper = UnifiedScraperFactory.create('realestate', {
        strategy: 'stream',
        stream: { highWaterMark: 100 }
      });
      mockFetchForUnifiedScraper(streamingScraper, largeDataset);
      
      const memBefore = process.memoryUsage().heapUsed;
      const results: any[] = [];
      
      // Process with streaming
      await new Promise((resolve, reject) => {
        streamingScraper.scrapeStream({ page: 1, limit: 1000 })
          .on('data', (apartment: any) => results.push(apartment))
          .on('end', resolve)
          .on('error', reject);
      });
      
      const memAfter = process.memoryUsage().heapUsed;
      const memUsed = (memAfter - memBefore) / 1024 / 1024; // MB
      
      expect(results.length).toBe(1000);
      expect(memUsed).toBeLessThan(100); // Should use less than 100MB for 1000 items
      
      console.log(`Streaming Memory: ${memUsed.toFixed(2)}MB for ${results.length} items`);
    });
  });

  describe('Error Handling Performance', () => {
    it('unified scrapers should handle errors gracefully without performance degradation', async () => {
      const scraper = UnifiedScraperFactory.create('yolo-japan', {
        maxRetries: 3,
        retryDelay: 50
      });
      
      // Mock to fail first 2 attempts, succeed on 3rd
      let attempts = 0;
      mockFetchForUnifiedScraper(scraper, '', () => {
        attempts++;
        if (attempts < 3) throw new Error('Network error');
        return generateMockYoloHtml(20);
      });
      
      const start = performance.now();
      const result = await scraper.scrape({ page: 1, limit: 20 });
      const duration = performance.now() - start;
      
      expect(result.apartments.length).toBe(20);
      expect(duration).toBeLessThan(500); // Should retry quickly
      expect(attempts).toBe(3);
      
      console.log(`Error Recovery: ${duration.toFixed(2)}ms with ${attempts} attempts`);
    });

    it('rate limiting should not significantly impact overall performance', async () => {
      const unlimitedScraper = UnifiedScraperFactory.create('wagaya-japan');
      const limitedScraper = UnifiedScraperFactory.create('wagaya-japan', {
        rateLimit: { requests: 5, period: 1000 }
      });
      
      const mockHtml = generateMockWagayaHtml(10);
      mockFetchForUnifiedScraper(unlimitedScraper, mockHtml);
      mockFetchForUnifiedScraper(limitedScraper, mockHtml);
      
      // Test unlimited
      const unlimitedStart = performance.now();
      for (let i = 0; i < 5; i++) {
        await unlimitedScraper.scrape({ page: i + 1, limit: 10 });
      }
      const unlimitedDuration = performance.now() - unlimitedStart;
      
      // Test rate limited
      const limitedStart = performance.now();
      for (let i = 0; i < 5; i++) {
        await limitedScraper.scrape({ page: i + 1, limit: 10 });
      }
      const limitedDuration = performance.now() - limitedStart;
      
      // Rate limiting should add minimal overhead
      const overhead = (limitedDuration - unlimitedDuration) / unlimitedDuration;
      expect(overhead).toBeLessThan(0.3); // Less than 30% overhead
      
      console.log(`Rate Limiting Overhead: ${(overhead * 100).toFixed(1)}%`);
    });
  });

  describe('Data Quality Validation', () => {
    it('unified scrapers should extract the same data as old scrapers', async () => {
      const mockHtml = generateMockRealEstateHtml(10);
      
      // Get data from old scraper
      const oldScraper = new RealEstateScraper();
      mockFetchForOldScraper(oldScraper, mockHtml);
      const oldResults = await oldScraper.scrapePage(1, 10);
      
      // Get data from new scraper
      const newScraper = UnifiedScraperFactory.create('realestate');
      mockFetchForUnifiedScraper(newScraper, mockHtml);
      const newResults = await newScraper.scrape({ page: 1, limit: 10 });
      
      // Compare data quality
      expect(newResults.apartments.length).toBe(oldResults.length);
      
      // Check that key fields are preserved
      for (let i = 0; i < oldResults.length; i++) {
        const oldApt = oldResults[i];
        const newApt = newResults.apartments[i];
        
        // Allow for minor formatting differences
        expect(newApt.rent).toBe(oldApt.rent);
        expect(newApt.size).toBeCloseTo(oldApt.size || 0, 1);
        expect(newApt.stationWalkTime).toBe(oldApt.stationWalkTime);
      }
      
      console.log(`Data Quality: Validated ${newResults.apartments.length} apartments match`);
    });
  });
});

// Helper functions
function generateMockRealEstateHtml(count: number): string {
  const properties = Array.from({ length: count }, (_, i) => `
    <div class="cassetteitem">
      <div class="cassetteitem_detail">
        <div class="cassetteitem_detail-title">1K Apartment ${i + 1}</div>
        <div class="cassetteitem_detail-col3">
          <div>${80000 + (i * 1000)}円</div>
          <div>${20 + (i % 15)}m²</div>
        </div>
        <div class="cassetteitem_detail-text">Shibuya Station ${5 + (i % 10)}分</div>
      </div>
    </div>
  `).join('');

  return `<div class="cassetteitem_content">${properties}</div>`;
}

function generateMockYoloHtml(count: number): string {
  const properties = Array.from({ length: count }, (_, i) => `
    <div class="property-item" data-id="prop-${i}">
      <h3 class="property-title">Modern Studio ${i + 1}</h3>
      <div class="property-price">¥${70000 + (i * 2000)}</div>
      <div class="property-area">${18 + (i % 12)} m²</div>
      <div class="property-station">Tokyo Station - ${3 + (i % 7)} min walk</div>
    </div>
  `).join('');

  return `<div class="property-list">${properties}</div>`;
}

function generateMockWagayaHtml(count: number): string {
  const properties = Array.from({ length: count }, (_, i) => `
    <article class="result-item">
      <h2 class="result-title">Cozy Apartment ${i + 1}</h2>
      <div class="result-price">月額: ${90000 + (i * 3000)}円</div>
      <div class="result-specs">
        <span class="result-area">${25 + (i % 20)}㎡</span>
        <span class="result-access">Shinjuku駅 徒歩${4 + (i % 8)}分</span>
      </div>
    </article>
  `).join('');

  return `<div class="result-list">${properties}</div>`;
}

function mockFetchForOldScraper(scraper: any, html: string, delay = 10) {
  scraper.fetchPage = jest.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return html;
  });
}

function mockFetchForUnifiedScraper(scraper: any, html: string, delay = 10, dynamicHtml?: () => string) {
  scraper.fetchWithRetry = jest.fn().mockImplementation(async () => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return {
      data: dynamicHtml ? dynamicHtml() : html,
      status: 200,
      headers: {}
    };
  });
}