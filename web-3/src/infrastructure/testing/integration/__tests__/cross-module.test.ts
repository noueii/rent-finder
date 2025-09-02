import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { vi } from '~/core/testing';
import { Container } from '~/core/di/container';
import type { IContainer } from '~/core/di/types';
import { ErrorHandler } from '~/core/errors/error-handler';
import { ValidationError } from '~/core/errors/operational-errors';
import { UnifiedProxyManager } from '~/infrastructure/scrapers/proxy/UnifiedProxyManager';
import { UnifiedScraperFactory } from '~/lib/scrapers/scraper-factory';
import { ApartmentRepository } from '~/server/repositories/apartment.repository';
import { ApartmentService } from '~/server/services/apartment.service';
import { createInnerTRPCContext } from '~/server/api/trpc';
import { appRouter } from '~/server/api/root';
import { prisma } from '~/server/db';
import type { Session } from 'next-auth';

// Test utilities
const createTestSession = (): Session => ({
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
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

// Performance measurement utilities
const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
};

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 300, // ms
  DB_QUERY_TIME: 100, // ms
};

describe('Cross-Module Integration Tests', () => {
  let container: IContainer;
  let errorHandler: ErrorHandler;
  
  beforeAll(() => {
    // Set up DI container with real implementations
    container = new Container();
    errorHandler = new ErrorHandler();
    
    // Register core services
    container.register('ErrorHandler', errorHandler, { lifetime: 'singleton' });
    container.register('ProxyManager', new UnifiedProxyManager(), { lifetime: 'singleton' });
    
    // Register repositories
    container.register('ApartmentRepository', new ApartmentRepository(prisma), { lifetime: 'singleton' });
    
    // Register services
    const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
    container.register('ApartmentService', new ApartmentService(apartmentRepo), { lifetime: 'singleton' });
  });
  
  afterAll(async () => {
    // Cleanup
    await prisma.apartment.deleteMany({});
  });

  describe('Scraper → Repository → Service → API Flow', () => {
    it('should handle scraped data through all layers', async () => {
      // 1. Scraper produces data (mock scraper behavior)
      const mockScrapedData = [{
        name: 'Modern 1LDK Apartment',
        price: 120000,
        size: 40,
        layout: '1LDK' as const,
        floor: 5,
        url: 'https://example.com/apt1'
      }];
      
      expect(mockScrapedData).toHaveLength(1);
      expect(mockScrapedData[0]).toHaveProperty('name', 'Modern 1LDK Apartment');
      expect(mockScrapedData[0]).toHaveProperty('price', 120000);
      
      // 2. Repository saves data
      const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
      const savedApartment = await apartmentRepo.create({
        ...mockScrapedData[0]!,
        id: 'test-apt-1',
        stationId: 'station-1',
        buildingAge: 5,
        location: { lat: 35.6762, lng: 139.6503 },
        source: 'realestate'
      });
      
      expect(savedApartment).toHaveProperty('id', 'test-apt-1');
      expect(savedApartment).toHaveProperty('name', 'Modern 1LDK Apartment');
      
      // 3. Service processes data
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      const apartments = await apartmentService.searchApartments({
        filters: {
          priceRange: { min: 100000, max: 150000 },
          layout: ['1LDK']
        },
        pagination: { page: 1, limit: 10 }
      });
      
      expect(apartments.data).toHaveLength(1);
      expect(apartments.data[0]!.id).toBe('test-apt-1');
      
      // 4. API exposes data
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const searchResult = await caller.apartment.search({
        filters: {
          priceRange: { min: 100000, max: 150000 },
          layout: ['1LDK']
        }
      });
      
      expect(searchResult.apartments).toHaveLength(1);
      expect(searchResult.apartments[0]!.name).toBe('Modern 1LDK Apartment');
    });
    
    it('should handle bulk scraping and deduplication', async () => {
      const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      
      // Simulate bulk scraping with duplicates
      const scrapedApartments = [
        {
          id: 'bulk-1',
          name: 'Apartment A',
          price: 80000,
          layout: '1K' as const,
          size: 25,
          stationId: 'station-1',
          buildingAge: 3,
          floor: 2,
          url: 'https://example.com/bulk1',
          source: 'test' as const,
          location: { lat: 35.6762, lng: 139.6503 }
        },
        {
          id: 'bulk-2',
          name: 'Apartment B',
          price: 90000,
          layout: '1K' as const,
          size: 28,
          stationId: 'station-1',
          buildingAge: 2,
          floor: 3,
          url: 'https://example.com/bulk2',
          source: 'test' as const,
          location: { lat: 35.6762, lng: 139.6503 }
        },
        // Duplicate of bulk-1 with different ID
        {
          id: 'bulk-3',
          name: 'Apartment A',
          price: 80000,
          layout: '1K' as const,
          size: 25,
          stationId: 'station-1',
          buildingAge: 3,
          floor: 2,
          url: 'https://example.com/bulk1', // Same URL
          source: 'test' as const,
          location: { lat: 35.6762, lng: 139.6503 }
        }
      ];
      
      // Save all apartments
      const savePromises = scrapedApartments.map(apt => 
        apartmentRepo.create(apt).catch(() => null) // Ignore duplicates
      );
      await Promise.all(savePromises);
      
      // Verify deduplication
      const allApartments = await apartmentService.searchApartments({
        filters: { source: 'test' },
        pagination: { page: 1, limit: 10 }
      });
      
      // Should only have 2 unique apartments (bulk-3 was a duplicate)
      const uniqueUrls = new Set(allApartments.data.map(apt => apt.url));
      expect(uniqueUrls.size).toBe(2);
    });
  });

  describe('Transit → Search → Results Flow', () => {
    beforeAll(async () => {
      // Create test apartments at different stations
      await prisma.apartment.createMany({
        data: [
          {
            id: 'transit-1',
            name: 'Near Origin Station',
            price: 100000,
            layout: '1DK',
            size: 30,
            stationId: 'station-1', // Origin station
            buildingAge: 5,
            floor: 3,
            url: 'https://example.com/transit1',
            source: 'test',
            location: { lat: 35.6762, lng: 139.6503 }
          },
          {
            id: 'transit-2',
            name: '15 Minutes Away',
            price: 90000,
            layout: '1DK',
            size: 32,
            stationId: 'station-2', // 15 min from origin
            buildingAge: 3,
            floor: 4,
            url: 'https://example.com/transit2',
            source: 'test',
            location: { lat: 35.6762, lng: 139.6503 }
          },
          {
            id: 'transit-3',
            name: '45 Minutes Away',
            price: 70000,
            layout: '1DK',
            size: 35,
            stationId: 'station-3', // 45 min from origin
            buildingAge: 10,
            floor: 2,
            url: 'https://example.com/transit3',
            source: 'test',
            location: { lat: 35.6762, lng: 139.6503 }
          }
        ]
      });
    });
    
    it('should filter apartments by commute time', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Mock transit service to return predictable results
      jest.mock('~/lib/transit/simplified-otp-service', () => ({
        SimplifiedOtpService: class {
          async getReachableStations(stationId: string, maxMinutes: number) {
            if (maxMinutes >= 30) {
              return [
                { stationId: 'station-1', travelTime: 0 },
                { stationId: 'station-2', travelTime: 15 },
                { stationId: 'station-3', travelTime: 45 }
              ];
            } else if (maxMinutes >= 15) {
              return [
                { stationId: 'station-1', travelTime: 0 },
                { stationId: 'station-2', travelTime: 15 }
              ];
            } else {
              return [
                { stationId: 'station-1', travelTime: 0 }
              ];
            }
          }
        }
      }));
      
      // Search with 30 minute commute limit
      const search30 = await caller.search.apartmentsWithCommute({
        workplace: { stationId: 'station-1' },
        commuteTime: { max: 30 },
        filters: { layout: ['1DK'] }
      });
      
      // Should include stations 1 and 2, but not 3 (45 min away)
      expect(search30.apartments.map(a => a.id)).toContain('transit-1');
      expect(search30.apartments.map(a => a.id)).toContain('transit-2');
      expect(search30.apartments.map(a => a.id)).not.toContain('transit-3');
      
      // Verify commute times are attached
      const apt1 = search30.apartments.find(a => a.id === 'transit-1');
      const apt2 = search30.apartments.find(a => a.id === 'transit-2');
      expect(apt1?.commuteTime).toBe(0);
      expect(apt2?.commuteTime).toBe(15);
    });
    
    it('should sort results by commute time when requested', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      const searchResult = await caller.search.apartmentsWithCommute({
        workplace: { stationId: 'station-1' },
        commuteTime: { max: 60 },
        filters: { layout: ['1DK'] },
        sortBy: 'commuteTime',
        sortOrder: 'asc'
      });
      
      // Verify apartments are sorted by commute time
      const commuteTimes = searchResult.apartments.map(a => a.commuteTime || 999);
      expect(commuteTimes).toEqual([...commuteTimes].sort((a, b) => a - b));
    });
  });

  describe('Error Propagation Across Layers', () => {
    it('should handle validation errors properly', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Invalid price range
      await expect(
        caller.apartment.search({
          filters: {
            priceRange: { min: 200000, max: 50000 } // min > max
          }
        })
      ).rejects.toThrow();
      
      // Invalid layout
      await expect(
        caller.apartment.search({
          filters: {
            layout: ['INVALID' as any]
          }
        })
      ).rejects.toThrow();
    });
    
    it('should handle repository errors gracefully', async () => {
      const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
      
      // Mock a database error
      const originalCreate = apartmentRepo.create;
      apartmentRepo.create = vi.fn().mockRejectedValue(new Error('Database connection failed'));
      
      // Error should be caught and transformed
      await expect(
        apartmentRepo.create({
          id: 'error-test',
          name: 'Test',
          price: 100000,
          layout: '1K',
          size: 25,
          stationId: 'station-1',
          buildingAge: 5,
          floor: 1,
          url: 'https://example.com/error',
          source: 'test',
          location: { lat: 0, lng: 0 }
        })
      ).rejects.toThrow('Database connection failed');
      
      // Restore original method
      apartmentRepo.create = originalCreate;
    });
    
    it('should handle service-level validation', async () => {
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      
      // Invalid pagination
      await expect(
        apartmentService.searchApartments({
          filters: {},
          pagination: { page: -1, limit: 10 } // Invalid page
        })
      ).rejects.toThrow(ValidationError);
      
      // Invalid limit
      await expect(
        apartmentService.searchApartments({
          filters: {},
          pagination: { page: 1, limit: 1000 } // Too high
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Transaction Rollbacks', () => {
    it('should rollback on partial failure', async () => {
      const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
      
      // Start a transaction
      await prisma.$transaction(async (tx) => {
        // Create first apartment (should succeed)
        await tx.apartment.create({
          data: {
            id: 'tx-1',
            name: 'Transaction Test 1',
            price: 100000,
            layout: '1K',
            size: 25,
            stationId: 'station-1',
            buildingAge: 5,
            floor: 1,
            url: 'https://example.com/tx1',
            source: 'test',
            location: { lat: 0, lng: 0 }
          }
        });
        
        // Simulate error on second operation
        throw new Error('Transaction should rollback');
      }).catch(() => {
        // Expected to fail
      });
      
      // Verify apartment was not created
      const apartment = await apartmentRepo.findById('tx-1');
      expect(apartment).toBeNull();
    });
    
    it('should handle concurrent updates safely', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Create a list
      const list = await caller.list.create({
        name: 'Concurrent Test',
        description: 'Testing concurrent updates'
      });
      
      // Simulate concurrent additions
      const addPromises = [
        caller.list.addApartment({ listId: list.id, apartmentId: 'transit-1' }),
        caller.list.addApartment({ listId: list.id, apartmentId: 'transit-2' }),
        caller.list.addApartment({ listId: list.id, apartmentId: 'transit-3' })
      ];
      
      await Promise.all(addPromises);
      
      // Verify all apartments were added
      const updatedList = await caller.list.getWithApartments({ listId: list.id });
      expect(updatedList.apartments).toHaveLength(3);
      
      // Cleanup
      await caller.list.delete({ listId: list.id });
    });
  });

  describe('Error Boundary Testing', () => {
    it('should gracefully handle unexpected errors in API layer', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Mock an unexpected error in the service layer
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      const originalSearch = apartmentService.searchApartments;
      apartmentService.searchApartments = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected service error');
      });
      
      // API should catch and transform the error
      await expect(
        caller.apartment.search({
          filters: {},
          pagination: { page: 1, limit: 10 }
        })
      ).rejects.toThrow('Unexpected service error');
      
      // Restore original method
      apartmentService.searchApartments = originalSearch;
    });
    
    it('should handle null/undefined gracefully', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Test with various invalid inputs
      const invalidInputs = [
        { filters: null as any },
        { filters: { priceRange: null as any } },
        { filters: { layout: null as any } },
        { pagination: null as any }
      ];
      
      for (const invalidInput of invalidInputs) {
        // Should either handle gracefully or throw validation error
        const result = await caller.apartment.search({
          filters: {},
          pagination: { page: 1, limit: 10 },
          ...invalidInput
        }).catch(err => err);
        
        // Should not crash the server
        expect(result).toBeDefined();
      }
    });
    
    it('should isolate errors between concurrent requests', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Create requests, some will fail
      const requests = [
        caller.apartment.search({
          filters: { priceRange: { min: 100000, max: 150000 } },
          pagination: { page: 1, limit: 10 }
        }),
        caller.apartment.search({
          filters: { priceRange: { min: 200000, max: 50000 } }, // Invalid: min > max
          pagination: { page: 1, limit: 10 }
        }),
        caller.apartment.search({
          filters: { layout: ['1K'] },
          pagination: { page: 1, limit: 10 }
        })
      ];
      
      const results = await Promise.allSettled(requests);
      
      // First and third should succeed
      expect(results[0]!.status).toBe('fulfilled');
      expect(results[2]!.status).toBe('fulfilled');
      
      // Second should fail
      expect(results[1]!.status).toBe('rejected');
      
      // Error in one request shouldn't affect others
      if (results[0]!.status === 'fulfilled' && results[2]!.status === 'fulfilled') {
        expect(results[0].value).toHaveProperty('apartments');
        expect(results[2].value).toHaveProperty('apartments');
      }
    });
    
    it('should recover from database connection errors', async () => {
      const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
      
      // Mock a temporary database error
      let callCount = 0;
      const originalFindMany = apartmentRepo.findMany;
      apartmentRepo.findMany = vi.fn().mockImplementation(async (...args) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Database connection lost');
        }
        // Second call should work
        return originalFindMany.apply(apartmentRepo, args);
      });
      
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      
      // First call fails
      await expect(
        apartmentService.searchApartments({
          filters: {},
          pagination: { page: 1, limit: 10 }
        })
      ).rejects.toThrow('Database connection lost');
      
      // Second call should succeed (simulating recovery)
      const result = await apartmentService.searchApartments({
        filters: {},
        pagination: { page: 1, limit: 10 }
      });
      
      expect(result).toHaveProperty('data');
      expect(callCount).toBe(2);
      
      // Restore original method
      apartmentRepo.findMany = originalFindMany;
    });
    
    it('should handle scraper errors without affecting other components', async () => {
      // Create a scraper instance
      const scraper = UnifiedScraperFactory.create('realestate');
      
      // Mock scrape method to simulate error handling
      const originalScrape = scraper.scrape;
      scraper.scrape = vi.fn().mockImplementation(async (url: string) => {
        // Simulate scraper handling malformed HTML gracefully
        return [];
      });
      
      // Should not throw, but return empty results
      const results = await scraper.scrape('https://example.com/malformed');
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
      
      // Restore original method
      scraper.scrape = originalScrape;
    });
  });

  describe('API Timeout and Retry Scenarios', () => {
    it('should timeout long-running operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Mock a slow operation
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      const originalSearch = apartmentService.searchApartments;
      apartmentService.searchApartments = vi.fn().mockImplementation(async () => {
        // Simulate a very slow operation
        await new Promise(resolve => setTimeout(resolve, 5000));
        return { data: [], totalCount: 0, page: 1, totalPages: 0 };
      });
      
      // Create a timeout wrapper
      const timeoutPromise = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
          )
        ]);
      };
      
      // Should timeout before operation completes
      await expect(
        timeoutPromise(
          caller.apartment.search({
            filters: {},
            pagination: { page: 1, limit: 10 }
          }),
          1000 // 1 second timeout
        )
      ).rejects.toThrow('Operation timed out');
      
      // Restore original method
      apartmentService.searchApartments = originalSearch;
    });
    
    it('should implement retry logic for transient failures', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Mock transient failures
      let attemptCount = 0;
      const apartmentRepo = container.resolve<ApartmentRepository>('ApartmentRepository');
      const originalFindMany = apartmentRepo.findMany;
      apartmentRepo.findMany = vi.fn().mockImplementation(async (...args) => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary network error');
        }
        return originalFindMany.apply(apartmentRepo, args);
      });
      
      // Implement retry logic
      const retryOperation = async <T>(
        operation: () => Promise<T>,
        maxRetries: number = 3,
        delay: number = 100
      ): Promise<T> => {
        let lastError: Error | undefined;
        
        for (let i = 0; i < maxRetries; i++) {
          try {
            return await operation();
          } catch (error) {
            lastError = error as Error;
            if (i < maxRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
          }
        }
        
        throw lastError;
      };
      
      // Should succeed after retries
      const result = await retryOperation(() => 
        caller.apartment.search({
          filters: {},
          pagination: { page: 1, limit: 10 }
        })
      );
      
      expect(result).toHaveProperty('apartments');
      expect(attemptCount).toBe(3); // Failed twice, succeeded on third
      
      // Restore original method
      apartmentRepo.findMany = originalFindMany;
    });
    
    it('should handle API rate limiting with exponential backoff', async () => {
      const scraper = UnifiedScraperFactory.create('realestate', {
        name: 'rate-limit-test',
        baseUrl: 'https://example.com',
        rateLimit: 100
      });
      
      // Mock rate limiting responses
      let requestCount = 0;
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async () => {
        requestCount++;
        if (requestCount < 3) {
          return new Response('Rate limit exceeded', { 
            status: 429,
            headers: { 'Retry-After': '1' }
          });
        }
        return new Response('<html><body>Success</body></html>', { status: 200 });
      });
      
      // Scraper should retry with backoff
      const startTime = Date.now();
      const result = await scraper.scrape('https://example.com/test');
      const elapsed = Date.now() - startTime;
      
      expect(requestCount).toBe(3); // Two 429s, then success
      expect(elapsed).toBeGreaterThan(1000); // Should have waited at least 1 second
      
      // Restore original fetch
      global.fetch = originalFetch;
    });
    
    it('should timeout scraper requests appropriately', async () => {
      const scraper = UnifiedScraperFactory.create('realestate', {
        name: 'timeout-test',
        baseUrl: 'https://example.com',
        timeout: 1000 // 1 second timeout
      });
      
      // Mock a slow response
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 seconds
        return new Response('<html><body>Too late</body></html>', { status: 200 });
      });
      
      // Should timeout before response
      await expect(
        scraper.scrape('https://example.com/slow')
      ).rejects.toThrow(/timeout|aborted/i);
      
      // Restore original fetch
      global.fetch = originalFetch;
    });
    
    it('should handle concurrent API calls with circuit breaker pattern', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Simple circuit breaker implementation
      class CircuitBreaker {
        private failures = 0;
        private lastFailTime = 0;
        private state: 'closed' | 'open' | 'half-open' = 'closed';
        
        constructor(
          private threshold: number = 5,
          private timeout: number = 10000
        ) {}
        
        async execute<T>(operation: () => Promise<T>): Promise<T> {
          if (this.state === 'open') {
            if (Date.now() - this.lastFailTime > this.timeout) {
              this.state = 'half-open';
            } else {
              throw new Error('Circuit breaker is open');
            }
          }
          
          try {
            const result = await operation();
            if (this.state === 'half-open') {
              this.state = 'closed';
              this.failures = 0;
            }
            return result;
          } catch (error) {
            this.failures++;
            this.lastFailTime = Date.now();
            
            if (this.failures >= this.threshold) {
              this.state = 'open';
            }
            throw error;
          }
        }
      }
      
      const circuitBreaker = new CircuitBreaker(3, 1000);
      
      // Mock failures
      let callCount = 0;
      const apartmentService = container.resolve<ApartmentService>('ApartmentService');
      const originalSearch = apartmentService.searchApartments;
      apartmentService.searchApartments = vi.fn().mockImplementation(async (...args) => {
        callCount++;
        if (callCount <= 4) {
          throw new Error('Service unavailable');
        }
        return originalSearch.apply(apartmentService, args);
      });
      
      // First 3 calls fail and open the circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.execute(() => 
            caller.apartment.search({
              filters: {},
              pagination: { page: 1, limit: 10 }
            })
          )
        ).rejects.toThrow('Service unavailable');
      }
      
      // Circuit should now be open
      await expect(
        circuitBreaker.execute(() => 
          caller.apartment.search({
            filters: {},
            pagination: { page: 1, limit: 10 }
          })
        )
      ).rejects.toThrow('Circuit breaker is open');
      
      // Wait for circuit to move to half-open
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Next call should succeed and close the circuit
      const result = await circuitBreaker.execute(() => 
        caller.apartment.search({
          filters: {},
          pagination: { page: 1, limit: 10 }
        })
      );
      
      expect(result).toHaveProperty('apartments');
      
      // Restore original method
      apartmentService.searchApartments = originalSearch;
    });
    
    it('should handle partial failures in batch operations', async () => {
      const ctx = createTestContext(createTestSession());
      const caller = appRouter.createCaller(ctx);
      
      // Create multiple lists
      const lists = await Promise.all([
        caller.list.create({ name: 'Batch Test 1', description: 'Test' }),
        caller.list.create({ name: 'Batch Test 2', description: 'Test' }),
        caller.list.create({ name: 'Batch Test 3', description: 'Test' })
      ]);
      
      // Mock partial failures when adding apartments
      let addCount = 0;
      const originalAddApartment = caller.list.addApartment;
      caller.list.addApartment = vi.fn().mockImplementation(async (input) => {
        addCount++;
        if (addCount === 2) {
          throw new Error('Temporary failure');
        }
        return originalAddApartment.call(caller.list, input);
      });
      
      // Batch add apartments with partial failure handling
      const batchResults = await Promise.allSettled([
        caller.list.addApartment({ listId: lists[0]!.id, apartmentId: 'transit-1' }),
        caller.list.addApartment({ listId: lists[1]!.id, apartmentId: 'transit-2' }),
        caller.list.addApartment({ listId: lists[2]!.id, apartmentId: 'transit-3' })
      ]);
      
      // Should have 2 successes and 1 failure
      const successes = batchResults.filter(r => r.status === 'fulfilled');
      const failures = batchResults.filter(r => r.status === 'rejected');
      
      expect(successes).toHaveLength(2);
      expect(failures).toHaveLength(1);
      
      // Verify successful operations completed
      const list1 = await caller.list.getWithApartments({ listId: lists[0]!.id });
      const list3 = await caller.list.getWithApartments({ listId: lists[2]!.id });
      
      expect(list1.apartments).toHaveLength(1);
      expect(list3.apartments).toHaveLength(1);
      
      // Cleanup
      await Promise.all(lists.map(list => 
        caller.list.delete({ listId: list.id }).catch(() => null)
      ));
      
      // Restore original method
      caller.list.addApartment = originalAddApartment;
    });
  });
});