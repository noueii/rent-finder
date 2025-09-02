import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

// Database utility functions
export const dbUtils = {
  // Find stations by name (fuzzy search)
  findStations: async (query: string) => {
    const lowerQuery = query.toLowerCase();
    return await db.station.findMany({
      where: {
        OR: [
          { name: { contains: lowerQuery, mode: 'insensitive' } },
          { nameJa: { contains: query } }
        ]
      },
      orderBy: { name: 'asc' }
    });
  },

  // Get all stations within commute range (to be used with transit API)
  getStationsByIds: async (stationIds: string[]) => {
    return await db.station.findMany({
      where: { id: { in: stationIds } },
      include: { _count: { select: { apartments: true } } }
    });
  },

  // Search apartments with filters
  searchApartments: async (params: {
    stationIds: string[];
    maxPrice?: number;
    minSize?: number;
    layouts?: string[];
    features?: string[];
    limit?: number;
    offset?: number;
  }) => {
    const {
      stationIds,
      maxPrice,
      minSize,
      layouts,
      features,
      limit = 20,
      offset = 0
    } = params;

    const where: any = {
      stationId: { in: stationIds },
      isAvailable: true
    };

    if (maxPrice) {
      where.rentMonthly = { lte: maxPrice };
    }

    if (minSize) {
      where.size = { gte: minSize };
    }

    if (layouts?.length) {
      where.layout = { in: layouts };
    }

    if (features?.length) {
      // For SQLite, we need to search JSON strings
      where.features = { contains: JSON.stringify(features) };
    }

    const [apartments, total] = await Promise.all([
      db.apartment.findMany({
        where,
        include: {
          station: {
            select: { id: true, name: true, nameJa: true, lines: true }
          }
        },
        orderBy: { rentMonthly: 'asc' },
        skip: offset,
        take: limit
      }),
      db.apartment.count({ where })
    ]);

    return { apartments, total };
  },

  // Get apartment statistics for a station
  getStationStats: async (stationId: string) => {
    const stats = await db.apartment.aggregate({
      where: { stationId, isAvailable: true },
      _count: true,
      _avg: { rentMonthly: true, size: true },
      _min: { rentMonthly: true },
      _max: { rentMonthly: true }
    });

    return stats;
  },

  // Record a search for analytics
  recordSearch: async (searchData: {
    targetStationId: string;
    targetStationName: string;
    maxCommuteMinutes: number;
    filters?: any;
    stationsSearched: number;
    totalResults: number;
    resultsReturned: number;
    searchDurationMs?: number;
    sessionId?: string;
  }) => {
    return await db.search.create({
      data: searchData
    });
  },

  // Get search analytics (for admin dashboard)
  getSearchAnalytics: async (days: number = 30) => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    return await db.search.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
  },

  // Health check
  healthCheck: async () => {
    try {
      await db.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error, timestamp: new Date().toISOString() };
    }
  }
};