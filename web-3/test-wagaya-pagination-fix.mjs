// Test to verify Wagaya pagination fix works
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// First build the project
console.log('Building project...');
import { execSync } from 'child_process';
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('Build complete!\n');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Use dynamic import to avoid ESM issues
const { ScraperFactory } = await import('./dist/lib/scrapers/scraper-factory.js');
await import('./dist/lib/scrapers/sources/index.js'); // Register all scrapers

async function testWagayaPaginationFix() {
  console.log('\n=== Testing Wagaya Pagination Fix ===\n');
  
  const scraper = ScraperFactory.create('wagaya');
  
  // Test with fetchAll: true to get all pages
  const params = {
    minPrice: 50000,
    maxPrice: 300000,
    fetchAll: true,
  };
  
  console.log('Search params:', params);
  console.log('Expected: Should fetch all pages until no listings found\n');
  
  let totalApartments = 0;
  let pagesProcessed = 0;
  let progressUpdates = [];
  
  const startTime = Date.now();
  
  const result = await scraper.search(params, (progress) => {
    progressUpdates.push({
      total: progress.total,
      completed: progress.completed,
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
    });
    
    // Log progress every 5 updates
    if (progressUpdates.length % 5 === 0 || progress.completed === progress.total) {
      console.log(`Progress: ${progress.completed}/${progress.total} apartments (Page ${progress.currentPage || '?'}/${progress.totalPages || '?'})`);
    }
    
    if (progress.currentPage) {
      pagesProcessed = Math.max(pagesProcessed, progress.currentPage);
    }
  });
  
  const duration = (Date.now() - startTime) / 1000;
  
  if (result.success && result.data) {
    totalApartments = result.data.length;
    
    console.log(`\n✅ Search completed in ${duration.toFixed(1)} seconds`);
    console.log(`Total apartments found: ${totalApartments}`);
    console.log(`Pages processed: ${pagesProcessed}`);
    
    // Show first and last few apartments to verify we got multiple pages
    console.log('\nFirst 3 apartments:');
    result.data.slice(0, 3).forEach((apt, i) => {
      console.log(`${i + 1}. ${apt.title} - ¥${apt.price.toLocaleString()} - ${apt.address}`);
    });
    
    console.log('\nLast 3 apartments:');
    result.data.slice(-3).forEach((apt, i) => {
      console.log(`${totalApartments - 2 + i}. ${apt.title} - ¥${apt.price.toLocaleString()} - ${apt.address}`);
    });
    
    // Check unique IDs to ensure no duplicates
    const uniqueIds = new Set(result.data.map(apt => apt.externalId));
    console.log(`\nUnique apartment IDs: ${uniqueIds.size}`);
    
    // Success criteria
    if (totalApartments >= 700 && pagesProcessed >= 10) {
      console.log('\n✅ SUCCESS: Wagaya pagination is working correctly!');
      console.log(`   - Got ${totalApartments} apartments (expected ~750)`);
      console.log(`   - Processed ${pagesProcessed} pages (expected 10+)`);
      console.log(`   - No duplicates (${uniqueIds.size} unique IDs)`);
    } else if (totalApartments > 127) {
      console.log('\n⚠️  PARTIAL SUCCESS: Got more than first page');
      console.log(`   - Got ${totalApartments} apartments (expected ~750)`);
      console.log(`   - Processed ${pagesProcessed} pages (expected 10+)`);
    } else {
      console.log('\n❌ FAILURE: Still only getting first page');
      console.log(`   - Got ${totalApartments} apartments (expected ~750)`);
      console.log(`   - Processed ${pagesProcessed} pages (expected 10+)`);
    }
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
  
  // Also test with limit: undefined (sequential scraper mode)
  console.log('\n\n=== Testing with limit: undefined (Sequential Mode) ===\n');
  
  const sequentialParams = {
    minPrice: 50000,
    maxPrice: 300000,
    limit: undefined,
  };
  
  const sequentialResult = await scraper.search(sequentialParams, (progress) => {
    if (progress.completed % 100 === 0 || progress.completed === progress.total) {
      console.log(`Progress: ${progress.completed}/${progress.total} apartments`);
    }
  });
  
  if (sequentialResult.success && sequentialResult.data) {
    console.log(`\nTotal apartments found: ${sequentialResult.data.length}`);
    if (sequentialResult.data.length >= 700) {
      console.log('✅ Sequential mode also works correctly!');
    }
  }
}

// Run the test
testWagayaPaginationFix().catch(console.error);