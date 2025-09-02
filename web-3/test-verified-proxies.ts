import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';

async function testVerifiedProxies() {
  console.log('🚀 Testing with verified working proxies only\n');
  
  // Load the default proxy manager (will use proxilist.txt)
  const proxyManager = ProxyManager.fromEnv();
  console.log(`📋 Proxy Configuration:`);
  console.log(`   - Total proxies: ${proxyManager.getProxyCount()}`);
  console.log(`   - Available proxies: ${proxyManager.getAvailableProxyCount()}`);
  
  // List the proxies
  console.log(`\n📌 Loaded proxies:`);
  for (let i = 0; i < proxyManager.getProxyCount(); i++) {
    const proxy = proxyManager.getNextProxy();
    if (proxy) {
      console.log(`   ${i + 1}. ${proxy.host}:${proxy.port}`);
    }
  }
  
  // Create scraper (will use the loaded proxies)
  const scraper = new WagayaJapanScraper();
  
  // Test URLs - use 4 URLs to test proxy rotation
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600104',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600105',
  ];

  console.log(`\n📋 Testing ${testUrls.length} URLs with ${proxyManager.getProxyCount()} proxies`);
  console.log('🔄 Proxy rotation: Each request will alternate between proxies\n');
  
  const startTime = Date.now();
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent(
      testUrls,
      2, // Use 2 concurrent workers (matching our proxy count)
      (progress) => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = progress.completed > 0 ? (progress.completed / parseFloat(elapsed)).toFixed(1) : '0';
        console.log(`[${elapsed}s] Progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed (${rate} apt/s)`);
      }
    );
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\n✅ Test completed!`);
    console.log(`⏱️  Total time: ${totalTime}s`);
    console.log(`📊 Results: ${result.data?.length || 0}/${testUrls.length} successful`);
    console.log(`⚡ Average rate: ${((result.data?.length || 0) / parseFloat(totalTime)).toFixed(1)} apartments/second`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n🏠 Successfully fetched apartments:');
      result.data.forEach((apt, i) => {
        console.log(`${i + 1}. ${apt.title}`);
        console.log(`   - Price: ¥${apt.price.toLocaleString()}`);
        console.log(`   - Size: ${apt.size}m² (${apt.layout || 'N/A'})`);
        console.log(`   - Location: ${apt.address}`);
      });
    }
    
    // Show proxy performance
    console.log('\n📊 Proxy Performance:');
    const stats = proxyManager.getPerformanceStats();
    stats.forEach((stat) => {
      console.log(`- ${stat.proxy}:`);
      console.log(`  Success rate: ${stat.successRate}%`);
      console.log(`  Avg response: ${stat.avgResponseTime}ms`);
      console.log(`  Used: ${stat.successCount + stat.failureCount} times`);
    });
    
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testVerifiedProxies().catch(console.error);