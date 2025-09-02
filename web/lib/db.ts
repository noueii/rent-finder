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
    return await db.station.findMany({
      where: {
        OR: [
          { name: { contains: query } },
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
      data: {
        ...searchData,
        filters: searchData.filters ? JSON.stringify(searchData.filters) : null
      }
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
  },

  // Additional utility functions for the rent finder

  // Get station by ID with full details
  getStationById: async (stationId: string) => {
    const station = await db.station.findUnique({
      where: { id: stationId },
      include: {
        _count: { select: { apartments: true } }
      }
    });
    
    if (station) {
      return {
        ...station,
        lines: JSON.parse(station.lines),
        transfers: JSON.parse(station.transfers || '[]')
      };
    }
    return null;
  },

  // Get all stations with apartment counts
  getAllStationsWithCounts: async () => {
    const stations = await db.station.findMany({
      include: {
        _count: { select: { apartments: true } }
      },
      orderBy: { name: 'asc' }
    });
    
    return stations.map(station => ({
      ...station,
      lines: JSON.parse(station.lines),
      transfers: JSON.parse(station.transfers || '[]')
    }));
  },

  // Get apartments by station with all details
  getApartmentsByStation: async (stationId: string, limit = 50) => {
    const apartments = await db.apartment.findMany({
      where: { stationId, isAvailable: true },
      include: {
        station: {
          select: { id: true, name: true, nameJa: true }
        }
      },
      orderBy: { rentMonthly: 'asc' },
      take: limit
    });
    
    return apartments.map(apartment => ({
      ...apartment,
      features: apartment.features ? JSON.parse(apartment.features) : [],
      nearbyFacilities: apartment.nearbyFacilities ? JSON.parse(apartment.nearbyFacilities) : [],
      imageUrls: apartment.imageUrls ? JSON.parse(apartment.imageUrls) : [],
      additionalStations: apartment.additionalStations ? JSON.parse(apartment.additionalStations) : []
    }));
  },

  // Create or update apartment listing
  upsertApartment: async (apartmentData: {
    sourceUrl: string;
    sourceSite: string;
    sourceListingId?: string;
    title: string;
    buildingName: string;
    unitNumber?: string;
    rentMonthly: number;
    managementFee?: number;
    keyMoney?: number;
    deposit?: number;
    size: number;
    sizeJo?: number;
    layout: string;
    layoutDetails?: any;
    prefecture: string;
    city: string;
    ward?: string;
    address: string;
    addressDetails?: any;
    buildingType?: string;
    buildingAge?: number;
    buildYear?: number;
    totalFloors?: number;
    floor?: string;
    features?: string[];
    nearbyFacilities?: string[];
    imageUrls?: string[];
    floorPlanUrl?: string;
    stationId: string;
    walkingMinutes: number;
    additionalStations?: any[];
    availableFrom?: Date;
    isAvailable?: boolean;
  }) => {
    const processedData = {
      ...apartmentData,
      layoutDetails: apartmentData.layoutDetails ? JSON.stringify(apartmentData.layoutDetails) : null,
      addressDetails: apartmentData.addressDetails ? JSON.stringify(apartmentData.addressDetails) : null,
      features: apartmentData.features ? JSON.stringify(apartmentData.features) : null,
      nearbyFacilities: apartmentData.nearbyFacilities ? JSON.stringify(apartmentData.nearbyFacilities) : null,
      imageUrls: apartmentData.imageUrls ? JSON.stringify(apartmentData.imageUrls) : null,
      additionalStations: apartmentData.additionalStations ? JSON.stringify(apartmentData.additionalStations) : null,
      isAvailable: apartmentData.isAvailable ?? true
    };

    return await db.apartment.upsert({
      where: { sourceUrl: apartmentData.sourceUrl },
      create: processedData,
      update: processedData
    });
  },

  // Mark apartment as unavailable
  markApartmentUnavailable: async (apartmentId: string) => {
    return await db.apartment.update({
      where: { id: apartmentId },
      data: { isAvailable: false, lastVerified: new Date() }
    });
  },

  // Get apartments that need verification (old lastVerified date)
  getApartmentsNeedingVerification: async (daysSinceVerification = 7) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysSinceVerification);
    
    return await db.apartment.findMany({
      where: {
        AND: [
          { isAvailable: true },
          { lastVerified: { lt: cutoffDate } }
        ]
      },
      select: {
        id: true,
        sourceUrl: true,
        sourceSite: true,
        title: true,
        lastVerified: true,
        station: {
          select: { name: true, nameJa: true }
        }
      },
      orderBy: { lastVerified: 'asc' },
      take: 100
    });
  },

  // Get summary statistics for dashboard
  getDashboardStats: async () => {
    const [
      totalStations,
      totalApartments,
      availableApartments,
      totalSearches,
      recentSearches,
      priceStats
    ] = await Promise.all([
      db.station.count(),
      db.apartment.count(),
      db.apartment.count({ where: { isAvailable: true } }),
      db.search.count(),
      db.search.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }),
      db.apartment.aggregate({
        where: { isAvailable: true },
        _avg: { rentMonthly: true },
        _min: { rentMonthly: true },
        _max: { rentMonthly: true }
      })
    ]);

    return {
      totalStations,
      totalApartments,
      availableApartments,
      totalSearches,
      recentSearches,
      averageRent: priceStats._avg.rentMonthly,
      minRent: priceStats._min.rentMonthly,
      maxRent: priceStats._max.rentMonthly
    };
  },

  // Cleanup old searches (for maintenance)
  cleanupOldSearches: async (daysToKeep = 30) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db.search.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });
    
    return result.count;
  }
};