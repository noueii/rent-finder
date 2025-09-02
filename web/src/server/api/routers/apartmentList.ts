import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';

const listTypeSchema = z.enum(['saved', 'favorites', 'liked', 'hidden']);

export const apartmentListRouter = createTRPCRouter({
  // Get apartments in a specific list
  getApartments: publicProcedure
    .input(z.object({
      listType: listTypeSchema,
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const apartmentLists = await ctx.db.apartmentList.findMany({
        where: {
          listType: input.listType,
        },
        include: {
          apartment: {
            include: {
              stations: {
                include: {
                  station: true,
                },
                orderBy: {
                  walkingMinutes: 'asc'
                },
                take: 1,
              },
              images: {
                orderBy: {
                  displayOrder: 'asc'
                },
                take: 5,
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: input.offset,
        take: input.limit,
      });

      const total = await ctx.db.apartmentList.count({
        where: {
          listType: input.listType,
        },
      });

      return {
        apartments: apartmentLists.map(al => ({
          ...al.apartment,
          addedAt: al.createdAt,
        })),
        pagination: {
          total,
          limit: input.limit,
          offset: input.offset,
        },
      };
    }),

  // Get list status for multiple apartments
  getApartmentListStatus: publicProcedure
    .input(z.object({
      apartmentIds: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      if (input.apartmentIds.length === 0) {
        return {};
      }

      const listEntries = await ctx.db.apartmentList.findMany({
        where: {
          apartmentId: { in: input.apartmentIds },
        },
        select: {
          apartmentId: true,
          listType: true,
        },
      });

      // Build status map
      const statusMap: Record<string, Record<string, boolean>> = {};
      
      input.apartmentIds.forEach(id => {
        statusMap[id] = {
          saved: false,
          favorites: false,
          liked: false,
          hidden: false,
        };
      });

      listEntries.forEach(entry => {
        if (statusMap[entry.apartmentId]) {
          statusMap[entry.apartmentId][entry.listType] = true;
        }
      });

      return statusMap;
    }),

  // Toggle apartment in a list
  toggleApartmentInList: publicProcedure
    .input(z.object({
      apartmentId: z.string(),
      listType: listTypeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Check if already in list
      const existing = await ctx.db.apartmentList.findUnique({
        where: {
          apartmentId_listType: {
            apartmentId: input.apartmentId,
            listType: input.listType,
          },
        },
      });

      if (existing) {
        // Remove from list
        await ctx.db.apartmentList.delete({
          where: {
            id: existing.id,
          },
        });
        return { action: 'removed', listType: input.listType };
      } else {
        // Add to list
        await ctx.db.apartmentList.create({
          data: {
            apartmentId: input.apartmentId,
            listType: input.listType,
          },
        });
        return { action: 'added', listType: input.listType };
      }
    }),

  // Clear all apartments from a list
  clearList: publicProcedure
    .input(z.object({
      listType: listTypeSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.apartmentList.deleteMany({
        where: {
          listType: input.listType,
        },
      });
      return { deleted: result.count };
    }),

  // Get count of apartments in each list
  getListCounts: publicProcedure
    .query(async ({ ctx }) => {
      const counts = await ctx.db.apartmentList.groupBy({
        by: ['listType'],
        _count: true,
      });

      const countMap: Record<string, number> = {
        saved: 0,
        favorites: 0,
        liked: 0,
        hidden: 0,
      };

      counts.forEach(count => {
        countMap[count.listType] = count._count;
      });

      return countMap;
    }),
});