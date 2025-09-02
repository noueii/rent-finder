/**
 * Tests for Unified RealEstate Scraper
 * Validates site-specific parsing and data extraction
 */


import { UnifiedRealEstateScraper } from '../../implementations/realestate-unified-scraper';
import type { ScrapeParams } from '../../base/unified-scraper';
import * as cheerio from 'cheerio';

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
jest.mock('../../proxy/UnifiedProxyManager');

describe('UnifiedRealEstateScraper', () => {
  let scraper: UnifiedRealEstateScraper;
  
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    
    scraper = new UnifiedRealEstateScraper({
      mode: 'normal',
      features: {
        screenshots: false,
        cache: false,
        proxy: false
      }
    });
  });
  
  afterEach(() => {
    if (scraper) {
      scraper.stop();
    }
  });
  
  describe('buildUrls', () => {
    it('should build search URLs correctly', async () => {
      const params: ScrapeParams = {
        prefecture: 'tokyo',
        city: 'shibuya',
        priceRange: { min: 50000, max: 150000 }
      };
      
      const urls = await scraper['buildUrls'](params);
      
      expect(urls).toBeDefined();
      expect(urls.length).toBeGreaterThan(0);
      expect(urls[0]).toContain('realestate.co.jp');
    });
    
    it('should handle train line search', async () => {
      const params: ScrapeParams = {
        trainLines: ['yamanote', 'chuo']
      };
      
      const urls = await scraper['buildUrls'](params);
      
      expect(urls).toBeDefined();
      expect(urls.length).toBeGreaterThan(0);
    });
  });
  
  describe('extractApartmentData', () => {
    it('should extract apartment data from HTML', () => {
      const html = `
        <div class="listing">
          <h2>Modern 1K Apartment</h2>
          <div class="price">¥80,000</div>
          <div class="size">25.5m²</div>
          <div class="layout">1K</div>
          <div class="type">マンション</div>
          <div class="age">築5年</div>
          <div class="floor">3階</div>
          <div class="address">東京都渋谷区道玄坂1-2-3</div>
          <div class="station">渋谷駅 徒歩5分</div>
          <div class="management">¥5,000</div>
          <div class="deposit">1ヶ月</div>
          <div class="key-money">1ヶ月</div>
        </div>
      `;
      
      const apartment = scraper['extractApartmentData'](html, 'http://test.com/apartment/123');
      
      expect(apartment).toBeDefined();
      expect(apartment.title).toBe('Modern 1K Apartment');
      expect(apartment.rent).toBe(80000);
      expect(apartment.size).toBe(25.5);
      expect(apartment.layout).toBe('1K');
      expect(apartment.buildingType).toBe('マンション');
      expect(apartment.age).toBe(5);
      expect(apartment.station.name).toBe('渋谷駅');
      expect(apartment.station.walkTime).toBe(5);
    });
    
    it('should handle missing data gracefully', () => {
      const html = `
        <div class="listing">
          <h2>Apartment</h2>
          <div class="price">¥100,000</div>
        </div>
      `;
      
      const apartment = scraper['extractApartmentData'](html, 'http://test.com/apartment/456');
      
      expect(apartment).toBeDefined();
      expect(apartment.title).toBe('Apartment');
      expect(apartment.rent).toBe(100000);
      expect(apartment.size).toBe(0);
      expect(apartment.layout).toBe('');
    });
    
    it('should parse Japanese numbers correctly', () => {
      const html = `
        <div class="listing">
          <h2>Test Apartment</h2>
          <div class="price">１２万円</div>
          <div class="size">３０．５㎡</div>
          <div class="age">築１０年</div>
        </div>
      `;
      
      const apartment = scraper['extractApartmentData'](html, 'http://test.com/apartment/789');
      
      expect(apartment.rent).toBe(120000);
      expect(apartment.size).toBe(30.5);
      expect(apartment.age).toBe(10);
    });
  });
  
  describe('extractListingUrls', () => {
    it('should extract listing URLs from search results', () => {
      const html = `
        <div class="search-results">
          <div class="listing-item">
            <a href="/apartment/1234567" class="listing-link">Apartment 1</a>
          </div>
          <div class="listing-item">
            <a href="/apartment/2345678" class="listing-link">Apartment 2</a>
          </div>
          <div class="listing-item">
            <a href="/apartment/3456789" class="listing-link">Apartment 3</a>
          </div>
        </div>
      `;
      
      const urls = scraper['extractListingUrls'](html);
      
      expect(urls).toHaveLength(3);
      expect(urls[0]).toContain('/apartment/1234567');
      expect(urls[1]).toContain('/apartment/2345678');
      expect(urls[2]).toContain('/apartment/3456789');
    });
    
    it('should handle empty results', () => {
      const html = `
        <div class="search-results">
          <p>No results found</p>
        </div>
      `;
      
      const urls = scraper['extractListingUrls'](html);
      
      expect(urls).toHaveLength(0);
    });
  });
  
  describe('processResults', () => {
    it('should enrich results with parsed address data', async () => {
      const apartments = [
        {
          id: '1',
          url: 'http://test.com/1',
          title: 'Test 1',
          rent: 100000,
          size: 25,
          layout: '1K',
          buildingType: 'Mansion',
          age: 5,
          floor: '2F',
          address: '東京都渋谷区道玄坂1-2-3',
          station: { name: 'Shibuya', line: 'JR', walkTime: 5 },
          images: [],
          features: [],
          scrapedAt: new Date(),
          source: 'realestate'
        }
      ];
      
      const processed = await scraper['processResults'](apartments);
      
      expect(processed).toHaveLength(1);
      expect(processed[0].prefecture).toBe('東京都');
      expect(processed[0].city).toBe('渋谷区');
    });
  });
  
  describe('full scraping flow', () => {
    it('should complete a full scraping cycle', async () => {
      const searchHtml = `
        <div class="search-results">
          <a href="/apartment/123">Apartment</a>
        </div>
      `;
      
      const detailHtml = `
        <div class="listing">
          <h2>Nice Apartment</h2>
          <div class="price">¥100,000</div>
          <div class="size">30m²</div>
          <div class="layout">1LDK</div>
          <div class="station">Shibuya Station 5 min walk</div>
        </div>
      `;
      
      (global.fetch as Mock)
        .mockResolvedValueOnce({
          ok: true,
          text: async () => searchHtml
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => detailHtml
        });
      
      const result = await scraper.scrape({
        prefecture: 'tokyo',
        priceRange: { min: 50000, max: 200000 }
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Nice Apartment');
      expect(result.data[0].rent).toBe(100000);
      expect(result.stats.successfulUrls).toBe(1);
    });
    
    it('should handle errors gracefully', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));
      
      const result = await scraper.scrape({
        prefecture: 'tokyo'
      });
      
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.data).toHaveLength(0);
    });
  });
  
  describe('fast mode', () => {
    it('should use concurrent strategy in fast mode', async () => {
      scraper = new UnifiedRealEstateScraper({
        mode: 'fast',
        concurrency: 3,
        features: {
          screenshots: false,
          cache: false,
          proxy: false
        }
      });
      
      const searchHtml = `
        <div class="search-results">
          <a href="/apartment/1">Apt 1</a>
          <a href="/apartment/2">Apt 2</a>
          <a href="/apartment/3">Apt 3</a>
        </div>
      `;
      
      const detailHtml = `
        <div class="listing">
          <h2>Apartment</h2>
          <div class="price">¥80,000</div>
          <div class="size">25m²</div>
        </div>
      `;
      
      (global.fetch as Mock)
        .mockResolvedValueOnce({ ok: true, text: async () => searchHtml })
        .mockResolvedValue({ ok: true, text: async () => detailHtml });
      
      const result = await scraper.scrape({
        prefecture: 'tokyo'
      });
      
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });
  
  describe('getScraperName', () => {
    it('should return correct scraper name', () => {
      expect(scraper['getScraperName']()).toBe('realestate');
    });
  });
  
  describe('getSelectors', () => {
    it('should return site-specific selectors', () => {
      const selectors = scraper['getSelectors']();
      
      expect(selectors).toBeDefined();
      expect(selectors.title).toBeDefined();
      expect(selectors.rent).toBeDefined();
      expect(selectors.size).toBeDefined();
    });
  });
});