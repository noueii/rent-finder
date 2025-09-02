import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import { ProxyManager } from './src/lib/scrapers/utils/proxy-manager';

async function testConcurrentWithProxies() {
  console.log('🚀 Testing concurrent scraping WITH proxies\n');
  
  // First, let's check how many proxies we have
  const proxyManager = ProxyManager.fromEnv();
  console.log(`📋 Proxy Status:`);
  console.log(`   - Total proxies loaded: ${proxyManager.getProxyCount()}`);
  console.log(`   - Available proxies: ${proxyManager.getAvailableProxyCount()}`);
  console.log(`   - Rotation strategy: ${proxyManager['rotationStrategy']}\n`);
  
  // Create scraper (proxies enabled by default)
  const scraper = new WagayaJapanScraper();
  
  // Test URLs
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600104',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600105',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600106',
  ];

  console.log(`📋 Testing with ${testUrls.length} URLs using proxies\n`);
  
  // Concurrent test with proxies
  console.log('🚀 Concurrent fetching with proxy rotation:');
  console.log('----------------------------------------');
  const concStart = Date.now();
  let lastProgress = { completed: 0, failed: 0 };
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent(
      testUrls,
      undefined, // Let it calculate optimal concurrency based on proxy count
      (progress) => {
        lastProgress = { completed: progress.completed, failed: progress.failed };
        const elapsed = ((Date.now() - concStart) / 1000).toFixed(1);
        const rate = progress.completed > 0 ? (progress.completed / parseFloat(elapsed)).toFixed(1) : '0';
        console.log(`[${elapsed}s] Progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed (${rate} apt/s)`);
      }
    );
    
    const concTime = (Date.now() - concStart) / 1000;
    console.log(`\n⏱️  Total time: ${concTime.toFixed(2)}s`);
    console.log(`📊 Results: ${result.data?.length || 0} successful, ${lastProgress.failed} failed`);
    console.log(`⚡ Average rate: ${(result.data?.length || 0) / concTime.toFixed(1)} apartments/second`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n🏠 Successfully fetched:');
      result.data.forEach((apt, i) => {
        console.log(`${i + 1}. ${apt.title}`);
        console.log(`   - Price: ¥${apt.price.toLocaleString()}`);
        console.log(`   - Size: ${apt.size}m² (${apt.layout || 'N/A'})`);
      });
    }
    
    // Show proxy performance stats
    console.log('\n📊 Proxy Performance Stats:');
    const stats = proxyManager.getPerformanceStats();
    const topProxies = stats.slice(0, 5);
    console.log('Top 5 performing proxies:');
    topProxies.forEach((stat, i) => {
      console.log(`${i + 1}. ${stat.proxy} - Success: ${stat.successRate}%, Avg: ${stat.avgResponseTime}ms`);
    });
    
    const failedProxies = stats.filter(s => s.failureCount > 0).length;
    console.log(`\n⚠️  Failed proxies: ${failedProxies}/${proxyManager.getProxyCount()}`);
    
  } catch (error: any) {
    console.error('Concurrent test failed:', error.message);
  }
}

// Run with timeout
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Test timeout after 60 seconds')), 60000);
});

Promise.race([testConcurrentWithProxies(), timeoutPromise])
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });