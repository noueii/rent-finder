import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import robotsParser from 'robots-parser';
import { RateLimiter } from 'limiter';
import { JSDOM } from 'jsdom';
import fetch, { Response } from 'node-fetch';
import { transitService } from './transit-service';

// ==================== Types & Schemas ====================

export const ScrapedApartmentSchema = z.object({
  sourceUrl: z.string().url(),
  sourceSite: z.string(),
  sourceListingId: z.string().optional(),
  title: z.string(),
  buildingName: z.string(),
  unitNumber: z.string().optional(),
  rentMonthly: z.number().int().positive(),
  managementFee: z.number().int().optional(),
  keyMoney: z.number().optional(),
  deposit: z.number().optional(),
  size: z.number().positive(),
  sizeJo: z.number().optional(),
  layout: z.string(),
  layoutDetails: z.string().optional(),
  prefecture: z.string(),
  city: z.string(),
  ward: z.string().optional(),
  address: z.string(),
  addressDetails: z.string().optional(),
  buildingType: z.string().optional(),
  buildingAge: z.number().int().optional(),
  buildYear: z.number().int().optional(),
  totalFloors: z.number().int().optional(),
  floor: z.string().optional(),
  features: z.array(z.string()).optional(),
  nearbyFacilities: z.array(z.string()).optional(),
  imageUrls: z.array(z.string().url()).optional(),
  floorPlanUrl: z.string().url().optional(),
  stationName: z.string(),
  walkingMinutes: z.number().int().positive(),
  availableFrom: z.date().optional(),
  isAvailable: z.boolean().default(true),
});

export type ScrapedApartment = z.infer<typeof ScrapedApartmentSchema>;

export interface ScrapingResult {
  success: boolean;
  itemsScraped: number;
  itemsNew: number;
  itemsUpdated: number;
  errors: string[];
  duration: number;
}

export interface ScrapingJob {
  id: string;
  sourceSite: string;
  targetUrl?: string;
  targetStation?: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  priority: number;
  startedAt?: Date;
  completedAt?: Date;
  result?: ScrapingResult;
}

// ==================== Core Scraping Service ====================

export class ScrapingService {
  private db: PrismaClient;
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private robotsCache: Map<string, any> = new Map();
  private userAgent = 'Tokyo-Rent-Finder/1.0 (Educational Project)';

  constructor(db: PrismaClient) {
    this.db = db;
  }

  // ==================== Rate Limiting & Robots.txt ====================

  private getRateLimiter(domain: string): RateLimiter {
    if (!this.rateLimiters.has(domain)) {
      // 1 request per second per domain
      this.rateLimiters.set(domain, new RateLimiter({ tokensPerInterval: 1, interval: 1000 }));
    }
    return this.rateLimiters.get(domain)!;
  }

  private async checkRobotsTxt(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      if (this.robotsCache.has(robotsUrl)) {
        const robots = this.robotsCache.get(robotsUrl);
        return robots.isAllowed(url, this.userAgent);
      }

      const response = await fetch(robotsUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000,
      });

      if (response.ok) {
        const robotsText = await response.text();
        const robots = robotsParser(robotsUrl, robotsText);
        this.robotsCache.set(robotsUrl, robots);
        return robots.isAllowed(url, this.userAgent);
      }

      // If robots.txt not found, assume allowed
      return true;
    } catch (error) {
      console.warn(`Failed to check robots.txt for ${url}:`, error);
      return true; // Assume allowed if can't check
    }
  }

  private async makeRequest(url: string, options: any = {}): Promise<Response> {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    const rateLimiter = this.getRateLimiter(domain);

    // Check robots.txt
    const isAllowed = await this.checkRobotsTxt(url);
    if (!isAllowed) {
      throw new Error(`Robots.txt disallows scraping ${url}`);
    }

    // Rate limiting
    await rateLimiter.removeTokens(1);

    // Make request with retries
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...options.headers,
          },
          timeout: 10000,
          ...options,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        if (attempt < 2) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    throw lastError;
  }

  // ==================== Station Matching ====================

  private async findStationId(stationName: string): Promise<string | null> {
    try {
      // Try exact match first
      const exactStation = await this.db.station.findFirst({
        where: {
          OR: [
            { name: stationName },
            { nameJa: stationName },
          ],
        },
      });

      if (exactStation) return exactStation.id;

      // Try fuzzy matching
      const stations = await this.db.station.findMany({
        where: {
          OR: [
            { name: { contains: stationName } },
            { nameJa: { contains: stationName } },
          ],
        },
        take: 5,
      });

      if (stations.length === 1) {
        return stations[0].id;
      }

      // If multiple matches, try to find the best one
      if (stations.length > 1) {
        const bestMatch = stations.find(s => 
          s.name.toLowerCase() === stationName.toLowerCase() ||
          s.nameJa === stationName
        );
        if (bestMatch) return bestMatch.id;
      }

      console.warn(`Could not find station ID for: ${stationName}`);
      return null;
    } catch (error) {
      console.error(`Error finding station ID for ${stationName}:`, error);
      return null;
    }
  }

  // ==================== Data Validation & Cleaning ====================

  private validateAndCleanData(data: any, sourceSite: string): ScrapedApartment | null {
    try {
      const validated = ScrapedApartmentSchema.parse({
        ...data,
        sourceSite,
      });

      // Additional cleaning
      validated.features = validated.features?.filter(f => f.trim().length > 0) || [];
      validated.nearbyFacilities = validated.nearbyFacilities?.filter(f => f.trim().length > 0) || [];
      validated.imageUrls = validated.imageUrls?.filter(url => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      }) || [];

      return validated;
    } catch (error) {
      console.error('Data validation failed:', error);
      return null;
    }
  }

  // ==================== Database Operations ====================

  private async saveApartment(apartment: ScrapedApartment): Promise<'new' | 'updated' | 'skipped'> {
    try {
      const stationId = await this.findStationId(apartment.stationName);
      if (!stationId) {
        console.warn(`Skipping apartment due to unknown station: ${apartment.stationName}`);
        return 'skipped';
      }

      // Check if apartment already exists
      const existing = await this.db.apartment.findUnique({
        where: { sourceUrl: apartment.sourceUrl },
      });

      const apartmentData = {
        sourceUrl: apartment.sourceUrl,
        sourceSite: apartment.sourceSite,
        sourceListingId: apartment.sourceListingId,
        title: apartment.title,
        buildingName: apartment.buildingName,
        unitNumber: apartment.unitNumber,
        rentMonthly: apartment.rentMonthly,
        managementFee: apartment.managementFee,
        keyMoney: apartment.keyMoney,
        deposit: apartment.deposit,
        size: apartment.size,
        sizeJo: apartment.sizeJo,
        layout: apartment.layout,
        layoutDetails: apartment.layoutDetails,
        prefecture: apartment.prefecture,
        city: apartment.city,
        ward: apartment.ward,
        address: apartment.address,
        addressDetails: apartment.addressDetails,
        buildingType: apartment.buildingType,
        buildingAge: apartment.buildingAge,
        buildYear: apartment.buildYear,
        totalFloors: apartment.totalFloors,
        floor: apartment.floor,
        features: apartment.features ? JSON.stringify(apartment.features) : null,
        nearbyFacilities: apartment.nearbyFacilities ? JSON.stringify(apartment.nearbyFacilities) : null,
        imageUrls: apartment.imageUrls ? JSON.stringify(apartment.imageUrls) : null,
        floorPlanUrl: apartment.floorPlanUrl,
        stationId,
        walkingMinutes: apartment.walkingMinutes,
        availableFrom: apartment.availableFrom,
        isAvailable: apartment.isAvailable,
        lastVerified: new Date(),
      };

      if (existing) {
        // Update existing apartment
        await this.db.apartment.update({
          where: { id: existing.id },
          data: apartmentData,
        });

        // Record price history if price changed
        if (existing.rentMonthly !== apartment.rentMonthly) {
          await this.db.priceHistory.create({
            data: {
              apartmentId: existing.id,
              rentMonthly: apartment.rentMonthly,
              managementFee: apartment.managementFee,
            },
          });
        }

        return 'updated';
      } else {
        // Create new apartment
        const newApartment = await this.db.apartment.create({
          data: apartmentData,
        });

        // Record initial price history
        await this.db.priceHistory.create({
          data: {
            apartmentId: newApartment.id,
            rentMonthly: apartment.rentMonthly,
            managementFee: apartment.managementFee,
          },
        });

        return 'new';
      }
    } catch (error) {
      console.error('Error saving apartment:', error);
      return 'skipped';
    }
  }

  // ==================== Job Management ====================

  async createScrapeJob(job: Omit<ScrapingJob, 'id' | 'status'>): Promise<string> {
    const scrapeJob = await this.db.scrapeJob.create({
      data: {
        sourceSite: job.sourceSite,
        targetUrl: job.targetUrl,
        targetStation: job.targetStation,
        priority: job.priority,
      },
    });

    return scrapeJob.id;
  }

  async getScrapeJobs(status?: string): Promise<ScrapingJob[]> {
    const jobs = await this.db.scrapeJob.findMany({
      where: status ? { status } : undefined,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return jobs.map(job => ({
      id: job.id,
      sourceSite: job.sourceSite,
      targetUrl: job.targetUrl || undefined,
      targetStation: job.targetStation || undefined,
      status: job.status as any,
      priority: job.priority,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
    }));
  }

  async updateScrapeJob(id: string, updates: Partial<ScrapingJob>): Promise<void> {
    await this.db.scrapeJob.update({
      where: { id },
      data: {
        status: updates.status,
        startedAt: updates.startedAt,
        completedAt: updates.completedAt,
        itemsScraped: updates.result?.itemsScraped,
        itemsNew: updates.result?.itemsNew,
        itemsUpdated: updates.result?.itemsUpdated,
        errors: updates.result?.errors ? JSON.stringify(updates.result.errors) : undefined,
      },
    });
  }

  // ==================== Site-Specific Scrapers ====================

  async scrapeAptsJp(targetUrl?: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsNew = 0;
    let itemsUpdated = 0;
    const errors: string[] = [];

    try {
      const { aptsJpScraper } = await import('./scrapers/apts-jp-scraper');
      
      // Determine URLs to scrape
      let urlsToScrape: string[] = [];
      if (targetUrl) {
        urlsToScrape = [targetUrl];
      } else {
        urlsToScrape = aptsJpScraper.generateSearchUrls();
      }

      console.log(`Scraping ${urlsToScrape.length} URLs from apts.jp...`);

      for (const url of urlsToScrape) {
        try {
          const response = await this.makeRequest(url);
          const html = await response.text();
          
          const apartments = aptsJpScraper.parseApartmentListing(html, url);
          itemsScraped += apartments.length;

          for (const apartment of apartments) {
            const validatedData = this.validateAndCleanData(apartment, 'apts.jp');
            if (validatedData) {
              const result = await this.saveApartment(validatedData);
              if (result === 'new') itemsNew++;
              else if (result === 'updated') itemsUpdated++;
            }
          }

          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          errors.push(`Failed to scrape ${url}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        itemsScraped,
        itemsNew,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(`apts.jp scraping failed: ${error.message}`);
      return {
        success: false,
        itemsScraped,
        itemsNew,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  async scrapeRealEstate(targetUrl?: string): Promise<ScrapingResult> {
    const startTime = Date.now();
    let itemsScraped = 0;
    let itemsNew = 0;
    let itemsUpdated = 0;
    const errors: string[] = [];

    try {
      const { realEstateScraper } = await import('./scrapers/realestate-scraper');
      
      // Determine URLs to scrape
      let urlsToScrape: string[] = [];
      if (targetUrl) {
        urlsToScrape = [targetUrl];
      } else {
        urlsToScrape = realEstateScraper.generateSearchUrls();
      }

      console.log(`Scraping ${urlsToScrape.length} URLs from realestate.co.jp...`);

      for (const url of urlsToScrape) {
        try {
          const response = await this.makeRequest(url);
          const html = await response.text();
          
          const apartments = realEstateScraper.parseApartmentListing(html, url);
          itemsScraped += apartments.length;

          for (const apartment of apartments) {
            const validatedData = this.validateAndCleanData(apartment, 'realestate.co.jp');
            if (validatedData) {
              const result = await this.saveApartment(validatedData);
              if (result === 'new') itemsNew++;
              else if (result === 'updated') itemsUpdated++;
            }
          }

          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          errors.push(`Failed to scrape ${url}: ${error.message}`);
        }
      }

      return {
        success: errors.length === 0,
        itemsScraped,
        itemsNew,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      errors.push(`Real estate scraping failed: ${error.message}`);
      return {
        success: false,
        itemsScraped,
        itemsNew,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  // ==================== Main Scraping Orchestrator ====================

  async runScrapeJob(jobId: string): Promise<ScrapingResult> {
    const job = await this.db.scrapeJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new Error(`Scrape job ${jobId} not found`);
    }

    if (job.status !== 'PENDING') {
      throw new Error(`Scrape job ${jobId} is not pending`);
    }

    await this.updateScrapeJob(jobId, {
      status: 'RUNNING',
      startedAt: new Date(),
    });

    try {
      let result: ScrapingResult;

      switch (job.sourceSite) {
        case 'apts.jp':
          result = await this.scrapeAptsJp(job.targetUrl || undefined);
          break;
        case 'realestate.co.jp':
          result = await this.scrapeRealEstate(job.targetUrl || undefined);
          break;
        default:
          throw new Error(`Unknown source site: ${job.sourceSite}`);
      }

      await this.updateScrapeJob(jobId, {
        status: result.success ? 'COMPLETED' : 'FAILED',
        completedAt: new Date(),
        result,
      });

      return result;
    } catch (error) {
      const result: ScrapingResult = {
        success: false,
        itemsScraped: 0,
        itemsNew: 0,
        itemsUpdated: 0,
        errors: [error.message],
        duration: Date.now() - Date.now(),
      };

      await this.updateScrapeJob(jobId, {
        status: 'FAILED',
        completedAt: new Date(),
        result,
      });

      throw error;
    }
  }

  // ==================== Utility Methods ====================

  async getScrapingStats(): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    pendingJobs: number;
    totalApartments: number;
    lastScrapeTime: Date | null;
  }> {
    const [
      totalJobs,
      completedJobs,
      failedJobs,
      pendingJobs,
      totalApartments,
      lastScrape,
    ] = await Promise.all([
      this.db.scrapeJob.count(),
      this.db.scrapeJob.count({ where: { status: 'COMPLETED' } }),
      this.db.scrapeJob.count({ where: { status: 'FAILED' } }),
      this.db.scrapeJob.count({ where: { status: 'PENDING' } }),
      this.db.apartment.count(),
      this.db.scrapeJob.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      }),
    ]);

    return {
      totalJobs,
      completedJobs,
      failedJobs,
      pendingJobs,
      totalApartments,
      lastScrapeTime: lastScrape?.completedAt || null,
    };
  }
}

// Export singleton instance
export const scrapingService = new ScrapingService(new PrismaClient());