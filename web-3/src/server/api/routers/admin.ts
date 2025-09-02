import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getJobQueue } from "~/lib/jobs/queue";
import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
import { db } from "~/server/db";
import { 
  AdminService, 
  ScraperManagementService, 
  SystemService 
} from "~/application/services";
import { ensureProcessorsInitialized } from "~/lib/jobs/processors";
import { ApartmentDetailService } from "~/lib/scrapers/services/apartment-detail-service";

// Admin check middleware
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const adminService = new AdminService(ctx.db);
  await adminService.ensureAdminAccess(ctx.session.user.id);
  return next({ ctx });
});

export const adminRouter = createTRPCRouter({
  // Dashboard Statistics
  getStats: adminProcedure.query(async ({ ctx }) => {
    const adminService = new AdminService(ctx.db);
    const systemService = new SystemService(ctx.db, getJobQueue());
    const jobStats = systemService.getJobStats();
    
    return await adminService.getDashboardStats(jobStats);
  }),

  // Scraper Management
  getScrapers: adminProcedure.query(async ({ ctx }) => {
    const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
    return await scraperService.getScrapers();
  }),

  updateScraperConfig: adminProcedure
    .input(z.object({
      id: z.string(),
      updates: z.object({
        isActive: z.boolean().optional(),
        rateLimit: z.number().min(100).optional(),
        headers: z.record(z.string()).optional(),
        selectors: z.record(z.string()).optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      return await scraperService.updateScraperConfig(input);
    }),

  // Manual Scraping Control
  startScraping: adminProcedure
    .input(z.object({
      scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']),
      filters: z.object({
        stationIds: z.array(z.string()).optional(),
        priceRange: z.object({ min: z.number(), max: z.number() }).optional(),
        sizeRange: z.object({ min: z.number(), max: z.number() }).optional(),
        layout: z.array(z.string()).optional(),
      }),
      options: z.object({
        maxPages: z.number().min(1).max(10).default(3),
        includeDetails: z.boolean().default(true),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      return await scraperService.startManualScraping(
        input.scraperType,
        input.filters,
        input.options,
        ctx.session.user.id,
        userName
      );
    }),

  // Job Management
  getAllJobs: adminProcedure
    .query(async () => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.getAllJobs();
    }),

  getJobs: adminProcedure
    .input(z.object({
      type: z.string().optional(),
      status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.getJobs(input);
    }),

  getJobDetails: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.getJobDetails(input.jobId);
    }),

  cancelJob: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .mutation(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.cancelJob(input.jobId);
    }),

  cleanupJobs: adminProcedure
    .input(z.object({
      olderThanHours: z.number().min(1).default(24),
    }))
    .mutation(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.cleanupJobs(input.olderThanHours);
    }),

  // Data Management
  getDataOverview: adminProcedure.query(async ({ ctx }) => {
    const adminService = new AdminService(ctx.db);
    return await adminService.getDataOverview();
  }),

  cleanupDuplicates: adminProcedure
    .input(z.object({
      dryRun: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const systemService = new SystemService(ctx.db, getJobQueue());
      return await systemService.cleanupDuplicates(input.dryRun);
    }),

  cleanupOldData: adminProcedure
    .input(z.object({
      olderThanDays: z.number().min(7).default(30),
      includeApartments: z.boolean().default(false),
      includeSearchSessions: z.boolean().default(true),
      dryRun: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const systemService = new SystemService(ctx.db, getJobQueue());
      return await systemService.cleanupOldData(input);
    }),

  // Cache Management
  getCacheStats: adminProcedure.query(async () => {
    const systemService = new SystemService(db, getJobQueue());
    return systemService.getCacheStats();
  }),

  clearCache: adminProcedure
    .input(z.object({
      pattern: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.clearCache(input.pattern);
    }),

  // System Health
  getSystemHealth: adminProcedure.query(async ({ ctx }) => {
    const adminService = new AdminService(ctx.db);
    
    return await adminService.checkSystemHealth(
      async () => {
        try {
          await ctx.db.$queryRaw`SELECT 1`;
          return true;
        } catch {
          return false;
        }
      },
      async () => {
        try {
          const queue = getJobQueue();
          const stats = queue.getStats();
          return stats.total >= 0;
        } catch {
          return false;
        }
      },
      async () => {
        try {
          const types = UnifiedScraperFactory.getRegisteredTypes();
          return types.length > 0;
        } catch {
          return false;
        }
      },
      async () => {
        try {
          const systemService = new SystemService(db, getJobQueue());
          const stats = systemService.getCacheStats();
          return stats.size >= 0;
        } catch {
          return false;
        }
      }
    );
  }),

  // Monitoring
  getRecentErrors: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.getRecentErrors(input.limit);
    }),

  getScrapingHistory: adminProcedure
    .input(z.object({
      scraperType: z.string().optional(),
      days: z.number().min(1).max(30).default(7),
    }))
    .query(async ({ ctx, input }) => {
      const adminService = new AdminService(ctx.db);
      return await adminService.getScrapingHistory(input.scraperType, input.days);
    }),

  // Test console logging
  testConsoleLog: adminProcedure
    .query(async () => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.testConsoleLog();
    }),

  // Simple test mutation to verify tRPC works
  testSimpleMutation: adminProcedure
    .input(z.object({
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log('[testSimpleMutation] Received:', input.message);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const response = {
        success: true,
        echo: input.message,
        timestamp: new Date(),
      };
      
      console.log('[testSimpleMutation] Returning:', response);
      return response;
    }),

  // Scraper Logs
  getScraperLogs: adminProcedure
    .input(z.object({
      jobId: z.string().optional(),
      scraperType: z.string().optional(),
      level: z.enum(['info', 'warn', 'error', 'debug']).optional(),
      since: z.date().optional(),
      limit: z.number().min(1).max(1000).default(100),
    }))
    .query(async ({ input }) => {
      const scraperService = new ScraperManagementService(db, getJobQueue());
      return scraperService.getScraperLogs(input);
    }),

  getScraperLogStats: adminProcedure.query(async () => {
    const scraperService = new ScraperManagementService(db, getJobQueue());
    return scraperService.getScraperLogStats();
  }),

  clearScraperLogs: adminProcedure.mutation(async () => {
    const scraperService = new ScraperManagementService(db, getJobQueue());
    return scraperService.clearScraperLogs();
  }),

  // Run a scraper with specific parameters
  runScraper: adminProcedure
    .input(z.object({
      scraperType: z.string(),
      params: z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minSize: z.number().optional(),
        maxSize: z.number().optional(),
        layout: z.array(z.string()).optional(),
        limit: z.number().optional(),
        fetchAll: z.boolean().optional(),
        updatedWithin: z.number().optional(), // Days - e.g., 14 or 30
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      return await scraperService.runScraper(
        input.scraperType,
        input.params,
        ctx.session.user.id,
        userName
      );
    }),

  // Fetch all available apartments from a scraper
  fetchAllFromScraper: adminProcedure
    .input(z.object({
      scraperType: z.string(),
      params: z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minSize: z.number().optional(),
        maxSize: z.number().optional(),
        layout: z.array(z.string()).optional(),
        fetchAll: z.literal(true),
        updatedWithin: z.number().optional(), // Days - e.g., 14 or 30
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      return await scraperService.fetchAllFromScraper(
        input.scraperType,
        input.params,
        ctx.session.user.id,
        userName
      );
    }),

  // Scraper Testing Endpoints
  testScraperDetail: adminProcedure
    .input(z.object({
      scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']),
      url: z.string().url(),
    }))
    .mutation(async ({ input }) => {
      const scraperService = new ScraperManagementService(db, getJobQueue());
      return await scraperService.testScraperDetail(input.scraperType, input.url);
    }),

  testScraperSearch: adminProcedure
    .input(z.object({
      scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']),
      mode: z.enum(['fast', 'normal']).optional().default('normal'),
      params: z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minSize: z.number().optional(),
        maxSize: z.number().optional(),
        layout: z.array(z.string()).optional(),
        stationNames: z.array(z.string()).optional(),
        page: z.number().optional(),
        limit: z.number().min(1).max(50).default(10),
        fetchAll: z.boolean().optional(),
        updatedWithin: z.number().optional(), // Days - e.g., 14 or 30
      }),
    }))
    .mutation(async ({ input }) => {
      const scraperService = new ScraperManagementService(db, getJobQueue());
      return await scraperService.testScraperSearch(
        input.scraperType,
        input.mode,
        input.params
      );
    }),

  testScraperUrls: adminProcedure
    .input(z.object({
      scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']),
      params: z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minSize: z.number().optional(),
        maxSize: z.number().optional(),
        layout: z.array(z.string()).optional(),
        page: z.number().optional(),
        limit: z.number().optional(),
      }),
    }))
    .query(async ({ input }) => {
      try {
        const scraper = UnifiedScraperFactory.create(input.scraperType as any);
        
        // Access the protected method through any type assertion
        const urls = await (scraper as any).buildSearchUrls(input.params);
        
        return {
          success: true,
          urls,
          scraperType: input.scraperType,
          params: input.params,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          scraperType: input.scraperType,
          params: input.params,
        };
      }
    }),

  // Get count of apartments needing details for each scraper
  getApartmentsNeedingDetailsCounts: adminProcedure
    .query(async ({ ctx }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      return await scraperService.getApartmentsNeedingDetailsCounts();
    }),

  // Get apartments that need detail fetching
  getApartmentsNeedingDetails: adminProcedure
    .input(z.object({
      scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']).optional(),
      limit: z.number().min(1).max(1000).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      return await scraperService.getApartmentsNeedingDetails(
        input.scraperType,
        input.limit
      );
    }),

  // Run multiple scrapers sequentially
  runScrapersSequentially: adminProcedure
    .input(z.object({
      scraperTypes: z.array(z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences'])),
      params: z.object({
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        minSize: z.number().optional(),
        maxSize: z.number().optional(),
        layout: z.array(z.string()).optional(),
        fetchAll: z.boolean().default(false),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      ensureProcessorsInitialized();
      
      const jobQueue = getJobQueue();
      const jobs = [];
      const errors = [];
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      // Process scrapers one by one
      for (const scraperType of input.scraperTypes) {
        try {
          // Check if this scraper is already running
          if (jobQueue.isScraperRunning(scraperType)) {
            errors.push({
              scraperType,
              error: `Scraper ${scraperType} is already running`
            });
            continue;
          }
          
          // Get scraper info
          const scraperSource = await db.scrapingSource.findFirst({
            where: { type: scraperType }
          });
          
          // Create a job for this scraper
          const jobId = await jobQueue.add('scrape-apartment-list', {
            scraperType,
            scraperName: scraperSource?.name || scraperType,
            scraperUrl: scraperSource?.baseUrl || '',
            params: {
              ...input.params,
              limit: undefined, // Always fetch all pages using dynamic pagination
            },
            userId: ctx.session.user.id,
            userName,
            timestamp: new Date(),
            action: input.params.fetchAll ? 'fetch-all' : 'search',
            expectedLimit: input.params.fetchAll ? 500 : 50,
          });
          
          jobs.push({
            jobId,
            scraperType,
            scraperName: scraperSource?.name || scraperType,
          });
          
          // Add a small delay between job creations to ensure proper ordering
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          errors.push({
            scraperType,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return {
        success: true,
        jobsCreated: jobs,
        errors,
        message: `Created ${jobs.length} jobs for sequential processing`,
      };
    }),

  // Bulk update apartments by URLs
  updateApartmentsByUrls: adminProcedure
    .input(z.object({
      urls: z.array(z.string().url()).min(1).max(100),
      scraperType: z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const scraperService = new ScraperManagementService(ctx.db, getJobQueue());
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      return await scraperService.updateApartmentsByUrls(
        input.urls,
        input.scraperType,
        ctx.session.user.id,
        userName
      );
    }),

  // Run updates for multiple providers sequentially
  runUpdatesSequentially: adminProcedure
    .input(z.object({
      scraperTypes: z.array(z.enum(['realestate', 'yolo-japan', 'wagaya-japan', 'e-housing', 'metro-residences'])),
      limit: z.number().min(1).max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      ensureProcessorsInitialized();
      
      const jobQueue = getJobQueue();
      const jobs = [];
      const errors = [];
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      // Process each scraper sequentially
      for (const scraperType of input.scraperTypes) {
        try {
          // Check if this scraper is already running
          if (jobQueue.isScraperRunning(scraperType)) {
            errors.push({
              scraperType,
              error: `Scraper ${scraperType} is already running`
            });
            continue;
          }
          
          // Get apartments needing details for this scraper
          const apartments = await db.apartment.findMany({
            where: {
              scrapingSource: {
                type: scraperType,
              },
              fetchedDetails: false,
            },
            select: {
              id: true,
              sourceUrl: true,
              latitude: true,
              longitude: true,
              fetchedDetails: true,
            },
            take: input.limit || undefined, // undefined means no limit (fetch all)
          });
          
          if (apartments.length === 0) {
            errors.push({
              scraperType,
              error: `No apartments found needing details for ${scraperType}`
            });
            continue;
          }
          
          // Get scraper info
          const scraperSource = await db.scrapingSource.findFirst({
            where: { type: scraperType }
          });
          
          // Create a job for updating apartments
          const urls = apartments.map(apt => apt.sourceUrl);
          const jobId = await jobQueue.add('update-apartments-by-urls', {
            scraperType,
            scraperName: scraperSource?.name || scraperType,
            scraperUrl: scraperSource?.baseUrl || '',
            urls,
            userId: ctx.session.user.id,
            userName,
            timestamp: new Date(),
            action: 'update-by-urls',
            expectedLimit: urls.length,
          });
          
          jobs.push({
            jobId,
            scraperType,
            scraperName: scraperSource?.name || scraperType,
            urlCount: urls.length,
          });
          
          // Add a small delay between job creations to ensure proper ordering
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          errors.push({
            scraperType,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
      
      return {
        success: true,
        jobsCreated: jobs,
        errors,
        message: `Created ${jobs.length} update jobs for sequential processing`,
      };
    }),

  // Debug: Force process job queue
  processJobQueue: adminProcedure
    .mutation(async () => {
      const systemService = new SystemService(db, getJobQueue());
      return systemService.processJobQueue();
    }),

  // Geocoding Management
  getGeocodingStats: adminProcedure
    .query(async () => {
      const systemService = new SystemService(db, getJobQueue());
      return await systemService.getGeocodingStatistics();
    }),

  batchGeocode: adminProcedure
    .input(z.object({
      limit: z.number().min(1).max(500).default(100),
    }))
    .mutation(async ({ input }) => {
      const systemService = new SystemService(db, getJobQueue());
      return await systemService.batchGeocodeApartments(input.limit);
    }),

  // Update apartment details for a list
  updateApartmentDetailsForList: adminProcedure
    .input(z.object({
      listId: z.string(),
      filters: z.object({
        minSize: z.number().optional(),
        minScore: z.number().optional(),
        limit: z.number().min(1).max(100).optional(),
        source: z.string().optional(),
      }).optional(),
      mode: z.enum(['fast', 'normal']).default('normal'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        ensureProcessorsInitialized();
        
        // Verify list exists and belongs to user or user is admin
        const list = await ctx.db.list.findUnique({
          where: { id: input.listId },
          select: { 
            id: true, 
            userId: true,
            name: true,
            apartments: {
              select: { apartmentId: true },
              take: 1,
            }
          }
        });
        
        if (!list) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "List not found",
          });
        }
        
        if (list.apartments.length === 0) {
          return {
            success: true,
            message: "No apartments in list to update",
            jobId: null,
          };
        }
        
        // Create a job for updating apartment details
        const jobQueue = getJobQueue();
        const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
        
        const jobId = await jobQueue.add('update-apartment-details-for-list', {
          listId: input.listId,
          listName: list.name,
          filters: input.filters || {},
          mode: input.mode,
          userId: ctx.session.user.id,
          userName,
          timestamp: new Date(),
          action: 'update-list-details',
        });
        
        return {
          success: true,
          message: `Update job ${jobId} queued for list "${list.name}"`,
          jobId,
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to queue list update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  updateApartmentsWithoutCoordinates: adminProcedure
    .input(z.object({
      sourceSite: z.string(),
      limit: z.number().min(1).max(10000).default(20).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const systemService = new SystemService(ctx.db, getJobQueue());
      const userName = ctx.session.user.name || ctx.session.user.email || 'Unknown';
      
      return await systemService.updateApartmentsWithoutCoordinates(
        input.sourceSite,
        input.limit,
        ctx.session.user.id,
        userName
      );
    }),

  // Apartment Removal Checks
  checkApartmentRemovals: adminProcedure
    .input(z.object({
      apartmentIds: z.array(z.string()).optional(),
      sourceSite: z.string().optional(),
      batchSize: z.number().min(1).max(50).default(10),
      checkOlderThan: z.date().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log('[Admin API] Starting apartment removal check');
      const { checkApartmentRemovals } = await import('~/lib/jobs/check-apartment-removals');
      const result = await checkApartmentRemovals(input);
      return result;
    }),

  getRemovalStats: adminProcedure.query(async ({ ctx }) => {
    console.log('[Admin API] Getting removal statistics');
    const { ApartmentRemovalHandler } = await import('~/lib/scrapers/utils/apartment-removal-handler');
    const adminService = new AdminService(ctx.db);
    
    const [scraperStats, removalCheckStats] = await Promise.all([
      ApartmentRemovalHandler.getRemovedApartmentsStats(),
      adminService.getRemovalStatistics(),
    ]);
    
    return {
      ...scraperStats,
      ...removalCheckStats,
    };
  }),
});