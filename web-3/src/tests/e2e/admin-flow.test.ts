import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  setupTestEnvironment,
  createTestPrismaClient,
  clearDatabase,
  createTestTRPCClient,
  makeAuthenticatedRequest,
} from '~/infrastructure/testing/integration';
import type { PrismaClient } from '@prisma/client';
import { hashPassword } from '~/lib/auth/password';

// Setup test environment
setupTestEnvironment();

describe('E2E: Admin Flow', () => {
  let prisma: PrismaClient;
  let trpc: ReturnType<typeof createTestTRPCClient>;
  let adminUser: any;
  let regularUser: any;
  let adminSession: any;

  beforeAll(async () => {
    prisma = await createTestPrismaClient();
    trpc = createTestTRPCClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await clearDatabase(prisma);
    
    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@rentfinder.com',
        name: 'Admin User',
        password: await hashPassword('AdminPassword123!'),
        role: 'ADMIN',
        emailVerified: new Date(),
      },
    });

    // Create regular user
    regularUser = await prisma.user.create({
      data: {
        email: 'user@example.com',
        name: 'Regular User',
        password: await hashPassword('UserPassword123!'),
        role: 'USER',
        emailVerified: new Date(),
      },
    });

    // Create mock admin session
    adminSession = {
      user: {
        id: adminUser.id,
        email: adminUser.email,
        name: adminUser.name,
        role: 'ADMIN',
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  });

  describe('Complete Admin Management Flow', () => {
    it('should complete full admin login → scraper management → monitoring → export flow', async () => {
      // Step 1: Admin login
      console.log('Step 1: Admin login...');
      
      // In a real E2E test, this would be done through the UI
      // For now, we'll verify admin-only endpoints require proper role
      await expect(
        trpc.admin.getSystemStats.query()
      ).rejects.toThrow(/unauthorized|permission/i);

      // With admin session
      const adminTrpc = createTestTRPCClient('http://localhost:3000', adminSession);

      // Step 2: View system statistics
      console.log('Step 2: Viewing system statistics...');
      
      // Create some test data first
      const testStation = await prisma.station.create({
        data: {
          name: 'Test Station',
          nameJa: 'テスト駅',
          line: 'Test Line',
          prefecture: 'Tokyo',
        },
      });

      await Promise.all([
        prisma.apartment.create({
          data: {
            title: 'Test Apartment 1',
            rent: 100000,
            size: 30,
            rooms: '1LDK',
            age: 5,
            floor: 3,
            address: 'Test Address',
            source: 'wagaya',
            sourceId: 'wagaya-001',
            lastScraped: new Date(),
          },
        }),
        prisma.apartment.create({
          data: {
            title: 'Test Apartment 2',
            rent: 120000,
            size: 35,
            rooms: '2K',
            age: 3,
            floor: 5,
            address: 'Test Address 2',
            source: 'suumo',
            sourceId: 'suumo-001',
            lastScraped: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          },
        }),
      ]);

      const systemStats = await adminTrpc.admin.getSystemStats.query();

      expect(systemStats).toBeDefined();
      expect(systemStats.totalApartments).toBe(2);
      expect(systemStats.totalUsers).toBe(2);
      expect(systemStats.totalStations).toBe(1);
      expect(systemStats.apartmentsBySource).toBeDefined();
      expect(systemStats.apartmentsBySource.wagaya).toBe(1);
      expect(systemStats.apartmentsBySource.suumo).toBe(1);
      expect(systemStats.recentActivity).toBeDefined();

      // Step 3: Manage scrapers
      console.log('Step 3: Managing scrapers...');
      
      // Get scraper status
      const scraperStatus = await adminTrpc.admin.getScraperStatus.query();

      expect(scraperStatus).toBeDefined();
      expect(scraperStatus.scrapers).toBeDefined();
      expect(Array.isArray(scraperStatus.scrapers)).toBe(true);

      // Configure scraper
      await adminTrpc.admin.updateScraperConfig.mutate({
        scraperName: 'wagaya',
        config: {
          enabled: true,
          schedule: '0 2 * * *', // 2 AM daily
          maxConcurrency: 5,
          timeout: 30000,
          retryAttempts: 3,
        },
      });

      // Run scraper manually
      const scraperRun = await adminTrpc.admin.runScraper.mutate({
        scraperName: 'wagaya',
        options: {
          testMode: true,
          limit: 10,
        },
      });

      expect(scraperRun.jobId).toBeDefined();
      expect(scraperRun.status).toBe('queued');

      // Check scraper job status
      const jobStatus = await adminTrpc.admin.getScraperJob.query({
        jobId: scraperRun.jobId,
      });

      expect(jobStatus).toBeDefined();
      expect(jobStatus.status).toBeDefined();
      expect(['queued', 'running', 'completed', 'failed']).toContain(jobStatus.status);

      // Step 4: View scraper logs
      console.log('Step 4: Viewing scraper logs...');
      
      // Create test scraper logs
      await prisma.scraperLog.createMany({
        data: [
          {
            scraperName: 'wagaya',
            status: 'completed',
            startTime: new Date(Date.now() - 60000),
            endTime: new Date(Date.now() - 30000),
            itemsScraped: 25,
            itemsNew: 5,
            itemsUpdated: 20,
            errors: 0,
          },
          {
            scraperName: 'suumo',
            status: 'failed',
            startTime: new Date(Date.now() - 120000),
            endTime: new Date(Date.now() - 90000),
            itemsScraped: 10,
            itemsNew: 2,
            itemsUpdated: 8,
            errors: 3,
            errorDetails: ['Timeout error', 'Parse error on page 5'],
          },
        ],
      });

      const scraperLogs = await adminTrpc.admin.getScraperLogs.query({
        limit: 10,
        scraperName: 'all',
      });

      expect(scraperLogs.logs).toHaveLength(2);
      expect(scraperLogs.logs[0].status).toBeDefined();
      expect(scraperLogs.stats).toBeDefined();
      expect(scraperLogs.stats.totalRuns).toBe(2);
      expect(scraperLogs.stats.successRate).toBe(50);

      // Step 5: Monitor system health
      console.log('Step 5: Monitoring system health...');
      
      const healthCheck = await adminTrpc.admin.getHealthCheck.query();

      expect(healthCheck).toBeDefined();
      expect(healthCheck.status).toBe('healthy');
      expect(healthCheck.services).toBeDefined();
      expect(healthCheck.services.database).toBe('connected');
      expect(healthCheck.services.scrapers).toBeDefined();
      expect(healthCheck.metrics).toBeDefined();

      // Step 6: Manage stale data
      console.log('Step 6: Managing stale data...');
      
      // Find stale apartments
      const staleApartments = await adminTrpc.admin.getStaleApartments.query({
        daysOld: 7,
        limit: 50,
      });

      expect(staleApartments).toBeDefined();
      expect(staleApartments.apartments).toHaveLength(1); // The one from 7 days ago
      expect(staleApartments.total).toBe(1);

      // Clean up stale data
      const cleanup = await adminTrpc.admin.cleanupStaleData.mutate({
        daysOld: 30,
        dryRun: true, // Test mode
      });

      expect(cleanup).toBeDefined();
      expect(cleanup.apartmentsToRemove).toBeDefined();
      expect(cleanup.dryRun).toBe(true);

      // Step 7: Export data
      console.log('Step 7: Exporting data...');
      
      // Export apartments
      const apartmentExport = await adminTrpc.admin.exportData.query({
        type: 'apartments',
        format: 'csv',
        filters: {
          source: 'wagaya',
          dateRange: {
            from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            to: new Date(),
          },
        },
      });

      expect(apartmentExport).toBeDefined();
      expect(apartmentExport.data).toContain('Title,Rent,Size');
      expect(apartmentExport.filename).toContain('apartments');
      expect(apartmentExport.recordCount).toBeGreaterThan(0);

      // Export system report
      const systemReport = await adminTrpc.admin.generateReport.query({
        type: 'system_overview',
        period: 'last_30_days',
      });

      expect(systemReport).toBeDefined();
      expect(systemReport.summary).toBeDefined();
      expect(systemReport.charts).toBeDefined();

      console.log('✅ Admin flow completed successfully!');
    });

    it('should enforce admin permissions properly', async () => {
      // Regular user trying admin endpoints
      const userTrpc = createTestTRPCClient('http://localhost:3000', {
        user: regularUser,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });

      // All admin endpoints should reject
      await expect(userTrpc.admin.getSystemStats.query()).rejects.toThrow(/permission/i);
      await expect(userTrpc.admin.runScraper.mutate({ scraperName: 'wagaya' })).rejects.toThrow(/permission/i);
      await expect(userTrpc.admin.getScraperLogs.query()).rejects.toThrow(/permission/i);
      await expect(userTrpc.admin.cleanupStaleData.mutate({ daysOld: 30 })).rejects.toThrow(/permission/i);
    });

    it('should handle scraper error scenarios', async () => {
      const adminTrpc = createTestTRPCClient('http://localhost:3000', adminSession);

      // Test invalid scraper name
      await expect(
        adminTrpc.admin.runScraper.mutate({
          scraperName: 'invalid-scraper',
        })
      ).rejects.toThrow(/invalid.*scraper/i);

      // Test scraper timeout simulation
      const timeoutRun = await adminTrpc.admin.runScraper.mutate({
        scraperName: 'wagaya',
        options: {
          testMode: true,
          simulateTimeout: true,
        },
      });

      // Wait and check status
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const timeoutStatus = await adminTrpc.admin.getScraperJob.query({
        jobId: timeoutRun.jobId,
      });

      expect(['failed', 'timeout']).toContain(timeoutStatus.status);
    });

    it('should manage user accounts as admin', async () => {
      const adminTrpc = createTestTRPCClient('http://localhost:3000', adminSession);

      // List all users
      const users = await adminTrpc.admin.getUsers.query({
        page: 1,
        limit: 10,
      });

      expect(users.users).toHaveLength(2);
      expect(users.total).toBe(2);

      // Search users
      const searchResults = await adminTrpc.admin.searchUsers.query({
        query: 'admin',
      });

      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].email).toBe('admin@rentfinder.com');

      // Update user role
      await adminTrpc.admin.updateUserRole.mutate({
        userId: regularUser.id,
        role: 'MODERATOR',
      });

      const updatedUser = await prisma.user.findUnique({
        where: { id: regularUser.id },
      });

      expect(updatedUser?.role).toBe('MODERATOR');

      // Suspend user
      await adminTrpc.admin.suspendUser.mutate({
        userId: regularUser.id,
        reason: 'Test suspension',
        duration: 7, // 7 days
      });

      const suspendedUser = await prisma.user.findUnique({
        where: { id: regularUser.id },
      });

      expect(suspendedUser?.suspended).toBe(true);
      expect(suspendedUser?.suspendedUntil).toBeDefined();

      // View user activity
      const userActivity = await adminTrpc.admin.getUserActivity.query({
        userId: regularUser.id,
      });

      expect(userActivity).toBeDefined();
      expect(userActivity.searches).toBeDefined();
      expect(userActivity.favorites).toBeDefined();
      expect(userActivity.lists).toBeDefined();
    });
  });

  describe('Advanced Admin Features', () => {
    it('should handle batch operations', async () => {
      const adminTrpc = createTestTRPCClient('http://localhost:3000', adminSession);

      // Create test apartments
      const apartments = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          prisma.apartment.create({
            data: {
              title: `Batch Test ${i}`,
              rent: 100000,
              size: 30,
              rooms: '1K',
              age: 5,
              floor: 2,
              address: 'Test',
              source: 'wagaya',
              sourceId: `batch-${i}`,
              lastScraped: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000),
            },
          })
        )
      );

      // Batch update apartments
      const batchUpdate = await adminTrpc.admin.batchUpdateApartments.mutate({
        apartmentIds: apartments.slice(0, 10).map(a => a.id),
        updates: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      expect(batchUpdate.updated).toBe(10);

      // Batch delete old apartments
      const batchDelete = await adminTrpc.admin.batchDeleteApartments.mutate({
        criteria: {
          lastScrapedBefore: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          source: 'wagaya',
        },
        dryRun: false,
      });

      expect(batchDelete.deleted).toBeGreaterThan(0);
    });

    it('should provide analytics and insights', async () => {
      const adminTrpc = createTestTRPCClient('http://localhost:3000', adminSession);

      // Create diverse test data
      await Promise.all([
        ...Array.from({ length: 5 }, () =>
          prisma.user.create({
            data: {
              email: `user${Math.random()}@example.com`,
              name: 'Test User',
              emailVerified: new Date(),
              createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            },
          })
        ),
        ...Array.from({ length: 10 }, () =>
          prisma.searchHistory.create({
            data: {
              userId: adminUser.id,
              filters: { maxRent: 100000 },
              resultCount: Math.floor(Math.random() * 50),
              createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
            },
          })
        ),
      ]);

      // Get analytics dashboard
      const analytics = await adminTrpc.admin.getAnalytics.query({
        period: 'last_30_days',
      });

      expect(analytics).toBeDefined();
      expect(analytics.userGrowth).toBeDefined();
      expect(analytics.searchTrends).toBeDefined();
      expect(analytics.popularStations).toBeDefined();
      expect(analytics.scraperPerformance).toBeDefined();
      
      // Get specific insights
      const insights = await adminTrpc.admin.getInsights.query({
        type: 'user_behavior',
      });

      expect(insights).toBeDefined();
      expect(insights.averageSearchesPerUser).toBeDefined();
      expect(insights.peakSearchTimes).toBeDefined();
      expect(insights.conversionRate).toBeDefined();
    });

    it('should handle system maintenance tasks', async () => {
      const adminTrpc = createTestTRPCClient('http://localhost:3000', adminSession);

      // Schedule maintenance
      const maintenance = await adminTrpc.admin.scheduleMaintenance.mutate({
        type: 'database_optimization',
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
        estimatedDuration: 30, // minutes
        notifyUsers: true,
      });

      expect(maintenance.id).toBeDefined();
      expect(maintenance.status).toBe('scheduled');

      // Get maintenance windows
      const windows = await adminTrpc.admin.getMaintenanceWindows.query();

      expect(windows).toHaveLength(1);
      expect(windows[0].type).toBe('database_optimization');

      // Run diagnostic
      const diagnostic = await adminTrpc.admin.runDiagnostic.mutate({
        type: 'full_system_check',
      });

      expect(diagnostic).toBeDefined();
      expect(diagnostic.database).toBeDefined();
      expect(diagnostic.scrapers).toBeDefined();
      expect(diagnostic.performance).toBeDefined();
      expect(diagnostic.recommendations).toBeDefined();
    });
  });
});