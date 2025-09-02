import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  createTestPrismaClient,
  clearDatabase,
  createTestTRPCClient,
  factories,
  seedDatabase,
} from '../index';
import type { PrismaClient } from '@prisma/client';

// Setup test environment
setupTestEnvironment();

describe('API Integration Tests', () => {
  let prisma: PrismaClient;
  let trpc: ReturnType<typeof createTestTRPCClient>;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    trpc = createTestTRPCClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  describe('Apartment Search API', () => {
    it('should search apartments by commute time', async () => {
      // Seed test data
      const { stations, apartments } = await seedDatabase(prisma);
      const workStation = stations[0];

      // Search apartments within 30 minutes
      const results = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 30,
        filters: {
          maxRent: 150000,
          minSize: 20,
        },
      });

      expect(results).toBeDefined();
      expect(results.apartments).toBeInstanceOf(Array);
      expect(results.totalCount).toBeGreaterThan(0);
      expect(results.searchId).toBeDefined();
    });

    it('should get apartment details with nearby stations', async () => {
      // Create apartment with nearby stations
      const apartment = await prisma.apartment.create({
        data: {
          ...factories.apartment(),
          nearbyStations: {
            create: [{
              station: {
                create: factories.station({ name: 'Test Station' }),
              },
              walkingTime: 10,
              distance: 800,
            }],
          },
        },
        include: {
          nearbyStations: {
            include: { station: true },
          },
        },
      });

      // Get apartment details
      const details = await trpc.apartments.getById.query({
        id: apartment.id,
      });

      expect(details).toBeDefined();
      expect(details.id).toBe(apartment.id);
      expect(details.nearbyStations).toHaveLength(1);
      expect(details.nearbyStations[0].station.name).toBe('Test Station');
    });

    it('should handle apartment not found', async () => {
      await expect(
        trpc.apartments.getById.query({ id: 'non-existent-id' })
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('Station API', () => {
    it('should search stations by name', async () => {
      // Create test stations
      await prisma.station.createMany({
        data: [
          factories.station({ name: 'Tokyo Station' }),
          factories.station({ name: 'Shinjuku Station' }),
          factories.station({ name: 'Shibuya Station' }),
        ],
      });

      // Search for stations
      const results = await trpc.stations.search.query({
        query: 'Station',
        limit: 10,
      });

      expect(results).toHaveLength(3);
      expect(results.every(s => s.name.includes('Station'))).toBe(true);
    });

    it('should get reachable stations within time limit', async () => {
      const { stations } = await seedDatabase(prisma);
      const originStation = stations[0];

      // Mock transit service response
      const reachableStations = await trpc.stations.getReachable.query({
        stationId: originStation.id,
        maxTime: 30,
      });

      expect(reachableStations).toBeDefined();
      expect(reachableStations).toBeInstanceOf(Array);
      expect(reachableStations.every(s => s.commuteTime <= 30)).toBe(true);
    });
  });

  describe('User Favorites API', () => {
    it('should add apartment to favorites', async () => {
      const user = await prisma.user.create({ data: factories.user() });
      const apartment = await prisma.apartment.create({ data: factories.apartment() });

      // Add to favorites (with mocked auth)
      const favorite = await trpc.users.addFavorite.mutate({
        apartmentId: apartment.id,
      });

      expect(favorite).toBeDefined();
      expect(favorite.userId).toBe(user.id);
      expect(favorite.apartmentId).toBe(apartment.id);

      // Verify in database
      const dbFavorite = await prisma.favorite.findUnique({
        where: {
          userId_apartmentId: {
            userId: user.id,
            apartmentId: apartment.id,
          },
        },
      });

      expect(dbFavorite).toBeDefined();
    });

    it('should list user favorites', async () => {
      const user = await prisma.user.create({ data: factories.user() });
      const apartments = await Promise.all(
        Array.from({ length: 3 }, () =>
          prisma.apartment.create({ data: factories.apartment() })
        )
      );

      // Add favorites
      await Promise.all(
        apartments.map(apt =>
          prisma.favorite.create({
            data: {
              userId: user.id,
              apartmentId: apt.id,
            },
          })
        )
      );

      // Get favorites
      const favorites = await trpc.users.getFavorites.query();

      expect(favorites).toHaveLength(3);
      expect(favorites.every(f => f.apartment)).toBe(true);
    });
  });

  describe('Search Presets API', () => {
    it('should create and retrieve search presets', async () => {
      const user = await prisma.user.create({ data: factories.user() });

      // Create preset
      const preset = await trpc.users.createSearchPreset.mutate({
        name: 'Work Commute',
        filters: {
          maxCommuteTime: 30,
          maxRent: 150000,
          minSize: 25,
          layout: '1LDK',
        },
      });

      expect(preset).toBeDefined();
      expect(preset.name).toBe('Work Commute');
      expect(preset.filters.maxCommuteTime).toBe(30);

      // Retrieve presets
      const presets = await trpc.users.getSearchPresets.query();

      expect(presets).toHaveLength(1);
      expect(presets[0].id).toBe(preset.id);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // Simulate database connection failure
      await prisma.$disconnect();

      await expect(
        trpc.apartments.searchByCommute.query({
          workStationId: 'test-id',
          maxCommuteTime: 30,
        })
      ).rejects.toThrow(/database/i);

      // Reconnect for cleanup
      prisma = await createTestPrismaClient();
    });

    it('should validate input parameters', async () => {
      await expect(
        trpc.apartments.searchByCommute.query({
          workStationId: '',
          maxCommuteTime: -1, // Invalid
        })
      ).rejects.toThrow(/validation/i);

      await expect(
        trpc.apartments.searchByCommute.query({
          workStationId: 'test',
          maxCommuteTime: 200, // Too high
        })
      ).rejects.toThrow(/validation/i);
    });
  });
});