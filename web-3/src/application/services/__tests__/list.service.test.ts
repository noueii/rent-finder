import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { vi } from '~/core/testing';
import { ListService } from '../list.service';
import { TRPCError } from '@trpc/server';
import type { IContainer } from '~/core/di/types';
import type { PrismaClient } from '@prisma/client';

// Mock dependencies
const mockPrismaClient = {
  list: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn()
  },
  apartmentList: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn()
  },
  apartment: {
    findUnique: vi.fn()
  },
  user: {
    findUnique: vi.fn()
  }
} as unknown as PrismaClient;

const mockContainer: IContainer = {
  resolve: vi.fn().mockReturnValue(mockPrismaClient),
  register: vi.fn(),
  has: vi.fn(),
  registerSingleton: vi.fn(),
  createScope: vi.fn()
};

describe('ListService', () => {
  let service: ListService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ListService(mockContainer);
  });

  describe('getById', () => {
    it('should get list with metadata', async () => {
      const mockList = {
        id: 'list1',
        userId: 'user1',
        name: 'My List',
        type: 'COLLECTION',
        isPublic: false,
        searchParams: null,
        _count: { apartments: 10 }
      };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);

      const result = await service.getById('list1', 'user1');

      expect(mockPrismaClient.list.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'list1',
          OR: [
            { userId: 'user1' },
            { isPublic: true }
          ]
        },
        include: {
          _count: {
            select: { apartments: true }
          }
        }
      });

      expect(result).toMatchObject({
        ...mockList,
        apartmentsWithoutRoutes: 0,
        apartmentsWithoutCoordinates: 0
      });
    });

    it('should calculate route statistics for commute search lists', async () => {
      const mockList = {
        id: 'list1',
        userId: 'user1',
        type: 'SEARCH_RESULT',
        searchParams: {
          workplaceStationId: 'station1'
        },
        _count: { apartments: 10 }
      };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.count as any)
        .mockResolvedValueOnce(3) // apartmentsWithoutRoutes
        .mockResolvedValueOnce(2); // apartmentsWithoutCoordinates

      const result = await service.getById('list1', 'user1');

      expect(mockPrismaClient.apartmentList.count).toHaveBeenCalledTimes(2);
      expect(result.apartmentsWithoutRoutes).toBe(3);
      expect(result.apartmentsWithoutCoordinates).toBe(2);
    });

    it('should throw error if list not found', async () => {
      (mockPrismaClient.list.findFirst as any).mockResolvedValue(null);

      await expect(service.getById('nonexistent', 'user1')).rejects.toThrow(TRPCError);
    });
  });

  describe('getApartments', () => {
    it('should get apartments with pagination', async () => {
      const mockList = {
        id: 'list1',
        userId: 'user1',
        type: 'COLLECTION'
      };

      const mockApartmentListItems = [
        {
          apartment: {
            id: 'apt1',
            title: 'Apartment 1',
            price: 80000,
            images: [],
            nearestStations: []
          }
        },
        {
          apartment: {
            id: 'apt2',
            title: 'Apartment 2',
            price: 90000,
            images: [],
            nearestStations: []
          }
        }
      ];

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.findMany as any).mockResolvedValue(mockApartmentListItems);
      (mockPrismaClient.apartmentList.count as any).mockResolvedValue(10);

      const result = await service.getApartments('list1', 'user1', {
        pagination: { page: 1, limit: 2 }
      });

      expect(result).toMatchObject({
        apartments: mockApartmentListItems.map(item => item.apartment),
        listItems: mockApartmentListItems,
        total: 10,
        page: 1,
        limit: 2,
        hasMore: true
      });
    });

    it('should apply filters', async () => {
      const mockList = { id: 'list1', userId: 'user1' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.findMany as any).mockResolvedValue([]);
      (mockPrismaClient.apartmentList.count as any).mockResolvedValue(0);

      await service.getApartments('list1', 'user1', {
        filters: {
          priceMin: 50000,
          priceMax: 100000,
          sizeMin: 20,
          layout: ['1K', '1LDK']
        }
      });

      expect(mockPrismaClient.apartmentList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            apartment: expect.objectContaining({
              removed: false,
              price: { gte: 50000, lte: 100000 },
              size: { gte: 20 },
              layout: { in: ['1K', '1LDK'] }
            })
          })
        })
      );
    });

    it('should exclude apartments from other lists', async () => {
      const mockList = { id: 'list1', userId: 'user1' };
      const mockExcludeLists = [{ id: 'exclude1' }];
      const mockExcludeApartments = [
        { apartmentId: 'apt1' },
        { apartmentId: 'apt2' }
      ];

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.list.findMany as any).mockResolvedValue(mockExcludeLists);
      (mockPrismaClient.apartmentList.findMany as any)
        .mockResolvedValueOnce(mockExcludeApartments) // For exclusion
        .mockResolvedValueOnce([]) // For main query
        .mockResolvedValueOnce(0); // For count

      await service.getApartments('list1', 'user1', {
        excludeListTypes: ['HIDDEN']
      });

      expect(mockPrismaClient.apartmentList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            apartmentId: { notIn: ['apt1', 'apt2'] }
          })
        })
      );
    });

    it('should handle sorting by price', async () => {
      const mockList = { id: 'list1', userId: 'user1' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.findMany as any).mockResolvedValue([]);
      (mockPrismaClient.apartmentList.count as any).mockResolvedValue(0);

      await service.getApartments('list1', 'user1', {
        sort: { field: 'price', order: 'asc' }
      });

      expect(mockPrismaClient.apartmentList.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { apartment: { price: 'asc' } },
            { apartmentId: 'asc' }
          ]
        })
      );
    });
  });

  describe('getUserLists', () => {
    it('should get user lists with metadata', async () => {
      const mockLists = [
        {
          id: 'list1',
          name: 'List 1',
          type: 'COLLECTION',
          _count: { apartments: 5 }
        },
        {
          id: 'list2',
          name: 'List 2',
          type: 'WISHLIST',
          _count: { apartments: 3 }
        }
      ];

      (mockPrismaClient.list.findMany as any).mockResolvedValue(mockLists);
      (mockPrismaClient.apartmentList.count as any)
        .mockResolvedValueOnce(2) // seen count for list1
        .mockResolvedValueOnce(1); // seen count for list2

      const result = await service.getUserLists('user1');

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'list1',
        totalApartments: 5,
        seenCount: 2
      });
      expect(result[1]).toMatchObject({
        id: 'list2',
        totalApartments: 3,
        seenCount: 1
      });
    });

    it('should filter by type', async () => {
      (mockPrismaClient.list.findMany as any).mockResolvedValue([]);

      await service.getUserLists('user1', 'BOOKMARKED');

      expect(mockPrismaClient.list.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user1',
            type: 'BOOKMARKED'
          }
        })
      );
    });
  });

  describe('addApartment', () => {
    it('should add apartment to list', async () => {
      const mockList = { id: 'list1', userId: 'user1' };
      const mockApartment = { id: 'apt1', title: 'Test Apartment' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(mockApartment);
      (mockPrismaClient.apartmentList.upsert as any).mockResolvedValue({
        apartmentId: 'apt1',
        listId: 'list1'
      });

      const result = await service.addApartment('list1', 'apt1', 'user1');

      expect(mockPrismaClient.apartmentList.upsert).toHaveBeenCalledWith({
        where: {
          apartmentId_listId: {
            apartmentId: 'apt1',
            listId: 'list1'
          }
        },
        update: {},
        create: {
          apartmentId: 'apt1',
          listId: 'list1'
        }
      });

      expect(result).toMatchObject({
        apartmentId: 'apt1',
        listId: 'list1'
      });
    });

    it('should throw error if list not found', async () => {
      (mockPrismaClient.list.findFirst as any).mockResolvedValue(null);

      await expect(service.addApartment('list1', 'apt1', 'user1')).rejects.toThrow(TRPCError);
    });

    it('should throw error if apartment not found', async () => {
      const mockList = { id: 'list1', userId: 'user1' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartment.findUnique as any).mockResolvedValue(null);

      await expect(service.addApartment('list1', 'apt1', 'user1')).rejects.toThrow(TRPCError);
    });
  });

  describe('removeApartment', () => {
    it('should remove apartment from list', async () => {
      const mockList = { id: 'list1', userId: 'user1' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.delete as any).mockResolvedValue({});

      await service.removeApartment('list1', 'apt1', 'user1');

      expect(mockPrismaClient.apartmentList.delete).toHaveBeenCalledWith({
        where: {
          apartmentId_listId: {
            apartmentId: 'apt1',
            listId: 'list1'
          }
        }
      });
    });
  });

  describe('markSeen', () => {
    it('should mark apartment as seen', async () => {
      const mockList = { id: 'list1', userId: 'user1' };
      const mockUpdated = {
        apartmentId: 'apt1',
        listId: 'list1',
        seen: true,
        seenAt: new Date()
      };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.update as any).mockResolvedValue(mockUpdated);

      const result = await service.markSeen('list1', 'apt1', 'user1');

      expect(mockPrismaClient.apartmentList.update).toHaveBeenCalledWith({
        where: {
          apartmentId_listId: {
            apartmentId: 'apt1',
            listId: 'list1'
          }
        },
        data: {
          seen: true,
          seenAt: expect.any(Date)
        }
      });

      expect(result).toEqual(mockUpdated);
    });
  });

  describe('getNextUnseen', () => {
    it('should get next unseen apartment', async () => {
      const mockList = { id: 'list1', userId: 'user1' };
      const mockApartmentList = {
        apartment: {
          id: 'apt1',
          title: 'Test Apartment',
          images: [],
          nearestStations: []
        }
      };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.findFirst as any).mockResolvedValue(mockApartmentList);
      (mockPrismaClient.apartmentList.count as any).mockResolvedValue(5);

      const result = await service.getNextUnseen('list1', 'user1');

      expect(result).toMatchObject({
        apartment: mockApartmentList.apartment,
        unseenCount: 5
      });
    });

    it('should return null if no unseen apartments', async () => {
      const mockList = { id: 'list1', userId: 'user1' };

      (mockPrismaClient.list.findFirst as any).mockResolvedValue(mockList);
      (mockPrismaClient.apartmentList.findFirst as any).mockResolvedValue(null);

      const result = await service.getNextUnseen('list1', 'user1');

      expect(result).toBeNull();
    });
  });

  describe('checkApartmentInLists', () => {
    it('should check which lists contain an apartment', async () => {
      const mockLists = [
        { id: 'list1', type: 'BOOKMARKED' },
        { id: 'list2', type: 'HIDDEN' }
      ];

      (mockPrismaClient.list.findMany as any).mockResolvedValue(mockLists);

      const result = await service.checkApartmentInLists('apt1', 'user1', ['BOOKMARKED', 'HIDDEN']);

      expect(mockPrismaClient.list.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user1',
          apartments: {
            some: {
              apartmentId: 'apt1'
            }
          },
          type: { in: ['BOOKMARKED', 'HIDDEN'] }
        },
        select: {
          id: true,
          type: true
        }
      });

      expect(result).toEqual({
        WISHLIST: 'list1',
        REJECTED: 'list2'
      });
    });
  });
});