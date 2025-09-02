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

describe('E2E: Commute Search Flow', () => {
  let prisma: PrismaClient;
  let trpc: ReturnType<typeof createTestTRPCClient>;
  let testUser: any;
  let workStation: any;
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
    
    // Create test user with preferences
    testUser = await prisma.user.create({
      data: {
        ...factories.user(),
        emailVerified: new Date(),
        preferences: {
          create: {
            maxCommuteTime: 45,
            maxRent: 130000,
            minSize: 25,
          },
        },
      },
    });

    // Create work station (target station)
    workStation = await prisma.station.create({
      data: {
        name: 'Tokyo Station',
        nameJa: '東京駅',
        line: 'JR Yamanote Line',
        prefecture: 'Tokyo',
        latitude: 35.6812,
        longitude: 139.7671,
      },
    });

    // Create stations at various distances
    testStations = await Promise.all([
      // 10 minutes from Tokyo Station
      prisma.station.create({
        data: {
          name: 'Otemachi Station',
          nameJa: '大手町駅',
          line: 'Tokyo Metro Marunouchi Line',
          prefecture: 'Tokyo',
          latitude: 35.6842,
          longitude: 139.7663,
        },
      }),
      // 20 minutes from Tokyo Station
      prisma.station.create({
        data: {
          name: 'Shinjuku Station',
          nameJa: '新宿駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
          latitude: 35.6896,
          longitude: 139.7006,
        },
      }),
      // 30 minutes from Tokyo Station
      prisma.station.create({
        data: {
          name: 'Shibuya Station',
          nameJa: '渋谷駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
          latitude: 35.6580,
          longitude: 139.7016,
        },
      }),
      // 40 minutes from Tokyo Station
      prisma.station.create({
        data: {
          name: 'Meguro Station',
          nameJa: '目黒駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
          latitude: 35.6340,
          longitude: 139.7157,
        },
      }),
      // 50 minutes from Tokyo Station (outside preferred range)
      prisma.station.create({
        data: {
          name: 'Tachikawa Station',
          nameJa: '立川駅',
          line: 'JR Chuo Line',
          prefecture: 'Tokyo',
          latitude: 35.6978,
          longitude: 139.4143,
        },
      }),
    ]);

    // Create commute connections in database
    await Promise.all([
      prisma.commuteTime.create({
        data: {
          fromStationId: testStations[0].id,
          toStationId: workStation.id,
          duration: 10,
          transfers: 0,
          route: 'Direct via Marunouchi Line',
        },
      }),
      prisma.commuteTime.create({
        data: {
          fromStationId: testStations[1].id,
          toStationId: workStation.id,
          duration: 20,
          transfers: 0,
          route: 'Direct via Yamanote Line',
        },
      }),
      prisma.commuteTime.create({
        data: {
          fromStationId: testStations[2].id,
          toStationId: workStation.id,
          duration: 30,
          transfers: 0,
          route: 'Direct via Yamanote Line',
        },
      }),
      prisma.commuteTime.create({
        data: {
          fromStationId: testStations[3].id,
          toStationId: workStation.id,
          duration: 40,
          transfers: 1,
          route: 'Yamanote Line → Transfer at Osaki',
        },
      }),
      prisma.commuteTime.create({
        data: {
          fromStationId: testStations[4].id,
          toStationId: workStation.id,
          duration: 50,
          transfers: 0,
          route: 'Direct via Chuo Line',
        },
      }),
    ]);

    // Create apartments near each station
    testApartments = await Promise.all([
      // Near Otemachi (10 min commute)
      prisma.apartment.create({
        data: {
          title: 'Premium 1LDK in Otemachi',
          rent: 180000,
          size: 45,
          rooms: '1LDK',
          age: 2,
          floor: 12,
          address: 'Chiyoda-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[0].id } },
              walkingTime: 5,
              distance: 400,
            }],
          },
        },
      }),
      // Near Shinjuku (20 min commute)
      prisma.apartment.create({
        data: {
          title: 'Modern Studio in Shinjuku',
          rent: 110000,
          size: 28,
          rooms: '1K',
          age: 5,
          floor: 7,
          address: 'Shinjuku-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[1].id } },
              walkingTime: 8,
              distance: 650,
            }],
          },
        },
      }),
      // Near Shibuya (30 min commute)
      prisma.apartment.create({
        data: {
          title: 'Stylish 1K in Shibuya',
          rent: 125000,
          size: 30,
          rooms: '1K',
          age: 3,
          floor: 5,
          address: 'Shibuya-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[2].id } },
              walkingTime: 10,
              distance: 800,
            }],
          },
        },
      }),
      // Near Meguro (40 min commute)
      prisma.apartment.create({
        data: {
          title: 'Spacious 2K in Meguro',
          rent: 95000,
          size: 38,
          rooms: '2K',
          age: 12,
          floor: 3,
          address: 'Meguro-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[3].id } },
              walkingTime: 12,
              distance: 950,
            }],
          },
        },
      }),
      // Near Tachikawa (50 min commute - outside range)
      prisma.apartment.create({
        data: {
          title: 'Large 2LDK in Tachikawa',
          rent: 80000,
          size: 55,
          rooms: '2LDK',
          age: 8,
          floor: 4,
          address: 'Tachikawa-shi, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: testStations[4].id } },
              walkingTime: 7,
              distance: 550,
            }],
          },
        },
      }),
    ]);
  });

  describe('Complete Commute-Based Search Flow', () => {
    it('should complete full commute search → filter → compare → save flow', async () => {
      // Step 1: Set target station
      console.log('Step 1: Setting target work station...');
      const stationSearch = await trpc.stations.search.query({
        query: 'Tokyo Station',
      });

      expect(stationSearch).toHaveLength(1);
      expect(stationSearch[0].name).toBe('Tokyo Station');

      const targetWorkStation = stationSearch[0];

      // Step 2: Set maximum commute time
      console.log('Step 2: Finding reachable stations...');
      const maxCommuteTime = 30; // 30 minutes
      
      const reachableStations = await trpc.stations.getReachable.query({
        stationId: targetWorkStation.id,
        maxTime: maxCommuteTime,
      });

      expect(reachableStations).toBeDefined();
      expect(reachableStations.length).toBeGreaterThan(0);
      expect(reachableStations.every(s => s.commuteTime <= maxCommuteTime)).toBe(true);

      // Verify stations are sorted by commute time
      const commuteTimes = reachableStations.map(s => s.commuteTime);
      expect(commuteTimes).toEqual([...commuteTimes].sort((a, b) => a - b));

      // Step 3: Search apartments within commute range
      console.log('Step 3: Searching apartments within commute range...');
      const commuteSearch = await trpc.apartments.searchByCommute.query({
        workStationId: targetWorkStation.id,
        maxCommuteTime: maxCommuteTime,
        filters: {
          maxRent: testUser.preferences.maxRent,
          minSize: testUser.preferences.minSize,
        },
      });

      expect(commuteSearch.apartments).toBeDefined();
      expect(commuteSearch.apartments.length).toBeGreaterThan(0);
      expect(commuteSearch.searchId).toBeDefined();

      // Verify all apartments are within commute range
      commuteSearch.apartments.forEach(apt => {
        expect(apt.commuteDetails).toBeDefined();
        expect(apt.commuteDetails.totalTime).toBeLessThanOrEqual(maxCommuteTime);
      });

      // Step 4: View commute details for specific apartment
      console.log('Step 4: Viewing detailed commute information...');
      const selectedApartment = commuteSearch.apartments[0];
      
      const commuteDetails = await trpc.apartments.getCommuteDetails.query({
        apartmentId: selectedApartment.id,
        targetStationId: targetWorkStation.id,
      });

      expect(commuteDetails).toBeDefined();
      expect(commuteDetails.routes).toBeDefined();
      expect(commuteDetails.routes.length).toBeGreaterThan(0);
      
      const primaryRoute = commuteDetails.routes[0];
      expect(primaryRoute.walkingTime).toBeDefined();
      expect(primaryRoute.trainTime).toBeDefined();
      expect(primaryRoute.totalTime).toBe(
        primaryRoute.walkingTime + primaryRoute.trainTime
      );
      expect(primaryRoute.transfers).toBeDefined();
      expect(primaryRoute.routeDescription).toBeDefined();

      // Step 5: Compare multiple apartments by commute
      console.log('Step 5: Comparing apartments by commute...');
      const topApartments = commuteSearch.apartments.slice(0, 3);
      
      const comparison = await trpc.apartments.compareByCommute.mutate({
        apartmentIds: topApartments.map(a => a.id),
        targetStationId: targetWorkStation.id,
      });

      expect(comparison.apartments).toHaveLength(3);
      
      // Verify comparison includes all relevant metrics
      comparison.apartments.forEach(apt => {
        expect(apt.commuteTime).toBeDefined();
        expect(apt.walkingTime).toBeDefined();
        expect(apt.transfers).toBeDefined();
        expect(apt.rent).toBeDefined();
        expect(apt.size).toBeDefined();
        expect(apt.commuteScore).toBeDefined(); // Combined score
      });

      // Apartments should be sorted by commute score
      const scores = comparison.apartments.map(a => a.commuteScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));

      // Step 6: Save commute search as preset
      console.log('Step 6: Saving commute search preset...');
      const commutePreset = await trpc.users.createSearchPreset.mutate({
        name: 'Daily Work Commute',
        filters: {
          workStationId: targetWorkStation.id,
          maxCommuteTime: maxCommuteTime,
          maxRent: testUser.preferences.maxRent,
          minSize: testUser.preferences.minSize,
        },
        isCommuteSearch: true,
      });

      expect(commutePreset).toBeDefined();
      expect(commutePreset.isCommuteSearch).toBe(true);

      // Step 7: Create alert for new apartments
      console.log('Step 7: Setting up commute search alert...');
      const alert = await trpc.users.createSearchAlert.mutate({
        name: 'New apartments within 30min of work',
        searchPresetId: commutePreset.id,
        frequency: 'daily',
      });

      expect(alert).toBeDefined();
      expect(alert.searchPresetId).toBe(commutePreset.id);

      console.log('✅ Commute search flow completed successfully!');
    });

    it('should handle multiple work locations', async () => {
      // Create second work location
      const secondWorkStation = await prisma.station.create({
        data: {
          name: 'Roppongi Station',
          nameJa: '六本木駅',
          line: 'Tokyo Metro Hibiya Line',
          prefecture: 'Tokyo',
        },
      });

      // Add commute times from test stations to second work location
      await Promise.all([
        prisma.commuteTime.create({
          data: {
            fromStationId: testStations[0].id,
            toStationId: secondWorkStation.id,
            duration: 15,
            transfers: 1,
          },
        }),
        prisma.commuteTime.create({
          data: {
            fromStationId: testStations[1].id,
            toStationId: secondWorkStation.id,
            duration: 25,
            transfers: 1,
          },
        }),
      ]);

      // Search from both work locations
      const tokyoResults = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 30,
      });

      const roppongiResults = await trpc.apartments.searchByCommute.query({
        workStationId: secondWorkStation.id,
        maxCommuteTime: 30,
      });

      // Results should be different
      expect(tokyoResults.apartments.length).toBeGreaterThan(0);
      expect(roppongiResults.apartments.length).toBeGreaterThan(0);

      // Find apartments good for both locations
      const multiLocationSearch = await trpc.apartments.searchByMultipleCommutes.query({
        workLocations: [
          { stationId: workStation.id, maxTime: 30, weight: 0.7 }, // Primary
          { stationId: secondWorkStation.id, maxTime: 30, weight: 0.3 }, // Secondary
        ],
      });

      expect(multiLocationSearch.apartments).toBeDefined();
      
      // Each apartment should have composite commute score
      multiLocationSearch.apartments.forEach(apt => {
        expect(apt.compositeCommuteScore).toBeDefined();
        expect(apt.commuteBreakdown).toBeDefined();
        expect(apt.commuteBreakdown).toHaveLength(2);
      });
    });

    it('should optimize for different commute preferences', async () => {
      // Test 1: Minimize transfers
      const noTransfersSearch = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 45,
        commutePreferences: {
          maxTransfers: 0,
          prioritize: 'transfers',
        },
      });

      expect(noTransfersSearch.apartments.every(apt => 
        apt.commuteDetails.transfers === 0
      )).toBe(true);

      // Test 2: Minimize walking time
      const minWalkingSearch = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 45,
        commutePreferences: {
          maxWalkingTime: 5,
          prioritize: 'walking',
        },
      });

      expect(minWalkingSearch.apartments.every(apt => 
        apt.commuteDetails.walkingTime <= 5
      )).toBe(true);

      // Test 3: Balance all factors
      const balancedSearch = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 45,
        commutePreferences: {
          prioritize: 'balanced',
        },
      });

      expect(balancedSearch.apartments).toBeDefined();
      
      // Verify balanced scoring
      balancedSearch.apartments.forEach(apt => {
        expect(apt.commuteDetails.score).toBeDefined();
        expect(apt.commuteDetails.scoreBreakdown).toBeDefined();
        expect(apt.commuteDetails.scoreBreakdown).toHaveProperty('timeScore');
        expect(apt.commuteDetails.scoreBreakdown).toHaveProperty('transferScore');
        expect(apt.commuteDetails.scoreBreakdown).toHaveProperty('walkingScore');
      });
    });

    it('should handle rush hour vs off-peak times', async () => {
      // Search during rush hour
      const rushHourSearch = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 30,
        timeOfDay: 'rush_morning', // 7-9 AM
      });

      // Search during off-peak
      const offPeakSearch = await trpc.apartments.searchByCommute.query({
        workStationId: workStation.id,
        maxCommuteTime: 30,
        timeOfDay: 'off_peak', // 10 AM - 4 PM
      });

      // Rush hour should have longer commute times for same apartments
      const rushHourApt = rushHourSearch.apartments[0];
      const offPeakApt = offPeakSearch.apartments.find(a => a.id === rushHourApt.id);

      if (offPeakApt) {
        expect(rushHourApt.commuteDetails.totalTime).toBeGreaterThanOrEqual(
          offPeakApt.commuteDetails.totalTime
        );
      }
    });
  });

  describe('Commute Analysis and Insights', () => {
    it('should provide commute statistics and recommendations', async () => {
      // Perform multiple searches
      const searches = await Promise.all([
        trpc.apartments.searchByCommute.query({
          workStationId: workStation.id,
          maxCommuteTime: 20,
        }),
        trpc.apartments.searchByCommute.query({
          workStationId: workStation.id,
          maxCommuteTime: 30,
        }),
        trpc.apartments.searchByCommute.query({
          workStationId: workStation.id,
          maxCommuteTime: 45,
        }),
      ]);

      // Get commute insights
      const insights = await trpc.users.getCommuteInsights.query({
        workStationId: workStation.id,
      });

      expect(insights).toBeDefined();
      expect(insights.averageRentByCommuteTime).toBeDefined();
      expect(insights.apartmentCountByCommuteTime).toBeDefined();
      expect(insights.bestValueZones).toBeDefined();
      
      // Best value zones should include rent per minute of commute
      insights.bestValueZones.forEach(zone => {
        expect(zone.stationName).toBeDefined();
        expect(zone.averageRent).toBeDefined();
        expect(zone.averageCommuteTime).toBeDefined();
        expect(zone.valueScore).toBeDefined();
      });

      // Get personalized recommendations
      const recommendations = await trpc.apartments.getCommuteRecommendations.query({
        workStationId: workStation.id,
        budget: testUser.preferences.maxRent,
      });

      expect(recommendations.sweetSpot).toBeDefined();
      expect(recommendations.sweetSpot.commuteTime).toBeDefined();
      expect(recommendations.sweetSpot.reason).toBeDefined();
      expect(recommendations.alternativeStations).toBeDefined();
    });
  });
});