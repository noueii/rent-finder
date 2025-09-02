import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';

async function testSocksProxy() {
  console.log('🔍 Testing SOCKS Proxy with Wagaya Japan');
  console.log('========================================\n');
  
  // Set environment variable to use SOCKS proxy file
  process.env.PROXY_FILE = 'src/lib/scrapers/data/proxyscrape_premium_socks_proxies.txt';
  process.env.PROXY_ROTATION_STRATEGY = 'round-robin';
  
  // We need to modify the proxy manager to recognize these as SOCKS proxies
  // Since the file doesn't have socks5:// prefix, we'll need to update the parser
  
  try {
    const scraper = new WagayaJapanScraper({
      rateLimit: 1000, // 1 second between requests
      maxRetries: 2,
      timeout: 30000, // 30 seconds timeout
    });
    
    console.log('Scraping apartments with SOCKS proxy rotation...\n');
    
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
      
      // Check if proxy was used
      if (result.metadata?.proxy) {
        console.log('\n🌐 Proxy used:', result.metadata.proxy);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSocksProxy().catch(console.error);