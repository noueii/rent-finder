import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import type { ApartmentWithRelations, PaginatedApartments } from "~/types";
import { ApartmentServiceToken } from "~/core/di/tokens";
import type { IApartmentService } from "~/application/services";

// Zod schemas for validation
const apartmentFilterSchema = z.object({
  priceMin: z.number().min(0).optional(),
  priceMax: z.number().min(0).optional(),
  sizeMin: z.number().min(0).optional(),
  sizeMax: z.number().min(0).optional(),
  layout: z.array(z.string()).optional(),
  amenities: z.array(z.string()).optional(),
  stationIds: z.array(z.string()).optional(),
  maxWalkingMinutes: z.number().min(0).max(30).optional(),
  availability: z.string().optional(),
  excludeWards: z.array(z.string()).optional(),
});

const paginationSchema = z.object({
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const sortSchema = z.object({
  field: z.enum(['price', 'size', 'createdAt', 'scrapedAt', 'score']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const apartmentRouter = createTRPCRouter({
  // Get single apartment by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }): Promise<ApartmentWithRelations | null> => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.getById(input.id);
    }),

  // Get multiple apartments by IDs
  getByIds: publicProcedure
    .input(z.object({ ids: z.array(z.string().cuid()).max(50) }))
    .query(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.getByIds(input.ids);
    }),

  // Search apartments with filters
  search: publicProcedure
    .input(z.object({
      filters: apartmentFilterSchema,
      pagination: paginationSchema.optional(),
      sort: sortSchema.optional(),
    }))
    .query(async ({ ctx, input }): Promise<PaginatedApartments> => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.search(
        input.filters,
        input.pagination,
        input.sort
      );
    }),

  // Get routes for an apartment to multiple destinations
  getRoutes: protectedProcedure
    .input(z.object({
      apartmentId: z.string().cuid(),
      destinationIds: z.array(z.string()).min(1).max(10),
    }))
    .query(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.getRoutes(
        input.apartmentId,
        input.destinationIds
      );
    }),

  // Create apartment (admin only - for testing)
  create: protectedProcedure
    .input(z.object({
      externalId: z.string(),
      sourceUrl: z.string().url(),
      sourceSite: z.string(),
      title: z.string(),
      price: z.number().int().positive(),
      size: z.number().positive(),
      layout: z.string().optional(),
      floor: z.number().int().optional(),
      totalFloors: z.number().int().optional(),
      buildingAge: z.number().int().optional(),
      address: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      description: z.string().optional(),
      amenities: z.array(z.string()).default([]),
      availability: z.string().default('unknown'),
      images: z.array(z.object({
        url: z.string().url(),
        caption: z.string().optional(),
        order: z.number().int().default(0),
      })).default([]),
      nearestStations: z.array(z.object({
        stationId: z.string().cuid(),
        walkingMinutes: z.number().int().positive(),
        distance: z.number().positive().optional(),
      })).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.create(input);
    }),

  // Update apartment availability
  updateAvailability: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      availability: z.enum(['available', 'occupied', 'unknown']),
    }))
    .mutation(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.updateAvailability(
        input.id,
        input.availability
      );
    }),

  // Update apartment's preferred station
  updatePreferredStation: protectedProcedure
    .input(z.object({
      id: z.string().cuid(),
      stationId: z.string().cuid().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.updatePreferredStation(
        input.id,
        input.stationId
      );
    }),

  // Delete apartment (admin only)
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      await apartmentService.delete(input.id);
      return { success: true };
    }),

  // Get available wards from database
  getAvailableWards: publicProcedure
    .query(async ({ ctx }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.getAvailableWards();
    }),

  // Refresh apartment data from source
  refreshData: protectedProcedure
    .input(z.object({ 
      id: z.string().cuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      const apartmentService = ctx.container.resolve(ApartmentServiceToken);
      return await apartmentService.refreshData(
        input.id,
        ctx.session?.user?.id
      );
    }),
});