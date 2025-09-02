import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createInnerTRPCContext } from '~/server/api/trpc';
import { appRouter } from '~/server/api/root';
import { prisma } from '~/server/db';
import type { Session } from 'next-auth';
import { mockExternalServices } from '../mocks/external-services';

// Test utilities
const createTestSession = (userId: string): Session => ({
  user: {
    id: userId,
    email: `test${userId}@example.com`,
    name: 'Test User',
    role: 'USER'
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
});

const createTestContext = (session?: Session | null) => {
  return createInnerTRPCContext({
    session: session ?? null,
    headers: new Headers()
  });
};

describe('API Integration Tests', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Start mock services
    await mockExternalServices.start();
    
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'integration-test@example.com',
        name: 'Integration Test User',
        role: 'USER'
      }
    });
    testUserId = user.id;
  });
  
  afterAll(async () => {
    // Cleanup test data
    await prisma.user.delete({ where: { id: testUserId } });
    await mockExternalServices.stop();
  });
  
  beforeEach(async () => {
    // Clear any apartment data between tests
    await prisma.apartment.deleteMany({});
  });

  describe('Apartment Search Flow', () => {
    it('should perform end-to-end apartment search', async () => {
      // Create test context with authenticated user
      const ctx = createTestContext(createTestSession(testUserId));
      const caller = appRouter.createCaller(ctx);
      
      // 1. Search for stations
      const stations = await caller.station.search({ query: 'Tokyo' });
      expect(stations).toHaveLength(5);
      expect(stations[0]).toHaveProperty('nameEn', 'Tokyo');
      
      // 2. Get reachable stations
      const reachableStations = await caller.station.getReachableStations({
        stationId: stations[0]!.id,
        maxMinutes: 30
      });
      expect(reachableStations.length).toBeGreaterThan(0);
      
      // 3. Search apartments with commute time
      const searchResult = await caller.search.apartmentsWithCommute({
        workplace: { stationId: stations[0]!.id },
        commuteTime: { max: 30 },
        filters: {
          priceRange: { min: 50000, max: 150000 },
          layout: ['1K', '1DK', '1LDK']
        }
      });
      
      expect(searchResult).toHaveProperty('apartments');
      expect(searchResult).toHaveProperty('totalCount');
      expect(searchResult).toHaveProperty('hasMore');
      
      // Verify apartment data structure
      if (searchResult.apartments.length > 0) {
        const apartment = searchResult.apartments[0]!;
        expect(apartment).toHaveProperty('id');
        expect(apartment).toHaveProperty('name');
        expect(apartment).toHaveProperty('price');
        expect(apartment).toHaveProperty('layout');
        expect(apartment).toHaveProperty('size');
        expect(apartment).toHaveProperty('station');
        expect(apartment).toHaveProperty('commuteTime');
      }
    });
    
    it('should handle search with no results gracefully', async () => {
      const ctx = createTestContext(createTestSession(testUserId));
      const caller = appRouter.createCaller(ctx);
      
      // Search with impossible criteria
      const searchResult = await caller.search.apartmentsWithCommute({
        workplace: { stationId: 'station-1' },
        commuteTime: { max: 5 }, // Too short
        filters: {
          priceRange: { min: 10000, max: 20000 }, // Too cheap
          layout: ['4LDK'] // Too large for price
        }
      });
      
      expect(searchResult.apartments).toHaveLength(0);
      expect(searchResult.totalCount).toBe(0);
      expect(searchResult.hasMore).toBe(false);
    });
  });

  describe('Station Lookup and Reachability', () => {
    it('should get all stations', async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      const stations = await caller.station.getAll();
      expect(stations.length).toBeGreaterThan(0);
      expect(stations[0]).toHaveProperty('id');
      expect(stations[0]).toHaveProperty('nameEn');
      expect(stations[0]).toHaveProperty('nameJp');
      expect(stations[0]).toHaveProperty('lines');
    });
    
    it('should calculate reachability correctly', async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Get Tokyo station
      const stations = await caller.station.search({ query: 'Tokyo' });
      const tokyoStation = stations[0]!;
      
      // Test different commute times
      const reachable15 = await caller.station.getReachableStations({
        stationId: tokyoStation.id,
        maxMinutes: 15
      });
      
      const reachable30 = await caller.station.getReachableStations({
        stationId: tokyoStation.id,
        maxMinutes: 30
      });
      
      const reachable60 = await caller.station.getReachableStations({
        stationId: tokyoStation.id,
        maxMinutes: 60
      });
      
      // Verify increasing coverage
      expect(reachable15.length).toBeLessThan(reachable30.length);
      expect(reachable30.length).toBeLessThan(reachable60.length);
      
      // Verify data structure
      expect(reachable30[0]).toHaveProperty('stationId');
      expect(reachable30[0]).toHaveProperty('travelTime');
      expect(reachable30[0]!.travelTime).toBeLessThanOrEqual(30);
    });
  });

  describe('User Authentication Flow', () => {
    it('should handle user registration', async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Check email availability
      const isAvailable = await caller.auth.checkEmailAvailability({
        email: 'newuser@example.com'
      });
      expect(isAvailable).toBe(true);
      
      // Register new user
      const result = await caller.auth.register({
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'New User'
      });
      
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('message');
      expect(result.user.email).toBe('newuser@example.com');
      
      // Cleanup
      await prisma.user.delete({ where: { email: 'newuser@example.com' } });
    });
    
    it('should handle password reset flow', async () => {
      const ctx = createTestContext();
      const caller = appRouter.createCaller(ctx);
      
      // Request password reset
      const resetResult = await caller.auth.requestPasswordReset({
        email: 'integration-test@example.com'
      });
      
      expect(resetResult).toHaveProperty('message');
      expect(resetResult.success).toBe(true);
      
      // In real scenario, user would receive email with token
      // For testing, we'll verify the token was created
      const verificationToken = await prisma.verificationToken.findFirst({
        where: { identifier: 'integration-test@example.com' }
      });
      expect(verificationToken).toBeTruthy();
      
      // Cleanup
      if (verificationToken) {
        await prisma.verificationToken.delete({ where: { id: verificationToken.id } });
      }
    });
  });

  describe('Favorites and Search Presets', () => {
    beforeEach(async () => {
      // Create test apartments
      await prisma.apartment.createMany({
        data: [
          {
            id: 'apt-1',
            name: 'Test Apartment 1',
            price: 80000,
            layout: '1K',
            size: 25,
            stationId: 'station-1',
            buildingAge: 5,
            floor: 3,
            url: 'https://example.com/apt1',
            source: 'test',
            location: { lat: 35.6762, lng: 139.6503 }
          },
          {
            id: 'apt-2',
            name: 'Test Apartment 2',
            price: 120000,
            layout: '1LDK',
            size: 40,
            stationId: 'station-2',
            buildingAge: 2,
            floor: 5,
            url: 'https://example.com/apt2',
            source: 'test',
            location: { lat: 35.6762, lng: 139.6503 }
          }
        ]
      });
    });
    
    it('should manage user lists (favorites)', async () => {
      const ctx = createTestContext(createTestSession(testUserId));
      const caller = appRouter.createCaller(ctx);
      
      // Create a list
      const list = await caller.list.create({
        name: 'My Favorites',
        description: 'Apartments I like',
        isPublic: false
      });
      
      expect(list).toHaveProperty('id');
      expect(list.name).toBe('My Favorites');
      
      // Add apartments to list
      await caller.list.addApartment({
        listId: list.id,
        apartmentId: 'apt-1'
      });
      
      await caller.list.addApartment({
        listId: list.id,
        apartmentId: 'apt-2'
      });
      
      // Get list with apartments
      const listWithApartments = await caller.list.getWithApartments({
        listId: list.id
      });
      
      expect(listWithApartments.apartments).toHaveLength(2);
      expect(listWithApartments.apartments[0]).toHaveProperty('name');
      expect(listWithApartments.apartments[0]).toHaveProperty('price');
      
      // Remove apartment
      await caller.list.removeApartment({
        listId: list.id,
        apartmentId: 'apt-1'
      });
      
      // Verify removal
      const updatedList = await caller.list.getWithApartments({
        listId: list.id
      });
      expect(updatedList.apartments).toHaveLength(1);
      expect(updatedList.apartments[0]!.id).toBe('apt-2');
      
      // Cleanup
      await caller.list.delete({ listId: list.id });
    });
    
    it('should save and retrieve search presets', async () => {
      const ctx = createTestContext(createTestSession(testUserId));
      const caller = appRouter.createCaller(ctx);
      
      // Save search preset
      const preset = await caller.search.savePreset({
        name: 'Near Work',
        filters: {
          workplace: { stationId: 'station-1' },
          commuteTime: { max: 30 },
          priceRange: { min: 60000, max: 120000 },
          layout: ['1K', '1DK'],
          minSize: 25
        }
      });
      
      expect(preset).toHaveProperty('id');
      expect(preset.name).toBe('Near Work');
      
      // Get user presets
      const presets = await caller.search.getUserPresets();
      expect(presets).toHaveLength(1);
      expect(presets[0]!.name).toBe('Near Work');
      
      // Use preset for search
      const searchResult = await caller.search.apartmentsWithPreset({
        presetId: preset.id
      });
      
      expect(searchResult).toHaveProperty('apartments');
      expect(searchResult).toHaveProperty('filters');
      expect(searchResult.filters.commuteTime?.max).toBe(30);
      
      // Delete preset
      await caller.search.deletePreset({ presetId: preset.id });
      
      // Verify deletion
      const updatedPresets = await caller.search.getUserPresets();
      expect(updatedPresets).toHaveLength(0);
    });
  });

  describe('Admin Operations', () => {
    let adminUserId: string;
    
    beforeAll(async () => {
      // Create admin user
      const adminUser = await prisma.user.create({
        data: {
          email: 'admin-test@example.com',
          name: 'Admin Test User',
          role: 'ADMIN'
        }
      });
      adminUserId = adminUser.id;
    });
    
    afterAll(async () => {
      await prisma.user.delete({ where: { id: adminUserId } });
    });
    
    it('should allow admin to manage scrapers', async () => {
      const ctx = createTestContext(createTestSession(adminUserId));
      const caller = appRouter.createCaller(ctx);
      
      // Get scraper status
      const scrapers = await caller.admin.getScrapers();
      expect(scrapers).toHaveProperty('scrapers');
      expect(scrapers.scrapers.length).toBeGreaterThan(0);
      
      const scraper = scrapers.scrapers[0]!;
      expect(scraper).toHaveProperty('name');
      expect(scraper).toHaveProperty('enabled');
      expect(scraper).toHaveProperty('lastRun');
      expect(scraper).toHaveProperty('status');
      
      // Test scraper (dry run)
      const testResult = await caller.admin.testScraper({
        scraperName: scraper.name,
        dryRun: true
      });
      
      expect(testResult).toHaveProperty('success');
      expect(testResult).toHaveProperty('results');
      expect(testResult).toHaveProperty('errors');
    });
    
    it('should provide system statistics', async () => {
      const ctx = createTestContext(createTestSession(adminUserId));
      const caller = appRouter.createCaller(ctx);
      
      // Get dashboard stats
      const stats = await caller.admin.getDashboardStats();
      
      expect(stats).toHaveProperty('totalUsers');
      expect(stats).toHaveProperty('totalApartments');
      expect(stats).toHaveProperty('totalSearches');
      expect(stats).toHaveProperty('activeListings');
      expect(stats).toHaveProperty('recentActivity');
      
      expect(stats.totalUsers).toBeGreaterThanOrEqual(2); // At least our test users
      expect(stats.totalApartments).toBeGreaterThanOrEqual(0);
    });
    
    it('should deny admin operations to regular users', async () => {
      const ctx = createTestContext(createTestSession(testUserId));
      const caller = appRouter.createCaller(ctx);
      
      // Should throw unauthorized error
      await expect(
        caller.admin.getDashboardStats()
      ).rejects.toThrow('UNAUTHORIZED');
      
      await expect(
        caller.admin.getScrapers()
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });
});