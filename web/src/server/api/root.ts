import { createTRPCRouter } from './trpc';
import { stationRouter } from './routers/station';
import { apartmentRouter } from './routers/apartment';
import { systemRouter } from './routers/system';
import { performanceRouter } from './routers/performance';
import { scrapingRouter } from './routers/scraping';
import { realtimeSearchRouter } from './routers/realtime-search';
import { adminRouter } from './routers/admin';
import { searchRouter } from './routers/search';
import { testScrapingRouter } from './routers/testScraping';
import { apartmentListRouter } from './routers/apartmentList';

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  station: stationRouter,
  apartment: apartmentRouter,
  system: systemRouter,
  scraping: scrapingRouter,
  performance: performanceRouter,
  realtimeSearch: realtimeSearchRouter,
  admin: adminRouter,
  search: searchRouter,
  testScraping: testScrapingRouter,
  apartmentList: apartmentListRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;