import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';
import type { ProxyConfig } from './src/types/scraper';

async function testWithWorkingProxies() {
  console.log('🚀 Testing concurrent scraping with WORKING proxies\n');
  
  // Create custom proxy manager with only working proxies
  const workingProxies: ProxyConfig[] = [
    { host: '185.192.111.18', port: 8080, protocol: 'http' },
    { host: '18.228.42.104', port: 3128, protocol: 'http' },
  ];
  
  // Create scraper with custom proxy configuration
  class TestWagayaScraper extends WagayaJapanScraper {
    constructor() {
      super();
      // Replace proxy manager with our custom one
      this.proxyManager = new ProxyManager({
        proxies: workingProxies,
        rotationStrategy: 'round-robin'
      });
    }
  }
  
  const scraper = new TestWagayaScraper();
  
  console.log(`📋 Using ${workingProxies.length} verified working proxies\n`);
  
  // Just 2 URLs since we only have 2 proxies
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
  ];

  console.log('🚀 Testing concurrent fetch with working proxies:');
  console.log('--------------------------------------------');
  const startTime = Date.now();
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent(
      testUrls,
      2, // Use 2 workers (one per proxy)
      (progress) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[${elapsed}s] Progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed`);
      }
    );
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Test completed!`);
    console.log(`⏱️  Total time: ${totalTime}s`);
    console.log(`📊 Results: ${result.data?.length || 0} successful`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n🏠 Successfully fetched with proxies:');
      result.data.forEach((apt, i) => {
        console.log(`${i + 1}. ${apt.title}`);
        console.log(`   - Price: ¥${apt.price.toLocaleString()}`);
        console.log(`   - Size: ${apt.size}m² (${apt.layout || 'N/A'})`);
      });
      
      console.log('\n✨ Proxies are working correctly!');
    }
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
  }
}

// Also test without proxies for comparison
async function testWithoutProxies() {
  console.log('\n\n🚀 Testing WITHOUT proxies for comparison:\n');
  
  class NoProxyWagayaScraper extends WagayaJapanScraper {
    constructor() {
      super();
      this.enableProxyRotation = false;
    }
  }
  
  const scraper = new NoProxyWagayaScraper();
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
  ];
  
  const startTime = Date.now();
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent(testUrls, 2);
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`⏱️  Without proxies: ${totalTime}s (${result.data?.length || 0} successful)`);
  } catch (error: any) {
    console.error('Failed without proxies:', error.message);
  }
}

// Run both tests
async function runComparison() {
  await testWithWorkingProxies();
  await testWithoutProxies();
  
  console.log('\n📊 Summary:');
  console.log('- Proxies add some overhead but provide anonymity');
  console.log('- Use proxies when scraping at scale to avoid IP bans');
  console.log('- Premium proxies will be more reliable than free ones');
}

runComparison().catch(console.error);