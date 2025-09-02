import { type PrismaClient, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { SearchCache } from "~/lib/cache/search-cache";
import { type JobQueue, type Job } from "~/lib/jobs/queue";
import { batchGeocodeApartments, getGeocodingStats } from "~/server/services/geocoding-batch";

interface CleanupResult {
  dryRun: boolean;
  duplicatesFound?: number;
  apartmentsToDelete?: number;
  apartmentsDeleted?: number;
  cutoffDate?: Date;
  counts?: Record<string, number>;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

interface JobStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

export class SystemService {
  constructor(
    private db: PrismaClient,
    private jobQueue: JobQueue
  ) {}

  /**
   * Clean up duplicate apartments
   */
  async cleanupDuplicates(dryRun: boolean = true): Promise<CleanupResult> {
    // Find duplicates
    const duplicates = await this.db.$queryRaw<Array<{
      externalId: string;
      sourceSite: string;
      ids: string[];
    }>>/*sql*/`
      SELECT 
        "externalId", 
        "sourceSite",
        ARRAY_AGG("id" ORDER BY "createdAt" DESC) as ids
      FROM "Apartment"
      GROUP BY "externalId", "sourceSite"
      HAVING COUNT(*) > 1
    `;

    if (dryRun) {
      return {
        dryRun: true,
        duplicatesFound: duplicates.length,
        apartmentsToDelete: duplicates.reduce((sum, d) => sum + d.ids.length - 1, 0),
      };
    }

    // Keep the newest, delete the rest
    let deletedCount = 0;
    for (const dup of duplicates) {
      const idsToDelete = dup.ids.slice(1); // Keep first (newest), delete rest
      await this.db.apartment.deleteMany({
        where: { id: { in: idsToDelete } },
      });
      deletedCount += idsToDelete.length;
    }

    return {
      dryRun: false,
      duplicatesFound: duplicates.length,
      apartmentsDeleted: deletedCount,
    };
  }

  /**
   * Clean up old data
   */
  async cleanupOldData(options: {
    olderThanDays: number;
    includeApartments: boolean;
    includeSearchSessions: boolean;
    dryRun: boolean;
  }): Promise<CleanupResult> {
    const cutoffDate = new Date(Date.now() - options.olderThanDays * 24 * 60 * 60 * 1000);
    const counts: Record<string, number> = {};

    if (options.includeSearchSessions) {
      const searchCount = await this.db.searchSession.count({
        where: { createdAt: { lt: cutoffDate } },
      });
      counts.searchSessions = searchCount;

      if (!options.dryRun) {
        await this.db.searchSession.deleteMany({
          where: { createdAt: { lt: cutoffDate } },
        });
      }
    }

    if (options.includeApartments) {
      const apartmentCount = await this.db.apartment.count({
        where: { 
          scrapedAt: { lt: cutoffDate },
          lists: { none: {} }, // Not in any lists
        },
      });
      counts.apartments = apartmentCount;

      if (!options.dryRun) {
        await this.db.apartment.deleteMany({
          where: { 
            scrapedAt: { lt: cutoffDate },
            lists: { none: {} },
          },
        });
      }
    }

    return {
      dryRun: options.dryRun,
      cutoffDate,
      counts,
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    const cache = SearchCache.getInstance();
    return cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(pattern?: string): { cleared: number; message: string } {
    const cache = SearchCache.getInstance();
    
    if (pattern) {
      // Clear specific pattern
      let cleared = 0;
      const allKeys = Array.from((cache as any).cache.keys()) as string[];
      for (const key of allKeys) {
        if (key.includes(pattern)) {
          (cache as any).cache.delete(key);
          cleared++;
        }
      }
      return { cleared, message: `Cleared ${cleared} cache entries matching pattern` };
    } else {
      // Clear all
      cache.clear();
      return { cleared: -1, message: "Cleared entire cache" };
    }
  }

  /**
   * Get all jobs from the queue
   */
  getAllJobs(): Array<{
    id: string;
    type: string;
    scraperType?: string;
    status: string;
    progress: number;
    progressData?: any;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    error?: string;
    urlCount: number;
  }> {
    const jobs = this.jobQueue.getAllJobs();
    
    return jobs.map(job => ({
      id: job.id,
      type: job.type,
      scraperType: job.data?.scraperType,
      status: job.status,
      progress: job.progress,
      progressData: job.progressData,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      urlCount: job.data?.urls?.length || job.data?.expectedLimit || 0,
    }));
  }

  /**
   * Get jobs with filtering
   */
  getJobs(options: {
    type?: string;
    status?: 'pending' | 'processing' | 'completed' | 'failed';
    limit: number;
  }) {
    const allJobs = options.type 
      ? this.jobQueue.getJobsByType(options.type)
      : Array.from((this.jobQueue as any).jobs.values());

    // Filter by status if provided
    const filteredJobs = options.status
      ? allJobs.filter((job: any) => job.status === options.status)
      : allJobs;

    // Sort by creation date (newest first) and limit
    const sortedJobs = filteredJobs
      .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, options.limit);

    return sortedJobs;
  }

  /**
   * Get job details
   */
  getJobDetails(jobId: string): Job {
    const job = this.jobQueue.getJob(jobId);
    
    if (!job) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }

    return job;
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): { success: boolean; message: string } {
    const job = this.jobQueue.getJob(jobId);
    
    if (!job) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Job not found",
      });
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Can only cancel pending or processing jobs",
      });
    }

    // Mark job as failed with cancellation message
    job.status = 'failed';
    job.error = 'Job cancelled by admin';
    job.completedAt = new Date();

    return { success: true, message: "Job cancelled" };
  }

  /**
   * Clean up old jobs
   */
  cleanupJobs(olderThanHours: number = 24): { success: boolean; message: string } {
    this.jobQueue.cleanup(olderThanHours * 60 * 60 * 1000);
    
    return { 
      success: true, 
      message: `Cleaned up jobs older than ${olderThanHours} hours` 
    };
  }

  /**
   * Get job queue statistics
   */
  getJobStats(): JobStats {
    return this.jobQueue.getStats();
  }

  /**
   * Get recent errors from failed jobs
   */
  getRecentErrors(limit: number = 20) {
    const failedJobs = this.jobQueue.getJobsByType('all')
      .filter(job => job.status === 'failed')
      .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
      .slice(0, limit);

    return failedJobs.map(job => ({
      id: job.id,
      type: job.type,
      error: job.error,
      timestamp: job.completedAt,
      attempts: job.attempts,
    }));
  }

  /**
   * Force process job queue
   */
  processJobQueue(): { message: string; stats: JobStats } {
    // Force start processing if it's not already running
    (this.jobQueue as any).startProcessing();
    
    const stats = this.jobQueue.getStats();
    return {
      message: 'Job queue processing triggered',
      stats,
    };
  }

  /**
   * Get geocoding statistics
   */
  async getGeocodingStatistics() {
    return await getGeocodingStats();
  }

  /**
   * Batch geocode apartments
   */
  async batchGeocodeApartments(limit: number = 100) {
    try {
      await batchGeocodeApartments(limit);
      
      // Get updated stats
      const stats = await getGeocodingStats();
      
      return {
        success: true,
        message: `Batch geocoding completed`,
        stats,
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Geocoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  /**
   * Update apartments without coordinates
   */
  async updateApartmentsWithoutCoordinates(
    sourceSite: string,
    limit: number | undefined,
    userId: string,
    userName: string
  ) {
    // Find apartments without coordinates from the specified source
    const apartmentsToUpdate = await this.db.apartment.findMany({
      where: {
        sourceSite,
        OR: [
          { latitude: null },
          { longitude: null },
        ],
      },
      select: {
        id: true,
        sourceUrl: true,
        externalId: true,
      },
      take: limit || undefined, // If no limit, get all
    });

    if (apartmentsToUpdate.length === 0) {
      return {
        success: true,
        message: `No apartments without coordinates found for ${sourceSite}`,
        urlsQueued: 0,
      };
    }

    // Extract URLs
    const urls = apartmentsToUpdate.map(apt => apt.sourceUrl);
    
    // Get scraper source info
    const scraperSource = await this.db.scrapingSource.findFirst({
      where: { 
        OR: [
          { type: sourceSite },
          { name: { contains: sourceSite, mode: 'insensitive' } }
        ]
      }
    });

    // Determine scraper type based on source site
    let scraperType = sourceSite;
    if (sourceSite === 'yolo-japan') {
      scraperType = 'yolo-japan';
    } else if (sourceSite === 'wagaya-japan') {
      scraperType = 'wagaya-japan';
    } else if (sourceSite === 'realestate-co-jp') {
      scraperType = 'realestate';
    }

    // Create update job
    const jobId = await this.jobQueue.add('update-apartments-by-urls', {
      scraperType,
      scraperName: scraperSource?.name || sourceSite,
      scraperUrl: scraperSource?.baseUrl || '',
      urls,
      userId,
      userName,
      timestamp: new Date(),
      action: 'update-missing-coordinates',
      expectedLimit: urls.length,
      metadata: {
        reason: 'Missing coordinates',
        sourceSite,
      },
    });

    return {
      success: true,
      message: `Queued ${urls.length} apartments for coordinate update`,
      jobId,
      urlsQueued: urls.length,
      scraperType,
    };
  }

  /**
   * Run simple test console logging
   */
  testConsoleLog() {
    console.log('============ SIMPLE CONSOLE TEST ============');
    console.warn('This is a warning');
    console.error('This is an error');
    console.info('This is info');
    console.debug('This is debug');
    process.stdout.write('Direct stdout write\n');
    process.stderr.write('Direct stderr write\n');
    console.log('============================================');
    
    return {
      message: 'Console test executed. Check server logs.',
      timestamp: new Date(),
    };
  }
}