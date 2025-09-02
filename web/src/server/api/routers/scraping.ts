import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { scrapingService } from '../../../services/scraping-service';
import { scrapeApartmentImages, getApartmentsNeedingImages } from '../../../lib/imageScraper';

// Input schemas
const createScrapeJobSchema = z.object({
  sourceSite: z.enum(['apts.jp', 'realestate.co.jp']),
  targetUrl: z.string().url().optional(),
  targetStation: z.string().optional(),
  priority: z.number().int().min(0).max(10).default(0),
});

const scrapeJobIdSchema = z.object({
  jobId: z.string(),
});

const listJobsSchema = z.object({
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

const manualScrapeSchema = z.object({
  sourceSite: z.enum(['apts.jp', 'realestate.co.jp']),
  targetUrl: z.string().url().optional(),
});

const imageScrapeSchema = z.object({
  apartmentIds: z.array(z.string()).min(1).max(2000), // Increased limit for bulk processing
  maxConcurrent: z.number().int().min(1).max(10).default(3),
});

const imageScrapeForFiltersSchema = z.object({
  targetStation: z.string().optional(),
  maxCommuteTime: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
  layouts: z.array(z.string()).optional(),
  maxBuildingAge: z.number().nullable().optional(),
  maxWalkingMinutes: z.number().nullable().optional(),
  excludeFromLists: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(5000).optional(), // Made optional, no default
  maxConcurrent: z.number().int().min(1).max(10).default(3),
});

// Schema for just checking apartments needing images (no limit by default)
const checkApartmentsNeedingImagesSchema = z.object({
  targetStation: z.string().optional(),
  maxCommuteTime: z.number().optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  minSize: z.number().optional(),
  maxSize: z.number().optional(),
  layouts: z.array(z.string()).optional(),
  maxBuildingAge: z.number().nullable().optional(),
  maxWalkingMinutes: z.number().nullable().optional(),
  excludeFromLists: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

export const scrapingRouter = createTRPCRouter({
  /**
   * Create a new scraping job
   */
  createJob: publicProcedure
    .input(createScrapeJobSchema)
    .mutation(async ({ input }) => {
      try {
        const jobId = await scrapingService.createScrapeJob({
          sourceSite: input.sourceSite,
          targetUrl: input.targetUrl,
          targetStation: input.targetStation,
          priority: input.priority,
        });

        return { jobId };
      } catch (error) {
        console.error('Failed to create scrape job:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create scraping job',
        });
      }
    }),

  /**
   * List scraping jobs
   */
  listJobs: publicProcedure
    .input(listJobsSchema)
    .query(async ({ input }) => {
      try {
        const jobs = await scrapingService.getScrapeJobs(input.status);
        
        // Apply pagination
        const paginatedJobs = jobs.slice(input.offset, input.offset + input.limit);
        
        return {
          jobs: paginatedJobs,
          pagination: {
            total: jobs.length,
            limit: input.limit,
            offset: input.offset,
            hasMore: input.offset + input.limit < jobs.length,
          },
        };
      } catch (error) {
        console.error('Failed to list scrape jobs:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to list scraping jobs',
        });
      }
    }),

  /**
   * Get scraping job details
   */
  getJob: publicProcedure
    .input(scrapeJobIdSchema)
    .query(async ({ input }) => {
      try {
        const jobs = await scrapingService.getScrapeJobs();
        const job = jobs.find(j => j.id === input.jobId);
        
        if (!job) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Scraping job not found',
          });
        }

        return { job };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Failed to get scrape job:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get scraping job',
        });
      }
    }),

  /**
   * Run a scraping job
   */
  runJob: publicProcedure
    .input(scrapeJobIdSchema)
    .mutation(async ({ input }) => {
      try {
        const result = await scrapingService.runScrapeJob(input.jobId);
        return { result };
      } catch (error) {
        console.error('Failed to run scrape job:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to run scraping job',
        });
      }
    }),

  /**
   * Manual scraping (immediate execution)
   */
  scrapeNow: publicProcedure
    .input(manualScrapeSchema)
    .mutation(async ({ input }) => {
      try {
        let result;
        
        switch (input.sourceSite) {
          case 'apts.jp':
            result = await scrapingService.scrapeAptsJp(input.targetUrl);
            break;
          case 'realestate.co.jp':
            result = await scrapingService.scrapeRealEstate(input.targetUrl);
            break;
          default:
            throw new Error(`Unknown source site: ${input.sourceSite}`);
        }

        return { result };
      } catch (error) {
        console.error('Manual scraping failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Manual scraping failed',
        });
      }
    }),

  /**
   * Get scraping statistics
   */
  getStats: publicProcedure
    .query(async () => {
      try {
        const stats = await scrapingService.getScrapingStats();
        return { stats };
      } catch (error) {
        console.error('Failed to get scraping stats:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get scraping statistics',
        });
      }
    }),

  /**
   * Cancel a pending scraping job
   */
  cancelJob: publicProcedure
    .input(scrapeJobIdSchema)
    .mutation(async ({ input }) => {
      try {
        await scrapingService.updateScrapeJob(input.jobId, {
          status: 'CANCELLED',
          completedAt: new Date(),
        });

        return { success: true };
      } catch (error) {
        console.error('Failed to cancel scrape job:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel scraping job',
        });
      }
    }),

  /**
   * Retry a failed scraping job
   */
  retryJob: publicProcedure
    .input(scrapeJobIdSchema)
    .mutation(async ({ input }) => {
      try {
        await scrapingService.updateScrapeJob(input.jobId, {
          status: 'PENDING',
          startedAt: undefined,
          completedAt: undefined,
        });

        return { success: true };
      } catch (error) {
        console.error('Failed to retry scrape job:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retry scraping job',
        });
      }
    }),

  /**
   * Get supported scraping sites
   */
  getSites: publicProcedure
    .query(async () => {
      return {
        sites: [
          {
            id: 'apts.jp',
            name: 'Apts.jp',
            description: 'English-language apartment listings in Tokyo',
            baseUrl: 'https://apts.jp',
            features: ['English interface', 'Detailed amenities', 'Photo galleries'],
          },
          {
            id: 'realestate.co.jp',
            name: 'RealEstate.co.jp',
            description: 'International real estate listings',
            baseUrl: 'https://realestate.co.jp',
            features: ['Multi-language support', 'International focus', 'Detailed property info'],
          },
        ],
      };
    }),

  /**
   * Scrape images for specific apartments
   */
  scrapeImages: publicProcedure
    .input(imageScrapeSchema)
    .mutation(async ({ input }) => {
      try {
        const results = await scrapeApartmentImages(input.apartmentIds, input.maxConcurrent);
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        return {
          success: true,
          total: results.length,
          successful: successful.length,
          failed: failed.length,
          results: results,
          summary: {
            imagesScraped: successful.reduce((sum, r) => sum + r.totalImagesFound, 0),
            mainImagesFound: successful.filter(r => r.mainImageUrl).length,
            additionalImagesFound: successful.reduce((sum, r) => sum + r.additionalImages.length, 0),
            floorPlansFound: successful.filter(r => r.floorPlanUrl).length,
          },
        };
      } catch (error) {
        console.error('Image scraping failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Image scraping failed',
        });
      }
    }),

  /**
   * Scrape images for apartments matching search filters
   */
  scrapeImagesForFilters: publicProcedure
    .input(imageScrapeForFiltersSchema)
    .mutation(async ({ input }) => {
      try {
        // Get apartments that need images based on filters
        const apartmentIds = await getApartmentsNeedingImages({
          targetStation: input.targetStation,
          maxCommuteTime: input.maxCommuteTime,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          minSize: input.minSize,
          maxSize: input.maxSize,
          layouts: input.layouts,
          maxBuildingAge: input.maxBuildingAge,
          maxWalkingMinutes: input.maxWalkingMinutes,
          excludeFromLists: input.excludeFromLists,
          limit: input.limit,
        });

        if (apartmentIds.length === 0) {
          return {
            success: true,
            message: 'No apartments found that need image scraping with the given filters',
            total: 0,
            successful: 0,
            failed: 0,
            results: [],
          };
        }

        console.log(`Starting image scraping for ${apartmentIds.length} apartments`);

        // For large batches, process in chunks to avoid timeouts
        const chunkSize = 500;
        const allResults: any[] = [];
        
        for (let i = 0; i < apartmentIds.length; i += chunkSize) {
          const chunk = apartmentIds.slice(i, i + chunkSize);
          console.log(`Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(apartmentIds.length / chunkSize)}`);
          
          const chunkResults = await scrapeApartmentImages(chunk, input.maxConcurrent);
          allResults.push(...chunkResults);
        }
        
        const successful = allResults.filter(r => r.success);
        const failed = allResults.filter(r => !r.success);
        
        return {
          success: true,
          total: allResults.length,
          successful: successful.length,
          failed: failed.length,
          results: allResults.slice(0, 100), // Return only first 100 results to avoid response size issues
          summary: {
            imagesScraped: successful.reduce((sum, r) => sum + r.totalImagesFound, 0),
            mainImagesFound: successful.filter(r => r.mainImageUrl).length,
            additionalImagesFound: successful.reduce((sum, r) => sum + r.additionalImages.length, 0),
            floorPlansFound: successful.filter(r => r.floorPlanUrl).length,
          },
        };
      } catch (error) {
        console.error('Filtered image scraping failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Filtered image scraping failed',
        });
      }
    }),

  /**
   * Get apartments that need image scraping
   */
  getApartmentsNeedingImages: publicProcedure
    .input(checkApartmentsNeedingImagesSchema)
    .query(async ({ input }) => {
      try {
        const apartmentIds = await getApartmentsNeedingImages({
          targetStation: input.targetStation,
          maxCommuteTime: input.maxCommuteTime,
          minPrice: input.minPrice,
          maxPrice: input.maxPrice,
          minSize: input.minSize,
          maxSize: input.maxSize,
          layouts: input.layouts,
          maxBuildingAge: input.maxBuildingAge,
          maxWalkingMinutes: input.maxWalkingMinutes,
          excludeFromLists: input.excludeFromLists,
          limit: input.limit,
        });

        return {
          apartmentIds,
          count: apartmentIds.length,
        };
      } catch (error) {
        console.error('Failed to get apartments needing images:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get apartments needing images',
        });
      }
    }),
});