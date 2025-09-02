import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  createTestPrismaClient,
  clearDatabase,
  createTestTRPCClient,
  factories,
} from '~/infrastructure/testing/integration';
import type { PrismaClient } from '@prisma/client';

// Setup test environment
setupTestEnvironment();

describe('E2E: Apartment Search Flow', () => {
  let prisma: PrismaClient;
  let trpc: ReturnType<typeof createTestTRPCClient>;
  let testUser: any;
  let testStations: any[];
  let testApartments: any[];

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    trpc = createTestTRPCClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    
    // Create test user
    testUser = await prisma.user.create({
      data: {
        ...factories.user(),
        emailVerified: new Date(),
        preferences: {
          create: {
            maxCommuteTime: 30,
            maxRent: 150000,
            minSize: 20,
            preferredAreas: ['Shibuya', 'Shinjuku', 'Minato'],
          },
        },
      },
    });

    // Create test stations
    testStations = await Promise.all([
      prisma.station.create({
        data: {
          name: 'Shibuya Station',
          nameJa: '渋谷駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      }),
      prisma.station.create({
        data: {
          name: 'Shinjuku Station',
          nameJa: '新宿駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      }),
      prisma.station.create({
        data: {
          name: 'Harajuku Station',
          nameJa: '原宿駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      }),
      prisma.station.create({
        data: {
          name: 'Ebisu Station',
          nameJa: '恵比寿駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      }),
    ]);

    // Create test apartments with various characteristics
    testApartments = await Promise.all([
      // Apartment 1: Perfect match - near Shibuya, good price, good size
      prisma.apartment.create({
        data: {
          title: 'Modern 1LDK in Shibuya',
          rent: 120000,
          size: 35,
          rooms: '1LDK',
          age: 3,
          floor: 5,
          address: 'Shibuya-ku, Tokyo',
          features: ['Auto Lock', 'Air Conditioning', 'Elevator'],
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[0].id } }, // Shibuya
              walkingTime: 7,
              distance: 500,
            }],
          },
        },
      }),
      // Apartment 2: Too expensive but great location
      prisma.apartment.create({
        data: {
          title: 'Luxury 2LDK near Shinjuku',
          rent: 200000,
          size: 55,
          rooms: '2LDK',
          age: 1,
          floor: 15,
          address: 'Shinjuku-ku, Tokyo',
          features: ['Concierge', 'Gym', 'Pet Allowed'],
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[1].id } }, // Shinjuku
              walkingTime: 5,
              distance: 400,
            }],
          },
        },
      }),
      // Apartment 3: Good price but far walk
      prisma.apartment.create({
        data: {
          title: 'Budget Studio in Harajuku',
          rent: 80000,
          size: 22,
          rooms: '1R',
          age: 15,
          floor: 2,
          address: 'Shibuya-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[2].id } }, // Harajuku
              walkingTime: 15,
              distance: 1200,
            }],
          },
        },
      }),
      // Apartment 4: Multiple station access
      prisma.apartment.create({
        data: {
          title: 'Convenient 1K between stations',
          rent: 95000,
          size: 25,
          rooms: '1K',
          age: 8,
          floor: 4,
          address: 'Shibuya-ku, Tokyo',
          features: ['Bicycle Parking', 'Balcony'],
          nearbyStations: {
            create: [
              {
                station: { connect: { id: testStations[0].id } }, // Shibuya
                walkingTime: 12,
                distance: 950,
              },
              {
                station: { connect: { id: testStations[3].id } }, // Ebisu
                walkingTime: 10,
                distance: 800,
              },
            ],
          },
        },
      }),
    ]);
  });

  describe('Search by Station Flow', () => {
    it('should complete full search → filter → view details → save flow', async () => {
      // Step 1: Search for stations
      console.log('Step 1: Searching for stations...');
      const stationSearch = await trpc.stations.search.query({
        query: 'Shibuya',
      });

      expect(stationSearch).toBeDefined();
      expect(stationSearch.length).toBeGreaterThan(0);
      expect(stationSearch[0].name).toContain('Shibuya');

      const targetStation = stationSearch[0];

      // Step 2: Search apartments near the station
      console.log('Step 2: Searching apartments near station...');
      const initialSearch = await trpc.apartments.search.query({
        filters: {
          stationId: targetStation.id,
          maxWalkingTime: 15,
        },
      });

      expect(initialSearch.apartments).toBeDefined();
      expect(initialSearch.apartments.length).toBeGreaterThan(0);
      expect(initialSearch.total).toBeGreaterThan(0);

      // Step 3: Apply filters to refine results
      console.log('Step 3: Applying filters...');
      const filteredSearch = await trpc.apartments.search.query({
        filters: {
          stationId: targetStation.id,
          maxWalkingTime: 10,
          maxRent: 150000,
          minSize: 25,
          features: ['Air Conditioning'],
        },
        sort: 'rent_asc',
        page: 1,
        limit: 20,
      });

      expect(filteredSearch.apartments.length).toBeLessThanOrEqual(initialSearch.apartments.length);
      expect(filteredSearch.apartments.every(apt => apt.rent <= 150000)).toBe(true);
      expect(filteredSearch.apartments.every(apt => apt.size >= 25)).toBe(true);

      // Verify sorting
      const rents = filteredSearch.apartments.map(apt => apt.rent);
      expect(rents).toEqual([...rents].sort((a, b) => a - b));

      // Step 4: View apartment details
      console.log('Step 4: Viewing apartment details...');
      const selectedApartment = filteredSearch.apartments[0];
      const apartmentDetails = await trpc.apartments.getById.query({
        id: selectedApartment.id,
      });

      expect(apartmentDetails).toBeDefined();
      expect(apartmentDetails.id).toBe(selectedApartment.id);
      expect(apartmentDetails.nearbyStations).toBeDefined();
      expect(apartmentDetails.nearbyStations.length).toBeGreaterThan(0);
      expect(apartmentDetails.features).toBeDefined();

      // Step 5: Check similar apartments
      console.log('Step 5: Finding similar apartments...');
      const similarApartments = await trpc.apartments.getSimilar.query({
        apartmentId: apartmentDetails.id,
        limit: 5,
      });

      expect(similarApartments).toBeDefined();
      expect(similarApartments.length).toBeGreaterThan(0);
      expect(similarApartments.every(apt => apt.id !== apartmentDetails.id)).toBe(true);

      // Step 6: Save to list
      console.log('Step 6: Saving to list...');
      
      // First create a list
      const newList = await trpc.lists.create.mutate({
        name: 'Shibuya Area Favorites',
        description: 'Apartments I like near Shibuya',
      });

      expect(newList).toBeDefined();
      expect(newList.name).toBe('Shibuya Area Favorites');

      // Add apartment to list
      const addToList = await trpc.lists.addApartment.mutate({
        listId: newList.id,
        apartmentId: apartmentDetails.id,
        notes: 'Great location, perfect size',
      });

      expect(addToList.success).toBe(true);

      // Verify apartment is in the list
      const listDetails = await trpc.lists.getById.query({
        id: newList.id,
      });

      expect(listDetails.apartments).toHaveLength(1);
      expect(listDetails.apartments[0].id).toBe(apartmentDetails.id);
      expect(listDetails.apartments[0].notes).toBe('Great location, perfect size');

      // Step 7: Update search history
      console.log('Step 7: Verifying search history...');
      const searchHistory = await trpc.users.getSearchHistory.query({
        limit: 10,
      });

      expect(searchHistory).toBeDefined();
      expect(searchHistory.length).toBeGreaterThan(0);
      expect(searchHistory[0].filters.stationId).toBe(targetStation.id);

      console.log('✅ Apartment search flow completed successfully!');
    });

    it('should handle complex multi-filter searches', async () => {
      // Test combining multiple filters
      const complexSearch = await trpc.apartments.search.query({
        filters: {
          stationIds: [testStations[0].id, testStations[1].id], // Multiple stations
          maxWalkingTime: 10,
          minRent: 90000,
          maxRent: 130000,
          minSize: 25,
          maxSize: 40,
          roomTypes: ['1K', '1LDK'],
          maxAge: 10,
          minFloor: 3,
          features: ['Air Conditioning', 'Auto Lock'],
        },
        sort: 'size_desc',
      });

      expect(complexSearch.apartments).toBeDefined();
      
      // Verify all filters are applied
      complexSearch.apartments.forEach(apt => {
        expect(apt.rent).toBeGreaterThanOrEqual(90000);
        expect(apt.rent).toBeLessThanOrEqual(130000);
        expect(apt.size).toBeGreaterThanOrEqual(25);
        expect(apt.size).toBeLessThanOrEqual(40);
        expect(apt.age).toBeLessThanOrEqual(10);
        expect(apt.floor).toBeGreaterThanOrEqual(3);
        expect(['1K', '1LDK']).toContain(apt.rooms);
      });

      // Verify sorting
      const sizes = complexSearch.apartments.map(apt => apt.size);
      expect(sizes).toEqual([...sizes].sort((a, b) => b - a));
    });

    it('should handle pagination correctly', async () => {
      // Create more apartments for pagination testing
      await Promise.all(
        Array.from({ length: 15 }, (_, i) =>
          prisma.apartment.create({
            data: {
              ...factories.apartment(),
              title: `Test Apartment ${i + 5}`,
              rent: 100000 + i * 5000,
              nearbyStations: {
                create: [{
                  station: { connect: { id: testStations[0].id } },
                  walkingTime: 5,
                  distance: 400,
                }],
              },
            },
          })
        )
      );

      // Test first page
      const page1 = await trpc.apartments.search.query({
        filters: { stationId: testStations[0].id },
        page: 1,
        limit: 10,
      });

      expect(page1.apartments).toHaveLength(10);
      expect(page1.total).toBeGreaterThan(10);
      expect(page1.hasMore).toBe(true);

      // Test second page
      const page2 = await trpc.apartments.search.query({
        filters: { stationId: testStations[0].id },
        page: 2,
        limit: 10,
      });

      expect(page2.apartments.length).toBeGreaterThan(0);
      expect(page2.apartments[0].id).not.toBe(page1.apartments[0].id);

      // Verify no duplicates between pages
      const page1Ids = new Set(page1.apartments.map(apt => apt.id));
      const page2Ids = new Set(page2.apartments.map(apt => apt.id));
      const intersection = [...page1Ids].filter(id => page2Ids.has(id));
      expect(intersection).toHaveLength(0);
    });

    it('should save and reuse search filters', async () => {
      // Perform a search
      const searchFilters = {
        stationId: testStations[0].id,
        maxWalkingTime: 10,
        maxRent: 120000,
        minSize: 30,
        features: ['Auto Lock'],
      };

      const searchResult = await trpc.apartments.search.query({
        filters: searchFilters,
      });

      // Save as preset
      const preset = await trpc.users.createSearchPreset.mutate({
        name: 'My Ideal Apartment',
        filters: searchFilters,
      });

      expect(preset).toBeDefined();

      // Load and use preset
      const loadedPreset = await trpc.users.getSearchPreset.query({
        id: preset.id,
      });

      const presetSearch = await trpc.apartments.search.query({
        filters: loadedPreset.filters,
      });

      // Results should be the same
      expect(presetSearch.apartments.length).toBe(searchResult.apartments.length);
      expect(presetSearch.apartments.map(a => a.id).sort()).toEqual(
        searchResult.apartments.map(a => a.id).sort()
      );
    });
  });

  describe('Search Result Interactions', () => {
    it('should track apartment views and generate recommendations', async () => {
      // View several apartments
      const viewedApartments = [];
      
      for (let i = 0; i < 3; i++) {
        const apartment = testApartments[i];
        
        // View apartment
        await trpc.apartments.recordView.mutate({
          apartmentId: apartment.id,
        });
        
        viewedApartments.push(apartment);
        
        // Simulate spending time on the page
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Get view history
      const viewHistory = await trpc.users.getViewHistory.query({
        limit: 10,
      });

      expect(viewHistory).toHaveLength(3);
      expect(viewHistory[0].apartmentId).toBe(testApartments[2].id); // Most recent first

      // Get recommendations based on views
      const recommendations = await trpc.apartments.getRecommendations.query({
        limit: 5,
      });

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      // Recommendations should not include already viewed apartments
      const viewedIds = viewedApartments.map(a => a.id);
      expect(recommendations.every(rec => !viewedIds.includes(rec.id))).toBe(true);
    });

    it('should handle batch operations on search results', async () => {
      // Search for apartments
      const searchResults = await trpc.apartments.search.query({
        filters: {
          maxRent: 150000,
        },
      });

      const selectedApartments = searchResults.apartments.slice(0, 3);

      // Create a list for batch operations
      const list = await trpc.lists.create.mutate({
        name: 'Batch Test List',
      });

      // Add multiple apartments at once
      const batchAdd = await trpc.lists.addApartments.mutate({
        listId: list.id,
        apartmentIds: selectedApartments.map(a => a.id),
      });

      expect(batchAdd.success).toBe(true);
      expect(batchAdd.added).toBe(3);

      // Compare multiple apartments
      const comparison = await trpc.apartments.compare.query({
        apartmentIds: selectedApartments.map(a => a.id),
      });

      expect(comparison).toBeDefined();
      expect(comparison.apartments).toHaveLength(3);
      expect(comparison.averageRent).toBeDefined();
      expect(comparison.averageSize).toBeDefined();
      
      // Each apartment should have comparison scores
      comparison.apartments.forEach(apt => {
        expect(apt.priceScore).toBeDefined();
        expect(apt.sizeScore).toBeDefined();
        expect(apt.locationScore).toBeDefined();
      });
    });
  });
});