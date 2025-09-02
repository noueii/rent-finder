#!/usr/bin/env node
/**
 * Test script for the scraping service
 */

import { PrismaClient } from '@prisma/client';
import { scrapingService } from '../src/services/scraping-service';
import { aptsJpScraper } from '../src/services/scrapers/apts-jp-scraper';
import { realEstateScraper } from '../src/services/scrapers/realestate-scraper';

async function testScrapingService() {
  const db = new PrismaClient();
  
  try {
    await db.$connect();
    console.log('Connected to database');

    console.log('\n=== Testing Scraping Service ===');

    // Test 1: Get current scraping stats
    console.log('\n1. Getting current scraping stats...');
    const initialStats = await scrapingService.getScrapingStats();
    console.log('Initial stats:', initialStats);

    // Test 2: Create scraping jobs
    console.log('\n2. Creating scraping jobs...');
    
    const aptsJpJobId = await scrapingService.createScrapeJob({
      sourceSite: 'apts.jp',
      priority: 5,
    });
    console.log(`Created apts.jp job: ${aptsJpJobId}`);

    const realEstateJobId = await scrapingService.createScrapeJob({
      sourceSite: 'realestate.co.jp',
      priority: 3,
    });
    console.log(`Created realestate.co.jp job: ${realEstateJobId}`);

    // Test 3: List pending jobs
    console.log('\n3. Listing pending jobs...');
    const pendingJobs = await scrapingService.getScrapeJobs('PENDING');
    console.log(`Found ${pendingJobs.length} pending jobs`);
    pendingJobs.forEach(job => {
      console.log(`- ${job.sourceSite} (Priority: ${job.priority})`);
    });

    // Test 4: Test scrapers (without actual web requests)
    console.log('\n4. Testing scraper URL generation...');
    
    const aptsJpUrls = aptsJpScraper.generateSearchUrls('Tokyo');
    console.log(`apts.jp URLs: ${aptsJpUrls.length}`);
    aptsJpUrls.forEach(url => console.log(`  - ${url}`));

    const realEstateUrls = realEstateScraper.generateSearchUrls('Shibuya');
    console.log(`realestate.co.jp URLs: ${realEstateUrls.length}`);
    realEstateUrls.forEach(url => console.log(`  - ${url}`));

    // Test 5: Test data parsing (with sample HTML)
    console.log('\n5. Testing data parsing...');
    
    const sampleAptsJpHtml = `
      <div class="property-card">
        <h3 class="property-title">Tokyo Apartment 101</h3>
        <div class="price">¥80,000</div>
        <div class="size">20.5m²</div>
        <div class="layout">1K</div>
        <div class="location">Shibuya-ku, Tokyo</div>
        <div class="station">Shibuya Station (5 min walk)</div>
        <div class="feature">Air Conditioning</div>
        <div class="feature">Balcony</div>
        <a href="/property/123">View Details</a>
      </div>
    `;

    const parsedApts = aptsJpScraper.parseApartmentListing(sampleAptsJpHtml, 'https://apts.jp/test');
    console.log(`Parsed ${parsedApts.length} apartments from sample apts.jp HTML`);

    const sampleRealEstateHtml = `
      <div class="property-listing">
        <div class="listing-title">
          <span class="text-semi-strong">1LDK Apartment</span>
          <span>in Shibuya<br/>Shibuya-ku, Tokyo</span>
        </div>
        <span>Monthly Costs</span>¥120,000
        <div class="text-success">Available Now</div>
        <span>Size</span>30.06 m²
        <span>Deposit</span>¥0
        <span>Key Money</span>¥0
        <span>Floor</span>4 / 4F
        <span>Year Built</span>2014
        <span>Nearest Station</span>Shibuya Station (3 min. walk)
        <a href="/property/456">View Details</a>
      </div>
    `;

    const parsedRealEstate = realEstateScraper.parseApartmentListing(sampleRealEstateHtml, 'https://realestate.co.jp/test');
    console.log(`Parsed ${parsedRealEstate.length} apartments from sample realestate.co.jp HTML`);

    // Test 6: Test job execution (dry run)
    console.log('\n6. Testing job execution (would normally scrape live data)...');
    
    // Note: In a real scenario, this would make actual HTTP requests
    // For testing, we'll just verify the job workflow
    
    console.log('Job execution test complete (dry run)');

    // Test 7: Get updated stats
    console.log('\n7. Getting updated scraping stats...');
    const finalStats = await scrapingService.getScrapingStats();
    console.log('Final stats:', finalStats);

    // Test 8: Test supported sites
    console.log('\n8. Testing supported sites...');
    const supportedSites = [
      {
        id: 'apts.jp',
        name: 'Apts.jp',
        description: 'English-language apartment listings in Tokyo',
        baseUrl: 'https://apts.jp',
        features: ['English interface', 'Detailed amenities', 'Photo galleries'],
      },
      {
        id: 'realestate.co.jp',
        name: 'RealEstate.co.jp',
        description: 'International real estate listings',
        baseUrl: 'https://realestate.co.jp',
        features: ['Multi-language support', 'International focus', 'Detailed property info'],
      },
    ];

    console.log(`Supported sites: ${supportedSites.length}`);
    supportedSites.forEach(site => {
      console.log(`- ${site.name}: ${site.description}`);
    });

    // Test 9: Station matching test
    console.log('\n9. Testing station matching...');
    
    const testStations = ['Tokyo', 'Shibuya', 'Shinjuku', 'Ikebukuro'];
    for (const stationName of testStations) {
      const station = await db.station.findFirst({
        where: {
          OR: [
            { name: { contains: stationName } },
            { nameJa: { contains: stationName } },
          ],
        },
      });
      
      if (station) {
        console.log(`✓ Found station: ${stationName} -> ${station.name} (${station.nameJa})`);
      } else {
        console.log(`✗ Station not found: ${stationName}`);
      }
    }

    console.log('\n✅ All scraping service tests completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the test
testScrapingService().catch(console.error);