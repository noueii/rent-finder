/**
 * Tests for Prisma Base Repository
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaBaseRepository, SimplePrismaRepository } from '../prisma-base-repository';
import { 
  NotFoundError, 
  ValidationError, 
  ConflictError,
  ServiceUnavailableError 
} from '~/core/errors/operational-errors';
import type { Filter, QueryOptions, WhereCondition } from '~/domain/repositories/base';

// Mock types
interface TestEntity {
  id: string;
  name: string;
  age: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TestPrismaModel {
  id: string;
  name: string;
  age: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Mock Prisma client
const mockPrisma = {
  testEntity: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as PrismaClient;

// Test repository implementation
class TestRepository extends PrismaBaseRepository<TestEntity, TestPrismaModel> {
  protected readonly modelName = 'testEntity' as Prisma.ModelName;

  protected toDomain(model: TestPrismaModel): TestEntity {
    return {
      id: model.id,
      name: model.name,
      age: model.age,
      active: model.active,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    };
  }

  protected toPrisma(entity: Partial<TestEntity>): any {
    const { createdAt, updatedAt, ...data } = entity;
    return data;
  }
}

describe('PrismaBaseRepository', () => {
  let repository: TestRepository;
  let mockModel: any;

  beforeEach(() => {
    repository = new TestRepository(mockPrisma);
    mockModel = (mockPrisma as any).testEntity;
    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should find entity by id', async () => {
      const mockEntity = {
        id: '1',
        name: 'Test',
        age: 25,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.findUnique.mockResolvedValue(mockEntity);

      const result = await repository.findById('1');

      expect(mockModel.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
      expect(result).toEqual(mockEntity);
    });

    it('should return null if entity not found', async () => {
      mockModel.findUnique.mockResolvedValue(null);

      const result = await repository.findById('999');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockModel.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(repository.findById('1')).rejects.toThrow();
    });
  });

  describe('findMany', () => {
    it('should find entities with pagination', async () => {
      const mockEntities = [
        { id: '1', name: 'Test1', age: 25, active: true, createdAt: new Date(), updatedAt: new Date() },
        { id: '2', name: 'Test2', age: 30, active: true, createdAt: new Date(), updatedAt: new Date() },
      ];

      mockModel.findMany.mockResolvedValue(mockEntities);
      mockModel.count.mockResolvedValue(10);

      const filter: Filter<TestEntity> = { active: true };
      const options: QueryOptions = { page: 1, limit: 2 };

      const result = await repository.findMany(filter, options);

      expect(mockModel.findMany).toHaveBeenCalledWith({
        where: { active: true },
        skip: 0,
        take: 2,
        orderBy: undefined,
        include: undefined,
      });
      expect(mockModel.count).toHaveBeenCalledWith({ where: { active: true } });
      expect(result).toEqual({
        data: mockEntities,
        total: 10,
        page: 1,
        limit: 2,
        hasMore: true,
      });
    });

    it('should handle ordering', async () => {
      mockModel.findMany.mockResolvedValue([]);
      mockModel.count.mockResolvedValue(0);

      const options: QueryOptions = { 
        orderBy: { name: 'asc', age: 'desc' }
      };

      await repository.findMany({}, options);

      expect(mockModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ name: 'asc' }, { age: 'desc' }]
        })
      );
    });

    it('should handle includes', async () => {
      mockModel.findMany.mockResolvedValue([]);
      mockModel.count.mockResolvedValue(0);

      const options: QueryOptions = { 
        include: ['posts', 'comments']
      };

      await repository.findMany({}, options);

      expect(mockModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { posts: true, comments: true }
        })
      );
    });

    it('should handle complex where conditions', async () => {
      mockModel.findMany.mockResolvedValue([]);
      mockModel.count.mockResolvedValue(0);

      const filter: Filter<TestEntity> = {
        where: {
          AND: [
            { age: { gte: 18 } },
            { active: true }
          ],
          OR: [
            { name: { contains: 'John' } },
            { name: { contains: 'Jane' } }
          ]
        }
      };

      await repository.findMany(filter);

      expect(mockModel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            AND: [
              { age: { gte: 18 } },
              { active: true }
            ],
            OR: [
              { name: { contains: 'John' } },
              { name: { contains: 'Jane' } }
            ]
          }
        })
      );
    });
  });

  describe('create', () => {
    it('should create entity', async () => {
      const createData = {
        name: 'New Entity',
        age: 25,
        active: true,
      };

      const createdEntity = {
        id: '123',
        ...createData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.create.mockResolvedValue(createdEntity);

      const result = await repository.create(createData);

      expect(mockModel.create).toHaveBeenCalledWith({
        data: createData,
      });
      expect(result).toEqual(createdEntity);
    });

    it('should handle unique constraint violations', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed',
        { code: 'P2002', clientVersion: '2.0.0' }
      );

      mockModel.create.mockRejectedValue(error);

      await expect(repository.create({ name: 'Test', age: 25, active: true }))
        .rejects.toThrow(ConflictError);
    });

    it('should handle validation errors', async () => {
      const error = new Prisma.PrismaClientValidationError('Invalid data', { clientVersion: '2.0.0' });

      mockModel.create.mockRejectedValue(error);

      await expect(repository.create({ name: 'Test', age: 25, active: true }))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('update', () => {
    it('should update entity', async () => {
      const updateData = { name: 'Updated' };
      const updatedEntity = {
        id: '1',
        name: 'Updated',
        age: 25,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.update.mockResolvedValue(updatedEntity);

      const result = await repository.update('1', updateData);

      expect(mockModel.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });
      expect(result).toEqual(updatedEntity);
    });

    it('should throw NotFoundError if entity not found', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record to update not found',
        { code: 'P2025', clientVersion: '2.0.0' }
      );

      mockModel.update.mockRejectedValue(error);

      await expect(repository.update('999', { name: 'Test' }))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('delete', () => {
    it('should delete entity', async () => {
      mockModel.delete.mockResolvedValue({});

      await repository.delete('1');

      expect(mockModel.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should throw NotFoundError if entity not found', async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        'Record to delete not found',
        { code: 'P2025', clientVersion: '2.0.0' }
      );

      mockModel.delete.mockRejectedValue(error);

      await expect(repository.delete('999')).rejects.toThrow(NotFoundError);
    });
  });

  describe('exists', () => {
    it('should return true if entities exist', async () => {
      mockModel.count.mockResolvedValue(5);

      const result = await repository.exists({ active: true });

      expect(mockModel.count).toHaveBeenCalledWith({ where: { active: true } });
      expect(result).toBe(true);
    });

    it('should return false if no entities exist', async () => {
      mockModel.count.mockResolvedValue(0);

      const result = await repository.exists({ active: true });

      expect(result).toBe(false);
    });
  });

  describe('transaction', () => {
    it('should execute work in transaction', async () => {
      const mockTxPrisma = {
        testEntity: {
          create: jest.fn().mockResolvedValue({ id: '1', name: 'Test' }),
          update: jest.fn().mockResolvedValue({ id: '1', name: 'Updated' }),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (fn) => {
        return fn(mockTxPrisma);
      });

      const result = await repository.transaction(async (txRepo) => {
        await txRepo.create({ name: 'Test', age: 25, active: true });
        return await txRepo.update('1', { name: 'Updated' });
      });

      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockTxPrisma.testEntity.create).toHaveBeenCalled();
      expect(mockTxPrisma.testEntity.update).toHaveBeenCalled();
    });
  });

  describe('SimplePrismaRepository', () => {
    it('should work with 1:1 mapped entities', async () => {
      const simpleRepo = new SimplePrismaRepository<TestEntity>(
        mockPrisma,
        'testEntity' as Prisma.ModelName
      );

      const mockEntity = {
        id: '1',
        name: 'Test',
        age: 25,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockModel.findUnique.mockResolvedValue(mockEntity);

      const result = await simpleRepo.findById('1');

      expect(result).toEqual(mockEntity);
    });
  });
});