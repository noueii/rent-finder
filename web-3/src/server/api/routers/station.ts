import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { StationService } from "~/server/services/station.service";

export const stationRouter = createTRPCRouter({
  getAll: publicProcedure
    .query(async ({ ctx }) => {
      const stationService = new StationService(ctx.db);
      return await stationService.getAllStations();
    }),

  search: publicProcedure
    .input(z.object({
      query: z.string().min(1),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const stationService = new StationService(ctx.db);
      return await stationService.searchStations(input.query, input.limit);
    }),

  getById: publicProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const stationService = new StationService(ctx.db);
      return await stationService.getStationById(input.id);
    }),
});