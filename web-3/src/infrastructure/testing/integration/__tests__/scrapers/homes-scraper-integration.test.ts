import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HomesScraper } from '~/infrastructure/scrapers/implementations/homes-scraper';
import type { ScrapeParams } from '~/infrastructure/scrapers/base';

// Mock dependencies to avoid import issues
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
    recordRequest: jest.fn()
  }))
}));

describe('Homes Scraper Integration Tests', () => {
  let scraper: HomesScraper;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    scraper = new HomesScraper();
    
    // Mock global fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch as any;
  });

  describe('Data Quality Validation', () => {
    it('should extract all required fields from listing page', async () => {
      const listingHtml = `
        <html>
          <body>
            <div class="mod-mergeBuilding">
              <h2 class="object-header">
                <a href="/chintai/detail/12345">Modern Tokyo Apartment</a>
              </h2>
            </div>
            <div class="mod-mergeBuilding">
              <h2 class="object-header">
                <a href="/chintai/detail/67890">Luxury Shibuya Mansion</a>
              </h2>
            </div>
          </body>
        </html>
      `;

      const detailHtml = `
        <html>
          <body>
            <h1 class="object-header__title">Modern Tokyo Apartment</h1>
            <div class="price-main">
              <span class="price">12.5万円</span>
            </div>
            <div class="floor-plan">
              <span class="area">35.5㎡</span>
              <span class="plan">1LDK</span>
            </div>
            <div class="building-type">マンション</div>
            <div class="building-age">築5年</div>
            <div class="floor-info">3階</div>
            <div class="address">東京都渋谷区道玄坂1-2-3</div>
            <div class="traffic-info">JR山手線 渋谷駅 徒歩5分</div>
            <div class="management-fee">1万円</div>
            <div class="deposit">敷金2ヶ月</div>
            <div class="key-money">礼金1ヶ月</div>
            <div class="photo-list">
              <img src="/thumb/img1.jpg" alt="外観">
              <img src="/thumb/img2.jpg" alt="リビング">
            </div>
            <ul class="merit-list">
              <li>バストイレ別</li>
              <li>エアコン</li>
              <li>オートロック</li>
            </ul>
          </body>
        </html>
      `;

      // Mock fetch responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          text: async () => listingHtml
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => detailHtml
        });

      const params: ScrapeParams = {
        prefecture: 'tokyo',
        city: 'shibuya'
      };

      const result = await scraper.scrape(params);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);

      const apartment = result.data[0];
      expect(apartment.title).toBe('Modern Tokyo Apartment');
      expect(apartment.rent).toBe(125000);
      expect(apartment.size).toBe(35.5);
      expect(apartment.layout).toBe('1LDK');
      expect(apartment.buildingType).toBe('マンション');
      expect(apartment.age).toBe(5);
      expect(apartment.floor).toBe('3階');
      expect(apartment.address).toBe('東京都渋谷区道玄坂1-2-3');
      expect(apartment.station.name).toBe('渋谷駅');
      expect(apartment.station.walkTime).toBe(5);
      expect(apartment.management).toBe(10000);
      expect(apartment.deposit).toBe(2); // 2 months
      expect(apartment.keyMoney).toBe(1); // 1 month
      expect(apartment.images).toHaveLength(2);
      expect(apartment.features).toHaveLength(3);
    });

    it('should handle various price formats correctly', async () => {
      const testCases = [
        { input: '5.8万円', expected: 58000 },
        { input: '12万円', expected: 120000 },
        { input: '58,000円', expected: 58000 },
        { input: '120,000円', expected: 120000 },
        { input: '要問合せ', expected: 0 },
        { input: '', expected: 0 }
      ];

      for (const testCase of testCases) {
        const html = `
          <html>
            <body>
              <h1 class="object-header__title">Test Apartment</h1>
              <div class="price-main">
                <span class="price">${testCase.input}</span>
              </div>
              <div class="traffic-info">JR山手線 渋谷駅 徒歩5分</div>
            </body>
          </html>
        `;

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => '<div class="mod-mergeBuilding"><h2 class="object-header"><a href="/detail/1">Test</a></h2></div>'
        }).mockResolvedValueOnce({
          ok: true,
          text: async () => html
        });

        const result = await scraper.scrape({ prefecture: 'tokyo' });
        
        if (testCase.expected > 0) {
          expect(result.data[0].rent).toBe(testCase.expected);
        } else {
          expect(result.data).toHaveLength(0); // Invalid listings should be filtered out
        }
      }
    });

    it('should extract station information in various formats', async () => {
      const testCases = [
        { 
          input: 'JR山手線 渋谷駅 徒歩5分', 
          expected: { line: 'JR山手線', name: '渋谷駅', walkTime: 5 }
        },
        { 
          input: '東京メトロ銀座線 表参道駅 徒歩10分', 
          expected: { line: '東京メトロ銀座線', name: '表参道駅', walkTime: 10 }
        },
        { 
          input: '複数路線利用可 新宿駅 徒歩8分', 
          expected: { line: '', name: '', walkTime: 0 } // Doesn't match pattern
        }
      ];

      for (const testCase of testCases) {
        const html = `
          <html>
            <body>
              <h1 class="object-header__title">Test Apartment</h1>
              <div class="price-main"><span class="price">10万円</span></div>
              <div class="traffic-info">${testCase.input}</div>
            </body>
          </html>
        `;

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => '<div class="mod-mergeBuilding"><h2 class="object-header"><a href="/detail/1">Test</a></h2></div>'
        }).mockResolvedValueOnce({
          ok: true,
          text: async () => html
        });

        const result = await scraper.scrape({ prefecture: 'tokyo' });
        
        if (testCase.expected.walkTime > 0) {
          const station = result.data[0].station;
          expect(station.line).toBe(testCase.expected.line);
          expect(station.name).toBe(testCase.expected.name);
          expect(station.walkTime).toBe(testCase.expected.walkTime);
        }
      }
    });
  });

  describe('Rate Limiting Compliance', () => {
    it('should respect rate limits between requests', async () => {
      // Configure rate limiting in scraper (it's set in SCRAPER_CONFIGS.homes)
      const startTime = Date.now();

      // Mock multiple pages
      for (let i = 0; i < 3; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <div class="mod-mergeBuilding">
              <h2 class="object-header">
                <a href="/detail/${i}">Apartment ${i}</a>
              </h2>
            </div>
          `
        }).mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <h1 class="object-header__title">Apartment ${i}</h1>
            <div class="price-main"><span class="price">10万円</span></div>
            <div class="traffic-info">JR山手線 渋谷駅 徒歩5分</div>
          `
        });
      }

      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = Date.now() - startTime;

      // Should have some delay due to rate limiting
      expect(duration).toBeGreaterThan(100); // At least some delay
      expect(result.data).toHaveLength(3);
    });
  });

  describe('Error Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // First request succeeds with listing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <div class="mod-mergeBuilding">
            <h2 class="object-header">
              <a href="/detail/1">Apartment 1</a>
            </h2>
          </div>
          <div class="mod-mergeBuilding">
            <h2 class="object-header">
              <a href="/detail/2">Apartment 2</a>
            </h2>
          </div>
        `
      });

      // First detail page fails
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

      // Second detail page succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <h1 class="object-header__title">Apartment 2</h1>
          <div class="price-main"><span class="price">12万円</span></div>
          <div class="traffic-info">JR山手線 新宿駅 徒歩10分</div>
        `
      });

      const result = await scraper.scrape({ prefecture: 'tokyo' });

      // Should get partial results
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Apartment 2');
      expect(result.errors).toHaveLength(0); // Errors are logged but don't bubble up
    });

    it('should handle malformed HTML gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <div class="mod-mergeBuilding">
            <h2 class="object-header">
              <a href="/detail/1">Test</a>
            </h2>
          </div>
        `
      }).mockResolvedValueOnce({
        ok: true,
        text: async () => `
          <html>
            <!-- Malformed/incomplete HTML -->
            <h1 class="object-header__title">Incomplete Apartment
            <div class="price-main">
              <span class="price">要問合せ
            <!-- Missing closing tags -->
          `
      });

      const result = await scraper.scrape({ prefecture: 'tokyo' });

      // Should handle gracefully and filter out invalid data
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // Invalid listings filtered out
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process listings efficiently', async () => {
      const apartmentCount = 50;
      
      // Generate listing page with many apartments
      const listingHtml = `
        <html>
          <body>
            ${Array.from({ length: apartmentCount }, (_, i) => `
              <div class="mod-mergeBuilding">
                <h2 class="object-header">
                  <a href="/detail/${i}">Apartment ${i}</a>
                </h2>
              </div>
            `).join('')}
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => listingHtml
      });

      // Mock detail pages
      for (let i = 0; i < apartmentCount; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => `
            <h1 class="object-header__title">Apartment ${i}</h1>
            <div class="price-main"><span class="price">${8 + i % 10}万円</span></div>
            <div class="traffic-info">JR山手線 駅 徒歩${5 + i % 10}分</div>
          `
        });
      }

      const startTime = performance.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = performance.now() - startTime;

      expect(result.data).toHaveLength(apartmentCount);
      expect(duration).toBeLessThan(apartmentCount * 100); // Should average less than 100ms per apartment
      
      // Verify data integrity
      expect(result.data[0].rent).toBe(80000);
      expect(result.data[9].rent).toBe(170000);
    });
  });

  describe('URL Building', () => {
    it('should build correct URLs for different search parameters', async () => {
      const testCases = [
        {
          params: { prefecture: 'tokyo', city: 'shibuya' },
          expectedUrl: expect.stringContaining('city=shibuya')
        },
        {
          params: { prefecture: 'tokyo', trainLines: ['Yamanote Line'] },
          expectedUrl: expect.stringContaining('railway=jre_yamanote')
        },
        {
          params: { prefecture: 'tokyo', priceRange: { min: 50000, max: 150000 } },
          expectedUrl: expect.stringContaining('price_min=50000&price_max=150000')
        }
      ];

      for (const testCase of testCases) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: async () => '<html></html>'
        });

        await scraper.scrape(testCase.params);

        expect(mockFetch).toHaveBeenCalledWith(
          testCase.expectedUrl,
          expect.any(Object)
        );
      }
    });
  });
});