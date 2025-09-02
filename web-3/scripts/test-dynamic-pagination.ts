// Use absolute imports with proper module resolution
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Import with require to avoid ESM issues
const { UnifiedScraperFactory } = require('../src/lib/scrapers/scraper-factory');
require('../src/lib/scrapers/sources'); // Register all scrapers

async function testDynamicPagination() {
  console.log('\n=== Testing Dynamic Pagination ===\n');
  
  const scraperType = 'realestate';
  const scraper = UnifiedScraperFactory.create(scraperType);
  
  console.log(`Testing ${scraperType} scraper with dynamic pagination...`);
  
  // Test with fetchAll enabled
  const params = {
    minPrice: 50000,
    maxPrice: 300000,
    fetchAll: true, // Enable dynamic pagination
  };
  
  console.log('Search params:', params);
  console.log('Expected: Should fetch all pages dynamically using next page detection');
  
  let totalFound = 0;
  let pagesProcessed = 0;
  
  const result = await scraper.search(params, (progress) => {
    console.log(`\nProgress update:`, {
      total: progress.total,
      completed: progress.completed,
      failed: progress.failed,
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
    });
    if (progress.currentPage) {
      pagesProcessed = Math.max(pagesProcessed, progress.currentPage);
    }
  });
  
  if (result.success && result.data) {
    totalFound = result.data.length;
    console.log(`\n✅ Search completed successfully`);
    console.log(`Total apartments found: ${totalFound}`);
    console.log(`Pages processed: ${pagesProcessed}`);
    
    if (totalFound > 15) {
      console.log('\n✅ SUCCESS: Found more than 15 apartments, dynamic pagination is working!');
    } else {
      console.log('\n⚠️  WARNING: Only found 15 or fewer apartments.');
      console.log('This might indicate pagination is not working correctly.');
    }
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
}

testDynamicPagination().catch(console.error);