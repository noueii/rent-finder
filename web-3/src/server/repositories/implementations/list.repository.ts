import { Prisma, PrismaClient, List, ApartmentList, ListType } from '@prisma/client';
import { PrismaBaseRepository } from '../base.repository';
import type { IListRepository } from '../interfaces/list.repository.interface';
import type {
  ListWithMeta,
  ListWithApartments,
  CreateListInput,
  UpdateListInput
} from '~/types/list';
import { TRPCError } from '@trpc/server';

export class ListRepository
  extends PrismaBaseRepository<
    List,
    Prisma.ListCreateInput,
    Prisma.ListUpdateInput,
    Prisma.ListWhereInput,
    Prisma.ListOrderByWithRelationInput
  >
  implements IListRepository {
  
  constructor(prisma: PrismaClient) {
    super(prisma, 'list');
  }

  async findById(id: string, includeApartments = false): Promise<ListWithApartments | ListWithMeta | null> {
    if (includeApartments) {
      return await this.model.findUnique({
        where: { id },
        include: {
          apartments: {
            include: {
              apartment: {
                include: {
                  images: {
                    orderBy: { order: 'asc' },
                    take: 1
                  },
                  nearestStations: {
                    include: {
                      station: {
                        include: {
                          lines: {
                            include: {
                              line: true
                            }
                          }
                        }
                      }
                    },
                    orderBy: { walkingMinutes: 'asc' },
                    take: 3
                  },
                  routes: {
                    include: {
                      toStation: true
                    },
                    take: 1
                  }
                }
              }
            },
            orderBy: { createdAt: 'desc' }
          }
        }
      }) as ListWithApartments | null;
    }

    const list = await this.model.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            apartments: true
          }
        }
      }
    });

    if (!list) return null;

    // Calculate additional metadata
    const seenCount = await this.prisma.apartmentList.count({
      where: {
        listId: id,
        seenAt: { not: null }
      }
    });

    const apartmentsWithoutRoutes = await this.prisma.apartmentList.count({
      where: {
        listId: id,
        apartment: {
          routes: {
            none: {}
          }
        }
      }
    });

    return {
      ...list,
      totalApartments: list._count.apartments,
      seenCount,
      apartmentsWithoutRoutes
    } as ListWithMeta;
  }

  async findByUserId(userId: string): Promise<ListWithMeta[]> {
    const lists = await this.model.findMany({
      where: { userId },
      include: {
        _count: {
          select: {
            apartments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add metadata to each list
    return await Promise.all(
      lists.map(async (list) => {
        const seenCount = await this.prisma.apartmentList.count({
          where: {
            listId: list.id,
            seenAt: { not: null }
          }
        });

        return {
          ...list,
          totalApartments: list._count.apartments,
          seenCount
        } as ListWithMeta;
      })
    );
  }

  async create(userId: string, data: CreateListInput): Promise<List> {
    const createData: Prisma.ListCreateInput = {
      user: { connect: { id: userId } },
      name: data.name,
      type: data.type,
      isPublic: data.isPublic ?? false,
      searchParams: data.searchParams
    };

    return await super.create(createData);
  }

  async update(id: string, data: UpdateListInput): Promise<List> {
    const updateData: Prisma.ListUpdateInput = {};
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.progress !== undefined) updateData.progress = data.progress;

    return await super.update(id, updateData);
  }

  async findByType(userId: string, type: ListType): Promise<ListWithMeta[]> {
    const lists = await this.model.findMany({
      where: { userId, type },
      include: {
        _count: {
          select: {
            apartments: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return lists.map(list => ({
      ...list,
      totalApartments: list._count.apartments
    })) as ListWithMeta[];
  }

  async findPublicLists(args?: {
    take?: number;
    skip?: number;
    orderBy?: Prisma.ListOrderByWithRelationInput;
  }): Promise<ListWithMeta[]> {
    const lists = await this.model.findMany({
      where: { isPublic: true },
      include: {
        _count: {
          select: {
            apartments: true
          }
        }
      },
      ...args
    });

    return lists.map(list => ({
      ...list,
      totalApartments: list._count.apartments
    })) as ListWithMeta[];
  }

  async addApartment(listId: string, apartmentId: string): Promise<ApartmentList> {
    // Check if already exists
    const existing = await this.prisma.apartmentList.findUnique({
      where: {
        listId_apartmentId: {
          listId,
          apartmentId
        }
      }
    });

    if (existing) {
      return existing;
    }

    return await this.prisma.apartmentList.create({
      data: {
        listId,
        apartmentId
      }
    });
  }

  async removeApartment(listId: string, apartmentId: string): Promise<ApartmentList> {
    return await this.prisma.apartmentList.delete({
      where: {
        listId_apartmentId: {
          listId,
          apartmentId
        }
      }
    });
  }

  async hasApartment(listId: string, apartmentId: string): Promise<boolean> {
    const count = await this.prisma.apartmentList.count({
      where: {
        listId,
        apartmentId
      }
    });
    return count > 0;
  }

  async getApartmentIds(listId: string): Promise<string[]> {
    const apartmentLists = await this.prisma.apartmentList.findMany({
      where: { listId },
      select: { apartmentId: true }
    });
    return apartmentLists.map(al => al.apartmentId);
  }

  async addApartments(listId: string, apartmentIds: string[]): Promise<{ count: number }> {
    // Filter out already existing apartments
    const existingIds = await this.getApartmentIds(listId);
    const newIds = apartmentIds.filter(id => !existingIds.includes(id));

    if (newIds.length === 0) {
      return { count: 0 };
    }

    return await this.prisma.apartmentList.createMany({
      data: newIds.map(apartmentId => ({
        listId,
        apartmentId
      })),
      skipDuplicates: true
    });
  }

  async removeApartments(listId: string, apartmentIds: string[]): Promise<{ count: number }> {
    return await this.prisma.apartmentList.deleteMany({
      where: {
        listId,
        apartmentId: { in: apartmentIds }
      }
    });
  }

  async clearApartments(listId: string): Promise<{ count: number }> {
    return await this.prisma.apartmentList.deleteMany({
      where: { listId }
    });
  }

  async markApartmentAsSeen(listId: string, apartmentId: string): Promise<ApartmentList> {
    return await this.prisma.apartmentList.update({
      where: {
        listId_apartmentId: {
          listId,
          apartmentId
        }
      },
      data: {
        seenAt: new Date()
      }
    });
  }

  async getSeenApartmentIds(listId: string): Promise<string[]> {
    const seenApartments = await this.prisma.apartmentList.findMany({
      where: {
        listId,
        seenAt: { not: null }
      },
      select: { apartmentId: true }
    });
    return seenApartments.map(al => al.apartmentId);
  }

  async getUnseenCount(listId: string): Promise<number> {
    return await this.prisma.apartmentList.count({
      where: {
        listId,
        seenAt: null
      }
    });
  }

  async getApartmentCount(listId: string): Promise<number> {
    return await this.prisma.apartmentList.count({
      where: { listId }
    });
  }

  async updateProgress(listId: string, progress: number): Promise<List> {
    return await this.update(listId, { progress });
  }

  async updateStatus(listId: string, status: string): Promise<List> {
    return await this.update(listId, { status });
  }
}