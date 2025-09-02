import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnifiedHomesAtScraper } from '../homes-at-unified';
import { UnifiedHomesRoomScraper } from '../homes-room-unified';
import type { ScraperConfig, Property } from '../../types';

// Mock CheerioScraper to avoid import issues
jest.mock('../../core/cheerio-scraper', () => ({
  CheerioScraper: class {
    constructor() {}
    protected async fetchPage(url: string) {
      return '';
    }
  }
}));

describe('Homes Scraper Validation', () => {
  const config: ScraperConfig = {
    baseUrl: 'https://www.homes.co.jp',
    pageSize: 20,
    maxRetries: 3,
    retryDelay: 1000,
    rateLimit: { requests: 10, period: 60000 },
    userAgent: 'Test Agent',
  };

  describe('Homes AT Scraper', () => {
    let scraper: UnifiedHomesAtScraper;

    beforeEach(() => {
      jest.clearAllMocks();
      scraper = new UnifiedHomesAtScraper(config);
    });

    it('should parse property listings correctly', async () => {
      const mockHtml = `
        <div class="moduleInner prg-building-freeword-hit-list">
          <section class="bukken-item-cassette">
            <div class="bukken-detail-link-area">
              <h2 class="bukken-name">
                <a href="/detail/12345">Modern Apartment in Shibuya</a>
              </h2>
            </div>
            <div class="bukken-item-info">
              <ul class="bukken-rent-price">
                <li class="bukken-rent-price">
                  <span class="bukken-rent-price-number">120,000</span>円
                </li>
              </ul>
              <table class="bukken-info-table">
                <tr>
                  <th>間取り</th>
                  <td>1LDK</td>
                </tr>
                <tr>
                  <th>専有面積</th>
                  <td>35.5m²</td>
                </tr>
              </table>
            </div>
            <div class="bukken-item-station">
              <div class="bukken-station-info">
                JR山手線「渋谷」駅 徒歩5分
              </div>
            </div>
          </section>
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ area: 'tokyo', page: 1 });

      expect(results.properties).toHaveLength(1);
      const property = results.properties[0];
      
      expect(property.title).toBe('Modern Apartment in Shibuya');
      expect(property.rent).toBe(120000);
      expect(property.layout).toBe('1LDK');
      expect(property.size).toBe(35.5);
      expect(property.nearestStation).toBe('渋谷');
      expect(property.walkingTime).toBe(5);
      expect(property.url).toBe('https://www.homes.co.jp/detail/12345');
    });

    it('should handle multiple properties', async () => {
      const mockHtml = `
        <div class="moduleInner prg-building-freeword-hit-list">
          ${Array.from({ length: 5 }, (_, i) => `
            <section class="bukken-item-cassette">
              <div class="bukken-detail-link-area">
                <h2 class="bukken-name">
                  <a href="/detail/${10000 + i}">Apartment ${i + 1}</a>
                </h2>
              </div>
              <div class="bukken-item-info">
                <ul class="bukken-rent-price">
                  <li class="bukken-rent-price">
                    <span class="bukken-rent-price-number">${80000 + i * 10000}</span>円
                  </li>
                </ul>
                <table class="bukken-info-table">
                  <tr>
                    <th>間取り</th>
                    <td>${i % 2 === 0 ? '1K' : '1LDK'}</td>
                  </tr>
                  <tr>
                    <th>専有面積</th>
                    <td>${25 + i * 5}m²</td>
                  </tr>
                </table>
              </div>
              <div class="bukken-item-station">
                <div class="bukken-station-info">
                  JR山手線「新宿」駅 徒歩${5 + i}分
                </div>
              </div>
            </section>
          `).join('')}
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(results.properties).toHaveLength(5);
      expect(results.properties[0].rent).toBe(80000);
      expect(results.properties[4].rent).toBe(120000);
      expect(results.properties[0].walkingTime).toBe(5);
      expect(results.properties[4].walkingTime).toBe(9);
    });

    it('should extract details correctly', async () => {
      const detailHtml = `
        <div class="bukken-detail">
          <h1>Luxury Apartment in Roppongi</h1>
          <div class="bukken-detail-rent">
            <span class="rent-price">250,000</span>円
          </div>
          <table class="bukken-detail-table">
            <tr>
              <th>間取り</th>
              <td>2LDK</td>
            </tr>
            <tr>
              <th>専有面積</th>
              <td>65.8m²</td>
            </tr>
            <tr>
              <th>所在地</th>
              <td>東京都港区六本木1-2-3</td>
            </tr>
            <tr>
              <th>築年月</th>
              <td>2020年3月</td>
            </tr>
          </table>
          <div class="bukken-station">
            東京メトロ日比谷線「六本木」駅 徒歩3分
          </div>
          <div class="bukken-description">
            高級マンション、ペット可、オートロック付き
          </div>
          <div class="bukken-images">
            <img src="/images/1.jpg" alt="外観">
            <img src="/images/2.jpg" alt="リビング">
          </div>
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(detailHtml);
      (scraper as any).fetchPage = mockFetch;

      const details = await scraper.scrapeDetails('https://www.homes.co.jp/detail/12345');

      expect(details.title).toBe('Luxury Apartment in Roppongi');
      expect(details.rent).toBe(250000);
      expect(details.layout).toBe('2LDK');
      expect(details.size).toBe(65.8);
      expect(details.address).toBe('東京都港区六本木1-2-3');
      expect(details.buildingAge).toBe('2020年3月');
      expect(details.nearestStation).toBe('六本木');
      expect(details.walkingTime).toBe(3);
      expect(details.description).toContain('高級マンション');
      expect(details.images).toHaveLength(2);
    });

    it('should handle missing data gracefully', async () => {
      const incompleteHtml = `
        <div class="moduleInner prg-building-freeword-hit-list">
          <section class="bukken-item-cassette">
            <div class="bukken-detail-link-area">
              <h2 class="bukken-name">
                <a href="/detail/99999">Incomplete Listing</a>
              </h2>
            </div>
            <div class="bukken-item-info">
              <ul class="bukken-rent-price">
                <li class="bukken-rent-price">
                  <span class="bukken-rent-price-number">要問合せ</span>
                </li>
              </ul>
              <table class="bukken-info-table">
                <tr>
                  <th>間取り</th>
                  <td>-</td>
                </tr>
              </table>
            </div>
          </section>
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(incompleteHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(results.properties).toHaveLength(0); // Should filter out invalid listings
    });
  });

  describe('Homes Room Scraper', () => {
    let scraper: UnifiedHomesRoomScraper;

    beforeEach(() => {
      scraper = new UnifiedHomesRoomScraper(config);
    });

    it('should parse room listings correctly', async () => {
      const mockHtml = `
        <div class="result-list">
          <article class="property">
            <h3 class="property-title">
              <a href="/room/detail/12345">Cozy Studio in Meguro</a>
            </h3>
            <div class="property-price">
              <span class="price-num">65,000</span>円/月
            </div>
            <dl class="property-details">
              <dt>間取り</dt>
              <dd>ワンルーム</dd>
              <dt>面積</dt>
              <dd>18.5m²</dd>
              <dt>最寄駅</dt>
              <dd>JR山手線 目黒駅 徒歩8分</dd>
            </dl>
          </article>
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ area: 'tokyo', page: 1 });

      expect(results.properties).toHaveLength(1);
      const property = results.properties[0];
      
      expect(property.title).toBe('Cozy Studio in Meguro');
      expect(property.rent).toBe(65000);
      expect(property.layout).toBe('ワンルーム');
      expect(property.size).toBe(18.5);
      expect(property.nearestStation).toBe('目黒');
      expect(property.walkingTime).toBe(8);
    });
  });

  describe('Data Validation', () => {
    it('should validate rent prices', async () => {
      const scraper = new UnifiedHomesAtScraper(config);
      const mockHtml = `
        <div class="moduleInner prg-building-freeword-hit-list">
          <section class="bukken-item-cassette">
            <h2 class="bukken-name"><a href="/1">Valid</a></h2>
            <span class="bukken-rent-price-number">100,000</span>円
          </section>
          <section class="bukken-item-cassette">
            <h2 class="bukken-name"><a href="/2">Invalid - Zero</a></h2>
            <span class="bukken-rent-price-number">0</span>円
          </section>
          <section class="bukken-item-cassette">
            <h2 class="bukken-name"><a href="/3">Invalid - Negative</a></h2>
            <span class="bukken-rent-price-number">-50000</span>円
          </section>
          <section class="bukken-item-cassette">
            <h2 class="bukken-name"><a href="/4">Invalid - Too High</a></h2>
            <span class="bukken-rent-price-number">10,000,000</span>円
          </section>
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      // Should only include valid rent
      expect(results.properties).toHaveLength(1);
      expect(results.properties[0].rent).toBe(100000);
    });

    it('should validate walking times', async () => {
      const scraper = new UnifiedHomesAtScraper(config);
      const mockHtml = `
        <div class="moduleInner prg-building-freeword-hit-list">
          <section class="bukken-item-cassette">
            <h2 class="bukken-name"><a href="/1">Valid</a></h2>
            <span class="bukken-rent-price-number">100,000</span>円
            <div class="bukken-station-info">渋谷駅 徒歩10分</div>
          </section>
          <section class="bukken-item-cassette">
            <h2 class="bukken-name"><a href="/2">Too Far</a></h2>
            <span class="bukken-rent-price-number">80,000</span>円
            <div class="bukken-station-info">渋谷駅 徒歩120分</div>
          </section>
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      // Both should be included but with reasonable walking times
      expect(results.properties).toHaveLength(2);
      expect(results.properties[0].walkingTime).toBe(10);
      expect(results.properties[1].walkingTime).toBeLessThanOrEqual(60); // Capped at reasonable max
    });
  });

  describe('Rate Limiting', () => {
    it('should respect rate limits', async () => {
      const scraper = new UnifiedHomesAtScraper({
        ...config,
        rateLimit: { requests: 2, period: 1000 },
      });

      const mockFetch = jest.fn().mockResolvedValue('<html></html>');
      (scraper as any).fetchPage = mockFetch;

      const startTime = Date.now();
      
      // Make 3 requests
      await Promise.all([
        scraper.scrapeListings({ page: 1 }),
        scraper.scrapeListings({ page: 2 }),
        scraper.scrapeListings({ page: 3 }),
      ]);

      const duration = Date.now() - startTime;

      // Should take at least 1 second for rate limiting
      expect(duration).toBeGreaterThanOrEqual(900); // Allow small margin
    });
  });

  describe('Error Recovery', () => {
    it('should retry on network errors', async () => {
      const scraper = new UnifiedHomesAtScraper({
        ...config,
        maxRetries: 2,
        retryDelay: 100,
      });

      const mockFetch = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(`
          <div class="moduleInner prg-building-freeword-hit-list">
            <section class="bukken-item-cassette">
              <h2 class="bukken-name"><a href="/1">Success after retry</a></h2>
              <span class="bukken-rent-price-number">100,000</span>円
            </section>
          </div>
        `);

      (scraper as any).fetchPage = mockFetch;

      const results = await scraper.scrapeListings({ page: 1 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(results.properties).toHaveLength(1);
      expect(results.properties[0].title).toBe('Success after retry');
    });

    it('should fail after max retries', async () => {
      const scraper = new UnifiedHomesAtScraper({
        ...config,
        maxRetries: 1,
        retryDelay: 50,
      });

      const mockFetch = jest.fn()
        .mockRejectedValue(new Error('Persistent error'));

      (scraper as any).fetchPage = mockFetch;

      await expect(scraper.scrapeListings({ page: 1 }))
        .rejects.toThrow('Persistent error');

      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe('Performance Benchmarks', () => {
    it('should parse 100 properties in reasonable time', async () => {
      const scraper = new UnifiedHomesAtScraper(config);
      const mockHtml = `
        <div class="moduleInner prg-building-freeword-hit-list">
          ${Array.from({ length: 100 }, (_, i) => `
            <section class="bukken-item-cassette">
              <h2 class="bukken-name"><a href="/detail/${i}">Apartment ${i}</a></h2>
              <span class="bukken-rent-price-number">${80000 + i * 1000}</span>円
              <div class="bukken-station-info">Station ${i % 10} 徒歩${5 + (i % 10)}分</div>
              <table class="bukken-info-table">
                <tr><th>間取り</th><td>${i % 3 === 0 ? '1K' : '1LDK'}</td></tr>
                <tr><th>専有面積</th><td>${20 + i % 30}m²</td></tr>
              </table>
            </section>
          `).join('')}
        </div>
      `;

      const mockFetch = jest.fn().mockResolvedValue(mockHtml);
      (scraper as any).fetchPage = mockFetch;

      const startTime = performance.now();
      const results = await scraper.scrapeListings({ page: 1 });
      const duration = performance.now() - startTime;

      expect(results.properties).toHaveLength(100);
      expect(duration).toBeLessThan(200); // Should parse in under 200ms
    });
  });
});