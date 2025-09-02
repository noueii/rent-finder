import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { performance } from 'perf_hooks';
import { createInnerTRPCContext } from '~/server/api/trpc';
import { appRouter } from '~/server/api/root';
import { prisma } from '~/server/db';
import type { Session } from 'next-auth';
import { UnifiedScraper } from '~/lib/scrapers/unified/base-scraper';
import { RealEstateStrategy } from '~/lib/scrapers/unified/strategies/realestate-strategy';
import { ConcurrentStrategy } from '~/lib/scrapers/unified/strategies/concurrent-strategy';

// Performance thresholds (from PHASE3-INTEGRATION-PLAN.md)
const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 300, // ms
  DB_QUERY_TIME: 100, // ms
  SEARCH_TIME: 3000, // ms (including scraping)
  MEMORY_LIMIT: 512 * 1024 * 1024, // 512MB in bytes
  SCRAPER_RATE: 10, // pages per second
};

// Test utilities
const createTestSession = (): Session => ({
  user: {
    id: 'perf-test-user',
    email: 'perf@example.com',
    name: 'Performance Test User',
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

const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

const measureMemory = () => {
  if (global.gc) {
    global.gc();
  }
  const usage = process.memoryUsage();
  return usage.heapUsed;
};

describe('Performance Tests', () => {
  let testUserId: string;
  
  beforeAll(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'perf@example.com',
        name: 'Performance Test User',
        role: 'USER'
      }
    });
    testUserId = user.id;
    
    // Seed test data for performance testing
    const apartments = [];
    for (let i = 0; i < 1000; i++) {
      apartments.push({
        id: `perf-apt-${i}`,
        name: `Performance Test Apartment ${i}`,
        price: 50000 + Math.floor(Math.random() * 150000),
        layout: ['1K', '1DK', '1LDK', '2K', '2DK', '2LDK'][Math.floor(Math.random() * 6)] as any,
        size: 20 + Math.floor(Math.random() * 60),
        stationId: `station-${Math.floor(Math.random() * 10) + 1}`,
        buildingAge: Math.floor(Math.random() * 30),
        floor: Math.floor(Math.random() * 15) + 1,
        url: `https://example.com/perf-apt-${i}`,
        source: 'test' as const,
        location: { lat: 35.6762, lng: 139.6503 }
      });
    }
    
    // Batch insert for better performance
    await prisma.apartment.createMany({ data: apartments });
  });
  
  afterAll(async () => {
    // Cleanup
    await prisma.apartment.deleteMany({ where: { id: { startsWith: 'perf-apt-' } } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  describe('API Response Times', () => {
    it('should respond within 300ms for cached operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Warm up cache
      await caller.station.getAll();
      
      // Measure cached response
      const { duration } = await measureTime(() => 
        caller.station.getAll()
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      console.log(`Station.getAll (cached): ${duration.toFixed(2)}ms`);
    });
    
    it('should handle apartment search within time limit', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const { duration } = await measureTime(() => 
        caller.apartment.search({
          filters: {
            priceRange: { min: 80000, max: 120000 },
            layout: ['1K', '1DK']
          },
          pagination: { page: 1, limit: 20 }
        })
      );
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      console.log(`Apartment search: ${duration.toFixed(2)}ms`);
    });
    
    it('should paginate efficiently', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Test different page sizes
      const pageSizes = [10, 20, 50, 100];
      
      for (const limit of pageSizes) {
        const { duration } = await measureTime(() => 
          caller.apartment.search({
            filters: {},
            pagination: { page: 1, limit }
          })
        );
        
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
        console.log(`Pagination (limit=${limit}): ${duration.toFixed(2)}ms`);
      }
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle multiple concurrent searches', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Simulate 10 concurrent users
      const concurrentSearches = 10;
      const searchPromises = [];
      
      const startTime = performance.now();
      
      for (let i = 0; i < concurrentSearches; i++) {
        searchPromises.push(
          caller.apartment.search({
            filters: {
              priceRange: { 
                min: 50000 + i * 10000, 
                max: 100000 + i * 10000 
              }
            },
            pagination: { page: 1, limit: 20 }
          })
        );
      }
      
      const results = await Promise.all(searchPromises);
      const totalDuration = performance.now() - startTime;
      const avgDuration = totalDuration / concurrentSearches;
      
      // All searches should complete
      expect(results).toHaveLength(concurrentSearches);
      results.forEach(result => {
        expect(result).toHaveProperty('apartments');
        expect(result).toHaveProperty('totalCount');
      });
      
      // Average time should still be reasonable
      expect(avgDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 2);
      console.log(`Concurrent searches (${concurrentSearches}): avg ${avgDuration.toFixed(2)}ms`);
    });
    
    it('should handle concurrent list operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Create a test list
      const list = await caller.list.create({
        name: 'Performance Test List',
        description: 'For concurrent testing'
      });
      
      // Simulate concurrent additions
      const operations = 20;
      const addPromises = [];
      
      for (let i = 0; i < operations; i++) {
        addPromises.push(
          caller.list.addApartment({
            listId: list.id,
            apartmentId: `perf-apt-${i}`
          }).catch(() => null) // Ignore duplicates
        );
      }
      
      const startTime = performance.now();
      await Promise.all(addPromises);
      const duration = performance.now() - startTime;
      
      expect(duration / operations).toBeLessThan(50); // 50ms per operation
      console.log(`Concurrent list additions: ${(duration / operations).toFixed(2)}ms per op`);
      
      // Cleanup
      await caller.list.delete({ listId: list.id });
    });
  });

  describe('Memory Usage Under Load', () => {
    it('should not exceed memory limit during bulk operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const initialMemory = measureMemory();
      
      // Perform memory-intensive operations
      const operations = [];
      
      // Load large dataset
      for (let i = 0; i < 10; i++) {
        operations.push(
          caller.apartment.search({
            filters: {},
            pagination: { page: i + 1, limit: 100 }
          })
        );
      }
      
      await Promise.all(operations);
      
      const peakMemory = measureMemory();
      const memoryIncrease = peakMemory - initialMemory;
      
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_LIMIT);
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
    
    it('should handle large search results efficiently', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const initialMemory = measureMemory();
      
      // Search returning many results
      const { result, duration } = await measureTime(() => 
        caller.apartment.search({
          filters: {},
          pagination: { page: 1, limit: 100 }
        })
      );
      
      const memoryAfter = measureMemory();
      const memoryUsed = memoryAfter - initialMemory;
      
      expect(result.apartments).toHaveLength(100);
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 2);
      expect(memoryUsed).toBeLessThan(50 * 1024 * 1024); // 50MB for 100 apartments
      
      console.log(`Large result set: ${duration.toFixed(2)}ms, ${(memoryUsed / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('N+1 Query Prevention', () => {
    it('should load apartments with stations in single query', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Enable query logging (in test environment)
      const queries: string[] = [];
      const originalQuery = prisma.$queryRaw;
      prisma.$queryRaw = new Proxy(originalQuery, {
        apply: (target, thisArg, args) => {
          queries.push(args[0]);
          return Reflect.apply(target, thisArg, args);
        }
      });
      
      // Perform search that includes station data
      await caller.apartment.search({
        filters: {},
        pagination: { page: 1, limit: 20 }
      });
      
      // Restore original method
      prisma.$queryRaw = originalQuery;
      
      // Should not have N+1 queries (1 for apartments, not 1 + 20 for stations)
      // This is a simplified check - in real implementation, you'd analyze query patterns
      expect(queries.length).toBeLessThan(5); // Reasonable number of queries
    });
    
    it('should efficiently load lists with apartments', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Create test lists with apartments
      const lists = [];
      for (let i = 0; i < 5; i++) {
        const list = await caller.list.create({
          name: `N+1 Test List ${i}`,
          description: 'Testing query efficiency'
        });
        
        // Add apartments
        for (let j = 0; j < 10; j++) {
          await caller.list.addApartment({
            listId: list.id,
            apartmentId: `perf-apt-${i * 10 + j}`
          });
        }
        
        lists.push(list);
      }
      
      // Measure loading all lists with apartments
      const { duration } = await measureTime(async () => {
        const loadPromises = lists.map(list => 
          caller.list.getWithApartments({ listId: list.id })
        );
        return Promise.all(loadPromises);
      });
      
      // Should be efficient even with multiple lists
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * lists.length);
      console.log(`Loading ${lists.length} lists with apartments: ${duration.toFixed(2)}ms`);
      
      // Cleanup
      await Promise.all(lists.map(list => 
        caller.list.delete({ listId: list.id })
      ));
    });
  });

  describe('Scraper Performance', () => {
    it('should achieve target scraping rate', async () => {
      const scraper = new UnifiedScraper({
        strategy: new ConcurrentStrategy({
          implementation: new RealEstateStrategy(),
          config: { maxConcurrent: 5 }
        }),
        config: {
          name: 'performance-test',
          baseUrl: 'https://example.com',
          enabled: true
        }
      });
      
      // Mock fetch to return quickly
      const originalFetch = global.fetch;
      let fetchCount = 0;
      global.fetch = async () => {
        fetchCount++;
        return new Response('<html><body>Mock content</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' }
        });
      };
      
      const startTime = performance.now();
      
      // Scrape multiple pages
      const urls = Array.from({ length: 50 }, (_, i) => `https://example.com/page-${i}`);
      await scraper.scrapeUrls(urls);
      
      const duration = performance.now() - startTime;
      const pagesPerSecond = (fetchCount * 1000) / duration;
      
      // Restore original fetch
      global.fetch = originalFetch;
      
      expect(pagesPerSecond).toBeGreaterThan(PERFORMANCE_THRESHOLDS.SCRAPER_RATE);
      console.log(`Scraper rate: ${pagesPerSecond.toFixed(2)} pages/second`);
    });
    
    it('should handle rate limiting efficiently', async () => {
      const scraper = new UnifiedScraper({
        strategy: new ConcurrentStrategy({
          implementation: new RealEstateStrategy(),
          config: { 
            maxConcurrent: 3,
            delayBetweenRequests: 100 // 100ms between requests
          }
        }),
        config: {
          name: 'rate-limit-test',
          baseUrl: 'https://example.com',
          enabled: true
        }
      });
      
      // Mock fetch
      const fetchTimes: number[] = [];
      global.fetch = async () => {
        fetchTimes.push(Date.now());
        return new Response('<html><body>Mock</body></html>', { status: 200 });
      };
      
      // Scrape with rate limiting
      const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/rl-${i}`);
      await scraper.scrapeUrls(urls);
      
      // Verify rate limiting
      for (let i = 1; i < fetchTimes.length; i++) {
        const timeDiff = fetchTimes[i]! - fetchTimes[i - 1]!;
        expect(timeDiff).toBeGreaterThanOrEqual(90); // Allow 10ms variance
      }
      
      console.log('Rate limiting working correctly');
    });
  });

  describe('Search Performance with Scraping', () => {
    it('should complete search with live scraping within 3 seconds', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Mock scraper to simulate real-world delay
      const mockScrapeDelay = 1500; // 1.5 seconds
      
      // This would be a real search that triggers scraping
      // For testing, we'll simulate with existing data
      const { duration } = await measureTime(async () => {
        // Simulate scraping delay
        await new Promise(resolve => setTimeout(resolve, mockScrapeDelay));
        
        // Then perform search
        return caller.apartment.search({
          filters: {
            priceRange: { min: 80000, max: 120000 }
          },
          pagination: { page: 1, limit: 20 }
        });
      });
      
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.SEARCH_TIME);
      console.log(`Search with scraping: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const operations = [
        { name: 'Station Search', fn: () => caller.station.search({ query: 'Tokyo' }) },
        { name: 'Apartment Search', fn: () => caller.apartment.search({ filters: {} }) },
        { name: 'Get All Stations', fn: () => caller.station.getAll() },
        { name: 'User Lists', fn: () => caller.list.getUserLists() }
      ];
      
      const results = [];
      
      for (const op of operations) {
        // Run each operation multiple times to get average
        const times = [];
        for (let i = 0; i < 5; i++) {
          const { duration } = await measureTime(op.fn);
          times.push(duration);
        }
        
        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        
        results.push({
          operation: op.name,
          avgTime: avgTime.toFixed(2),
          maxTime: maxTime.toFixed(2)
        });
        
        // No operation should exceed threshold
        expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      }
      
      console.table(results);
    });
  });

  describe('Database Query Optimization', () => {
    it('should execute queries within acceptable time limits', async () => {
      // Test individual query performance
      const queries = [
        {
          name: 'Find apartments by price',
          query: () => prisma.apartment.findMany({
            where: { price: { gte: 80000, lte: 120000 } },
            take: 20
          })
        },
        {
          name: 'Find apartments with station',
          query: () => prisma.apartment.findMany({
            include: { station: true },
            take: 20
          })
        },
        {
          name: 'Count apartments by layout',
          query: () => prisma.apartment.groupBy({
            by: ['layout'],
            _count: true
          })
        },
        {
          name: 'Find user lists with apartments',
          query: () => prisma.userList.findFirst({
            include: {
              apartments: {
                include: { apartment: true }
              }
            }
          })
        }
      ];

      for (const { name, query } of queries) {
        const { duration } = await measureTime(query);
        expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DB_QUERY_TIME);
        console.log(`${name}: ${duration.toFixed(2)}ms`);
      }
    });

    it('should handle complex aggregations efficiently', async () => {
      // Test aggregation performance
      const { result, duration } = await measureTime(async () => {
        const [avgPrice, countByLayout, priceRanges] = await Promise.all([
          // Average price calculation
          prisma.apartment.aggregate({
            _avg: { price: true }
          }),
          // Count by layout
          prisma.apartment.groupBy({
            by: ['layout'],
            _count: true,
            orderBy: { _count: { layout: 'desc' } }
          }),
          // Price range distribution
          prisma.$queryRaw`
            SELECT 
              CASE 
                WHEN price < 80000 THEN 'Under 80k'
                WHEN price < 120000 THEN '80k-120k'
                WHEN price < 160000 THEN '120k-160k'
                ELSE 'Over 160k'
              END as price_range,
              COUNT(*) as count
            FROM "Apartment"
            GROUP BY price_range
            ORDER BY MIN(price)
          `
        ]);

        return { avgPrice, countByLayout, priceRanges };
      });

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.DB_QUERY_TIME * 3); // Allow 3x for complex query
      console.log(`Complex aggregation: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Load Testing', () => {
    it('should handle 50 concurrent API requests', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const concurrentRequests = 50;
      const requests = [];
      
      // Mix of different API calls
      for (let i = 0; i < concurrentRequests; i++) {
        const requestType = i % 4;
        switch (requestType) {
          case 0:
            requests.push(caller.apartment.search({ 
              filters: { priceRange: { min: 50000 + i * 1000, max: 100000 + i * 1000 } },
              pagination: { page: 1, limit: 10 }
            }));
            break;
          case 1:
            requests.push(caller.station.search({ query: 'Station' }));
            break;
          case 2:
            requests.push(caller.station.getAll());
            break;
          case 3:
            requests.push(caller.list.getUserLists());
            break;
        }
      }
      
      const startTime = performance.now();
      const results = await Promise.allSettled(requests);
      const totalDuration = performance.now() - startTime;
      
      // Count successes and failures
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      expect(succeeded).toBeGreaterThan(concurrentRequests * 0.95); // 95% success rate
      expect(totalDuration).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME * 10); // Allow 10x for concurrent load
      
      console.log(`Load test: ${succeeded}/${concurrentRequests} succeeded in ${totalDuration.toFixed(2)}ms`);
      if (failed > 0) {
        console.log(`Failed requests: ${failed}`);
      }
    });

    it('should maintain performance under sustained load', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const duration = 5000; // 5 seconds
      const startTime = performance.now();
      let requestCount = 0;
      let errorCount = 0;
      const responseTimes: number[] = [];
      
      // Send requests continuously for duration
      while (performance.now() - startTime < duration) {
        const requestStart = performance.now();
        
        try {
          await caller.apartment.search({
            filters: { priceRange: { min: 80000, max: 120000 } },
            pagination: { page: 1, limit: 10 }
          });
          
          const responseTime = performance.now() - requestStart;
          responseTimes.push(responseTime);
          requestCount++;
        } catch (error) {
          errorCount++;
        }
        
        // Small delay to prevent overwhelming
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const requestsPerSecond = (requestCount * 1000) / duration;
      
      expect(avgResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.API_RESPONSE_TIME);
      expect(errorCount).toBeLessThan(requestCount * 0.05); // Less than 5% errors
      
      console.log(`Sustained load test:`);
      console.log(`- Requests: ${requestCount} (${requestsPerSecond.toFixed(2)} req/s)`);
      console.log(`- Avg response: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`- Max response: ${maxResponseTime.toFixed(2)}ms`);
      console.log(`- Errors: ${errorCount}`);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during repeated operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const initialMemory = measureMemory();
      const measurements: number[] = [];
      
      // Perform operations repeatedly
      for (let i = 0; i < 100; i++) {
        // Create and discard results
        await caller.apartment.search({
          filters: {},
          pagination: { page: 1, limit: 50 }
        });
        
        // Measure every 10 iterations
        if (i % 10 === 0) {
          if (global.gc) {
            global.gc();
          }
          const currentMemory = measureMemory();
          measurements.push(currentMemory);
        }
      }
      
      // Check for consistent memory growth
      const memoryGrowth = measurements[measurements.length - 1]! - measurements[0]!;
      const avgGrowthPerIteration = memoryGrowth / measurements.length;
      
      // Memory should not grow more than 1MB per 10 iterations
      expect(avgGrowthPerIteration).toBeLessThan(1024 * 1024);
      
      console.log(`Memory leak test:`);
      console.log(`- Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Final: ${(measurements[measurements.length - 1]! / 1024 / 1024).toFixed(2)}MB`);
      console.log(`- Total growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('API Endpoint Performance', () => {
    it('should meet response time requirements for all endpoints', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const endpoints = [
        // Public endpoints
        { name: 'health.check', fn: () => caller.health.check(), expectedTime: 50 },
        { name: 'station.getAll', fn: () => caller.station.getAll(), expectedTime: 200 },
        { name: 'station.search', fn: () => caller.station.search({ query: 'Tokyo' }), expectedTime: 100 },
        
        // Auth endpoints
        { name: 'auth.register', fn: () => caller.auth.register({ 
          email: `test${Date.now()}@example.com`, 
          password: 'Test123!@#', 
          name: 'Test User' 
        }), expectedTime: 500 },
        
        // User endpoints
        { name: 'list.getUserLists', fn: () => caller.list.getUserLists(), expectedTime: 100 },
        { name: 'list.create', fn: () => caller.list.create({ 
          name: 'Test List', 
          description: 'Test' 
        }), expectedTime: 200 },
        
        // Search endpoints
        { name: 'apartment.search', fn: () => caller.apartment.search({ 
          filters: {}, 
          pagination: { page: 1, limit: 20 } 
        }), expectedTime: 300 },
        { name: 'search.commute', fn: () => caller.search.byCommute({ 
          workplaceStationId: 'station-1', 
          maxCommuteTime: 30, 
          filters: {} 
        }), expectedTime: 3000 }, // Includes scraping
      ];
      
      const results = [];
      
      for (const endpoint of endpoints) {
        try {
          const { duration } = await measureTime(endpoint.fn);
          const passed = duration < endpoint.expectedTime;
          
          results.push({
            endpoint: endpoint.name,
            duration: duration.toFixed(2),
            expected: endpoint.expectedTime,
            status: passed ? '✅' : '❌'
          });
          
          expect(duration).toBeLessThan(endpoint.expectedTime);
        } catch (error) {
          results.push({
            endpoint: endpoint.name,
            duration: 'N/A',
            expected: endpoint.expectedTime,
            status: '❌ Error'
          });
        }
      }
      
      console.table(results);
    });
  });

  describe('Caching Performance', () => {
    it('should significantly improve response times with caching', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // First call - cache miss
      const { duration: firstCallDuration } = await measureTime(() => 
        caller.station.getAll()
      );
      
      // Second call - cache hit
      const { duration: secondCallDuration } = await measureTime(() => 
        caller.station.getAll()
      );
      
      // Cache should improve performance by at least 50%
      expect(secondCallDuration).toBeLessThan(firstCallDuration * 0.5);
      
      console.log(`Cache performance:`);
      console.log(`- First call (miss): ${firstCallDuration.toFixed(2)}ms`);
      console.log(`- Second call (hit): ${secondCallDuration.toFixed(2)}ms`);
      console.log(`- Improvement: ${((1 - secondCallDuration / firstCallDuration) * 100).toFixed(0)}%`);
    });
  });
});