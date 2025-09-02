import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { vi } from '~/core/testing';
import { ApartmentService } from '../apartment.service';
import type { IContainer } from '~/core/di/types';
import type { PrismaClient } from '@prisma/client';
import type { ApartmentFilters } from '../interfaces';

// Mock job queue
jest.mock('~/lib/jobs/queue', () => ({
  getJobQueue: vi.fn().mockReturnValue({
    add: vi.fn().mockResolvedValue('job-123')
  })
}));

jest.mock('~/lib/jobs/processors', () => ({
  ensureProcessorsInitialized: vi.fn()
}));

// Mock dependencies
const mockPrismaClient = {
  apartment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  route: {
    findMany: vi.fn()
  }
} as unknown as PrismaClient;

const mockContainer: IContainer = {
  resolve: vi.fn().mockReturnValue(mockPrismaClient),
  register: vi.fn(),
  has: vi.fn(),
  registerSingleton: vi.fn(),
  createScope: vi.fn()
};

describe('ApartmentService', () => {
  let service: ApartmentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ApartmentService(mockContainer);
  });

  describe('getById', () => {
    it('should get apartment with all relations', async () => {
      const mockApartment = {
        id: 'apt1',
        title: 'Test Apartment',
        price: 80000,
        images: [{ id: '1', url: 'image1.jpg', order: 0 }],
        nearestStations: [
          {
            station: { id: 'st1', name: '新宿' },
            walkingMinutes: 5
          }
        ],
        routes: [
          {
            toStation: { id: 'st2', name: '東京' },
            duration: 30
          }
        ],
        preferredStation: { id: 'st1', name: '新宿' }
      };

      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(mockApartment);

      const result = await service.getById('apt1');

      expect(mockPrismaClient.apartment.findUnique).toHaveBeenCalledWith({
        where: { id: 'apt1' },
        include: {
          images: { orderBy: { order: 'asc' } },
          nearestStations: {
            include: { station: true },
            orderBy: { walkingMinutes: 'asc' }
          },
          routes: {
            include: { toStation: true },
            orderBy: { duration: 'asc' }
          },
          preferredStation: true
        }
      });

      expect(result).toEqual(mockApartment);
    });

    it('should return null if apartment not found', async () => {
      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByIds', () => {
    it('should get multiple apartments', async () => {
      const mockApartments = [
        { id: 'apt1', title: 'Apartment 1' },
        { id: 'apt2', title: 'Apartment 2' }
      ];

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue(mockApartments);

      const result = await service.getByIds(['apt1', 'apt2']);

      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['apt1', 'apt2'] },
          removed: false
        },
        include: expect.any(Object)
      });

      expect(result).toEqual(mockApartments);
    });

    it('should throw error if more than 50 ids', async () => {
      const ids = Array(51).fill('apt1');

      await expect(service.getByIds(ids)).rejects.toThrow('Maximum 50 apartments can be fetched at once');
    });
  });

  describe('search', () => {
    it('should search apartments with filters', async () => {
      const filters: ApartmentFilters = {
        priceMin: 50000,
        priceMax: 100000,
        sizeMin: 20,
        layout: ['1K', '1LDK'],
        amenities: ['autolock'],
        availability: 'available'
      };

      const mockApartments = [
        { id: 'apt1', title: 'Apartment 1', price: 80000 }
      ];

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue(mockApartments);
      (mockPrismaClient.apartment.count as any).mockResolvedValue(1);

      const result = await service.search(filters, { page: 1, limit: 20 });

      // Verify where clause construction
      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          removed: false,
          AND: expect.arrayContaining([
            { price: { gte: 50000, lte: 100000 } },
            { size: { gte: 20 } },
            { layout: { in: ['1K', '1LDK'] } },
            { amenities: { hasSome: ['autolock'] } },
            { availability: 'available' }
          ])
        }),
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object)
      });

      expect(result).toEqual({
        apartments: mockApartments,
        total: 1,
        page: 1,
        limit: 20,
        hasMore: false,
        nextCursor: undefined
      });
    });

    it('should handle station proximity filters', async () => {
      const filters: ApartmentFilters = {
        stationIds: ['st1', 'st2'],
        maxWalkingMinutes: 10
      };

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue([]);
      (mockPrismaClient.apartment.count as any).mockResolvedValue(0);

      await service.search(filters);

      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            {
              nearestStations: {
                some: {
                  stationId: { in: ['st1', 'st2'] },
                  walkingMinutes: { lte: 10 }
                }
              }
            }
          ])
        }),
        skip: 0,
        take: 20,
        orderBy: expect.any(Object),
        include: expect.any(Object)
      });
    });

    it('should handle ward exclusion', async () => {
      const filters: ApartmentFilters = {
        excludeWards: ['渋谷区', '新宿区']
      };

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue([]);
      (mockPrismaClient.apartment.count as any).mockResolvedValue(0);

      await service.search(filters);

      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { ward: { notIn: ['渋谷区', '新宿区'] } }
          ])
        }),
        skip: 0,
        take: 20,
        orderBy: expect.any(Object),
        include: expect.any(Object)
      });
    });

    it('should handle pagination and sorting', async () => {
      (mockPrismaClient.apartment.findMany as any).mockResolvedValue([]);
      (mockPrismaClient.apartment.count as any).mockResolvedValue(0);

      await service.search(
        {},
        { page: 2, limit: 10 },
        { field: 'price', order: 'asc' }
      );

      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        where: { removed: false },
        skip: 10,
        take: 10,
        orderBy: { price: 'asc' },
        include: expect.any(Object)
      });
    });
  });

  describe('getRoutes', () => {
    it('should get routes and identify missing destinations', async () => {
      const mockRoutes = [
        { toStationId: 'st1', duration: 30 },
        { toStationId: 'st2', duration: 45 }
      ];

      (mockPrismaClient.route.findMany as any).mockResolvedValue(mockRoutes);

      const result = await service.getRoutes('apt1', ['st1', 'st2', 'st3']);

      expect(mockPrismaClient.route.findMany).toHaveBeenCalledWith({
        where: {
          apartmentId: 'apt1',
          toStationId: { in: ['st1', 'st2', 'st3'] }
        },
        orderBy: { duration: 'asc' }
      });

      expect(result).toEqual({
        routes: mockRoutes,
        missingDestinations: ['st3']
      });
    });

    it('should throw error if more than 10 destinations', async () => {
      const destinations = Array(11).fill('st1');

      await expect(service.getRoutes('apt1', destinations)).rejects.toThrow('Maximum 10 destinations allowed');
    });
  });

  describe('create', () => {
    it('should create apartment with relations', async () => {
      const apartmentData = {
        title: 'New Apartment',
        price: 100000,
        images: [{ url: 'image1.jpg', order: 0 }],
        nearestStations: [{ stationId: 'st1', walkingMinutes: 5 }]
      };

      const mockCreated = {
        id: 'apt1',
        ...apartmentData,
        scrapedAt: expect.any(Date)
      };

      (mockPrismaClient.apartment.create as any).mockResolvedValue(mockCreated);

      const result = await service.create(apartmentData);

      expect(mockPrismaClient.apartment.create).toHaveBeenCalledWith({
        data: {
          title: 'New Apartment',
          price: 100000,
          scrapedAt: expect.any(Date),
          images: {
            create: apartmentData.images
          },
          nearestStations: {
            create: apartmentData.nearestStations
          }
        },
        include: {
          images: true,
          nearestStations: {
            include: { station: true }
          }
        }
      });

      expect(result).toEqual(mockCreated);
    });
  });

  describe('updateAvailability', () => {
    it('should update apartment availability', async () => {
      const mockUpdated = {
        id: 'apt1',
        availability: 'occupied'
      };

      (mockPrismaClient.apartment.update as any).mockResolvedValue(mockUpdated);

      const result = await service.updateAvailability('apt1', 'occupied');

      expect(mockPrismaClient.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt1' },
        data: { availability: 'occupied' }
      });

      expect(result).toEqual(mockUpdated);
    });
  });

  describe('updatePreferredStation', () => {
    it('should update preferred station', async () => {
      const mockUpdated = {
        id: 'apt1',
        preferredStationId: 'st1',
        preferredStation: { id: 'st1', name: '新宿' }
      };

      (mockPrismaClient.apartment.update as any).mockResolvedValue(mockUpdated);

      const result = await service.updatePreferredStation('apt1', 'st1');

      expect(mockPrismaClient.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt1' },
        data: { preferredStationId: 'st1' },
        include: { preferredStation: true }
      });

      expect(result).toEqual(mockUpdated);
    });

    it('should clear preferred station', async () => {
      const mockUpdated = {
        id: 'apt1',
        preferredStationId: null,
        preferredStation: null
      };

      (mockPrismaClient.apartment.update as any).mockResolvedValue(mockUpdated);

      const result = await service.updatePreferredStation('apt1', null);

      expect(mockPrismaClient.apartment.update).toHaveBeenCalledWith({
        where: { id: 'apt1' },
        data: { preferredStationId: null },
        include: { preferredStation: true }
      });

      expect(result).toEqual(mockUpdated);
    });
  });

  describe('getAvailableWards', () => {
    it('should get distinct wards', async () => {
      const mockWards = [
        { ward: '渋谷区' },
        { ward: '新宿区' },
        { ward: '港区' }
      ];

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue(mockWards);

      const result = await service.getAvailableWards();

      expect(mockPrismaClient.apartment.findMany).toHaveBeenCalledWith({
        select: { ward: true },
        distinct: ['ward'],
        where: {
          ward: {
            not: null
          }
        },
        orderBy: { ward: 'asc' }
      });

      expect(result).toEqual(['渋谷区', '新宿区', '港区']);
    });

    it('should filter out null and empty wards', async () => {
      const mockWards = [
        { ward: '渋谷区' },
        { ward: null },
        { ward: '' },
        { ward: '新宿区' }
      ];

      (mockPrismaClient.apartment.findMany as any).mockResolvedValue(mockWards);

      const result = await service.getAvailableWards();

      expect(result).toEqual(['渋谷区', '新宿区']);
    });
  });

  describe('refreshData', () => {
    it('should create job to refresh apartment data', async () => {
      const mockApartment = {
        id: 'apt1',
        externalId: 'ext1',
        sourceUrl: 'https://example.com/apt1',
        sourceSite: 'realestate.co.jp'
      };

      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(mockApartment);

      const result = await service.refreshData('apt1', 'user1');

      expect(result).toEqual({
        success: true,
        jobId: 'job-123',
        message: 'Refreshing apartment data. Job ID: job-123'
      });
    });

    it('should throw error if apartment not found', async () => {
      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(null);

      await expect(service.refreshData('nonexistent')).rejects.toThrow('Apartment not found');
    });
  });

  describe('delete', () => {
    it('should delete apartment', async () => {
      (mockPrismaClient.apartment.delete as any).mockResolvedValue({});

      await service.delete('apt1');

      expect(mockPrismaClient.apartment.delete).toHaveBeenCalledWith({
        where: { id: 'apt1' }
      });
    });
  });
});