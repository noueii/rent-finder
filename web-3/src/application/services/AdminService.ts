import { type PrismaClient, type User, UserRole } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { type Station } from "~/types/station";

interface DashboardStats {
  users: {
    total: number;
    growth: string;
  };
  apartments: {
    total: number;
    recentlyScraped: number;
    growth: string;
  };
  lists: {
    active: number;
    growth: string;
  };
  searches: {
    last24h: number;
    growth: string;
  };
  scraping: {
    activeSources: number;
    jobs: {
      total: number;
      pending: number;
      processing: number;
      completed: number;
      failed: number;
    };
  };
  popularStations: Array<{
    station: Station | undefined;
    apartmentCount: number;
  }>;
}

interface SystemHealthCheck {
  status: 'healthy' | 'degraded';
  checks: {
    database: boolean;
    jobQueue: boolean;
    scrapers: boolean;
    cache: boolean;
  };
  timestamp: Date;
}

interface DataOverview {
  bySource: Array<{
    sourceSite: string;
    _count: { id: number };
  }>;
  byAvailability: Array<{
    availability: string;
    _count: { id: number };
  }>;
  issues: {
    missingCoordinates: number;
    duplicates: number;
    orphanedImages: number;
  };
}

export class AdminService {
  constructor(private db: PrismaClient) {}

  /**
   * Check if a user has admin privileges
   */
  async checkAdminAccess(userId: string): Promise<boolean> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    return user?.role === 'ADMIN';
  }

  /**
   * Ensure user has admin access, throw if not
   */
  async ensureAdminAccess(userId: string): Promise<void> {
    const isAdmin = await this.checkAdminAccess(userId);
    
    if (!isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin access required",
      });
    }
  }

  /**
   * Get comprehensive dashboard statistics
   */
  async getDashboardStats(jobQueueStats: any): Promise<DashboardStats> {
    const [
      userCount,
      apartmentCount,
      activeListCount,
      searchSessionCount,
      scrapingSourceCount,
      recentApartments,
      popularStations,
    ] = await Promise.all([
      this.db.user.count(),
      this.db.apartment.count(),
      this.db.list.count({ where: { type: { not: 'HIDDEN' } } }),
      this.db.searchSession.count({ 
        where: { 
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        } 
      }),
      this.db.scrapingSource.count({ where: { isActive: true } }),
      this.db.apartment.count({ 
        where: { 
          scrapedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
        } 
      }),
      this.db.apartmentStation.groupBy({
        by: ['stationId'],
        _count: { stationId: true },
        orderBy: { _count: { stationId: 'desc' } },
        take: 5,
      }),
    ]);

    // Get station details for popular stations
    const stationIds = popularStations.map(s => s.stationId);
    const stations = await this.db.station.findMany({
      where: { id: { in: stationIds } },
      include: { lines: { include: { line: true } } },
    });

    const stationMap = new Map(stations.map(s => [s.id, s]));
    const popularStationsWithDetails = popularStations.map(ps => ({
      station: stationMap.get(ps.stationId),
      apartmentCount: ps._count.stationId,
    }));

    return {
      users: {
        total: userCount,
        growth: '+12%', // TODO: Implement actual growth calculation
      },
      apartments: {
        total: apartmentCount,
        recentlyScraped: recentApartments,
        growth: '+8%', // TODO: Implement actual growth calculation
      },
      lists: {
        active: activeListCount,
        growth: '+15%', // TODO: Implement actual growth calculation
      },
      searches: {
        last24h: searchSessionCount,
        growth: '+20%', // TODO: Implement actual growth calculation
      },
      scraping: {
        activeSources: scrapingSourceCount,
        jobs: jobQueueStats,
      },
      popularStations: popularStationsWithDetails,
    };
  }

  /**
   * Check system health status
   */
  async checkSystemHealth(
    checkDatabase: () => Promise<boolean>,
    checkJobQueue: () => Promise<boolean>,
    checkScrapers: () => Promise<boolean>,
    checkCache: () => Promise<boolean>
  ): Promise<SystemHealthCheck> {
    const checks = {
      database: false,
      jobQueue: false,
      scrapers: false,
      cache: false,
    };

    // Run all health checks in parallel
    const [dbHealth, jobHealth, scraperHealth, cacheHealth] = await Promise.allSettled([
      checkDatabase(),
      checkJobQueue(),
      checkScrapers(),
      checkCache(),
    ]);

    checks.database = dbHealth.status === 'fulfilled' && dbHealth.value;
    checks.jobQueue = jobHealth.status === 'fulfilled' && jobHealth.value;
    checks.scrapers = scraperHealth.status === 'fulfilled' && scraperHealth.value;
    checks.cache = cacheHealth.status === 'fulfilled' && cacheHealth.value;

    const allHealthy = Object.values(checks).every(v => v);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      timestamp: new Date(),
    };
  }

  /**
   * Get data overview with apartment statistics
   */
  async getDataOverview(): Promise<DataOverview> {
    const [
      apartmentsBySource,
      apartmentsByAvailability,
      apartmentsWithoutCoordinates,
      duplicateApartments,
      orphanedImages,
    ] = await Promise.all([
      this.db.apartment.groupBy({
        by: ['sourceSite'],
        _count: { id: true },
      }),
      this.db.apartment.groupBy({
        by: ['availability'],
        _count: { id: true },
      }),
      this.db.apartment.count({
        where: { OR: [{ latitude: null }, { longitude: null }] },
      }),
      this.db.$queryRaw<Array<{ count: bigint }>>/*sql*/`
        SELECT COUNT(*) as count
        FROM (
          SELECT "externalId", "sourceSite", COUNT(*) as cnt
          FROM "Apartment"
          GROUP BY "externalId", "sourceSite"
          HAVING COUNT(*) > 1
        ) as duplicates
      `,
      // Count of orphaned images (apartmentId is required, so this will always be 0)
      Promise.resolve(0),
    ]);

    return {
      bySource: apartmentsBySource,
      byAvailability: apartmentsByAvailability,
      issues: {
        missingCoordinates: apartmentsWithoutCoordinates,
        duplicates: Number(duplicateApartments[0]?.count || 0),
        orphanedImages,
      },
    };
  }

  /**
   * Get scraping history statistics
   */
  async getScrapingHistory(scraperType?: string, days: number = 7) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const dailyCounts = await this.db.$queryRaw<Array<{
      date: Date;
      source: string;
      count: bigint;
    }>>/*sql*/`
      SELECT 
        DATE(a."scrapedAt") as date,
        s."type" as source,
        COUNT(*) as count
      FROM "Apartment" a
      LEFT JOIN "ScrapingSource" s ON a."scrapingSourceId" = s."id"
      WHERE a."scrapedAt" >= ${since}
      ${scraperType ? /*sql*/`AND s."type" = ${scraperType}` : /*sql*/``}
      GROUP BY DATE(a."scrapedAt"), s."type"
      ORDER BY date DESC, source
    `;

    return dailyCounts.map(row => ({
      date: row.date,
      source: row.source,
      count: Number(row.count),
    }));
  }

  /**
   * Get apartment removal statistics
   */
  async getRemovalStatistics() {
    const [neverChecked, needsCheck, recentlyChecked] = await Promise.all([
      this.db.apartment.count({
        where: {
          removed: false,
          lastDetailCheck: null,
        },
      }),
      this.db.apartment.count({
        where: {
          removed: false,
          lastDetailCheck: {
            lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          },
        },
      }),
      this.db.apartment.count({
        where: {
          removed: false,
          lastDetailCheck: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          },
        },
      }),
    ]);

    return {
      checkStatus: {
        neverChecked,
        needsCheck,
        recentlyChecked,
      },
    };
  }
}