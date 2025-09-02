import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ListType } from "@prisma/client";
import { ListService, ListQueryService, ListRefreshService } from "~/server/services";
import type { ListWithApartments } from "~/types";

// Zod schemas
const createListSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(ListType),
  isPublic: z.boolean().default(false),
  searchParams: z.any().optional(),
});

const updateListSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(100).optional(),
  isPublic: z.boolean().optional(),
  status: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
});

const filtersSchema = z.object({
  priceMin: z.number().optional(),
  priceMax: z.number().optional(),
  twoYearAvgMin: z.number().optional(),
  twoYearAvgMax: z.number().optional(),
  sizeMin: z.number().optional(),
  sizeMax: z.number().optional(),
  layout: z.array(z.string()).optional(),
  buildingAge: z.number().optional(),
  maxWalkingMinutes: z.number().optional(),
  maxCommuteMinutes: z.number().optional(),
  excludeWards: z.array(z.string()).optional(),
});

const sortSchema = z.object({
  field: z.enum(['price', 'size', 'addedAt', 'commuteTime', 'score']).default('addedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export const listRouter = createTRPCRouter({
  // Get a specific list by ID
  getById: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getById(input.id);
    }),

  // Get apartments in a list with pagination
  getApartments: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      pagination: paginationSchema.optional(),
      filters: filtersSchema.optional(),
      sort: sortSchema.optional(),
      excludeListTypes: z.array(z.enum(['LIKED', 'HIDDEN', 'BOOKMARKED', 'FAVORITED'])).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const queryService = new ListQueryService(ctx.db, ctx.session);
      return await queryService.getApartments(
        input.listId,
        input.pagination,
        input.filters,
        input.sort,
        input.excludeListTypes
      );
    }),

  // Check if apartment is in user's lists
  checkApartmentInLists: protectedProcedure
    .input(z.object({
      apartmentId: z.string(),
      listTypes: z.array(z.nativeEnum(ListType)).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.checkApartmentInLists(input.apartmentId, input.listTypes);
    }),

  // Get all lists for the current user
  getUserLists: protectedProcedure
    .input(z.object({
      type: z.nativeEnum(ListType).optional(),
      includeCount: z.boolean().default(true),
    }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getUserLists(input.type, input.includeCount);
    }),

  // Get a specific list with apartments (legacy endpoint)
  getList: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ ctx, input }): Promise<ListWithApartments | null> => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getListWithApartments(input.id, input.page, input.limit);
    }),

  // Get list progress (for search result lists)
  getListProgress: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getListProgress(input.id);
    }),

  // Create a new list
  create: protectedProcedure
    .input(createListSchema)
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.create(input);
    }),

  // Get apartment stats for a list
  getApartmentStats: protectedProcedure
    .input(z.object({ listId: z.string() }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getApartmentStats(input.listId);
    }),

  // Update list details
  update: protectedProcedure
    .input(updateListSchema)
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.update(input);
    }),

  // Delete a list
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.delete(input.id);
    }),

  // Add apartment to list
  addApartment: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      apartmentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.addApartment(input.listId, input.apartmentId);
    }),

  // Remove apartment from list
  removeApartment: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      apartmentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.removeApartment(input.listId, input.apartmentId);
    }),

  // Update apartment scores
  updateApartmentScore: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      apartmentId: z.string(),
      locationScore: z.number().min(0).max(5).nullable(),
      designScore: z.number().min(0).max(5).nullable(),
      spaceScore: z.number().min(0).max(5).nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.updateApartmentScore(
        input.listId,
        input.apartmentId,
        input.locationScore,
        input.designScore,
        input.spaceScore
      );
    }),

  // Mark apartment as seen
  markSeen: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      apartmentId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.markSeen(input.listId, input.apartmentId);
    }),

  // Get next unseen apartment in list (for browse mode)
  getNextUnseen: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      currentId: z.string().cuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.getNextUnseen(input.listId, input.currentId);
    }),

  // Get all apartments for export (no pagination)
  getAllApartmentsForExport: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      filters: filtersSchema.optional(),
      sort: sortSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const queryService = new ListQueryService(ctx.db, ctx.session);
      return await queryService.getAllApartmentsForExport(
        input.listId,
        input.filters,
        input.sort
      );
    }),

  // Get all apartments with routes calculated to a specific station
  getAllApartmentsWithRoutes: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      targetStationId: z.string(),
      filters: filtersSchema.optional(),
      sort: sortSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const refreshService = new ListRefreshService(ctx.db, ctx.session);
      return await refreshService.getAllApartmentsWithRoutes(
        input.listId,
        input.targetStationId,
        input.filters,
        input.sort
      );
    }),

  // Bulk operations
  bulkAddApartments: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      apartmentIds: z.array(z.string()).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.bulkAddApartments(input.listId, input.apartmentIds);
    }),

  // Refresh all apartments in a list
  refreshAllApartments: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      includeRemovalCheck: z.boolean().optional().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const refreshService = new ListRefreshService(ctx.db, ctx.session);
      return await refreshService.refreshAllApartments(input.listId, input.includeRemovalCheck);
    }),

  // Update preferred station for all apartments in a list
  updateAllApartmentsPreferredStation: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
      stationId: z.string().cuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const listService = new ListService(ctx.db, ctx.session);
      return await listService.updateAllApartmentsPreferredStation(input.listId, input.stationId);
    }),
});