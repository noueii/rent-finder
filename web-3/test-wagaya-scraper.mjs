// Test Wagaya scraper directly
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Build first
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

async function testWagayaScraper() {
  console.log('\n=== Testing Wagaya Scraper ===\n');
  
  const scraper = ScraperFactory.create('wagaya');
  
  // Test with fetchAll: true
  console.log('Testing with fetchAll: true');
  const params = {
    minPrice: 50000,
    maxPrice: 300000,
    fetchAll: true,
  };
  
  let totalApartments = 0;
  let pagesProcessed = 0;
  
  console.log('Starting search...');
  const result = await scraper.search(params, (progress) => {
    console.log('Progress:', {
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
    totalApartments = result.data.length;
    console.log(`\n✅ Search completed`);
    console.log(`Total apartments found: ${totalApartments}`);
    console.log(`Pages processed: ${pagesProcessed}`);
    
    // Show first few apartments
    console.log('\nFirst 3 apartments:');
    result.data.slice(0, 3).forEach((apt, i) => {
      console.log(`${i + 1}. ${apt.title} - ¥${apt.price.toLocaleString()} - ${apt.address}`);
    });
    
    // Check if we got all the data
    if (totalApartments >= 126) {
      console.log('\n✅ SUCCESS: Got all apartments from JavaScript data!');
    } else if (totalApartments === 30) {
      console.log('\n⚠️  Only got 30 apartments (single page HTML)');
    } else {
      console.log('\n❓ Unexpected number of apartments');
    }
  } else {
    console.log('\n❌ Search failed:', result.error);
  }
}

// Run the test
testWagayaScraper().catch(console.error);