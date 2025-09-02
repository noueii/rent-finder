import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { SearchServiceToken } from "~/core/di/tokens";
import type { ISearchService } from "~/application/services";

// Zod schemas for validation
const standardSearchSchema = z.object({
  filters: z.object({
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    sizeMin: z.number().min(0).optional(),
    sizeMax: z.number().min(0).optional(),
    layout: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
    stationIds: z.array(z.string()).optional(),
    maxWalkingMinutes: z.number().min(0).max(30).optional(),
  }),
  sort: z.object({
    field: z.enum(['price', 'size', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }).optional(),
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(20),
  }).optional(),
});

const commuteSearchSchema = z.object({
  workplaceStationId: z.string().cuid(),
  maxCommuteMinutes: z.number().min(5).max(120),
  filters: z.object({
    priceMin: z.number().min(0).optional(),
    priceMax: z.number().min(0).optional(),
    sizeMin: z.number().min(0).optional(),
    sizeMax: z.number().min(0).optional(),
    layout: z.array(z.string()).optional(),
    amenities: z.array(z.string()).optional(),
  }).optional(),
  listName: z.string().optional(),
  listDescription: z.string().optional(),
});

export const searchRouter = createTRPCRouter({
  // Standard apartment search
  search: publicProcedure
    .input(standardSearchSchema)
    .query(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      
      // Save search session if user is logged in
      const result = await searchService.search(input);
      
      if (ctx.session?.user) {
        await searchService.saveSearchSession(
          ctx.session.user.id,
          input,
          result.total
        );
      }
      
      return result;
    }),

  // Initiate commute-based search
  searchWithCommute: protectedProcedure
    .input(commuteSearchSchema)
    .mutation(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.searchByCommuteTime(
        input,
        ctx.session.user.id
      );
    }),

  // Get recent searches for a user
  getRecentSearches: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10),
    }))
    .query(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.getRecentSearches(
        ctx.session.user.id,
        input.limit
      );
    }),

  // Get popular searches (for suggestions)
  getPopularSearches: publicProcedure
    .query(async ({ ctx }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.getPopularSearches();
    }),

  // Get search suggestions based on partial input
  getSuggestions: publicProcedure
    .input(z.object({
      query: z.string().min(1).max(100),
      type: z.enum(['station', 'area', 'amenity']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.getSuggestions(input.query, input.type);
    }),

  // Trigger a refresh/scrape for apartments matching criteria
  refreshApartments: protectedProcedure
    .input(standardSearchSchema)
    .mutation(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.refreshApartments(
        input.filters,
        ctx.session.user.id
      );
    }),

  // Get search progress for a commute search
  getSearchProgress: protectedProcedure
    .input(z.object({
      listId: z.string().cuid(),
    }))
    .query(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.getSearchProgress(
        input.listId,
        ctx.session.user.id
      );
    }),

  // Fast concurrent search across multiple sources
  fastSearch: protectedProcedure
    .input(z.object({
      filters: z.object({
        priceMin: z.number().min(0).optional(),
        priceMax: z.number().min(0).optional(),
        sizeMin: z.number().min(0).optional(),
        sizeMax: z.number().min(0).optional(),
        sources: z.array(z.string()).optional(), // Specific sources to search
      }),
      limit: z.number().min(10).max(200).default(50),
    }))
    .mutation(async ({ ctx, input }) => {
      const searchService = ctx.container.resolve(SearchServiceToken);
      return await searchService.fastSearch(
        input.filters,
        input.limit,
        ctx.session.user.id
      );
    }),
});