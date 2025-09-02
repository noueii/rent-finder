import { type PrismaClient, type ScrapingSource, Prisma } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { UnifiedScraperFactory, type UnifiedScraperType as ScraperType } from '~/lib/scrapers/unified-scraper-factory';
import { ScraperLogger } from "~/lib/logging/scraper-logger";
import { ensureProcessorsInitialized } from "~/lib/jobs/processors";
import { type JobQueue } from "~/lib/jobs/queue";

// Import scrapers to trigger registration
import "~/lib/scrapers/sources";

export interface ScraperConfig {
  id: string;
  updates: {
    isActive?: boolean;
    rateLimit?: number;
    headers?: Record<string, string>;
    selectors?: Record<string, string>;
  };
}

export interface ScraperTestResult {
  success: boolean;
  data?: any;
  error?: string;
  scraperType: string;
  url?: string;
  params?: any;
  timestamp: Date;
  debugInfo?: {
    jsonSaved: string | null;
    htmlSaved: string;
    message: string;
  };
}

export interface ScraperJobResult {
  jobId: string;
  scraperType: string;
  scraperName: string;
  urlCount?: number;
}

export interface ScraperSearchParams {
  minPrice?: number;
  maxPrice?: number;
  minSize?: number;
  maxSize?: number;
  layout?: string[];
  stationNames?: string[];
  page?: number;
  limit?: number;
  fetchAll?: boolean;
  updatedWithin?: number; // Days - e.g., 14 or 30 (RealEstate.co.jp specific)
}

export class ScraperManagementService {
  constructor(
    private db: PrismaClient,
    private jobQueue: JobQueue
  ) {}

  /**
   * Get all registered and configured scrapers
   */
  async getScrapers() {
    const registeredTypes = UnifiedScraperFactory.getRegisteredTypes();
    const sources = await this.db.scrapingSource.findMany({
      orderBy: { name: 'asc' },
    });

    return {
      registered: registeredTypes,
      configured: sources,
    };
  }

  /**
   * Update scraper configuration
   */
  async updateScraperConfig(config: ScraperConfig): Promise<ScrapingSource> {
    return await this.db.scrapingSource.update({
      where: { id: config.id },
      data: {
        ...config.updates,
        headers: config.updates.headers ? config.updates.headers : undefined,
        selectors: config.updates.selectors ? config.updates.selectors : undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * Start a manual scraping job
   */
  async startManualScraping(
    scraperType: ScraperType,
    filters: any,
    options: { maxPages?: number; includeDetails?: boolean } = {},
    userId: string,
    userName: string
  ): Promise<{ jobId: string; message: string }> {
    ensureProcessorsInitialized();
    
    const jobId = await this.jobQueue.add('manual-scrape', {
      scraperType,
      filters,
      options: {
        maxPages: options.maxPages ?? 3,
        includeDetails: options.includeDetails ?? true,
      },
      userId,
      startedAt: new Date(),
    });

    return {
      jobId,
      message: `Scraping job ${jobId} started`,
    };
  }

  /**
   * Run a scraper with specific parameters
   */
  async runScraper(
    scraperType: string,
    params: ScraperSearchParams,
    userId: string,
    userName: string
  ): Promise<ScraperJobResult> {
    ensureProcessorsInitialized();
    
    // Check if this scraper is already running
    if (this.jobQueue.isScraperRunning(scraperType)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Scraper ${scraperType} is already running. Please wait for it to complete.`,
      });
    }
    
    // Get scraper info
    const scraperSource = await this.db.scrapingSource.findFirst({
      where: { type: scraperType }
    });
    
    // Create a job for scraping
    const jobId = await this.jobQueue.add('scrape-apartment-list', {
      scraperType,
      scraperName: scraperSource?.name || scraperType,
      scraperUrl: scraperSource?.baseUrl || '',
      params,
      userId,
      userName,
      timestamp: new Date(),
      action: 'search',
      expectedLimit: params.limit || 30,
    });
    
    return {
      jobId,
      scraperType,
      scraperName: scraperSource?.name || scraperType,
    };
  }

  /**
   * Fetch all apartments from a scraper
   */
  async fetchAllFromScraper(
    scraperType: string,
    params: ScraperSearchParams,
    userId: string,
    userName: string
  ): Promise<ScraperJobResult> {
    ensureProcessorsInitialized();
    
    // Check if this scraper is already running
    if (this.jobQueue.isScraperRunning(scraperType)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Scraper ${scraperType} is already running. Please wait for it to complete.`,
      });
    }
    
    // Get scraper info
    const scraperSource = await this.db.scrapingSource.findFirst({
      where: { type: scraperType }
    });
    
    // Create a job for fetching all apartments
    const jobId = await this.jobQueue.add('scrape-apartment-list', {
      scraperType,
      scraperName: scraperSource?.name || scraperType,
      scraperUrl: scraperSource?.baseUrl || '',
      params: {
        ...params,
        fetchAll: true,
      },
      userId,
      userName,
      timestamp: new Date(),
      action: 'fetch-all',
      expectedLimit: 500, // Estimate for fetch-all
    });
    
    return {
      jobId,
      scraperType,
      scraperName: scraperSource?.name || scraperType,
    };
  }

  /**
   * Test a scraper's detail page functionality
   */
  async testScraperDetail(
    scraperType: ScraperType,
    url: string
  ): Promise<ScraperTestResult> {
    console.log('[ScraperManagementService] testScraperDetail called with:', { scraperType, url });
    
    // Store original environment variables
    const originalDebugMode = process.env.SCRAPER_DEBUG;
    const originalTestMode = process.env.SCRAPER_TEST_MODE;
    
    try {
      // Clear the cache to ensure we get a fresh normal scraper instance
      console.log('[ScraperManagementService] Clearing scraper instances cache');
      UnifiedScraperFactory.clearInstances();
      
      // Enable debug mode and test mode for testing
      process.env.SCRAPER_DEBUG = 'true';
      process.env.SCRAPER_TEST_MODE = 'true';
      
      console.log('[ScraperManagementService] Creating scraper instance:', scraperType, 'mode: normal');
      const scraper = UnifiedScraperFactory.create(scraperType, undefined, 'normal');
      console.log('[ScraperManagementService] Scraper instance created:', scraper.constructor.name);
      
      // Check if scraper has getApartmentDetails method (only normal scrapers have it)
      if (typeof (scraper as any).getApartmentDetails !== 'function') {
        console.error('[ScraperManagementService] Scraper does not have getApartmentDetails method');
        return {
          success: false,
          error: 'This scraper does not support detail page scraping. Fast scrapers only support search.',
          scraperType,
          url,
          timestamp: new Date(),
        };
      }
      
      console.log('[ScraperManagementService] Calling getApartmentDetails for URL:', url);
      const result = await (scraper as any).getApartmentDetails(url);
      console.log('[ScraperManagementService] getApartmentDetails returned:', result ? 'success' : 'null');
      
      // Extract raw HTML and response metadata if available
      let rawHtml = null;
      let httpResponse = null;
      let isRemoved = false;
      let removalReason = null;
      let removalConfidence = null;
      
      if (result && typeof result === 'object') {
        rawHtml = result._rawHtml;
        httpResponse = result._httpResponse;
        isRemoved = result._isRemoved || false;
        removalReason = result._removalReason || null;
        removalConfidence = result._removalConfidence || null;
        
        // Clean up the internal fields
        delete result._rawHtml;
        delete result._httpResponse;
      }
      
      // Save the result to debug folder
      if (result) {
        await this.saveDebugData(scraperType, url, result, rawHtml, httpResponse, {
          isRemoved,
          removalReason,
          removalConfidence,
        });
      }
      
      return {
        success: true,
        data: result,
        scraperType,
        url,
        timestamp: new Date(),
        debugInfo: {
          jsonSaved: result ? `debug/scraper-tests/${scraperType}/` : null,
          htmlSaved: `debug/html-responses/${scraperType}/`,
          message: 'Debug files saved to the debug folder'
        }
      };
    } catch (error) {
      console.error('[ScraperManagementService] Detail page test failed:', {
        scraperType,
        url,
        error: error instanceof Error ? {
          message: error.message,
          name: error.name,
          stack: error.stack?.split('\n').slice(0, 5).join('\n')
        } : error
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        scraperType,
        url,
        timestamp: new Date(),
      };
    } finally {
      // Restore original environment variables
      if (originalDebugMode !== undefined) {
        process.env.SCRAPER_DEBUG = originalDebugMode;
      } else {
        delete process.env.SCRAPER_DEBUG;
      }
      if (originalTestMode !== undefined) {
        process.env.SCRAPER_TEST_MODE = originalTestMode;
      } else {
        delete process.env.SCRAPER_TEST_MODE;
      }
    }
  }

  /**
   * Test a scraper's search functionality
   */
  async testScraperSearch(
    scraperType: ScraperType,
    mode: 'fast' | 'normal',
    params: ScraperSearchParams
  ): Promise<ScraperTestResult> {
    const mutationId = `mutation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      const scraper = UnifiedScraperFactory.create(scraperType, undefined, mode);
      
      // Create logger for this test
      const logger = new ScraperLogger(`test-${mutationId}`, scraperType);
      
      // Logger is not part of the scraper interface anymore
      
      logger.info('Starting scraper search test', { 
        params,
        fetchAll: params.fetchAll || false,
        updatedWithin: params.updatedWithin || null
      });
      
      if (params.fetchAll) {
        logger.warn('FetchAll mode enabled - this may take a while and scrape many pages');
        if (params.updatedWithin) {
          logger.info(`FetchAll will be limited to listings updated within ${params.updatedWithin} days`);
        }
      }
      
      // Add a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          logger.error('Search timeout after 30 seconds');
          reject(new Error('Search timeout after 30 seconds'));
        }, 30000);
      });
      
      // Map ScraperSearchParams to ScrapeParams
      const scrapeParams = {
        priceRange: params.minPrice || params.maxPrice ? {
          min: params.minPrice || 0,
          max: params.maxPrice || 999999999
        } : undefined,
        sizeRange: params.minSize || params.maxSize ? {
          min: params.minSize || 0,
          max: params.maxSize || 999999
        } : undefined,
        page: params.page,
        // When fetchAll is true, don't set a limit (or set a very high one)
        limit: params.fetchAll ? undefined : params.limit,
        updatedWithin: params.updatedWithin
      };
      
      const result = await Promise.race([
        scraper.scrape(scrapeParams),
        timeoutPromise
      ]) as any;
      
      logger.info('Search completed', { 
        success: result.success, 
        apartmentsFound: result.data?.length || 0,
        duration: result.metadata?.duration
      });
      
      // Ensure all dates are serialized as ISO strings
      const serializeDates = (obj: any): any => {
        if (obj instanceof Date) {
          return obj.toISOString();
        }
        if (Array.isArray(obj)) {
          return obj.map(serializeDates);
        }
        if (obj !== null && typeof obj === 'object') {
          const newObj: any = {};
          for (const key in obj) {
            newObj[key] = serializeDates(obj[key]);
          }
          return newObj;
        }
        return obj;
      };
      
      return {
        success: result.success,
        data: result.data ? serializeDates(result.data) : undefined,
        scraperType,
        params,
        timestamp: new Date(),
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        scraperType,
        params,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get apartments needing details for each scraper
   */
  async getApartmentsNeedingDetailsCounts(): Promise<Record<string, number>> {
    const scraperTypes = UnifiedScraperFactory.getRegisteredTypes();
    const counts: Record<string, number> = {};
    
    for (const scraperType of scraperTypes) {
      const count = await this.db.apartment.count({
        where: {
          scrapingSource: {
            type: scraperType,
          },
          fetchedDetails: false,
        },
      });
      counts[scraperType] = count;
    }
    
    return counts;
  }

  /**
   * Get apartments that need detail fetching
   */
  async getApartmentsNeedingDetails(scraperType?: ScraperType, limit?: number) {
    const where: Prisma.ApartmentWhereInput = {
      fetchedDetails: false,
    };
    
    if (scraperType) {
      where.scrapingSource = {
        type: scraperType,
      };
    }
    
    const apartments = await this.db.apartment.findMany({
      where,
      take: limit,
      select: {
        id: true,
        externalId: true,
        sourceUrl: true,
        sourceSite: true,
        title: true,
        price: true,
        area: true,
        ward: true,
        scrapedAt: true,
        latitude: true,
        longitude: true,
        fetchedDetails: true,
      },
      orderBy: {
        scrapedAt: 'desc', // Newest first
      },
    });
    
    // Get total count of apartments needing details
    const totalNeedingDetails = await this.db.apartment.count({
      where,
    });
    
    return {
      apartments,
      totalNeedingDetails,
      requestedLimit: limit,
    };
  }

  /**
   * Update apartments by URLs
   */
  async updateApartmentsByUrls(
    urls: string[],
    scraperType: string | undefined,
    userId: string,
    userName: string
  ): Promise<{ jobs: ScraperJobResult[]; message: string }> {
    ensureProcessorsInitialized();
    
    // Group URLs by scraper type
    const urlsByScraperType = new Map<string, string[]>();
    
    for (const url of urls) {
      // Determine scraper type from URL if not provided
      let detectedScraperType = scraperType;
      
      if (!detectedScraperType) {
        // Auto-detect scraper type from URL
        if (url.includes('realestate.co.jp')) {
          detectedScraperType = 'realestate.co.jp';
        } else if (url.includes('yolo-japan.com')) {
          detectedScraperType = 'yolo-japan';
        } else if (url.includes('wagaya-japan.com')) {
          detectedScraperType = 'wagaya-japan';
        } else if (url.includes('ehousing.co.jp')) {
          detectedScraperType = 'e-housing';
        } else if (url.includes('metroresidences.com')) {
          detectedScraperType = 'metro-residences';
        }
      }
      
      if (!detectedScraperType) {
        continue; // Skip URLs we can't identify
      }
      
      const existingUrls = urlsByScraperType.get(detectedScraperType) || [];
      existingUrls.push(url);
      urlsByScraperType.set(detectedScraperType, existingUrls);
    }
    
    if (urlsByScraperType.size === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No valid URLs found or unable to determine scraper type",
      });
    }
    
    // Create jobs for each scraper type
    const jobs: ScraperJobResult[] = [];
    
    for (const [detectedScraperType, scraperUrls] of urlsByScraperType) {
      // Check if this scraper is already running
      if (this.jobQueue.isScraperRunning(detectedScraperType)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Scraper ${detectedScraperType} is already running. Please wait for it to complete.`,
        });
      }
      
      // Get scraper info
      const scraperSource = await this.db.scrapingSource.findFirst({
        where: { type: detectedScraperType }
      });
      
      // Create a job for updating apartments
      const jobId = await this.jobQueue.add('update-apartments-by-urls', {
        scraperType: detectedScraperType,
        scraperName: scraperSource?.name || detectedScraperType,
        scraperUrl: scraperSource?.baseUrl || '',
        urls: scraperUrls,
        userId,
        userName,
        timestamp: new Date(),
        action: 'update-by-urls',
        expectedLimit: scraperUrls.length,
      });
      
      jobs.push({
        jobId,
        scraperType: detectedScraperType,
        scraperName: scraperSource?.name || detectedScraperType,
        urlCount: scraperUrls.length,
      });
    }
    
    return {
      jobs,
      message: `Created ${jobs.length} job(s) to update ${urls.length} apartments`,
    };
  }

  /**
   * Get scraper logs
   */
  getScraperLogs(options: {
    jobId?: string;
    scraperType?: string;
    level?: 'info' | 'warn' | 'error' | 'debug';
    since?: Date;
    limit?: number;
  }) {
    return ScraperLogger.getGlobalLogs(options);
  }

  /**
   * Get scraper log statistics
   */
  getScraperLogStats() {
    return ScraperLogger.getLogStats();
  }

  /**
   * Clear scraper logs
   */
  clearScraperLogs() {
    ScraperLogger.clearGlobalLogs();
    return { success: true, message: "Scraper logs cleared" };
  }

  /**
   * Save debug data for scraper tests
   */
  private async saveDebugData(
    scraperType: string,
    url: string,
    result: any,
    rawHtml: string | null,
    httpResponse: any,
    removalInfo: { isRemoved: boolean; removalReason: string | null; removalConfidence: number | null }
  ) {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Create debug folder structure
    const debugDir = path.join(process.cwd(), 'debug', 'scraper-tests', scraperType);
    await fs.mkdir(debugDir, { recursive: true });
    
    // Create filename with timestamp and sanitized URL
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlPart = url
      .replace(/^https?:\/\//, '')
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50); // Limit filename length
    
    const filename = `${timestamp}_${urlPart}.json`;
    const filepath = path.join(debugDir, filename);
    
    // Save the scraped data JSON
    const debugData = {
      timestamp: new Date().toISOString(),
      scraperType,
      url,
      result,
      httpResponse: httpResponse || {},
      listingStatus: {
        isRemoved: removalInfo.isRemoved,
        removalInfo: removalInfo.isRemoved ? {
          reason: removalInfo.removalReason,
          confidence: removalInfo.removalConfidence
        } : null
      }
    };
    
    await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
    
    // Save HTML file separately if available
    if (rawHtml) {
      const htmlFilename = `${timestamp}_${urlPart}.html`;
      const htmlFilepath = path.join(debugDir, htmlFilename);
      await fs.writeFile(htmlFilepath, rawHtml, 'utf-8');
    }
  }
}