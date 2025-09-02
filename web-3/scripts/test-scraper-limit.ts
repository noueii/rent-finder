import { UnifiedScraperFactory } from '~/lib/scrapers/unified-scraper-factory';
import '../src/lib/scrapers/sources'; // Register all scrapers

async function testScraperLimit() {
  console.log('\n=== Testing Scraper Limit Issue ===\n');
  
  const scraperType = 'realestate';
  const scraper = UnifiedScraperFactory.create(scraperType);
  
  console.log(`Testing ${scraperType} scraper...`);
  
  // Test with limit of 50 (should fetch multiple pages)
  const params = {
    minPrice: 50000,
    maxPrice: 300000,
    limit: 50,
    fetchAll: false,
  };
  
  console.log('Search params:', params);
  console.log('Expected: Should fetch multiple pages (50 / 15 per page = 4 pages)');
  
  let totalFound = 0;
  let pagesProcessed = 0;
  
  const result = await scraper.search(params, (progress) => {
    console.log(`Progress update:`, {
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
    
    if (totalFound <= 15) {
      console.log('\n⚠️  WARNING: Only found 15 or fewer apartments!');
      console.log('This suggests only 1 page was scraped.');
    }
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
}

testScraperLimit().catch(console.error);