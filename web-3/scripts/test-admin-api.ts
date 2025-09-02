#!/usr/bin/env tsx
/**
 * Test script for admin API endpoints
 * Run with: npm run tsx scripts/test-admin-api.ts
 */

import { appRouter } from '../src/server/api/root';
import { db } from '../src/server/db';
import { createTRPCContext } from '../src/server/api/trpc';

async function testAdminAPI() {
  console.log('Testing Admin API endpoints...\n');

  try {
    // Create a mock context with admin user
    const ctx = await createTRPCContext({
      headers: new Headers(),
    });
    
    // Override with admin session for testing
    const adminCtx = {
      ...ctx,
      session: {
        user: {
          id: 'test-admin-id',
          email: 'admin@tokyo-apartment-finder.com',
          name: 'Test Admin',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };

    // Create a caller with admin context
    const caller = appRouter.createCaller(adminCtx);

    // Test 1: Get admin stats
    console.log('1. Testing getStats...');
    const stats = await caller.admin.getStats();
    console.log('Stats:', {
      users: stats.users.total,
      apartments: stats.apartments.total,
      lists: stats.lists.active,
      searches: stats.searches.last24h,
      scraping: stats.scraping,
    });
    console.log('✅ getStats successful\n');

    // Test 2: Get scrapers
    console.log('2. Testing getScrapers...');
    const scrapers = await caller.admin.getScrapers();
    console.log('Registered scrapers:', scrapers.registered);
    console.log('Configured sources:', scrapers.configured.length);
    console.log('✅ getScrapers successful\n');

    // Test 3: Get jobs
    console.log('3. Testing getJobs...');
    const jobs = await caller.admin.getJobs({ limit: 10 });
    console.log('Total jobs:', jobs.length);
    if (jobs.length > 0) {
      console.log('Latest job:', {
        id: jobs[0].id,
        type: jobs[0].type,
        status: jobs[0].status,
      });
    }
    console.log('✅ getJobs successful\n');

    // Test 4: Get data overview
    console.log('4. Testing getDataOverview...');
    const dataOverview = await caller.admin.getDataOverview();
    console.log('Data overview:', {
      sources: dataOverview.bySource.map(s => ({ site: s.sourceSite, count: s._count.id })),
      availability: dataOverview.byAvailability.map(a => ({ status: a.availability, count: a._count.id })),
      issues: dataOverview.issues,
    });
    console.log('✅ getDataOverview successful\n');

    // Test 5: Get cache stats
    console.log('5. Testing getCacheStats...');
    const cacheStats = await caller.admin.getCacheStats();
    console.log('Cache stats:', cacheStats);
    console.log('✅ getCacheStats successful\n');

    // Test 6: Get system health
    console.log('6. Testing getSystemHealth...');
    const health = await caller.admin.getSystemHealth();
    console.log('System health:', health);
    console.log('✅ getSystemHealth successful\n');

    // Test 7: Get scraping history
    console.log('7. Testing getScrapingHistory...');
    const history = await caller.admin.getScrapingHistory({ days: 7 });
    console.log('Scraping history entries:', history.length);
    if (history.length > 0) {
      console.log('Latest entry:', history[0]);
    }
    console.log('✅ getScrapingHistory successful\n');

    // Test non-admin access
    console.log('8. Testing non-admin access (should fail)...');
    const nonAdminCtx = {
      ...ctx,
      session: {
        user: {
          id: 'test-user-id',
          email: 'user@example.com',
          name: 'Test User',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    
    const nonAdminCaller = appRouter.createCaller(nonAdminCtx);
    try {
      await nonAdminCaller.admin.getStats();
      console.log('❌ Non-admin access should have failed!');
    } catch (error: any) {
      console.log('✅ Non-admin access correctly rejected:', error.message);
    }

    console.log('\n✅ All admin API tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the tests
testAdminAPI().catch(console.error);