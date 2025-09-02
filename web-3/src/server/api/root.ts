import { postRouter } from "~/server/api/routers/post";
import { apartmentRouter } from "~/server/api/routers/apartment";
import { searchRouter } from "~/server/api/routers/search";
import { listRouter } from "~/server/api/routers/list";
import { userRouter } from "~/server/api/routers/user";
import { adminRouter } from "~/server/api/routers/admin";
import { authRouter } from "~/server/api/routers/auth";
import { stationRouter } from "~/server/api/routers/station";
import { scoreRouter } from "~/server/api/routers/score";
import { healthRouter } from "~/server/api/routers/health";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  post: postRouter,
  apartment: apartmentRouter,
  search: searchRouter,
  list: listRouter,
  user: userRouter,
  admin: adminRouter,
  auth: authRouter,
  station: stationRouter,
  score: scoreRouter,
  health: healthRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
