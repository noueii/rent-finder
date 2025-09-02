import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // This is a placeholder - the Post model doesn't exist in our schema
      return {
        id: "1",
        name: input.name,
        createdById: ctx.session.user.id,
      };
    }),

  getLatest: protectedProcedure.query(async ({ ctx }) => {
    // This is a placeholder - the Post model doesn't exist in our schema
    return null;
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
