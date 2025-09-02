import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { vi } from '~/core/testing';
import { SearchService } from '../search.service';
import type { IContainer } from '~/core/di/types';
import type { PrismaClient } from '@prisma/client';
import type { StandardSearchInput, CommuteSearchInput } from '~/types';

// Mock cache
jest.mock('~/lib/cache/search-cache', () => ({
  getSearchCache: vi.fn().mockReturnValue({
    generateKey: vi.fn().mockReturnValue('cache-key'),
    get: vi.fn(),
    set: vi.fn()
  })
}));

// Mock search integration
jest.mock('~/lib/search/search-integration', () => ({
  getSearchIntegrationService: vi.fn().mockReturnValue({
    initiateCommuteSearch: vi.fn().mockResolvedValue({ listId: 'list-123', jobId: 'job-123' }),
    getSearchProgress: vi.fn().mockResolvedValue({ status: 'processing', progress: 50 })
  })
}));

// Mock scraper factory
jest.mock('~/lib/scrapers/scraper-factory', () => ({
  UnifiedScraperFactory: {
    create: vi.fn().mockReturnValue({
      search: vi.fn().mockResolvedValue([
        {
          externalId: 'apt1',
          sourceSite: 'test-site',
          title: 'Test Apartment',
          price: 80000,
          images: [],
          nearestStations: []
        }
      ])
    })
  }
}));

// Mock logging
jest.mock('~/lib/logging/scraper-logger', () => ({
  createScraperLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  })
}));

// Mock dependencies
const mockPrismaClient = {
  apartment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn()
  },
  list: {
    findFirst: vi.fn(),
    findUnique: vi.fn()
  },
  searchSession: {
    findMany: vi.fn()
  },
  station: {
    findMany: vi.fn(),
    findFirst: vi.fn()
  },
  apartmentStation: {
    create: vi.fn()
  },
  scrapingSource: {
    findMany: vi.fn(),
    findFirst: vi.fn()
  }
} as unknown as PrismaClient;

const mockContainer: IContainer = {
  resolve: vi.fn().mockReturnValue(mockPrismaClient),
  register: vi.fn(),
  has: vi.fn(),
  registerSingleton: vi.fn(),
  createScope: vi.fn()
};

describe('SearchService', () => {
  let service: SearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SearchService(mockContainer);
  });

  describe('search', () => {
    it('should perform standard search with filters', async () => {
      const input: StandardSearchInput = {
        filters: {
          priceMin: 50000,
          priceMax: 100000,
          sizeMin: 20,
          layout: ['1K', '1LDK']
        },
        pagination: { page: 1, limit: 20 },
        sort: { field: 'price', order: 'asc' }
      };

      const mockApartments = [
        { id: 'apt1', title: 'Apartment 1', price: 60000 },
        { id: 'apt2', title: 'Apartment 2', price: 80000 }
      ];

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue(mockApartments);
      (mockPrismaClient.apartment.count as any).mockResolvedValue(2);

      const result = await service.search(input);

      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          removed: false,
          AND: expect.arrayContaining([
            { price: { gte: 50000, lte: 100000 } },
            { size: { gte: 20 } },
            { layout: { in: ['1K', '1LDK'] } }
          ])
        }),
        skip: 0,
        take: 20,
        orderBy: { price: 'asc' },
        include: expect.any(Object)
      });

      expect(result).toEqual({
        apartments: mockApartments,
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false
      });
    });

    it('should use cached results if available', async () => {
      const { getSearchCache } = await import('~/lib/cache/search-cache');
      const cache = getSearchCache();
      
      const cachedResult = {
        apartments: [{ id: 'cached1' }],
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false
      };

      (cache.get as any).mockReturnValue(cachedResult);

      const result = await service.search({ filters: {} });

      expect(mockPrismaClient.apartment.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(cachedResult);
    });

    it('should cache results after search', async () => {
      const { getSearchCache } = await import('~/lib/cache/search-cache');
      const cache = getSearchCache();
      
      (cache.get as any).mockReturnValue(null);
      (mockPrismaClient.apartment.findMany as any).mockResolvedValue([]);
      (mockPrismaClient.apartment.count as any).mockResolvedValue(0);

      await service.search({ filters: {} });

      expect(cache.set).toHaveBeenCalledWith(
        'cache-key',
        expect.any(Object),
        1800000 // 30 minutes
      );
    });
  });

  describe('searchByCommuteTime', () => {
    it('should initiate commute search', async () => {
      const input: CommuteSearchInput = {
        workplaceStationId: 'station1',
        maxCommuteMinutes: 30,
        filters: {
          priceMax: 100000
        }
      };

      const result = await service.searchByCommuteTime(input, 'user1');

      expect(result).toEqual({
        listId: 'list-123',
        jobId: 'job-123',
        status: 'pending',
        message: 'Search initiated. Results will be available shortly.'
      });
    });
  });

  describe('getRecentSearches', () => {
    it('should get recent searches with metadata', async () => {
      const mockSearches = [
        {
          id: 'search1',
          userId: 'user1',
          listId: 'list1',
          createdAt: new Date()
        },
        {
          id: 'search2',
          userId: 'user1',
          listId: null,
          createdAt: new Date()
        }
      ];

      const mockList = {
        name: 'Search Results',
        status: 'completed',
        _count: { apartments: 15 }
      };

      (mockPrismaClient.searchSession.findMany as any).mockResolvedValue(mockSearches);
      (mockPrismaClient.list.findUnique as any).mockResolvedValue(mockList);

      const result = await service.getRecentSearches('user1', 5);

      expect(mockPrismaClient.searchSession.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      expect(result[0]).toMatchObject({
        id: 'search1',
        listName: 'Search Results',
        status: 'completed',
        apartmentCount: 15
      });

      expect(result[1]).toMatchObject({
        id: 'search2',
        listId: null
      });
    });
  });

  describe('getPopularSearches', () => {
    it('should return popular search patterns', async () => {
      const mockStations = [
        { id: 'st1', name: '新宿' },
        { id: 'st2', name: '渋谷' }
      ];

      (mockPrismaClient.station.findMany as any).mockResolvedValue(mockStations);

      const result = await service.getPopularSearches();

      expect(result).toMatchObject({
        popularStations: mockStations,
        popularLayouts: expect.arrayContaining(['1K', '1LDK', '2LDK']),
        popularPriceRanges: expect.arrayContaining([
          expect.objectContaining({ label: 'Under ¥80,000' })
        ])
      });
    });
  });

  describe('getSuggestions', () => {
    it('should get station suggestions', async () => {
      const mockStations = [
        { id: 'st1', name: '新宿', nameEn: 'Shinjuku' },
        { id: 'st2', name: '新宿三丁目', nameEn: 'Shinjuku-sanchome' }
      ];

      (mockPrismaClient.station.findMany as any).mockResolvedValue(mockStations);

      const result = await service.getSuggestions('新宿', 'station');

      expect(mockPrismaClient.station.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { name: { contains: '新宿', mode: 'insensitive' } },
            { nameEn: { contains: '新宿', mode: 'insensitive' } }
          ]
        },
        take: 5
      });

      expect(result.stations).toEqual(mockStations);
    });

    it('should get amenity suggestions', async () => {
      const result = await service.getSuggestions('auto', 'amenity');

      expect(result.amenities).toContain('Auto Lock');
    });
  });

  describe('refreshApartments', () => {
    it('should scrape and save new apartments', async () => {
      const mockScrapingSource = { id: 'source1', type: 'test-site' };
      const mockStation = { id: 'st1', name: '新宿' };

      (mockPrismaClient.scrapingSource.findMany as any).mockResolvedValue([mockScrapingSource]);
      (mockPrismaClient.scrapingSource.findFirst as any).mockResolvedValue(mockScrapingSource);
      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(null);
      (mockPrismaClient.apartment.create as any).mockResolvedValue({ id: 'new-apt' });
      (mockPrismaClient.station.findFirst as any).mockResolvedValue(mockStation);
      (mockPrismaClient.apartmentStation.create as any).mockResolvedValue({});

      const result = await service.refreshApartments(
        { priceMax: 100000 },
        'user1'
      );

      expect(result).toMatchObject({
        success: true,
        totalFound: 1,
        newlySaved: 1,
        updated: 0
      });
    });

    it('should update existing apartments', async () => {
      const mockScrapingSource = { id: 'source1', type: 'test-site' };
      const mockExisting = {
        id: 'existing-apt',
        externalId: 'apt1',
        sourceSite: 'test-site'
      };

      (mockPrismaClient.scrapingSource.findMany as any).mockResolvedValue([mockScrapingSource]);
      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(mockExisting);
      (mockPrismaClient.apartment.update as any).mockResolvedValue({});

      const result = await service.refreshApartments(
        { priceMax: 100000 },
        'user1'
      );

      expect(mockPrismaClient.apartment.update).toHaveBeenCalledWith({
        where: { id: 'existing-apt' },
        data: {
          price: 80000,
          availability: expect.any(String),
          updatedAt: expect.any(Date)
        }
      });

      expect(result).toMatchObject({
        success: true,
        totalFound: 1,
        newlySaved: 0,
        updated: 1
      });
    });

    it('should throw error if no active scrapers', async () => {
      (mockPrismaClient.scrapingSource.findMany as any).mockResolvedValue([]);

      await expect(service.refreshApartments({}, 'user1')).rejects.toThrow('No active scrapers available');
    });
  });

  describe('getSearchProgress', () => {
    it('should get search progress for user list', async () => {
      const mockList = { id: 'list1', userId: 'user1' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);

      const result = await service.getSearchProgress('list1', 'user1');

      expect(result).toEqual({
        status: 'processing',
        progress: 50
      });
    });

    it('should throw error if list not found', async () => {
      (mockPrismaClient.list.findFirst as any).mockResolvedValue(null);

      await expect(service.getSearchProgress('list1', 'user1')).rejects.toThrow('List not found');
    });
  });

  describe('fastSearch', () => {
    it('should perform concurrent searches across sources', async () => {
      const mockSources = [
        { type: 'source1' },
        { type: 'source2' }
      ];

      (mockPrismaClient.scrapingSource.findMany as any).mockResolvedValue(mockSources);

      const result = await service.fastSearch(
        { priceMax: 100000 },
        10,
        'user1'
      );

      expect(result).toMatchObject({
        success: true,
        apartments: expect.any(Array),
        stats: expect.objectContaining({
          totalFound: 2,
          successfulSources: 2,
          failedSources: 0
        })
      });
    });

    it('should deduplicate results', async () => {
      const mockSources = [{ type: 'source1' }];

      // Mock scraper to return duplicate apartments
      const { UnifiedScraperFactory } = await import('~/lib/scrapers/scraper-factory');
      (UnifiedScraperFactory.create as any).mockReturnValue({
        search: vi.fn().mockResolvedValue([
          { externalId: 'apt1', sourceSite: 'test', title: 'Apt 1' },
          { externalId: 'apt1', sourceSite: 'test', title: 'Apt 1 Duplicate' }
        ])
      });

      (mockPrismaClient.scrapingSource.findMany as any).mockResolvedValue(mockSources);

      const result = await service.fastSearch({}, 10, 'user1');

      expect(result.apartments).toHaveLength(1);
      expect(result.message).toContain('1 unique apartments');
    });

    it('should handle source failures gracefully', async () => {
      const mockSources = [
        { type: 'source1' },
        { type: 'source2' }
      ];

      // Mock one scraper to fail
      const { UnifiedScraperFactory } = await import('~/lib/scrapers/scraper-factory');
      let callCount = 0;
      (UnifiedScraperFactory.create as any).mockImplementation(() => ({
        search: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Scraper failed');
          }
          return [{ externalId: 'apt2', sourceSite: 'test2' }];
        })
      }));

      (mockPrismaClient.scrapingSource.findMany as any).mockResolvedValue(mockSources);

      const result = await service.fastSearch({}, 10, 'user1');

      expect(result.stats.successfulSources).toBe(1);
      expect(result.stats.failedSources).toBe(1);
    });
  });
});