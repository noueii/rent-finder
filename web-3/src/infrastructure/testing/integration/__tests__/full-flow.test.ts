import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  createTestPrismaClient,
  clearDatabase,
  createTestTRPCClient,
  createTestScenarios,
  factories,
} from '../index';
import type { PrismaClient } from '@prisma/client';

// Setup test environment
setupTestEnvironment();

describe('Full User Flow Integration Tests', () => {
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

  describe('Complete Apartment Search Flow', () => {
    it('should complete full search to details flow', async () => {
      // Step 1: Set up test scenario
      const scenario = await createTestScenarios.userWithWorkCommute(prisma);
      const { user, workStation, apartments } = scenario;

      // Step 2: User searches for stations
      const stationSearchResults = await trpc.stations.search.query({
        query: 'Tokyo',
      });

      expect(stationSearchResults).toContainEqual(
        expect.objectContaining({ name: 'Tokyo Station' })
      );

      // Step 3: Get reachable stations from work
      const reachableStations = await trpc.stations.getReachable.query({
        stationId: workStation.id,
        maxTime: 30,
      });

      expect(reachableStations.length).toBeGreaterThan(0);

      // Step 4: Search apartments near reachable stations
      const searchResults = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 30,
        filters: {
          maxRent: 150000,
          minSize: 20,
        },
      });

      expect(searchResults.apartments.length).toBeGreaterThan(0);
      expect(searchResults.searchId).toBeDefined();

      // Step 5: Get details for first apartment
      const firstApartment = searchResults.apartments[0];
      const apartmentDetails = await trpc.apartments.getById.query({
        id: firstApartment.id,
      });

      expect(apartmentDetails).toBeDefined();
      expect(apartmentDetails.nearbyStations.length).toBeGreaterThan(0);

      // Step 6: Add to favorites
      const favorite = await trpc.users.addFavorite.mutate({
        apartmentId: apartmentDetails.id,
      });

      expect(favorite).toBeDefined();

      // Step 7: Save search as preset
      const preset = await trpc.users.createSearchPreset.mutate({
        name: 'Daily Commute Search',
        filters: {
          workStationId: workStation.id,
          maxCommuteTime: 30,
          maxRent: 150000,
          minSize: 20,
        },
      });

      expect(preset).toBeDefined();

      // Step 8: Verify saved data
      const userFavorites = await trpc.users.getFavorites.query();
      const userPresets = await trpc.users.getSearchPresets.query();

      expect(userFavorites).toHaveLength(1);
      expect(userPresets).toHaveLength(1);
    });
  });

  describe('Price Range Search Flow', () => {
    it('should filter apartments by price ranges correctly', async () => {
      // Create apartments with different price ranges
      const { apartments, priceRanges } = await createTestScenarios.apartmentsByPriceRange(prisma);

      // Test each price range
      for (const range of priceRanges) {
        const results = await trpc.apartments.search.query({
          filters: {
            minRent: range.min,
            maxRent: range.max,
          },
        });

        expect(results.apartments.length).toBeGreaterThanOrEqual(range.count);
        expect(
          results.apartments.every(apt => apt.rent >= range.min && apt.rent <= range.max)
        ).toBe(true);
      }
    });
  });

  describe('Multi-Station Commute Search', () => {
    it('should handle searches with multiple work locations', async () => {
      // Create user with multiple work locations
      const user = await prisma.user.create({ data: factories.user() });
      
      const workStations = await Promise.all([
        prisma.station.create({ data: factories.station({ name: 'Office Station' }) }),
        prisma.station.create({ data: factories.station({ name: 'Client Station' }) }),
      ]);

      // Create apartments near different stations
      const nearbyStations = await Promise.all(
        Array.from({ length: 8 }, () =>
          prisma.station.create({ data: factories.station() })
        )
      );

      const apartments = await Promise.all(
        nearbyStations.map((station, index) =>
          prisma.apartment.create({
            data: {
              ...factories.apartment(),
              nearbyStations: {
                create: [{
                  station: { connect: { id: station.id } },
                  walkingTime: 10,
                  distance: 500,
                }],
              },
            },
          })
        )
      );

      // Search from first work location
      const resultsFromOffice = await trpc.apartments.searchByCommute.query({
        workStationId: workStations[0].id,
        maxCommuteTime: 30,
      });

      // Search from second work location
      const resultsFromClient = await trpc.apartments.searchByCommute.query({
        workStationId: workStations[1].id,
        maxCommuteTime: 30,
      });

      // Results should be different
      expect(resultsFromOffice.apartments.length).toBeGreaterThan(0);
      expect(resultsFromClient.apartments.length).toBeGreaterThan(0);
      
      // Save both as presets
      const officePreset = await trpc.users.createSearchPreset.mutate({
        name: 'Office Commute',
        filters: {
          workStationId: workStations[0].id,
          maxCommuteTime: 30,
        },
      });

      const clientPreset = await trpc.users.createSearchPreset.mutate({
        name: 'Client Office Commute',
        filters: {
          workStationId: workStations[1].id,
          maxCommuteTime: 30,
        },
      });

      expect(officePreset).toBeDefined();
      expect(clientPreset).toBeDefined();
    });
  });

  describe('Search History and Analytics', () => {
    it('should track search history and provide insights', async () => {
      const user = await prisma.user.create({ data: factories.user() });
      const station = await prisma.station.create({ data: factories.station() });

      // Perform multiple searches
      const searches = [];
      for (let i = 0; i < 5; i++) {
        const result = await trpc.apartments.searchByCommute.query({
          workStationId: station.id,
          maxCommuteTime: 30 + i * 5, // Varying commute times
          filters: {
            maxRent: 100000 + i * 10000, // Varying rent
          },
        });
        searches.push(result);
      }

      // Get search history
      const history = await trpc.users.getSearchHistory.query({
        limit: 10,
      });

      expect(history.length).toBe(5);
      expect(history[0].resultCount).toBeDefined();

      // Analyze search patterns
      const avgMaxRent = history.reduce((sum, h) => sum + (h.filters.maxRent || 0), 0) / history.length;
      const avgCommuteTime = history.reduce((sum, h) => sum + (h.filters.maxCommuteTime || 0), 0) / history.length;

      expect(avgMaxRent).toBeGreaterThan(100000);
      expect(avgCommuteTime).toBeGreaterThan(30);
    });
  });

  describe('Concurrent User Operations', () => {
    it('should handle multiple users searching simultaneously', async () => {
      // Create multiple users
      const users = await Promise.all(
        Array.from({ length: 3 }, () =>
          prisma.user.create({ data: factories.user() })
        )
      );

      // Create shared station and apartments
      const station = await prisma.station.create({ data: factories.station() });
      const apartments = await Promise.all(
        Array.from({ length: 10 }, () =>
          prisma.apartment.create({ data: factories.apartment() })
        )
      );

      // Simulate concurrent searches
      const searchPromises = users.map(user =>
        trpc.apartments.searchByCommute.query({
          workStationId: station.id,
          maxCommuteTime: 30,
        })
      );

      const results = await Promise.all(searchPromises);

      // All users should get results
      expect(results.every(r => r.apartments.length > 0)).toBe(true);

      // Simulate concurrent favorites
      const favoritePromises = users.map((user, index) =>
        trpc.users.addFavorite.mutate({
          apartmentId: apartments[index].id,
        })
      );

      const favorites = await Promise.all(favoritePromises);

      // All favorites should be created
      expect(favorites.every(f => f.id)).toBe(true);

      // Verify no data conflicts
      const allFavorites = await prisma.favorite.findMany();
      expect(allFavorites).toHaveLength(3);
    });
  });
});