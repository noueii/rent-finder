import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMocks } from '~/infrastructure/testing/mocks/prisma';
import { vi } from '~/core/testing';
import { ApartmentRepository } from '../implementations/apartment.repository';
import type { ApartmentSearchFilters } from '~/types/apartment';



describe('ApartmentRepository', () => {
  
  let repository: ApartmentRepository;

  beforeEach(() => {
    resetPrismaMocks();
    
    repository = new ApartmentRepository(prismaMock as any);
  });

  describe('findById', () => {
    it('should find apartment by id with relations', async () => {
      const mockApartment = {
        id: '1',
        title: 'Test Apartment',
        price: 100000,
        images: [],
        nearestStations: [],
        routes: []
      };

      prismaMock.apartment.findUnique.mockResolvedValue(mockApartment as any);

      const result = await repository.findById('1', true);

      expect(prismaMock.apartment.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.objectContaining({
          images: expect.any(Object),
          nearestStations: expect.any(Object),
          routes: expect.any(Object)
        })
      });
      expect(result).toEqual(mockApartment);
    });

    it('should find apartment by id without relations', async () => {
      const mockApartment = {
        id: '1',
        title: 'Test Apartment',
        price: 100000
      };

      prismaMock.apartment.findUnique.mockResolvedValue(mockApartment as any);

      const result = await repository.findById('1', false);

      expect(prismaMock.apartment.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: undefined
      });
      expect(result).toEqual(mockApartment);
    });
  });

  describe('search', () => {
    it('should search apartments with filters', async () => {
      const filters: ApartmentSearchFilters = {
        priceMin: 50000,
        priceMax: 150000,
        sizeMin: 20,
        layout: ['1K', '1LDK']
      };

      const mockApartments = [
        { id: '1', title: 'Apartment 1', price: 80000 },
        { id: '2', title: 'Apartment 2', price: 120000 }
      ];

      prismaMock.apartment.findMany.mockResolvedValue(mockApartments);
      prismaMock.apartment.count.mockResolvedValue(2);

      const result = await repository.search(filters, { page: 1, limit: 20 });

      expect(prismaMock.apartment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          removed: false,
          price: { gte: 50000, lte: 150000 },
          size: { gte: 20 },
          layout: { in: ['1K', '1LDK'] }
        }),
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
        include: expect.any(Object)
      });

      expect(result).toEqual({
        apartments: mockApartments,
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false,
        nextCursor: undefined
      });
    });

    it('should handle station filters', async () => {
      const filters: ApartmentSearchFilters = {
        stationIds: ['station1', 'station2'],
        maxWalkingMinutes: 10
      };

      prismaMock.apartment.findMany.mockResolvedValue([]);
      prismaMock.apartment.count.mockResolvedValue(0);

      await repository.search(filters, { page: 1, limit: 20 });

      expect(prismaMock.apartment.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          nearestStations: {
            some: {
              stationId: { in: ['station1', 'station2'] },
              walkingMinutes: { lte: 10 }
            }
          }
        }),
        orderBy: expect.any(Object),
        skip: 0,
        take: 20,
        include: expect.any(Object)
      });
    });
  });

  describe('updateRoutes', () => {
    it('should update apartment routes in a transaction', async () => {
      const apartmentId = '1';
      const routes = [
        { toStationId: 'station1', commuteMinutes: 30, transferCount: 1, routeDetails: {} },
        { toStationId: 'station2', commuteMinutes: 45, transferCount: 2, routeDetails: {} }
      ];

      (prismaMock.$transaction as any).mockImplementation(async (fn: any) => {
        await fn({
          route: {
            deleteMany: vi.fn(),
            createMany: vi.fn()
          }
        });
      });

      await repository.updateRoutes(apartmentId, routes);

      expect(prismaMock.$transaction).toHaveBeenCalled();
    });
  });

  describe('statistics', () => {
    it('should calculate average price', async () => {
      prismaMock.apartment.aggregate.mockResolvedValue({
        _avg: { price: 85000 }
      } as any);

      const result = await repository.getAveragePrice();

      expect(prismaMock.apartment.aggregate).toHaveBeenCalledWith({
        where: { removed: false },
        _avg: { price: true }
      });
      expect(result).toBe(85000);
    });

    it('should return 0 for null average', async () => {
      prismaMock.apartment.aggregate.mockResolvedValue({
        _avg: { price: null }
      } as any);

      const result = await repository.getAveragePrice();

      expect(result).toBe(0);
    });
  });
});