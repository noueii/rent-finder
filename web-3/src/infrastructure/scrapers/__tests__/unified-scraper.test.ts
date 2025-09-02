/**
 * Tests for Unified Base Scraper
 * Validates common functionality across all scrapers
 */

import * as cheerio from 'cheerio';
import { BaseScraper, ScraperConfig, ScrapeParams, BaseApartment, ScraperError, ERROR_CODES } from '../base/unified-scraper';
import { RateLimiter, TokenBucketRateLimiter } from '~/lib/scrapers/rate-limiter';
import { UnifiedProxyManager } from '../proxy/UnifiedProxyManager';

// Mock implementations
jest.mock('~/lib/logging', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  })
}));

jest.mock('../proxy/UnifiedProxyManager');
jest.mock('~/lib/scrapers/rate-limiter');

// Test implementation of BaseScraper
class TestScraper extends BaseScraper<BaseApartment> {
  public mockBuildUrls: jest.Mock;
  public mockExtractListingUrls: jest.Mock;
  public mockExtractApartmentData: jest.Mock;
  
  constructor(config: ScraperConfig) {
    super(config);
    this.mockBuildUrls = jest.fn();
    this.mockExtractListingUrls = jest.fn();
    this.mockExtractApartmentData = jest.fn();
  }
  
  protected getScraperName(): string {
    return 'test-scraper';
  }
  
  protected async buildUrls(params: ScrapeParams): Promise<string[]> {
    return this.mockBuildUrls(params);
  }
  
  protected extractListingUrls(html: string): string[] {
    return this.mockExtractListingUrls(html);
  }
  
  protected extractApartmentData(html: string, url: string): BaseApartment {
    return this.mockExtractApartmentData(html, url);
  }
  
  protected getSelectors() {
    return {
      title: '.title',
      rent: '.rent',
      size: '.size',
      layout: '.layout',
      buildingType: '.building-type',
      age: '.age',
      floor: '.floor',
      address: '.address',
      station: '.station',
      management: '.management',
      deposit: '.deposit',
      keyMoney: '.key-money'
    };
  }
  
  // Expose protected methods for testing
  public async testFetchWithRetry(url: string): Promise<string> {
    return this.fetchWithRetry(url);
  }
  
  public testHandleError(error: unknown): ScraperError {
    return this.handleError(error);
  }
  
  public async testFetch(url: string): Promise<string> {
    return this.fetch(url);
  }
}

describe('BaseScraper', () => {
  let scraper: TestScraper;
  let defaultConfig: ScraperConfig;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Default config
    defaultConfig = {
      mode: 'normal',
      strategy: 'sequential',
      rateLimit: { requests: 2, perSeconds: 1 },
      maxRetries: 3,
      retryDelay: 100,
      retryBackoff: 'linear',
      concurrency: 1,
      requestTimeout: 5000,
      totalTimeout: 60000,
      features: {
        screenshots: false,
        cache: false,
        proxy: false
      }
    };
    
    // Mock fetch globally
    global.fetch = jest.fn();
  });
  
  afterEach(() => {
    if (scraper) {
      scraper.stop();
    }
  });
  
  describe('constructor', () => {
    it('should initialize with correct config', () => {
      scraper = new TestScraper(defaultConfig);
      expect(scraper).toBeDefined();
    });
    
    it('should create RateLimiter for normal rate limiting', () => {
      scraper = new TestScraper(defaultConfig);
      expect(RateLimiter).toHaveBeenCalledWith({
        maxRequests: 2,
        windowMs: 1000,
        minDelayMs: 100,
        maxDelayMs: 60000,
        backoffMultiplier: 1
      });
    });
    
    it('should create TokenBucketRateLimiter for burst mode', () => {
      const burstConfig = {
        ...defaultConfig,
        rateLimit: { requests: 10, perSeconds: 1, burst: 5 }
      };
      scraper = new TestScraper(burstConfig);
      expect(TokenBucketRateLimiter).toHaveBeenCalledWith(5, 10);
    });
    
    it('should initialize proxy manager when enabled', () => {
      const proxyConfig = {
        ...defaultConfig,
        features: { ...defaultConfig.features, proxy: true }
      };
      scraper = new TestScraper(proxyConfig);
      expect(UnifiedProxyManager.fromEnv).toHaveBeenCalled();
    });
  });
  
  describe('scrape', () => {
    beforeEach(() => {
      scraper = new TestScraper(defaultConfig);
    });
    
    it('should execute full scraping flow', async () => {
      const params: ScrapeParams = { prefecture: 'tokyo' };
      const urls = ['http://test.com/1', 'http://test.com/2'];
      const apartment: BaseApartment = {
        id: '1',
        url: 'http://test.com/1',
        title: 'Test Apartment',
        rent: 100000,
        size: 25,
        layout: '1K',
        buildingType: 'Mansion',
        age: 5,
        floor: '2F',
        address: 'Tokyo',
        station: { name: 'Shibuya', line: 'JR', walkTime: 5 },
        images: [],
        features: [],
        scrapedAt: new Date(),
        source: 'test'
      };
      
      scraper.mockBuildUrls.mockResolvedValue(urls);
      scraper.mockExtractApartmentData.mockReturnValue(apartment);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => '<html></html>'
      });
      
      const result = await scraper.scrape(params);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.stats.totalUrls).toBe(2);
      expect(result.stats.successfulUrls).toBe(2);
      expect(result.stats.failedUrls).toBe(0);
    });
    
    it('should handle errors gracefully', async () => {
      const params: ScrapeParams = { prefecture: 'tokyo' };
      scraper.mockBuildUrls.mockRejectedValue(new Error('Build URLs failed'));
      
      const result = await scraper.scrape(params);
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Build URLs failed');
    });
    
    it('should respect abort signal', async () => {
      const params: ScrapeParams = { prefecture: 'tokyo' };
      scraper.mockBuildUrls.mockResolvedValue(['http://test.com/1']);
      
      // Abort immediately
      scraper.stop();
      
      const result = await scraper.scrape(params);
      
      expect(result.data).toHaveLength(0);
    });
  });
  
  describe('fetchWithRetry', () => {
    beforeEach(() => {
      scraper = new TestScraper(defaultConfig);
      
      // Mock rate limiter methods
      const mockRateLimiter = scraper['rateLimiter'] as any;
      mockRateLimiter.waitForSlot = jest.fn().mockResolvedValue(undefined);
      mockRateLimiter.recordRequest = jest.fn();
      mockRateLimiter.recordError = jest.fn();
      mockRateLimiter.resetErrors = jest.fn();
    });
    
    it('should retry on failure', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'Success'
        });
      
      const result = await scraper.testFetchWithRetry('http://test.com');
      
      expect(result).toBe('Success');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
    
    it('should respect max retries', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      await expect(scraper.testFetchWithRetry('http://test.com'))
        .rejects.toThrow('Network error');
      
      expect(global.fetch).toHaveBeenCalledTimes(3); // maxRetries = 3
    });
    
    it('should apply linear backoff', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const start = Date.now();
      try {
        await scraper.testFetchWithRetry('http://test.com');
      } catch {
        // Expected to fail
      }
      const duration = Date.now() - start;
      
      // Should have delays: 100ms, 200ms, 300ms = 600ms minimum
      expect(duration).toBeGreaterThanOrEqual(500); // Allow some margin
    });
    
    it('should apply exponential backoff', async () => {
      const expConfig = {
        ...defaultConfig,
        retryBackoff: 'exponential' as const,
        retryDelay: 100
      };
      scraper = new TestScraper(expConfig);
      
      // Mock rate limiter
      const mockRateLimiter = scraper['rateLimiter'] as any;
      mockRateLimiter.waitForSlot = jest.fn().mockResolvedValue(undefined);
      mockRateLimiter.recordRequest = jest.fn();
      mockRateLimiter.recordError = jest.fn();
      
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      const start = Date.now();
      try {
        await scraper.testFetchWithRetry('http://test.com');
      } catch {
        // Expected to fail
      }
      const duration = Date.now() - start;
      
      // Should have delays: 100ms, 200ms, 400ms = 700ms minimum
      expect(duration).toBeGreaterThanOrEqual(600); // Allow some margin
    });
  });
  
  describe('fetch', () => {
    beforeEach(() => {
      scraper = new TestScraper(defaultConfig);
    });
    
    it('should handle successful fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'HTML content'
      });
      
      const result = await scraper.testFetch('http://test.com');
      
      expect(result).toBe('HTML content');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla')
          })
        })
      );
    });
    
    it('should handle HTTP errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });
      
      await expect(scraper.testFetch('http://test.com'))
        .rejects.toThrow('HTTP 404: Not Found');
    });
    
    it('should handle timeouts', async () => {
      const timeoutError = new Error('AbortError');
      timeoutError.name = 'AbortError';
      (global.fetch as jest.Mock).mockRejectedValue(timeoutError);
      
      await expect(scraper.testFetch('http://test.com'))
        .rejects.toThrow(ScraperError);
      
      try {
        await scraper.testFetch('http://test.com');
      } catch (error) {
        expect(error).toBeInstanceOf(ScraperError);
        expect((error as ScraperError).code).toBe(ERROR_CODES.TIMEOUT);
      }
    });
    
    it('should use custom headers', async () => {
      const customConfig = {
        ...defaultConfig,
        overrides: {
          userAgent: 'CustomBot/1.0',
          headers: {
            'X-Custom-Header': 'test'
          }
        }
      };
      scraper = new TestScraper(customConfig);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'HTML'
      });
      
      await scraper.testFetch('http://test.com');
      
      expect(global.fetch).toHaveBeenCalledWith(
        'http://test.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'CustomBot/1.0',
            'X-Custom-Header': 'test'
          })
        })
      );
    });
  });
  
  describe('proxy support', () => {
    let proxyManager: any;
    
    beforeEach(() => {
      proxyManager = {
        hasProxies: jest.fn().mockReturnValue(true),
        getNextProxy: jest.fn().mockReturnValue({
          host: 'proxy.test.com',
          port: 8080,
          protocol: 'http'
        }),
        createProxyAgents: jest.fn().mockReturnValue({
          httpAgent: {},
          httpsAgent: {}
        }),
        reportSuccess: jest.fn(),
        reportFailure: jest.fn(),
        destroy: jest.fn(),
        getSummary: jest.fn().mockReturnValue({
          total: 1,
          active: 1,
          blacklisted: 0
        })
      };
      
      (UnifiedProxyManager.fromEnv as jest.Mock).mockReturnValue(proxyManager);
      
      const proxyConfig = {
        ...defaultConfig,
        features: { ...defaultConfig.features, proxy: true }
      };
      scraper = new TestScraper(proxyConfig);
    });
    
    it('should use proxy when available', async () => {
      // Mock axios
      const mockAxios = {
        get: jest.fn().mockResolvedValue({ data: 'HTML content' })
      };
      jest.doMock('axios', () => ({ default: mockAxios }));
      
      await scraper.testFetch('http://test.com');
      
      expect(proxyManager.getNextProxy).toHaveBeenCalled();
      expect(proxyManager.createProxyAgents).toHaveBeenCalled();
      expect(proxyManager.reportSuccess).toHaveBeenCalled();
    });
    
    it('should report proxy failures', async () => {
      const mockAxios = {
        get: jest.fn().mockRejectedValue(new Error('Proxy error'))
      };
      jest.doMock('axios', () => ({ default: mockAxios }));
      
      await expect(scraper.testFetch('http://test.com'))
        .rejects.toThrow();
      
      expect(proxyManager.reportFailure).toHaveBeenCalled();
    });
    
    it('should fall back to direct connection', async () => {
      proxyManager.getNextProxy.mockReturnValue(null);
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'Direct response'
      });
      
      const result = await scraper.testFetch('http://test.com');
      
      expect(result).toBe('Direct response');
      expect(global.fetch).toHaveBeenCalled();
    });
    
    it('should provide proxy stats', () => {
      const stats = scraper.getProxyStats();
      
      expect(stats.enabled).toBe(true);
      expect(stats.summary).toEqual({
        total: 1,
        active: 1,
        blacklisted: 0
      });
    });
  });
  
  describe('error handling', () => {
    beforeEach(() => {
      scraper = new TestScraper(defaultConfig);
    });
    
    it('should handle ScraperError correctly', () => {
      const scraperError = new ScraperError(
        'Test error',
        ERROR_CODES.PARSE_ERROR,
        'http://test.com'
      );
      
      const result = scraper.testHandleError(scraperError);
      
      expect(result).toBe(scraperError);
    });
    
    it('should wrap generic Error', () => {
      const error = new Error('Generic error');
      const result = scraper.testHandleError(error);
      
      expect(result).toBeInstanceOf(ScraperError);
      expect(result.message).toBe('Generic error');
      expect(result.code).toBe(ERROR_CODES.INVALID_RESPONSE);
    });
    
    it('should handle unknown errors', () => {
      const result = scraper.testHandleError('String error');
      
      expect(result).toBeInstanceOf(ScraperError);
      expect(result.message).toBe('Unknown error occurred');
    });
  });
  
  describe('progress tracking', () => {
    beforeEach(() => {
      scraper = new TestScraper(defaultConfig);
    });
    
    it('should track progress correctly', async () => {
      const params: ScrapeParams = { prefecture: 'tokyo' };
      const urls = ['http://test.com/1', 'http://test.com/2', 'http://test.com/3'];
      
      scraper.mockBuildUrls.mockResolvedValue(urls);
      scraper.mockExtractApartmentData.mockReturnValue({
        id: '1',
        url: 'http://test.com',
        title: 'Test',
        rent: 100000,
        size: 25,
        layout: '1K',
        buildingType: 'Mansion',
        age: 5,
        floor: '2F',
        address: 'Tokyo',
        station: { name: 'Shibuya', line: 'JR', walkTime: 5 },
        images: [],
        features: [],
        scrapedAt: new Date(),
        source: 'test'
      });
      
      // Make one request fail
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: true, text: async () => 'HTML' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ ok: true, text: async () => 'HTML' });
      
      const result = await scraper.scrape(params);
      
      expect(result.stats.totalUrls).toBe(3);
      expect(result.stats.successfulUrls).toBe(2);
      expect(result.stats.failedUrls).toBe(1);
    });
  });
  
  describe('streaming', () => {
    it('should stream results with stream strategy', async () => {
      const streamConfig = {
        ...defaultConfig,
        strategy: 'stream' as const,
        strategyConfig: {
          highWaterMark: 10,
          lowWaterMark: 5
        }
      };
      scraper = new TestScraper(streamConfig);
      
      const params: ScrapeParams = { prefecture: 'tokyo' };
      const urls = ['http://test.com/1', 'http://test.com/2'];
      
      scraper.mockBuildUrls.mockResolvedValue(urls);
      scraper.mockExtractApartmentData.mockImplementation((html, url) => ({
        id: url,
        url,
        title: 'Test',
        rent: 100000,
        size: 25,
        layout: '1K',
        buildingType: 'Mansion',
        age: 5,
        floor: '2F',
        address: 'Tokyo',
        station: { name: 'Shibuya', line: 'JR', walkTime: 5 },
        images: [],
        features: [],
        scrapedAt: new Date(),
        source: 'test'
      }));
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        text: async () => 'HTML'
      });
      
      const results: BaseApartment[] = [];
      for await (const apartment of scraper.scrapeStream(params)) {
        results.push(apartment);
      }
      
      expect(results).toHaveLength(2);
      expect(results[0].url).toBe('http://test.com/1');
      expect(results[1].url).toBe('http://test.com/2');
    });
    
    it('should throw error for non-stream strategy', async () => {
      scraper = new TestScraper(defaultConfig);
      
      await expect(async () => {
        for await (const _ of scraper.scrapeStream({})) {
          // Should not reach here
        }
      }).rejects.toThrow('Stream method only works with stream strategy');
    });
  });
});