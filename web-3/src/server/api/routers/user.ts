import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { UserServiceToken } from "~/core/di/tokens";
import type { IUserService } from "~/application/services";

// Schema for score weights
const scoreWeightsSchema = z.object({
  commuteTimeWeight: z.number().min(0).max(100),
  priceWeight: z.number().min(0).max(100),
  sizeWeight: z.number().min(0).max(100),
  ageWeight: z.number().min(0).max(100),
  floorWeight: z.number().min(0).max(100),
  walkTimeWeight: z.number().min(0).max(100),
}).refine(data => {
  const total = data.commuteTimeWeight + data.priceWeight + data.sizeWeight + 
                data.ageWeight + data.floorWeight + data.walkTimeWeight;
  return Math.abs(total - 100) < 0.01; // Allow for small floating point errors
}, {
  message: "Weights must add up to 100%"
});

export const userRouter = createTRPCRouter({
  /**
   * Get user preferences
   */
  getPreferences: protectedProcedure
    .query(async ({ ctx }) => {
      const userService = ctx.container.resolve(UserServiceToken);
      return await userService.getPreferences(ctx.session.user.id);
    }),

  /**
   * Create initial preferences for a new user
   */
  createInitialPreferences: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userService = ctx.container.resolve(UserServiceToken);
      return await userService.createInitialPreferences(ctx.session.user.id);
    }),

  /**
   * Get current user's profile with preferences
   */
  getCurrentUser: protectedProcedure
    .query(async ({ ctx }) => {
      const userService = ctx.container.resolve(UserServiceToken);
      return await userService.getCurrentUser(ctx.session.user.id);
    }),

  /**
   * Update user preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        maxCommute: z.number().min(5).max(120).optional(),
        preferredStations: z.array(z.string()).optional(),
        priceRange: z.object({
          min: z.number().min(0),
          max: z.number().min(0),
        }).optional(),
        sizeRange: z.object({
          min: z.number().min(0),
          max: z.number().min(0),
        }).optional(),
        scoreWeights: scoreWeightsSchema.optional(),
        targetValues: z.object({
          targetPrice: z.number().min(0).optional(),
          targetSize: z.number().min(0).optional(),
          targetCommute: z.number().min(0).optional(),
          targetAge: z.number().min(0).optional(),
          targetFloor: z.number().min(1).optional(),
          targetWalkTime: z.number().min(0).optional(),
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userService = ctx.container.resolve(UserServiceToken);
      return await userService.updatePreferences(
        ctx.session.user.id,
        input as any
      );
    }),

  /**
   * Update user profile
   */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userService = ctx.container.resolve(UserServiceToken);
      return await userService.updateProfile(
        ctx.session.user.id,
        input
      );
    }),

  /**
   * Delete user account
   */
  deleteAccount: protectedProcedure
    .mutation(async ({ ctx }) => {
      const userService = ctx.container.resolve(UserServiceToken);
      await userService.deleteAccount(ctx.session.user.id);
      return { success: true };
    }),
});