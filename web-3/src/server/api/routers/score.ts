import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { ApartmentScoreService } from "~/server/services/apartment-score-service";

export const scoreRouter = createTRPCRouter({
  // Calculate and store scores for apartments
  calculateScores: protectedProcedure
    .input(z.object({
      apartmentIds: z.array(z.string()).min(1).max(100),
      listId: z.string().optional(),
      targetStationId: z.string().optional(),
      forceRecalculate: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const scoreService = new ApartmentScoreService(ctx.db);
      
      const scores = await scoreService.calculateAndStoreScores({
        userId: ctx.session.user.id,
        ...input,
      });
      
      return {
        success: true,
        calculated: scores.length,
        scores,
      };
    }),

  // Get scores for specific apartments
  getScores: protectedProcedure
    .input(z.object({
      apartmentIds: z.array(z.string()).min(1).max(100),
      listId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const scoreService = new ApartmentScoreService(ctx.db);
      
      const scoreMap = await scoreService.getScores(
        ctx.session.user.id,
        input.apartmentIds,
        input.listId
      );
      
      // Convert Map to object for serialization (only return the score value)
      const scores: Record<string, number> = {};
      scoreMap.forEach((score, apartmentId) => {
        scores[apartmentId] = score.score;
      });
      
      return scores;
    }),

  // Get top scored apartments
  getTopScored: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).optional().default(10),
      listId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const scoreService = new ApartmentScoreService(ctx.db);
      
      return await scoreService.getTopScoredApartments(
        ctx.session.user.id,
        input.limit,
        input.listId
      );
    }),

  // Calculate scores for entire list
  calculateListScores: protectedProcedure
    .input(z.object({
      listId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scoreService = new ApartmentScoreService(ctx.db);
      
      // Verify list ownership
      const list = await scoreService.verifyListOwnership(input.listId, ctx.session.user.id);
      if (!list) {
        throw new Error("List not found or access denied");
      }
      
      await scoreService.calculateListScores(ctx.session.user.id, input.listId);
      
      return {
        success: true,
        message: "Scores calculated for all apartments in the list",
      };
    }),

  // Get score statistics for a list
  getListStats: protectedProcedure
    .input(z.object({
      listId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const scoreService = new ApartmentScoreService(ctx.db);
      
      // Verify list access
      const list = await scoreService.verifyListAccess(input.listId, ctx.session.user.id);
      if (!list) {
        throw new Error("List not found or access denied");
      }
      
      return await scoreService.getListScoreStats(ctx.session.user.id, input.listId);
    }),

  // Invalidate all user scores (when preferences change)
  invalidateScores: protectedProcedure
    .mutation(async ({ ctx }) => {
      const scoreService = new ApartmentScoreService(ctx.db);
      await scoreService.invalidateUserScores(ctx.session.user.id);
      
      return {
        success: true,
        message: "All scores have been invalidated",
      };
    }),
});