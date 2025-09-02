import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { prismaMock, resetPrismaMocks } from '~/infrastructure/testing/mocks/prisma';
import { vi } from '~/core/testing';
import { PrismaClient, ListType, ListStatus } from '@prisma/client';
import { ListRepository } from '../implementations/list.repository';
import type { CreateListInput, UpdateListInput } from '~/types/list';



describe('ListRepository', () => {
  
  let repository: ListRepository;

  beforeEach(() => {
    resetPrismaMocks();
    
    repository = new ListRepository(prismaMock as any);
  });

  describe('findById', () => {
    it('should find list by id with metadata', async () => {
      const mockList = {
        id: '1',
        name: 'My List',
        userId: 'user1',
        type: ListType.COLLECTION,
        _count: { apartments: 10 }
      };

      prismaMock.list.findUnique.mockResolvedValue(mockList as any);
      (prismaMock.apartmentList.count as any)
        .mockResolvedValueOnce(5) // seenCount
        .mockResolvedValueOnce(3); // apartmentsWithoutRoutes

      const result = await repository.findById('1', false);

      expect(prismaMock.list.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: {
          _count: {
            select: { apartments: true }
          }
        }
      });
      
      expect(result).toEqual({
        ...mockList,
        totalApartments: 10,
        seenCount: 5,
        apartmentsWithoutRoutes: 3
      });
    });

    it('should find list by id with apartments', async () => {
      const mockList = {
        id: '1',
        name: 'My List',
        apartments: [
          {
            apartment: {
              id: 'apt1',
              title: 'Apartment 1',
              images: [],
              nearestStations: [],
              routes: []
            }
          }
        ]
      };

      prismaMock.list.findUnique.mockResolvedValue(mockList);

      const result = await repository.findById('1', true);

      expect(prismaMock.list.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.objectContaining({
          apartments: expect.objectContaining({
            include: expect.objectContaining({
              apartment: expect.any(Object)
            })
          })
        })
      });
      expect(result).toEqual(mockList);
    });

    it('should return null if list not found', async () => {
      prismaMock.list.findUnique.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all lists for a user with metadata', async () => {
      const mockLists = [
        { id: '1', name: 'List 1', userId: 'user1', _count: { apartments: 5 } },
        { id: '2', name: 'List 2', userId: 'user1', _count: { apartments: 8 } }
      ];

      prismaMock.list.findMany.mockResolvedValue(mockLists as any);
      (prismaMock.apartmentList.count as any)
        .mockResolvedValueOnce(3) // seenCount for list 1
        .mockResolvedValueOnce(6); // seenCount for list 2

      const result = await repository.findByUserId('user1');

      expect(prismaMock.list.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1' },
        include: {
          _count: {
            select: { apartments: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('totalApartments', 5);
      expect(result[0]).toHaveProperty('seenCount', 3);
    });
  });

  describe('create', () => {
    it('should create a new list', async () => {
      const createInput: CreateListInput = {
        name: 'New List',
        type: ListType.COLLECTION,
        isPublic: true,
        searchParams: { priceMax: 100000 }
      };

      const mockCreatedList = {
        id: '1',
        userId: 'user1',
        ...createInput
      };

      prismaMock.list.create.mockResolvedValue(mockCreatedList);

      const result = await repository.create('user1', createInput);

      expect(prismaMock.list.create).toHaveBeenCalledWith({
        data: {
          user: { connect: { id: 'user1' } },
          name: 'New List',
          type: ListType.COLLECTION,
          isPublic: true,
          searchParams: { priceMax: 100000 }
        }
      });
      expect(result).toEqual(mockCreatedList);
    });
  });

  describe('update', () => {
    it('should update list properties', async () => {
      const updateInput: UpdateListInput = {
        name: 'Updated Name',
        isPublic: false,
        status: ListStatus.ARCHIVED,
        progress: 75
      };

      const mockUpdatedList = {
        id: '1',
        ...updateInput
      };

      prismaMock.list.update.mockResolvedValue(mockUpdatedList);

      const result = await repository.update('1', updateInput);

      expect(prismaMock.list.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          name: 'Updated Name',
          isPublic: false,
          status: ListStatus.ARCHIVED,
          progress: 75
        }
      });
      expect(result).toEqual(mockUpdatedList);
    });

    it('should handle partial updates', async () => {
      const updateInput: UpdateListInput = {
        name: 'New Name'
      };

      prismaMock.list.update.mockResolvedValue({ id: '1', name: 'New Name' });

      await repository.update('1', updateInput);

      expect(prismaMock.list.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { name: 'New Name' }
      });
    });
  });

  describe('apartment management', () => {
    describe('addApartment', () => {
      it('should add apartment to list', async () => {
        const mockApartmentList = {
          listId: 'list1',
          apartmentId: 'apt1',
          createdAt: new Date()
        };

        prismaMock.apartmentList.findUnique.mockResolvedValue(null);
        prismaMock.apartmentList.create.mockResolvedValue(mockApartmentList);

        const result = await repository.addApartment('list1', 'apt1');

        expect(prismaMock.apartmentList.create).toHaveBeenCalledWith({
          data: {
            listId: 'list1',
            apartmentId: 'apt1'
          }
        });
        expect(result).toEqual(mockApartmentList);
      });

      it('should return existing if already in list', async () => {
        const existing = {
          listId: 'list1',
          apartmentId: 'apt1'
        };

        prismaMock.apartmentList.findUnique.mockResolvedValue(existing);

        const result = await repository.addApartment('list1', 'apt1');

        expect(prismaMock.apartmentList.create).not.toHaveBeenCalled();
        expect(result).toEqual(existing);
      });
    });

    describe('removeApartment', () => {
      it('should remove apartment from list', async () => {
        const mockDeleted = {
          listId: 'list1',
          apartmentId: 'apt1'
        };

        prismaMock.apartmentList.delete.mockResolvedValue(mockDeleted);

        const result = await repository.removeApartment('list1', 'apt1');

        expect(prismaMock.apartmentList.delete).toHaveBeenCalledWith({
          where: {
            listId_apartmentId: {
              listId: 'list1',
              apartmentId: 'apt1'
            }
          }
        });
        expect(result).toEqual(mockDeleted);
      });
    });

    describe('addApartments', () => {
      it('should add multiple apartments', async () => {
        prismaMock.apartmentList.findMany.mockResolvedValue([
          { apartmentId: 'existing1' }
        ]);
        prismaMock.apartmentList.createMany.mockResolvedValue({ count: 2 });

        const result = await repository.addApartments('list1', ['existing1', 'new1', 'new2']);

        expect(prismaMock.apartmentList.createMany).toHaveBeenCalledWith({
          data: [
            { listId: 'list1', apartmentId: 'new1' },
            { listId: 'list1', apartmentId: 'new2' }
          ],
          skipDuplicates: true
        });
        expect(result).toEqual({ count: 2 });
      });

      it('should return 0 if all apartments already exist', async () => {
        prismaMock.apartmentList.findMany.mockResolvedValue([
          { apartmentId: 'apt1' },
          { apartmentId: 'apt2' }
        ]);

        const result = await repository.addApartments('list1', ['apt1', 'apt2']);

        expect(prismaMock.apartmentList.createMany).not.toHaveBeenCalled();
        expect(result).toEqual({ count: 0 });
      });
    });

    describe('markApartmentAsSeen', () => {
      it('should mark apartment as seen', async () => {
        const mockUpdated = {
          listId: 'list1',
          apartmentId: 'apt1',
          seenAt: new Date()
        };

        prismaMock.apartmentList.update.mockResolvedValue(mockUpdated);

        const result = await repository.markApartmentAsSeen('list1', 'apt1');

        expect(prismaMock.apartmentList.update).toHaveBeenCalledWith({
          where: {
            listId_apartmentId: {
              listId: 'list1',
              apartmentId: 'apt1'
            }
          },
          data: {
            seenAt: expect.any(Date)
          }
        });
        expect(result).toEqual(mockUpdated);
      });
    });
  });

  describe('list queries', () => {
    it('should find lists by type', async () => {
      const mockLists = [
        { id: '1', type: ListType.WISHLIST, _count: { apartments: 5 } },
        { id: '2', type: ListType.WISHLIST, _count: { apartments: 3 } }
      ];

      prismaMock.list.findMany.mockResolvedValue(mockLists);

      const result = await repository.findByType('user1', ListType.WISHLIST);

      expect(prismaMock.list.findMany).toHaveBeenCalledWith({
        where: { userId: 'user1', type: ListType.WISHLIST },
        include: {
          _count: {
            select: { apartments: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('totalApartments', 5);
    });

    it('should find public lists with pagination', async () => {
      const mockLists = [
        { id: '1', isPublic: true, _count: { apartments: 10 } }
      ];

      prismaMock.list.findMany.mockResolvedValue(mockLists as any);

      const result = await repository.findPublicLists({
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });

      expect(prismaMock.list.findMany).toHaveBeenCalledWith({
        where: { isPublic: true },
        include: {
          _count: {
            select: { apartments: true }
          }
        },
        take: 10,
        skip: 0,
        orderBy: { createdAt: 'desc' }
      });
      expect(result[0]).toHaveProperty('totalApartments', 10);
    });
  });

  describe('statistics', () => {
    it('should get unseen count', async () => {
      prismaMock.apartmentList.count.mockResolvedValue(7);

      const result = await repository.getUnseenCount('list1');

      expect(prismaMock.apartmentList.count).toHaveBeenCalledWith({
        where: {
          listId: 'list1',
          seenAt: null
        }
      });
      expect(result).toBe(7);
    });

    it('should get apartment count', async () => {
      prismaMock.apartmentList.count.mockResolvedValue(15);

      const result = await repository.getApartmentCount('list1');

      expect(prismaMock.apartmentList.count).toHaveBeenCalledWith({
        where: { listId: 'list1' }
      });
      expect(result).toBe(15);
    });
  });
});