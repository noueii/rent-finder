/**
 * Common test fixtures
 */

import { PrismaClient } from '@prisma/client';
import { factories } from './factories';
import type { UserId, ApartmentId, StationId } from '../types';

/**
 * Base fixture data
 */
export const fixtures = {
  /**
   * Common user fixtures
   */
  users: {
    testUser: {
      id: 'user_test_001' as UserId,
      email: 'test@example.com',
      name: 'Test User',
      password: 'hashedPassword123',
    },
    adminUser: {
      id: 'user_admin_001' as UserId,
      email: 'admin@example.com',
      name: 'Admin User',
      password: 'hashedAdminPassword123',
    },
  },

  /**
   * Common station fixtures
   */
  stations: {
    shibuya: {
      id: 'station_shibuya' as StationId,
      name: '渋谷',
      nameEn: 'Shibuya',
      lines: ['JR Yamanote Line', 'Tokyo Metro Ginza Line'],
      latitude: 35.6580,
      longitude: 139.7016,
    },
    shinjuku: {
      id: 'station_shinjuku' as StationId,
      name: '新宿',
      nameEn: 'Shinjuku',
      lines: ['JR Yamanote Line', 'JR Chuo Line'],
      latitude: 35.6896,
      longitude: 139.7006,
    },
    tokyo: {
      id: 'station_tokyo' as StationId,
      name: '東京',
      nameEn: 'Tokyo',
      lines: ['JR Yamanote Line', 'JR Tokaido Shinkansen'],
      latitude: 35.6812,
      longitude: 139.7671,
    },
  },

  /**
   * Common apartment fixtures
   */
  apartments: {
    studioNearShibuya: {
      id: 'apt_001' as ApartmentId,
      title: 'Modern Studio near Shibuya',
      rent: 120000,
      size: 25.5,
      layout: '1K',
      address: '渋谷区道玄坂1-2-3',
      nearestStationId: 'station_shibuya' as StationId,
      walkingMinutes: 5,
      imageUrl: 'https://example.com/apt1.jpg',
    },
    oneBedNearShinjuku: {
      id: 'apt_002' as ApartmentId,
      title: 'Spacious 1LDK in Shinjuku',
      rent: 180000,
      size: 45.0,
      layout: '1LDK',
      address: '新宿区西新宿2-3-4',
      nearestStationId: 'station_shinjuku' as StationId,
      walkingMinutes: 8,
      imageUrl: 'https://example.com/apt2.jpg',
    },
  },

  /**
   * Common search criteria
   */
  searchCriteria: {
    basic: {
      workplaceStationId: 'station_shibuya' as StationId,
      maxCommuteTime: 30,
    },
    withFilters: {
      workplaceStationId: 'station_shinjuku' as StationId,
      maxCommuteTime: 45,
      maxRent: 150000,
      minSize: 30,
      layout: ['1LDK', '2K'],
    },
  },

  /**
   * Common dates
   */
  dates: {
    past: new Date('2024-01-01'),
    recent: new Date('2025-01-01'),
    future: new Date('2025-06-01'),
  },
};

/**
 * Seed database with fixtures
 */
export async function seedFixtures(
  prisma: PrismaClient,
  options: {
    users?: boolean;
    stations?: boolean;
    apartments?: boolean;
  } = {}
): Promise<void> {
  const { users = true, stations = true, apartments = true } = options;

  // Seed users
  if (users) {
    await prisma.user.createMany({
      data: Object.values(fixtures.users),
      skipDuplicates: true,
    });
  }

  // Seed stations
  if (stations) {
    await prisma.station.createMany({
      data: Object.values(fixtures.stations),
      skipDuplicates: true,
    });
  }

  // Seed apartments
  if (apartments && stations) {
    for (const apartment of Object.values(fixtures.apartments)) {
      const { nearestStationId, walkingMinutes, imageUrl, rent, ...apartmentData } = apartment;
      
      const created = await prisma.apartment.create({
        data: {
          ...apartmentData,
          price: rent, // Map rent to price
          externalId: apartment.id,
          sourceUrl: `https://example.com/apartments/${apartment.id}`,
          sourceSite: 'test',
          availability: 'available',
          scrapedAt: new Date(),
          // Add images through relation
          images: imageUrl ? {
            create: {
              url: imageUrl,
              order: 0,
            }
          } : undefined,
          // Add station through relation
          nearestStations: nearestStationId ? {
            create: {
              stationId: nearestStationId,
              walkingMinutes: walkingMinutes || 5,
            }
          } : undefined,
        },
      });
    }
  }
}

/**
 * Create dynamic fixtures
 */
export const dynamicFixtures = {
  /**
   * Create apartments with specific criteria
   */
  createApartmentsNearStation: async (
    prisma: PrismaClient,
    stationId: StationId,
    count: number,
    options: {
      rentRange?: [number, number];
      sizeRange?: [number, number];
      layouts?: string[];
      walkingMinutesRange?: [number, number];
    } = {}
  ) => {
    const {
      rentRange = [50000, 300000],
      sizeRange = [20, 80],
      layouts = ['1K', '1DK', '1LDK', '2K', '2DK', '2LDK'],
      walkingMinutesRange = [1, 20],
    } = options;

    const apartments = factories.apartment.buildMany(count, {
      nearestStationId: stationId,
    });

    // Customize each apartment
    const customizedApartments = apartments.map(apt => {
      const { rent, nearestStationId, walkingMinutes, imageUrl, ...apartmentData } = apt;
      return {
        ...apartmentData,
        price: Math.floor(
          Math.random() * (rentRange[1] - rentRange[0]) + rentRange[0]
        ),
        size: Math.round(
          (Math.random() * (sizeRange[1] - sizeRange[0]) + sizeRange[0]) * 10
        ) / 10,
        layout: layouts[Math.floor(Math.random() * layouts.length)],
        externalId: apt.id,
        sourceUrl: `https://example.com/apartments/${apt.id}`,
        sourceSite: 'test',
        availability: 'available',
        scrapedAt: new Date(),
      };
    });

    return prisma.apartment.createMany({
      data: customizedApartments,
    });
  },

  /**
   * Create a user with saved searches
   */
  createUserWithSearches: async (
    prisma: PrismaClient,
    userData?: Partial<typeof fixtures.users.testUser>,
    searchCount = 3
  ) => {
    const user = await prisma.user.create({
      data: {
        ...fixtures.users.testUser,
        ...userData,
      },
    });

    const searches = factories.searchCriteria.buildMany(searchCount);
    
    for (const search of searches) {
      await prisma.searchSession.create({
        data: {
          userId: user.id,
          filters: search as any, // JSON field
          resultCount: Math.floor(Math.random() * 50),
        },
      });
    }

    return user;
  },

  /**
   * Create a complete test scenario
   */
  createTestScenario: async (
    prisma: PrismaClient,
    options: {
      userCount?: number;
      stationCount?: number;
      apartmentsPerStation?: number;
    } = {}
  ) => {
    const {
      userCount = 3,
      stationCount = 5,
      apartmentsPerStation = 10,
    } = options;

    // Create users
    const users = await Promise.all(
      Array.from({ length: userCount }, () =>
        prisma.user.create({
          data: factories.user.build(),
        })
      )
    );

    // Create stations
    const stations = await Promise.all(
      Array.from({ length: stationCount }, () => {
        const { lines, ...stationData } = factories.station.build();
        return prisma.station.create({
          data: stationData,
        });
      })
    );

    // Create apartments for each station
    for (const station of stations) {
      await dynamicFixtures.createApartmentsNearStation(
        prisma,
        station.id as StationId,
        apartmentsPerStation
      );
    }

    return { users, stations };
  },
};

/**
 * Clean up fixtures
 */
export async function cleanupFixtures(prisma: PrismaClient): Promise<void> {
  // Delete in reverse order of dependencies
  await prisma.searchSession.deleteMany();
  await prisma.apartment.deleteMany();
  await prisma.station.deleteMany();
  await prisma.user.deleteMany();
}

/**
 * Test data builders
 */
export const testDataBuilders = {
  /**
   * Build a valid search request
   */
  buildSearchRequest: (overrides?: any) => ({
    workplaceStationId: fixtures.stations.shibuya.id,
    maxCommuteTime: 30,
    filters: {
      maxRent: 150000,
      minSize: 25,
      layout: ['1K', '1LDK'],
      ...overrides?.filters,
    },
    ...overrides,
  }),

  /**
   * Build a valid apartment listing
   */
  buildApartmentListing: (overrides?: any) => ({
    ...fixtures.apartments.studioNearShibuya,
    features: ['Auto-lock', 'Balcony', 'Bath/Toilet Separate'],
    deposit: 1,
    keyMoney: 1,
    managementFee: 5000,
    ...overrides,
  }),

  /**
   * Build API test headers
   */
  buildTestHeaders: (auth = true) => ({
    'Content-Type': 'application/json',
    ...(auth && { Authorization: 'Bearer test-token' }),
  }),
};

/**
 * Export all test data
 */
export const testData = {
  fixtures,
  factories,
  seedFixtures,
  dynamicFixtures,
  cleanupFixtures,
  testDataBuilders,
} as const;