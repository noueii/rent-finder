import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';

async function testScraperWithProxy() {
  console.log('🔍 Testing Wagaya Japan Scraper with Proxy');
  console.log('==========================================\n');
  
  // Set environment variable to use proxy file
  process.env.PROXY_FILE = 'src/lib/scrapers/data/proxilist.txt';
  process.env.PROXY_ROTATION_STRATEGY = 'round-robin';
  
  try {
    const scraper = new WagayaJapanScraper({
      rateLimit: 1000, // 1 second between requests
      maxRetries: 2,
      timeout: 30000, // 30 seconds timeout
    });
    
    console.log('Scraping apartments with proxy rotation...\n');
    
    const result = await scraper.search({
      maxPrice: 200000,
      minSize: 20,
      limit: 5, // Just get 5 apartments for testing
    });
    
    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Search failed');
    }
    
    const results = result.data;
    
    console.log(`\n✅ Successfully scraped ${results.length} apartments`);
    
    if (results.length > 0) {
      console.log('\nFirst apartment:');
      console.log('- Title:', results[0].title);
      console.log('- Price:', results[0].price);
      console.log('- Size:', results[0].size);
      console.log('- Source URL:', results[0].sourceUrl);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testScraperWithProxy().catch(console.error);