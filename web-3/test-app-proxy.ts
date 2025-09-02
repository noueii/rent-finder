// Test if our app's proxy manager works correctly for RealEstate

// Set environment to use HTTP proxies for RealEstate
process.env.REALESTATE_PROXY_TYPE = 'http';
process.env.REALESTATE_PROXY_FILE = 'src/lib/scrapers/data/proxyscrape_premium_http_proxies.txt';
process.env.USE_FAST_SCRAPERS = 'true';

import { FastRealEstateScraper } from './src/lib/scrapers/sources/fast-realestate-scraper';

async function testProxyManager() {
  console.log('🧪 Testing RealEstate Proxy Manager in our app\n');
  
  const scraper = new FastRealEstateScraper();
  console.log(`✅ Scraper created: ${scraper.getName()}`);
  
  // Check if HTTP proxies were loaded
  const proxyHealth = scraper.getProxyHealth();
  console.log('\n📊 Proxy Manager Status:');
  console.log(`   Available: ${proxyHealth.available}`);
  console.log(`   Total proxies: ${proxyHealth.total || 0}`);
  console.log(`   Healthy proxies: ${proxyHealth.healthy || 0}`);
  
  // Test actual scraping
  console.log('\n🔍 Testing apartment fetch...');
  const testUrl = 'https://realestate.co.jp/en/rent/view/1254309';
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent([testUrl], 1);
    
    if (result.success && result.data?.length > 0) {
      console.log('\n✅ SUCCESS! Our proxy manager works!');
      console.log(`   Apartment: ${result.data[0].title}`);
      console.log(`   Rent: ¥${result.data[0].rent?.toLocaleString()}`);
      console.log(`   Duration: ${result.metadata.duration}ms`);
      
      // The proxy manager is working if we got here
      console.log('\n🎉 HTTP PROXY MANAGER IS WORKING IN THE APP!');
    } else {
      console.log('\n❌ Failed to fetch apartment');
      console.log(result);
    }
  } catch (error: any) {
    console.log('\n❌ Error:', error.message);
    console.log('This might mean proxy manager issues');
  }
}

testProxyManager().catch(console.error);