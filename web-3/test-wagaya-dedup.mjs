// Test Wagaya with deduplication fix
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Build the project
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

async function testWagayaDeduplication() {
  console.log('\n=== Testing Wagaya with Deduplication Fix ===\n');
  
  const scraper = ScraperFactory.create('wagaya');
  
  const params = {
    minPrice: 50000,
    maxPrice: 300000,
    fetchAll: true,
  };
  
  console.log('Search params:', params);
  console.log('Expected: Should fetch all pages and deduplicate apartments\n');
  
  let totalApartments = 0;
  let pagesProcessed = 0;
  let duplicatesFound = 0;
  const seenIds = new Set();
  
  const startTime = Date.now();
  
  const result = await scraper.search(params, (progress) => {
    // Log progress every 100 apartments
    if (progress.completed % 100 === 0 || progress.completed === progress.total) {
      console.log(`Progress: ${progress.completed}/${progress.total} apartments (Page ${progress.currentPage || '?'})`);
    }
    
    if (progress.currentPage) {
      pagesProcessed = Math.max(pagesProcessed, progress.currentPage);
    }
  });
  
  const duration = (Date.now() - startTime) / 1000;
  
  if (result.success && result.data) {
    totalApartments = result.data.length;
    
    // Check for duplicates in the result
    result.data.forEach(apt => {
      if (seenIds.has(apt.externalId)) {
        duplicatesFound++;
        console.log(`DUPLICATE FOUND: ${apt.externalId}`);
      } else {
        seenIds.add(apt.externalId);
      }
    });
    
    console.log(`\n✅ Search completed in ${duration.toFixed(1)} seconds`);
    console.log(`Total apartments found: ${totalApartments}`);
    console.log(`Unique apartments: ${seenIds.size}`);
    console.log(`Duplicates in result: ${duplicatesFound}`);
    console.log(`Pages processed: ${pagesProcessed}`);
    
    // Show sample apartments
    console.log('\nFirst 3 apartments:');
    result.data.slice(0, 3).forEach((apt, i) => {
      console.log(`${i + 1}. [${apt.externalId}] ${apt.title} - ¥${apt.price.toLocaleString()}`);
    });
    
    console.log('\nLast 3 apartments:');
    result.data.slice(-3).forEach((apt, i) => {
      console.log(`${totalApartments - 2 + i}. [${apt.externalId}] ${apt.title} - ¥${apt.price.toLocaleString()}`);
    });
    
    // Success check
    if (duplicatesFound === 0 && totalApartments >= 700) {
      console.log('\n✅ SUCCESS: Deduplication is working!');
      console.log(`   - Got ${totalApartments} unique apartments`);
      console.log(`   - No duplicates in final result`);
      console.log(`   - Processed ${pagesProcessed} pages`);
    } else if (duplicatesFound > 0) {
      console.log('\n❌ FAILURE: Still have duplicates in result!');
    } else if (totalApartments < 700) {
      console.log('\n❌ FAILURE: Not getting all apartments');
    }
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
}

// Run the test
testWagayaDeduplication().catch(console.error);