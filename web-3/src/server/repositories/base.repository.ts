import { PrismaClient, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { handlePrismaError } from '~/lib/error-handler';

export interface BaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(args?: any): Promise<T[]>;
  create(data: any): Promise<T>;
  update(id: string, data: any): Promise<T>;
  delete(id: string): Promise<T>;
  count(where?: any): Promise<number>;
}

export class PrismaBaseRepository<
  Model,
  CreateInput,
  UpdateInput,
  WhereInput = any,
  OrderByInput = any
> implements BaseRepository<Model> {
  constructor(
    protected prisma: PrismaClient,
    protected modelName: Prisma.ModelName
  ) {}

  protected get model() {
    return (this.prisma as any)[this.modelName];
  }

  async findById(id: string): Promise<Model | null> {
    try {
      return await this.model.findUnique({
        where: { id }
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async findMany(args?: {
    where?: WhereInput;
    orderBy?: OrderByInput;
    take?: number;
    skip?: number;
    include?: any;
  }): Promise<Model[]> {
    try {
      return await this.model.findMany(args);
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async create(data: CreateInput): Promise<Model> {
    try {
      return await this.model.create({ data });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async update(id: string, data: UpdateInput): Promise<Model> {
    try {
      return await this.model.update({
        where: { id },
        data
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async delete(id: string): Promise<Model> {
    try {
      return await this.model.delete({
        where: { id }
      });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async count(where?: WhereInput): Promise<number> {
    try {
      return await this.model.count({ where });
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async exists(where: WhereInput): Promise<boolean> {
    try {
      const count = await this.count(where);
      return count > 0;
    } catch (error) {
      throw handlePrismaError(error);
    }
  }

  async transaction<R>(
    fn: (tx: PrismaClient) => Promise<R>
  ): Promise<R> {
    try {
      return await this.prisma.$transaction(fn);
    } catch (error) {
      throw handlePrismaError(error);
    }
  }
}