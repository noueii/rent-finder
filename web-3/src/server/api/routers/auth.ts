import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { AuthService } from "~/server/services/auth.service";

export const authRouter = createTRPCRouter({
  /**
   * Register a new user with email and password
   */
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authService = new AuthService(ctx.db);
      return await authService.register(input.email, input.password, input.name);
    }),

  /**
   * Verify email with verification code
   */
  verifyEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authService = new AuthService(ctx.db);
      return await authService.verifyEmail(input.email, input.code);
    }),

  /**
   * Request password reset
   */
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authService = new AuthService(ctx.db);
      return await authService.requestPasswordReset(input.email);
    }),

  /**
   * Reset password with token
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        token: z.string().length(6),
        newPassword: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authService = new AuthService(ctx.db);
      return await authService.resetPassword(input.email, input.token, input.newPassword);
    }),

  /**
   * Check if email is available
   */
  checkEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const authService = new AuthService(ctx.db);
      return await authService.checkEmailAvailability(input.email);
    }),
});