/**
 * Performance Validation Tests
 * Ensures unified scrapers maintain or improve performance compared to old scrapers
 */


import { UnifiedRealEstateScraper } from '../implementations/realestate-unified-scraper';
import { UnifiedWagayaScraper } from '../implementations/wagaya-unified-scraper';
import { UnifiedYoloScraper } from '../implementations/yolo-unified-scraper';
import type { ScrapeParams } from '../base/unified-scraper';

// Mock dependencies
jest.mock('~/lib/logging', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('~/lib/scrapers/rate-limiter');
jest.mock('../proxy/UnifiedProxyManager');

// Performance benchmarks from old scrapers
const PERFORMANCE_BASELINES = {
  realestate: {
    avgResponseTime: 500, // ms
    memoryUsage: 50 * 1024 * 1024, // 50MB
    urlsPerSecond: 2
  },
  wagaya: {
    avgResponseTime: 400,
    memoryUsage: 40 * 1024 * 1024,
    urlsPerSecond: 2.5
  },
  yolo: {
    avgResponseTime: 350,
    memoryUsage: 35 * 1024 * 1024,
    urlsPerSecond: 3
  }
};

describe('Performance Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });
  
  describe('Response Time', () => {
    it('should maintain response time for RealEstate scraper', async () => {
      const scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 3
      });
      
      // Mock fast responses
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
      });
      
      const params: ScrapeParams = { prefecture: 'tokyo' };
      const start = Date.now();
      
      // Override buildUrls to return test URLs
      scraper['buildUrls'] = async () => Array(10).fill('http://test.com');
      
      const result = await scraper.scrape(params);
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      
      // Average response time should be better than baseline
      const avgResponseTime = duration / result.stats.totalUrls;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_BASELINES.realestate.avgResponseTime);
    });
    
    it('should maintain response time for Wagaya scraper', async () => {
      const scraper = new UnifiedWagayaScraper({
        mode: 'fast',
        concurrency: 3
      });
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="property"><h3>Test</h3><span class="price">100,000円</span></div></html>'
      });
      
      const params: ScrapeParams = { prefecture: 'tokyo' };
      const start = Date.now();
      
      scraper['buildUrls'] = async () => Array(10).fill('http://test.com');
      
      const result = await scraper.scrape(params);
      const duration = Date.now() - start;
      
      const avgResponseTime = duration / result.stats.totalUrls;
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_BASELINES.wagaya.avgResponseTime);
    });
  });
  
  describe('Memory Usage', () => {
    it('should not exceed memory baseline', async () => {
      const scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 5
      });
      
      // Large HTML response to test memory
      const largeHtml = '<html>' + 
        Array(100).fill('<div class="listing"><h2>Apartment</h2><div class="price">¥100,000</div></div>').join('') +
        '</html>';
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => largeHtml
      });
      
      scraper['buildUrls'] = async () => Array(20).fill('http://test.com');
      
      const memBefore = process.memoryUsage().heapUsed;
      await scraper.scrape({ prefecture: 'tokyo' });
      const memAfter = process.memoryUsage().heapUsed;
      
      const memoryIncrease = memAfter - memBefore;
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_BASELINES.realestate.memoryUsage);
    });
  });
  
  describe('Throughput', () => {
    it('should maintain URLs per second rate', async () => {
      const scraper = new UnifiedYoloScraper({
        mode: 'fast',
        concurrency: 5,
        strategy: 'concurrent'
      });
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="property-item"><h3>Test</h3><div class="price">100,000</div></div></html>'
      });
      
      const urlCount = 15;
      scraper['buildUrls'] = async () => Array(urlCount).fill('http://test.com');
      
      const start = Date.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = (Date.now() - start) / 1000; // in seconds
      
      const urlsPerSecond = result.stats.successfulUrls / duration;
      expect(urlsPerSecond).toBeGreaterThanOrEqual(PERFORMANCE_BASELINES.yolo.urlsPerSecond * 0.9); // Allow 10% variance
    });
  });
  
  describe('Concurrent Execution', () => {
    it('should process multiple URLs concurrently in fast mode', async () => {
      const scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 3
      });
      
      const processingOrder: string[] = [];
      let activeRequests = 0;
      let maxConcurrent = 0;
      
      (global.fetch as any).mockImplementation(async (url: string) => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        processingOrder.push(url);
        
        await new Promise(resolve => setTimeout(resolve, 50));
        
        activeRequests--;
        return {
          ok: true,
          text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
        };
      });
      
      scraper['buildUrls'] = async () => [
        'http://test.com/1',
        'http://test.com/2',
        'http://test.com/3',
        'http://test.com/4',
        'http://test.com/5'
      ];
      
      await scraper.scrape({ prefecture: 'tokyo' });
      
      // Should have processed concurrently
      expect(maxConcurrent).toBeGreaterThan(1);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
  });
  
  describe('Rate Limiting', () => {
    it('should respect rate limits without performance degradation', async () => {
      const scraper = new UnifiedRealEstateScraper({
        mode: 'normal',
        rateLimit: {
          requests: 5,
          perSeconds: 1
        }
      });
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
      });
      
      scraper['buildUrls'] = async () => Array(5).fill('http://test.com');
      
      const start = Date.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(result.stats.successfulUrls).toBe(5);
      
      // Should complete within reasonable time despite rate limiting
      expect(duration).toBeLessThan(2000); // 5 requests at 5/sec should take ~1 second
    });
  });
  
  describe('Strategy Performance', () => {
    it('should choose optimal strategy for workload', async () => {
      // Small workload - sequential should be used
      const smallScraper = new UnifiedRealEstateScraper({
        mode: 'normal'
      });
      
      expect(smallScraper['config'].strategy).toBe('sequential');
      
      // Large workload - concurrent should be used
      const largeScraper = new UnifiedRealEstateScraper({
        mode: 'fast'
      });
      
      expect(largeScraper['config'].strategy).toBe('concurrent');
    });
    
    it('should handle stream strategy efficiently', async () => {
      const scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        strategy: 'stream',
        strategyConfig: {
          highWaterMark: 10,
          lowWaterMark: 5
        }
      });
      
      (global.fetch as any).mockResolvedValue({
        ok: true,
        text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
      });
      
      scraper['buildUrls'] = async () => Array(20).fill('http://test.com');
      
      const results: any[] = [];
      const start = Date.now();
      
      for await (const apartment of scraper.scrapeStream({ prefecture: 'tokyo' })) {
        results.push(apartment);
      }
      
      const duration = Date.now() - start;
      
      expect(results.length).toBe(20);
      expect(duration / results.length).toBeLessThan(100); // Should stream efficiently
    });
  });
  
  describe('Error Recovery', () => {
    it('should maintain performance during error recovery', async () => {
      const scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 3,
        maxRetries: 2
      });
      
      let callCount = 0;
      (global.fetch as any).mockImplementation(async () => {
        callCount++;
        // Fail first attempt, succeed on retry
        if (callCount % 2 === 1) {
          throw new Error('Network error');
        }
        return {
          ok: true,
          text: async () => '<html><div class="listing"><h2>Test</h2><div class="price">¥100,000</div></div></html>'
        };
      });
      
      scraper['buildUrls'] = async () => Array(10).fill('http://test.com');
      
      const start = Date.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = Date.now() - start;
      
      expect(result.success).toBe(true);
      expect(result.stats.successfulUrls).toBe(10);
      
      // Despite retries, should complete in reasonable time
      const avgTime = duration / result.stats.successfulUrls;
      expect(avgTime).toBeLessThan(PERFORMANCE_BASELINES.realestate.avgResponseTime * 1.5); // Allow 50% overhead for retries
    });
  });
});