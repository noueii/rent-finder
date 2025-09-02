import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  createTestPrismaClient,
  clearDatabase,
  createTestTRPCClient,
  testAPIEndpoint,
  makeAuthenticatedRequest,
} from '~/infrastructure/testing/integration';
import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '~/lib/auth/password';

// Setup test environment
setupTestEnvironment();

describe('E2E: User Registration Flow', () => {
  let prisma: PrismaClient;
  let trpc: ReturnType<typeof createTestTRPCClient>;
  const testBaseUrl = 'http://localhost:3000';

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    trpc = createTestTRPCClient(testBaseUrl);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
  });

  describe('Complete Registration Journey', () => {
    it('should complete full registration → email verification → preference setup → first search flow', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        name: 'Test User',
      };

      // Step 1: Register new user
      console.log('Step 1: Registering new user...');
      const registration = await trpc.auth.register.mutate({
        email: userData.email,
        password: userData.password,
        name: userData.name,
      });

      expect(registration.user).toBeDefined();
      expect(registration.user.email).toBe(userData.email);
      expect(registration.user.emailVerified).toBe(false);
      expect(registration.message).toContain('verification');

      // Verify user was created in database
      const dbUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(dbUser).toBeDefined();
      expect(dbUser?.emailVerified).toBeNull();

      // Step 2: Simulate email verification
      console.log('Step 2: Verifying email...');
      
      // Get verification token from database
      const verificationToken = await prisma.verificationToken.findFirst({
        where: { identifier: userData.email },
        orderBy: { expires: 'desc' },
      });
      expect(verificationToken).toBeDefined();

      // Verify email using token
      const verificationResult = await trpc.auth.verifyEmail.mutate({
        token: verificationToken!.token,
      });

      expect(verificationResult.success).toBe(true);
      expect(verificationResult.message).toContain('verified');

      // Verify user is now verified
      const verifiedUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(verifiedUser?.emailVerified).toBeTruthy();

      // Step 3: Sign in with verified account
      console.log('Step 3: Signing in...');
      const signInResult = await testAPIEndpoint(
        'POST',
        '/api/auth/callback/credentials',
        {
          email: userData.email,
          password: userData.password,
          csrfToken: 'test-csrf-token', // In real E2E, this would come from the form
        }
      );

      // Note: In a real E2E test with a running server, we'd get a session cookie here
      // For this test, we'll create a mock session
      const mockSession = {
        user: {
          id: dbUser!.id,
          email: userData.email,
          name: userData.name,
          role: 'USER',
          emailVerified: new Date(),
        },
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Step 4: Set user preferences
      console.log('Step 4: Setting user preferences...');
      const preferences = await trpc.users.updatePreferences.mutate({
        maxCommuteTime: 45,
        maxRent: 120000,
        minSize: 25,
        preferredAreas: ['Shibuya', 'Shinjuku', 'Meguro'],
        amenities: ['Air Conditioning', 'Auto Lock', 'Separate Bath/Toilet'],
      });

      expect(preferences.maxCommuteTime).toBe(45);
      expect(preferences.preferredAreas).toHaveLength(3);

      // Step 5: Perform first search
      console.log('Step 5: Performing first search...');
      
      // First, create some test data
      const tokyoStation = await prisma.station.create({
        data: {
          name: 'Tokyo Station',
          nameJa: '東京駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      });

      const shibuyaStation = await prisma.station.create({
        data: {
          name: 'Shibuya Station',
          nameJa: '渋谷駅',
          line: 'JR Yamanote Line',
          prefecture: 'Tokyo',
        },
      });

      // Create test apartments
      const apartment1 = await prisma.apartment.create({
        data: {
          title: 'Modern 1K in Shibuya',
          rent: 95000,
          size: 28,
          rooms: '1K',
          age: 5,
          floor: 3,
          address: 'Shibuya-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: shibuyaStation.id } },
              walkingTime: 8,
              distance: 650,
            }],
          },
        },
      });

      const apartment2 = await prisma.apartment.create({
        data: {
          title: 'Cozy Studio near Tokyo Station',
          rent: 110000,
          size: 25,
          rooms: '1R',
          age: 3,
          floor: 5,
          address: 'Chiyoda-ku, Tokyo',
          nearbyStations: {
            create: [{
              station: { connect: { id: tokyoStation.id } },
              walkingTime: 10,
              distance: 800,
            }],
          },
        },
      });

      // Search based on preferences
      const searchResults = await trpc.apartments.searchByCommute.query({
        workStationId: tokyoStation.id,
        maxCommuteTime: preferences.maxCommuteTime,
        filters: {
          maxRent: preferences.maxRent,
          minSize: preferences.minSize,
        },
      });

      expect(searchResults.apartments).toBeDefined();
      expect(searchResults.apartments.length).toBeGreaterThan(0);
      expect(searchResults.searchId).toBeDefined();

      // Step 6: View apartment details from search
      console.log('Step 6: Viewing apartment details...');
      const firstResult = searchResults.apartments[0];
      const apartmentDetails = await trpc.apartments.getById.query({
        id: firstResult.id,
      });

      expect(apartmentDetails).toBeDefined();
      expect(apartmentDetails.nearbyStations).toBeDefined();
      expect(apartmentDetails.nearbyStations.length).toBeGreaterThan(0);

      // Step 7: Save apartment to favorites
      console.log('Step 7: Saving to favorites...');
      const favorite = await trpc.users.addFavorite.mutate({
        apartmentId: apartmentDetails.id,
      });

      expect(favorite).toBeDefined();
      expect(favorite.userId).toBe(dbUser!.id);
      expect(favorite.apartmentId).toBe(apartmentDetails.id);

      // Step 8: Create first saved search
      console.log('Step 8: Creating saved search...');
      const savedSearch = await trpc.users.createSearchPreset.mutate({
        name: 'My Daily Commute',
        filters: {
          workStationId: tokyoStation.id,
          maxCommuteTime: preferences.maxCommuteTime,
          maxRent: preferences.maxRent,
          minSize: preferences.minSize,
        },
      });

      expect(savedSearch).toBeDefined();
      expect(savedSearch.name).toBe('My Daily Commute');

      // Verify complete user state
      console.log('Verifying complete user state...');
      const finalUserState = await prisma.user.findUnique({
        where: { id: dbUser!.id },
        include: {
          preferences: true,
          favorites: true,
          searchPresets: true,
          searchHistory: true,
        },
      });

      expect(finalUserState).toBeDefined();
      expect(finalUserState!.emailVerified).toBeTruthy();
      expect(finalUserState!.preferences).toBeDefined();
      expect(finalUserState!.favorites).toHaveLength(1);
      expect(finalUserState!.searchPresets).toHaveLength(1);
      expect(finalUserState!.searchHistory).toHaveLength(1);

      console.log('✅ User registration flow completed successfully!');
    });

    it('should handle registration errors gracefully', async () => {
      // Test duplicate email
      const existingUser = await prisma.user.create({
        data: {
          email: 'existing@example.com',
          name: 'Existing User',
          password: await hashPassword('password123'),
        },
      });

      await expect(
        trpc.auth.register.mutate({
          email: 'existing@example.com',
          password: 'NewPassword123!',
          name: 'Another User',
        })
      ).rejects.toThrow(/already exists/i);

      // Test invalid email
      await expect(
        trpc.auth.register.mutate({
          email: 'invalid-email',
          password: 'ValidPassword123!',
          name: 'Test User',
        })
      ).rejects.toThrow(/invalid.*email/i);

      // Test weak password
      await expect(
        trpc.auth.register.mutate({
          email: 'newuser@example.com',
          password: '123',
          name: 'Test User',
        })
      ).rejects.toThrow(/password/i);
    });

    it('should enforce email verification before allowing certain actions', async () => {
      // Create unverified user
      const unverifiedUser = await prisma.user.create({
        data: {
          email: 'unverified@example.com',
          name: 'Unverified User',
          password: await hashPassword('password123'),
          emailVerified: null,
        },
      });

      // Try to perform actions that require verification
      await expect(
        trpc.users.updatePreferences.mutate({
          maxCommuteTime: 30,
          maxRent: 100000,
        })
      ).rejects.toThrow(/verif/i);

      await expect(
        trpc.users.addFavorite.mutate({
          apartmentId: 'some-apartment-id',
        })
      ).rejects.toThrow(/verif/i);
    });
  });

  describe('Email Verification Edge Cases', () => {
    it('should handle expired verification tokens', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'expiredtoken@example.com',
          name: 'Test User',
          password: await hashPassword('password123'),
        },
      });

      // Create expired token
      const expiredToken = await prisma.verificationToken.create({
        data: {
          identifier: user.email,
          token: 'expired-token-123',
          expires: new Date(Date.now() - 1000), // Already expired
        },
      });

      await expect(
        trpc.auth.verifyEmail.mutate({
          token: expiredToken.token,
        })
      ).rejects.toThrow(/expired/i);
    });

    it('should handle invalid verification tokens', async () => {
      await expect(
        trpc.auth.verifyEmail.mutate({
          token: 'invalid-token-that-does-not-exist',
        })
      ).rejects.toThrow(/invalid.*token/i);
    });

    it('should allow resending verification emails', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'resend@example.com',
          name: 'Test User',
          password: await hashPassword('password123'),
        },
      });

      const result = await trpc.auth.resendVerificationEmail.mutate({
        email: user.email,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('sent');

      // Check new token was created
      const tokens = await prisma.verificationToken.findMany({
        where: { identifier: user.email },
        orderBy: { expires: 'desc' },
      });

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].expires.getTime()).toBeGreaterThan(Date.now());
    });
  });
});