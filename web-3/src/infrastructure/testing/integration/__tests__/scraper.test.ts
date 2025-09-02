import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  server,
  externalServiceHandlers,
  mockScraperResponses,
  mockServiceFailure,
  mockServiceDelay,
  createTestPrismaClient,
  clearDatabase,
} from '../index';
import type { PrismaClient } from '@prisma/client';

// Setup test environment and MSW
setupTestEnvironment();

describe('Scraper Integration Tests', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    server.use(...externalServiceHandlers);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    server.resetHandlers();
  });

  describe('SUUMO Scraper', () => {
    it('should scrape apartment listings successfully', async () => {
      // Mock HTML response
      const mockHtml = mockScraperResponses.suumo.listPage();
      
      // Import scraper (adjust path as needed)
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      // Scrape listings
      const results = await scraper.scrapeListings({
        area: 'tokyo',
        maxRent: 150000,
        maxCommute: 30,
      });

      expect(results).toBeDefined();
      expect(results.apartments).toBeInstanceOf(Array);
      expect(results.apartments.length).toBeGreaterThan(0);

      // Verify data structure
      const apartment = results.apartments[0];
      expect(apartment).toHaveProperty('title');
      expect(apartment).toHaveProperty('rent');
      expect(apartment).toHaveProperty('nearestStation');
      expect(apartment).toHaveProperty('walkingTime');

      // Verify saved to database
      const dbApartments = await prisma.apartment.findMany();
      expect(dbApartments.length).toBe(results.apartments.length);
    });

    it('should scrape apartment details with all fields', async () => {
      const mockHtml = mockScraperResponses.suumo.detailPage();
      
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      const details = await scraper.scrapeDetails('http://suumo.jp/property/12345');

      expect(details).toBeDefined();
      expect(details.title).toBeTruthy();
      expect(details.rent).toBeGreaterThan(0);
      expect(details.size).toBeGreaterThan(0);
      expect(details.layout).toBeTruthy();
      expect(details.images).toBeInstanceOf(Array);
      expect(details.description).toBeTruthy();
    });

    it('should handle pagination correctly', async () => {
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      // Scrape multiple pages
      const allResults = [];
      for (let page = 1; page <= 3; page++) {
        const results = await scraper.scrapeListings({
          area: 'tokyo',
          page,
        });
        allResults.push(...results.apartments);
      }

      expect(allResults.length).toBeGreaterThan(10);

      // Check for duplicates
      const uniqueIds = new Set(allResults.map(a => a.externalId));
      expect(uniqueIds.size).toBe(allResults.length);
    });

    it('should update existing apartments on rescrape', async () => {
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      // First scrape
      await scraper.scrapeListings({ area: 'tokyo' });
      const firstCount = await prisma.apartment.count();

      // Wait and scrape again
      await new Promise(resolve => setTimeout(resolve, 100));
      await scraper.scrapeListings({ area: 'tokyo' });
      const secondCount = await prisma.apartment.count();

      // Should not duplicate
      expect(secondCount).toBe(firstCount);

      // Should update lastScraped
      const apartments = await prisma.apartment.findMany();
      const recentlyScraped = apartments.filter(
        a => new Date().getTime() - a.lastScraped.getTime() < 1000
      );
      expect(recentlyScraped.length).toBe(apartments.length);
    });
  });

  describe('HOMES Scraper', () => {
    it('should scrape from HOMES API', async () => {
      const { HomesScraper } = await import('~/infrastructure/scrapers/homes');
      const scraper = new HomesScraper(prisma);

      const results = await scraper.searchApartments({
        stationId: 'tokyo-station',
        maxWalkTime: 15,
        maxRent: 120000,
      });

      expect(results).toBeDefined();
      expect(results.items).toBeInstanceOf(Array);
      expect(results.items.length).toBeGreaterThan(0);

      // Verify station association
      const apartment = results.items[0];
      expect(apartment.station).toBeDefined();
      expect(apartment.station.walkTime).toBeLessThanOrEqual(15);
    });
  });

  describe('Multi-Source Aggregation', () => {
    it('should aggregate results from multiple scrapers', async () => {
      const { ScraperAggregator } = await import('~/infrastructure/scrapers/aggregator');
      const aggregator = new ScraperAggregator(prisma);

      // Run all scrapers
      const results = await aggregator.searchAllSources({
        workStationId: 'tokyo-station',
        maxCommuteTime: 30,
        filters: {
          maxRent: 150000,
          minSize: 25,
        },
      });

      expect(results.totalCount).toBeGreaterThan(0);
      expect(results.sources).toContain('SUUMO');
      expect(results.sources).toContain('HOMES');

      // Check deduplication
      const uniqueAddresses = new Set(results.apartments.map(a => a.address));
      expect(uniqueAddresses.size).toBeLessThanOrEqual(results.apartments.length);
    });

    it('should handle partial scraper failures gracefully', async () => {
      // Make SUUMO fail
      server.use(mockServiceFailure('suumo'));

      const { ScraperAggregator } = await import('~/infrastructure/scrapers/aggregator');
      const aggregator = new ScraperAggregator(prisma);

      const results = await aggregator.searchAllSources({
        workStationId: 'tokyo-station',
        maxCommuteTime: 30,
      });

      // Should still get results from other sources
      expect(results.totalCount).toBeGreaterThan(0);
      expect(results.sources).not.toContain('SUUMO');
      expect(results.sources).toContain('HOMES');
      expect(results.errors).toContainEqual(
        expect.objectContaining({
          source: 'SUUMO',
          error: expect.stringContaining('unavailable'),
        })
      );
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('should respect rate limits', async () => {
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      const startTime = Date.now();
      
      // Make multiple requests
      const requests = Array.from({ length: 5 }, (_, i) =>
        scraper.scrapeListings({ area: 'tokyo', page: i + 1 })
      );

      await Promise.all(requests);
      
      const duration = Date.now() - startTime;

      // Should take at least 4 seconds for 5 requests (1 second between each)
      expect(duration).toBeGreaterThanOrEqual(4000);
    });

    it('should handle timeout gracefully', async () => {
      // Mock slow service
      server.use(mockServiceDelay('suumo', 10000));

      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      await expect(
        scraper.scrapeListings({ area: 'tokyo' })
      ).rejects.toThrow(/timeout/i);
    });
  });

  describe('Data Validation and Cleaning', () => {
    it('should validate and clean scraped data', async () => {
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      // Mock response with invalid data
      server.use(
        rest.get('*', (req, res, ctx) => {
          return res(ctx.text(`
            <div class="property-item">
              <h3 class="title"></h3> <!-- Empty title -->
              <span class="rent">invalid</span> <!-- Invalid rent -->
              <span class="size">-10</span> <!-- Negative size -->
            </div>
          `));
        })
      );

      const results = await scraper.scrapeListings({ area: 'tokyo' });

      // Should filter out invalid entries
      expect(results.apartments.every(a => a.title)).toBe(true);
      expect(results.apartments.every(a => a.rent > 0)).toBe(true);
      expect(results.apartments.every(a => a.size === null || a.size > 0)).toBe(true);
    });

    it('should geocode addresses when coordinates missing', async () => {
      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      const apartment = await scraper.scrapeDetails('http://suumo.jp/property/12345');

      // Should have coordinates
      expect(apartment.latitude).toBeDefined();
      expect(apartment.longitude).toBeDefined();
      expect(apartment.latitude).toBeGreaterThanOrEqual(-90);
      expect(apartment.latitude).toBeLessThanOrEqual(90);
      expect(apartment.longitude).toBeGreaterThanOrEqual(-180);
      expect(apartment.longitude).toBeLessThanOrEqual(180);
    });
  });

  describe('Station Matching', () => {
    it('should match scraped stations to database stations', async () => {
      // Pre-populate stations
      await prisma.station.createMany({
        data: [
          { stationId: 'tokyo-1', name: 'Tokyo', nameKana: 'とうきょう', latitude: 35.6812, longitude: 139.7671 },
          { stationId: 'shinjuku-1', name: 'Shinjuku', nameKana: 'しんじゅく', latitude: 35.6896, longitude: 139.7006 },
        ],
      });

      const { SuumoScraper } = await import('~/infrastructure/scrapers/suumo');
      const scraper = new SuumoScraper(prisma);

      // Mock response with station names
      server.use(
        rest.get('*', (req, res, ctx) => {
          return res(ctx.text(`
            <div class="property-item">
              <h3 class="title">Test Apartment</h3>
              <span class="rent">100000円</span>
              <span class="station">Tokyo駅 徒歩10分</span>
            </div>
          `));
        })
      );

      const results = await scraper.scrapeListings({ area: 'tokyo' });
      
      // Should match to existing station
      const apartment = await prisma.apartment.findFirst({
        include: {
          nearbyStations: {
            include: { station: true },
          },
        },
      });

      expect(apartment?.nearbyStations).toHaveLength(1);
      expect(apartment?.nearbyStations[0].station.name).toBe('Tokyo');
      expect(apartment?.nearbyStations[0].walkingTime).toBe(10);
    });
  });
});