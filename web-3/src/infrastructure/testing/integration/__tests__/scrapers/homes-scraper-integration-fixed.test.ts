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
    recordRequest: jest.fn(),
    waitForSlot: jest.fn().mockResolvedValue(undefined),
    resetErrors: jest.fn()
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
    it('should extract all required fields from listing and detail pages', async () => {
      // First mock: listing page with apartment links
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

      // Detail pages for each apartment
      const detailHtml1 = `
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

      const detailHtml2 = `
        <html>
          <body>
            <h1 class="object-header__title">Luxury Shibuya Mansion</h1>
            <div class="price-main">
              <span class="price">25万円</span>
            </div>
            <div class="floor-plan">
              <span class="area">65.5㎡</span>
              <span class="plan">2LDK</span>
            </div>
            <div class="building-type">マンション</div>
            <div class="building-age">築3年</div>
            <div class="floor-info">15階</div>
            <div class="address">東京都渋谷区恵比寿4-5-6</div>
            <div class="traffic-info">JR山手線 恵比寿駅 徒歩3分</div>
            <div class="management-fee">2万円</div>
            <div class="deposit">敷金2ヶ月</div>
            <div class="key-money">礼金2ヶ月</div>
          </body>
        </html>
      `;

      // Mock the base scraper's flow properly
      const fetchWithRetryMock = jest.spyOn(scraper as any, 'fetchWithRetry');
      fetchWithRetryMock
        .mockResolvedValueOnce(listingHtml) // First call returns listing
        .mockResolvedValueOnce(detailHtml1) // Second call returns detail for apartment 1
        .mockResolvedValueOnce(detailHtml2); // Third call returns detail for apartment 2

      // Also mock extractListingUrls to return the correct URLs
      const extractListingUrlsMock = jest.spyOn(scraper as any, 'extractListingUrls');
      extractListingUrlsMock.mockReturnValue([
        'https://www.homes.co.jp/chintai/detail/12345',
        'https://www.homes.co.jp/chintai/detail/67890'
      ]);

      const params: ScrapeParams = {
        prefecture: 'tokyo',
        city: 'shibuya'
      };

      const result = await scraper.scrape(params);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);

      // Check first apartment
      const apartment1 = result.data[0];
      expect(apartment1.title).toBe('Modern Tokyo Apartment');
      expect(apartment1.rent).toBe(125000);
      expect(apartment1.size).toBe(35.5);
      expect(apartment1.layout).toBe('1LDK');
      expect(apartment1.buildingType).toBe('マンション');
      expect(apartment1.age).toBe(5);
      expect(apartment1.floor).toBe('3階');
      expect(apartment1.address).toBe('東京都渋谷区道玄坂1-2-3');
      expect(apartment1.station.name).toBe('渋谷駅');
      expect(apartment1.station.walkTime).toBe(5);
      expect(apartment1.management).toBe(10000);
      expect(apartment1.deposit).toBe(2); // 2 months
      expect(apartment1.keyMoney).toBe(1); // 1 month
      expect(apartment1.images).toHaveLength(2);
      expect(apartment1.features).toHaveLength(3);

      // Check second apartment
      const apartment2 = result.data[1];
      expect(apartment2.title).toBe('Luxury Shibuya Mansion');
      expect(apartment2.rent).toBe(250000);
      expect(apartment2.size).toBe(65.5);
      expect(apartment2.layout).toBe('2LDK');
      expect(apartment2.buildingType).toBe('マンション');
      expect(apartment2.age).toBe(3);
      expect(apartment2.floor).toBe('15階');
      expect(apartment2.address).toBe('東京都渋谷区恵比寿4-5-6');
      expect(apartment2.station.name).toBe('恵比寿駅');
      expect(apartment2.station.walkTime).toBe(3);
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
        const fetchWithRetryMock = jest.spyOn(scraper as any, 'fetchWithRetry');
        const extractListingUrlsMock = jest.spyOn(scraper as any, 'extractListingUrls');
        
        // Mock listing page that returns one apartment
        fetchWithRetryMock.mockResolvedValueOnce(`
          <div class="mod-mergeBuilding">
            <h2 class="object-header">
              <a href="/detail/1">Test</a>
            </h2>
          </div>
        `);
        
        extractListingUrlsMock.mockReturnValue(['https://www.homes.co.jp/detail/1']);
        
        // Mock detail page with test price
        fetchWithRetryMock.mockResolvedValueOnce(`
          <html>
            <body>
              <h1 class="object-header__title">Test Apartment</h1>
              <div class="price-main">
                <span class="price">${testCase.input}</span>
              </div>
              <div class="traffic-info">JR山手線 渋谷駅 徒歩5分</div>
            </body>
          </html>
        `);

        const result = await scraper.scrape({ prefecture: 'tokyo' });
        
        if (testCase.expected > 0) {
          expect(result.data[0].rent).toBe(testCase.expected);
        } else {
          expect(result.data).toHaveLength(0); // Invalid listings should be filtered out
        }
        
        jest.clearAllMocks();
      }
    });
  });

  describe('Rate Limiting Compliance', () => {
    it('should respect rate limits between requests', async () => {
      const startTime = Date.now();
      
      const fetchWithRetryMock = jest.spyOn(scraper as any, 'fetchWithRetry');
      const extractListingUrlsMock = jest.spyOn(scraper as any, 'extractListingUrls');
      
      // Mock listing page
      fetchWithRetryMock.mockResolvedValueOnce(`
        <div class="mod-mergeBuilding">
          <h2 class="object-header"><a href="/detail/1">Apt 1</a></h2>
        </div>
        <div class="mod-mergeBuilding">
          <h2 class="object-header"><a href="/detail/2">Apt 2</a></h2>
        </div>
        <div class="mod-mergeBuilding">
          <h2 class="object-header"><a href="/detail/3">Apt 3</a></h2>
        </div>
      `);
      
      extractListingUrlsMock.mockReturnValue([
        'https://www.homes.co.jp/detail/1',
        'https://www.homes.co.jp/detail/2',
        'https://www.homes.co.jp/detail/3'
      ]);
      
      // Mock detail pages
      for (let i = 1; i <= 3; i++) {
        fetchWithRetryMock.mockResolvedValueOnce(`
          <h1 class="object-header__title">Apartment ${i}</h1>
          <div class="price-main"><span class="price">10万円</span></div>
          <div class="traffic-info">JR山手線 渋谷駅 徒歩5分</div>
        `);
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
      const fetchWithRetryMock = jest.spyOn(scraper as any, 'fetchWithRetry');
      const extractListingUrlsMock = jest.spyOn(scraper as any, 'extractListingUrls');
      
      // Mock listing page
      fetchWithRetryMock.mockResolvedValueOnce(`
        <div class="mod-mergeBuilding">
          <h2 class="object-header"><a href="/detail/1">Apartment 1</a></h2>
        </div>
        <div class="mod-mergeBuilding">
          <h2 class="object-header"><a href="/detail/2">Apartment 2</a></h2>
        </div>
      `);
      
      extractListingUrlsMock.mockReturnValue([
        'https://www.homes.co.jp/detail/1',
        'https://www.homes.co.jp/detail/2'
      ]);
      
      // First detail page fails
      fetchWithRetryMock.mockRejectedValueOnce(new Error('Network timeout'));
      
      // Second detail page succeeds
      fetchWithRetryMock.mockResolvedValueOnce(`
        <h1 class="object-header__title">Apartment 2</h1>
        <div class="price-main"><span class="price">12万円</span></div>
        <div class="traffic-info">JR山手線 新宿駅 徒歩10分</div>
      `);

      const result = await scraper.scrape({ prefecture: 'tokyo' });

      // Should get partial results
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].title).toBe('Apartment 2');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process listings efficiently', async () => {
      const apartmentCount = 20; // Reduced for test speed
      
      const fetchWithRetryMock = jest.spyOn(scraper as any, 'fetchWithRetry');
      const extractListingUrlsMock = jest.spyOn(scraper as any, 'extractListingUrls');
      
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
      
      fetchWithRetryMock.mockResolvedValueOnce(listingHtml);
      
      extractListingUrlsMock.mockReturnValue(
        Array.from({ length: apartmentCount }, (_, i) => 
          `https://www.homes.co.jp/detail/${i}`
        )
      );
      
      // Mock detail pages
      for (let i = 0; i < apartmentCount; i++) {
        fetchWithRetryMock.mockResolvedValueOnce(`
          <h1 class="object-header__title">Apartment ${i}</h1>
          <div class="price-main"><span class="price">${8 + i % 10}万円</span></div>
          <div class="traffic-info">JR山手線 駅 徒歩${5 + i % 10}分</div>
        `);
      }

      const startTime = performance.now();
      const result = await scraper.scrape({ prefecture: 'tokyo' });
      const duration = performance.now() - startTime;

      expect(result.data).toHaveLength(apartmentCount);
      expect(duration).toBeLessThan(apartmentCount * 200); // Should average less than 200ms per apartment
      
      // Verify data integrity
      expect(result.data[0].rent).toBe(80000);
      expect(result.data[9].rent).toBe(170000);
    });
  });
});