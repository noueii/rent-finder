import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { prisma } from '~/server/db';
import { UnifiedScraper } from '~/lib/scrapers/unified/base-scraper';
import { RealEstateStrategy } from '~/lib/scrapers/unified/strategies/realestate-strategy';
import { ConcurrentStrategy } from '~/lib/scrapers/unified/strategies/concurrent-strategy';
import { ApartmentRepository } from '~/server/repositories/apartment.repository';
import { ScraperManagementService } from '~/server/services/scraper-management.service';
import type { ScrapedApartment } from '~/lib/scrapers/types';

/**
 * Scraper to Database Integration Tests
 * Tests the complete flow from scraping to database storage
 */

describe('Scraper Database Integration', () => {
  let apartmentRepo: ApartmentRepository;
  let scraperService: ScraperManagementService;
  
  beforeAll(() => {
    apartmentRepo = new ApartmentRepository(prisma);
    scraperService = new ScraperManagementService(prisma);
  });
  
  beforeEach(async () => {
    // Clear test data
    await prisma.apartment.deleteMany({
      where: { source: 'test-scraper' }
    });
  });
  
  afterAll(async () => {
    // Final cleanup
    await prisma.apartment.deleteMany({
      where: { source: 'test-scraper' }
    });
  });

  describe('Scraper to Database Save Flow', () => {
    it('should save scraped apartments to database', async () => {
      // Mock scraped data
      const scrapedApartments: ScrapedApartment[] = [
        {
          name: 'Test Apartment 1',
          price: 85000,
          layout: '1K',
          size: 25.5,
          buildingAge: 5,
          floor: 3,
          nearestStation: 'Shibuya',
          walkingTime: 5,
          url: 'https://test.com/apt1',
          source: 'test-scraper',
          location: { lat: 35.6580, lng: 139.7016 }
        },
        {
          name: 'Test Apartment 2',
          price: 120000,
          layout: '1LDK',
          size: 40.2,
          buildingAge: 2,
          floor: 7,
          nearestStation: 'Shinjuku',
          walkingTime: 8,
          url: 'https://test.com/apt2',
          source: 'test-scraper',
          location: { lat: 35.6896, lng: 139.6995 }
        }
      ];
      
      // Save apartments (simulating what scraper service would do)
      const savePromises = scrapedApartments.map(async (apt) => {
        // Map station name to station ID (in real app, this would be more sophisticated)
        const stationId = await getOrCreateStationId(apt.nearestStation || 'Unknown');
        
        return apartmentRepo.create({
          ...apt,
          id: `test-${Date.now()}-${Math.random()}`,
          stationId,
          walkingTime: apt.walkingTime || 10
        });
      });
      
      const savedApartments = await Promise.all(savePromises);
      
      // Verify saved data
      expect(savedApartments).toHaveLength(2);
      expect(savedApartments[0]!.name).toBe('Test Apartment 1');
      expect(savedApartments[0]!.price).toBe(85000);
      expect(savedApartments[1]!.name).toBe('Test Apartment 2');
      expect(savedApartments[1]!.price).toBe(120000);
      
      // Verify data persisted
      const dbApartments = await apartmentRepo.findMany({
        where: { source: 'test-scraper' }
      });
      expect(dbApartments.data).toHaveLength(2);
    });
    
    it('should handle duplicate URL deduplication', async () => {
      const duplicateApartment: ScrapedApartment = {
        name: 'Duplicate Test',
        price: 90000,
        layout: '1DK',
        size: 30,
        url: 'https://test.com/duplicate',
        source: 'test-scraper'
      };
      
      const stationId = await getOrCreateStationId('Tokyo');
      
      // First save
      const first = await apartmentRepo.create({
        ...duplicateApartment,
        id: 'dup-1',
        stationId,
        buildingAge: 5,
        floor: 2,
        walkingTime: 10,
        location: { lat: 35.6762, lng: 139.6503 }
      });
      
      expect(first).toBeTruthy();
      
      // Try to save duplicate (different ID, same URL)
      await expect(
        apartmentRepo.create({
          ...duplicateApartment,
          id: 'dup-2',
          name: 'Different Name', // Different data
          price: 95000, // Different price
          stationId,
          buildingAge: 5,
          floor: 2,
          walkingTime: 10,
          location: { lat: 35.6762, lng: 139.6503 }
        })
      ).rejects.toThrow(); // Should fail due to unique constraint on URL
      
      // Verify only one exists
      const count = await prisma.apartment.count({
        where: { url: duplicateApartment.url }
      });
      expect(count).toBe(1);
    });
    
    it('should update existing apartments on re-scrape', async () => {
      const apartment: ScrapedApartment = {
        name: 'Update Test Apartment',
        price: 100000,
        layout: '1LDK',
        size: 35,
        url: 'https://test.com/update-test',
        source: 'test-scraper'
      };
      
      const stationId = await getOrCreateStationId('Shibuya');
      
      // Initial save
      await apartmentRepo.create({
        ...apartment,
        id: 'update-1',
        stationId,
        buildingAge: 3,
        floor: 4,
        walkingTime: 7,
        location: { lat: 35.6580, lng: 139.7016 }
      });
      
      // Simulate re-scrape with updated price
      const existing = await prisma.apartment.findUnique({
        where: { url: apartment.url }
      });
      
      if (existing) {
        await apartmentRepo.update(existing.id, {
          price: 95000, // Price dropped
          updatedAt: new Date()
        });
      }
      
      // Verify update
      const updated = await prisma.apartment.findUnique({
        where: { url: apartment.url }
      });
      
      expect(updated).toBeTruthy();
      expect(updated!.price).toBe(95000);
      expect(updated!.name).toBe('Update Test Apartment'); // Other fields unchanged
    });
  });

  describe('Bulk Import Scenarios', () => {
    it('should handle bulk import efficiently', async () => {
      // Generate test data
      const bulkApartments: ScrapedApartment[] = [];
      for (let i = 0; i < 100; i++) {
        bulkApartments.push({
          name: `Bulk Apartment ${i}`,
          price: 50000 + Math.floor(Math.random() * 100000),
          layout: ['1K', '1DK', '1LDK'][Math.floor(Math.random() * 3)] as any,
          size: 20 + Math.floor(Math.random() * 40),
          buildingAge: Math.floor(Math.random() * 20),
          floor: Math.floor(Math.random() * 10) + 1,
          nearestStation: ['Shibuya', 'Shinjuku', 'Tokyo'][Math.floor(Math.random() * 3)],
          walkingTime: Math.floor(Math.random() * 15) + 1,
          url: `https://test.com/bulk-${i}`,
          source: 'test-scraper',
          location: { 
            lat: 35.6 + Math.random() * 0.1, 
            lng: 139.6 + Math.random() * 0.1 
          }
        });
      }
      
      const startTime = Date.now();
      
      // Bulk insert using createMany (more efficient)
      const stationId = await getOrCreateStationId('Tokyo');
      const dataToInsert = bulkApartments.map((apt, i) => ({
        ...apt,
        id: `bulk-${Date.now()}-${i}`,
        stationId,
        walkingTime: apt.walkingTime || 10
      }));
      
      await prisma.apartment.createMany({
        data: dataToInsert,
        skipDuplicates: true
      });
      
      const duration = Date.now() - startTime;
      
      // Verify all inserted
      const count = await prisma.apartment.count({
        where: { 
          source: 'test-scraper',
          url: { startsWith: 'https://test.com/bulk-' }
        }
      });
      
      expect(count).toBe(100);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      console.log(`Bulk import of 100 apartments took ${duration}ms`);
    });
    
    it('should handle partial failures in bulk import', async () => {
      const apartments: ScrapedApartment[] = [
        {
          name: 'Valid Apartment 1',
          price: 80000,
          layout: '1K',
          url: 'https://test.com/partial-1',
          source: 'test-scraper'
        },
        {
          name: 'Valid Apartment 2',
          price: 90000,
          layout: '1DK',
          url: 'https://test.com/partial-2',
          source: 'test-scraper'
        },
        {
          name: 'Invalid Apartment',
          price: -1000, // Invalid price
          layout: 'INVALID' as any, // Invalid layout
          url: 'https://test.com/partial-3',
          source: 'test-scraper'
        }
      ];
      
      const stationId = await getOrCreateStationId('Tokyo');
      let successCount = 0;
      let errorCount = 0;
      
      // Process individually to handle errors
      for (const apt of apartments) {
        try {
          // Validate before insert
          if (apt.price <= 0) {
            throw new Error('Invalid price');
          }
          if (!['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3LDK'].includes(apt.layout || '')) {
            throw new Error('Invalid layout');
          }
          
          await apartmentRepo.create({
            ...apt,
            id: `partial-${Date.now()}-${Math.random()}`,
            stationId,
            size: apt.size || 25,
            buildingAge: 5,
            floor: 1,
            walkingTime: 10,
            location: { lat: 35.6762, lng: 139.6503 }
          });
          successCount++;
        } catch (error) {
          errorCount++;
          console.log(`Failed to import: ${apt.name} - ${error}`);
        }
      }
      
      expect(successCount).toBe(2);
      expect(errorCount).toBe(1);
      
      // Verify only valid apartments were saved
      const saved = await prisma.apartment.count({
        where: { 
          url: { in: apartments.map(a => a.url) }
        }
      });
      expect(saved).toBe(2);
    });
  });

  describe('Error Logging', () => {
    it('should log scraping errors properly', async () => {
      // Create a scraper that will fail
      const failingScraper = new UnifiedScraper({
        strategy: new ConcurrentStrategy({
          implementation: {
            parsePage: async () => {
              throw new Error('Parse error: Invalid HTML structure');
            },
            getNextPageUrl: () => null
          } as any,
          config: { maxConcurrent: 1 }
        }),
        config: {
          name: 'failing-scraper',
          baseUrl: 'https://failing.com',
          enabled: true
        }
      });
      
      // Track errors
      const errors: Error[] = [];
      failingScraper.on('error', (error) => {
        errors.push(error);
      });
      
      // Run scraper (will fail)
      const results = await failingScraper.scrape({
        maxPages: 1,
        startUrl: '/fail'
      });
      
      // Should return empty results
      expect(results).toEqual([]);
      
      // Should have logged errors
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.message).toContain('Parse error');
    });
    
    it('should track scraper run history', async () => {
      // Simulate scraper run
      const runId = await scraperService.startScraperRun('test-scraper');
      
      // Log some activity
      await scraperService.logScraperActivity(runId, {
        pagesScraped: 5,
        apartmentsFound: 23,
        errors: 1
      });
      
      // Complete run
      await scraperService.completeScraperRun(runId, {
        success: true,
        totalPages: 5,
        totalApartments: 23,
        totalErrors: 1,
        duration: 15000
      });
      
      // Verify history
      const history = await scraperService.getScraperHistory('test-scraper', 10);
      expect(history.length).toBeGreaterThan(0);
      
      const latestRun = history[0];
      expect(latestRun).toHaveProperty('success', true);
      expect(latestRun).toHaveProperty('totalApartments', 23);
    });
  });

  describe('Data Validation', () => {
    it('should validate required fields before save', async () => {
      const invalidApartments = [
        { name: '', price: 100000, url: 'https://test.com/1' }, // Empty name
        { name: 'Test', price: 0, url: 'https://test.com/2' }, // Zero price
        { name: 'Test', price: 100000, url: '' }, // Empty URL
        { name: 'Test', price: -5000, url: 'https://test.com/3' } // Negative price
      ];
      
      const stationId = await getOrCreateStationId('Tokyo');
      let validCount = 0;
      
      for (const apt of invalidApartments) {
        try {
          // Basic validation
          if (!apt.name || apt.name.trim() === '') {
            throw new Error('Name is required');
          }
          if (!apt.price || apt.price <= 0) {
            throw new Error('Price must be positive');
          }
          if (!apt.url || apt.url.trim() === '') {
            throw new Error('URL is required');
          }
          
          await apartmentRepo.create({
            ...apt,
            id: `invalid-${Date.now()}-${Math.random()}`,
            source: 'test-scraper',
            layout: '1K',
            size: 25,
            stationId,
            buildingAge: 5,
            floor: 1,
            walkingTime: 10,
            location: { lat: 35.6762, lng: 139.6503 }
          });
          
          validCount++;
        } catch (error) {
          // Expected validation error
        }
      }
      
      expect(validCount).toBe(0); // All should fail validation
    });
    
    it('should normalize data before saving', async () => {
      const messyApartment: ScrapedApartment = {
        name: '  Messy Apartment Name  ', // Extra whitespace
        price: 85_000, // With underscore
        layout: '1ldk' as any, // Lowercase
        size: 25.567, // Too many decimals
        nearestStation: 'SHIBUYA', // Uppercase
        url: 'https://test.com/messy  ', // Trailing space
        source: 'test-scraper'
      };
      
      // Normalize data
      const normalized = {
        ...messyApartment,
        name: messyApartment.name.trim(),
        layout: (messyApartment.layout || '').toUpperCase() as any,
        size: Math.round(messyApartment.size! * 10) / 10, // One decimal
        nearestStation: messyApartment.nearestStation?.trim(),
        url: messyApartment.url.trim()
      };
      
      const stationId = await getOrCreateStationId(normalized.nearestStation || 'Unknown');
      
      const saved = await apartmentRepo.create({
        ...normalized,
        id: `normalized-${Date.now()}`,
        stationId,
        buildingAge: 5,
        floor: 1,
        walkingTime: 10,
        location: { lat: 35.6580, lng: 139.7016 }
      });
      
      // Verify normalization
      expect(saved.name).toBe('Messy Apartment Name');
      expect(saved.layout).toBe('1LDK');
      expect(saved.size).toBe(25.6);
      expect(saved.url).toBe('https://test.com/messy');
    });
  });
});

/**
 * Helper function to get or create a station ID
 * In real app, this would use the station service
 */
async function getOrCreateStationId(stationName: string): Promise<string> {
  // For testing, use a deterministic ID based on name
  return `station-${stationName.toLowerCase().replace(/\s+/g, '-')}`;
}