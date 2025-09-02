// Test to understand why Wagaya and Metro stop after first fetchAll
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

async function testFetchAll() {
  console.log('\n=== Testing FetchAll Behavior ===\n');
  
  // Test 1: Wagaya with fetchAll: true
  console.log('1. Testing Wagaya with fetchAll: true');
  const wagayaScraper = ScraperFactory.create('wagaya');
  
  const wagayaParams = {
    minPrice: 50000,
    maxPrice: 300000,
    fetchAll: true,
  };
  
  console.log('Params:', wagayaParams);
  
  let wagayaTotal = 0;
  let wagayaPages = 0;
  
  const wagayaResult = await wagayaScraper.search(wagayaParams, (progress) => {
    console.log(`Progress:`, {
      total: progress.total,
      completed: progress.completed,
      currentPage: progress.currentPage,
      totalPages: progress.totalPages,
    });
    if (progress.currentPage) {
      wagayaPages = Math.max(wagayaPages, progress.currentPage);
    }
  });
  
  if (wagayaResult.success && wagayaResult.data) {
    wagayaTotal = wagayaResult.data.length;
    console.log(`\nWagaya Results: ${wagayaTotal} apartments across ${wagayaPages} pages`);
    console.log(`First apartment:`, wagayaResult.data[0]?.title);
    console.log(`Last apartment:`, wagayaResult.data[wagayaTotal - 1]?.title);
  } else {
    console.log('\nWagaya failed:', wagayaResult.error);
  }
  
  // Test 2: Metro with fetchAll: true
  console.log('\n\n2. Testing Metro with fetchAll: true');
  const metroScraper = ScraperFactory.create('metro');
  
  const metroParams = {
    minPrice: 50000,
    maxPrice: 300000,
    fetchAll: true,
  };
  
  console.log('Params:', metroParams);
  
  let metroTotal = 0;
  
  const metroResult = await metroScraper.search(metroParams, (progress) => {
    console.log(`Progress:`, {
      total: progress.total,
      completed: progress.completed,
    });
  });
  
  if (metroResult.success && metroResult.data) {
    metroTotal = metroResult.data.length;
    console.log(`\nMetro Results: ${metroTotal} apartments`);
    console.log(`First apartment:`, metroResult.data[0]?.title);
    console.log(`Last apartment:`, metroResult.data[metroTotal - 1]?.title);
  } else {
    console.log('\nMetro failed:', metroResult.error);
  }
  
  // Test 3: Compare with limit: undefined
  console.log('\n\n3. Testing Wagaya with limit: undefined (no fetchAll)');
  const wagayaParams2 = {
    minPrice: 50000,
    maxPrice: 300000,
    limit: undefined,
  };
  
  console.log('Params:', wagayaParams2);
  
  let wagayaTotal2 = 0;
  let wagayaPages2 = 0;
  
  const wagayaResult2 = await wagayaScraper.search(wagayaParams2, (progress) => {
    if (progress.currentPage) {
      wagayaPages2 = Math.max(wagayaPages2, progress.currentPage);
    }
  });
  
  if (wagayaResult2.success && wagayaResult2.data) {
    wagayaTotal2 = wagayaResult2.data.length;
    console.log(`\nWagaya Results (limit: undefined): ${wagayaTotal2} apartments across ${wagayaPages2} pages`);
  }
  
  // Summary
  console.log('\n\n=== Summary ===');
  console.log(`Wagaya with fetchAll: true - ${wagayaTotal} apartments`);
  console.log(`Wagaya with limit: undefined - ${wagayaTotal2} apartments`);
  console.log(`Metro with fetchAll: true - ${metroTotal} apartments`);
  
  if (wagayaTotal === wagayaTotal2) {
    console.log('\n✅ Both methods produce the same results for Wagaya');
  } else {
    console.log('\n❌ Different results between fetchAll and limit:undefined');
  }
}

// Run the test
testFetchAll().catch(console.error);