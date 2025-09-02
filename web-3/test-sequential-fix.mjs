// Test to verify sequential scraper with undefined limit works
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Use dynamic import to avoid ESM issues
const { ScraperFactory } = await import('./dist/lib/scrapers/scraper-factory.js');
await import('./dist/lib/scrapers/sources/index.js'); // Register all scrapers

async function testSequentialScraping() {
  console.log('\n=== Testing Sequential Scraping with undefined limit ===\n');
  
  const scraperType = 'realestate';
  const scraper = ScraperFactory.create(scraperType);
  
  console.log(`Testing ${scraperType} scraper with sequential parameters...`);
  
  // Simulate sequential scraper params (limit: undefined)
  const params = {
    minPrice: 50000,
    maxPrice: 300000,
    limit: undefined, // This is what sequential scraper passes
  };
  
  console.log('Search params:', params);
  console.log('Expected: Should fetch all pages dynamically since limit is undefined');
  
  let totalFound = 0;
  let pagesProcessed = 0;
  let maxPages = 5; // Limit to 5 pages for testing
  
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
    
    // Stop after 5 pages for testing
    if (progress.currentPage >= maxPages) {
      console.log(`\nReached test limit of ${maxPages} pages, stopping...`);
      return false; // This won't actually stop the scraper, but we can check
    }
  });
  
  if (result.success && result.data) {
    totalFound = result.data.length;
    console.log(`\n✅ Search completed successfully`);
    console.log(`Total apartments found: ${totalFound}`);
    console.log(`Pages processed: ${pagesProcessed}`);
    
    if (totalFound > 15) {
      console.log('\n✅ SUCCESS: Dynamic pagination is working with undefined limit!');
      console.log(`Found ${totalFound} apartments across ${pagesProcessed} pages`);
    } else {
      console.log('\n❌ FAILURE: Only found 15 or fewer apartments.');
      console.log('Dynamic pagination is NOT working correctly.');
    }
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
}

// First build the project
console.log('Building project...');
import { execSync } from 'child_process';
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build complete!\n');
  
  // Run the test
  testSequentialScraping().catch(console.error);
} catch (error) {
  console.error('Build failed:', error);
}