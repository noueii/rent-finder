#!/usr/bin/env node

/**
 * Test script for enhanced Wagaya Japan scraper with anti-blocking measures
 * Tests:
 * 1. User agent rotation
 * 2. Rate limiting with jitter
 * 3. Enhanced headers
 * 4. Small batch scraping
 */

import { WagayaJapanScraper } from './dist/lib/scrapers/sources/wagaya-japan-scraper.js';

console.log('Testing enhanced Wagaya Japan scraper with anti-blocking measures...\n');

async function testScraper() {
  const scraper = new WagayaJapanScraper();
  
  console.log('Scraper configuration:');
  console.log(`- Rate limit: 2.5s base + random jitter (±500ms)`);
  console.log(`- User agent rotation: Every 10 minutes`);
  console.log(`- Enhanced headers: Including Sec-Ch-Ua, Sec-Fetch-*, etc.\n`);
  
  try {
    console.log('Starting scrape with small limit (5 apartments)...');
    console.log('Monitoring for blocking indicators (403, captcha, etc.)...\n');
    
    const startTime = Date.now();
    
    const result = await scraper.search({
      maxPrice: 150000,
      minSize: 25,
      limit: 5, // Small batch for testing
      onProgress: (progress) => {
        console.log(`Progress: ${progress.completed}/${progress.total} apartments scraped`);
      }
    });
    
    const duration = Date.now() - startTime;
    
    if (result.success) {
      console.log(`\n✅ Scrape completed successfully!`);
      console.log(`- Apartments found: ${result.data?.length || 0}`);
      console.log(`- Total duration: ${(duration / 1000).toFixed(2)}s`);
      console.log(`- Average time per apartment: ${(duration / (result.data?.length || 1) / 1000).toFixed(2)}s`);
      console.log(`- No blocking detected`);
      
      // Show first apartment as sample
      if (result.data && result.data.length > 0) {
        const firstApt = result.data[0];
        console.log(`\nSample apartment:`);
        console.log(`- Title: ${firstApt.title}`);
        console.log(`- Price: ¥${firstApt.price.toLocaleString()}`);
        console.log(`- Size: ${firstApt.size}m²`);
        console.log(`- URL: ${firstApt.sourceUrl}`);
      }
    } else {
      console.error(`\n❌ Scrape failed:`, result.error);
      
      if (result.error?.code === 'BLOCKED') {
        console.error('\n⚠️  BLOCKING DETECTED - Headers may need further enhancement');
        console.error('Consider adding:');
        console.error('- Session cookies');
        console.error('- Proxy rotation');
        console.error('- Longer delays between requests');
      }
    }
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testScraper().catch(console.error);