import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import { FastWagayaJapanScraper } from './src/lib/scrapers/sources/fast-wagaya-scraper';

async function compareSpeed() {
  console.log('🏁 Speed Comparison: Standard vs Fast Scraper');
  console.log('============================================\n');
  
  // Use the optimized proxy file
  process.env.PROXY_FILE = 'src/lib/scrapers/data/fast-socks-proxies.txt';
  process.env.PROXY_ROTATION_STRATEGY = 'performance';
  
  const searchParams = {
    maxPrice: 200000,
    minSize: 20,
    limit: 50, // Fetch 50 apartments
  };
  
  // Test 1: Standard Scraper
  console.log('📊 Standard Wagaya Scraper');
  console.log('-------------------------');
  
  const standardScraper = new WagayaJapanScraper({
    rateLimit: 500,
    maxRetries: 2,
    timeout: 15000,
  });
  
  console.log('Starting standard scraping...');
  const standardStart = Date.now();
  
  try {
    const result = await standardScraper.search(searchParams);
    const standardDuration = Date.now() - standardStart;
    
    if (result.success && result.data) {
      console.log(`✅ Success: ${result.data.length} apartments in ${standardDuration}ms`);
      console.log(`   Rate: ${(result.data.length / (standardDuration / 1000)).toFixed(1)} apartments/second`);
      console.log(`   Avg per apartment: ${(standardDuration / result.data.length).toFixed(0)}ms`);
    } else {
      console.log(`❌ Failed: ${result.error?.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  console.log('\n⏸️ Waiting 5 seconds before next test...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Test 2: Fast Scraper
  console.log('⚡ Fast Wagaya Scraper');
  console.log('---------------------');
  
  const fastScraper = new FastWagayaJapanScraper({
    rateLimit: 200,
    maxRetries: 2,
    timeout: 10000,
  });
  
  console.log('Starting fast scraping with concurrent requests...');
  const fastStart = Date.now();
  
  try {
    const result = await fastScraper.search({
      ...searchParams,
      warmupProxies: true, // Enable proxy warmup
    });
    const fastDuration = Date.now() - fastStart;
    
    if (result.success && result.data) {
      console.log(`✅ Success: ${result.data.length} apartments in ${fastDuration}ms`);
      console.log(`   Rate: ${(result.data.length / (fastDuration / 1000)).toFixed(1)} apartments/second`);
      console.log(`   Avg per apartment: ${(fastDuration / result.data.length).toFixed(0)}ms`);
      
      if (result.metadata) {
        console.log(`\n📊 Performance Metrics:`);
        console.log(`   Pages fetched: ${result.metadata.pagesFetched || 'N/A'}`);
        console.log(`   Fetch duration: ${result.metadata.fetchDuration || 'N/A'}ms`);
        
        if (result.metadata.proxyHealth) {
          const health = result.metadata.proxyHealth;
          console.log(`   Proxy health: ${health.healthy}/${health.total} healthy`);
          console.log(`   Avg proxy latency: ${health.avgLatency?.toFixed(0) || 'N/A'}ms`);
        }
      }
    } else {
      console.log(`❌ Failed: ${result.error?.message}`);
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
  
  // Cleanup
  if (fastScraper.destroy) {
    fastScraper.destroy();
  }
  
  console.log('\n📈 Summary');
  console.log('==========');
  console.log('The fast scraper uses:');
  console.log('- Concurrent page fetching');
  console.log('- Performance-based proxy selection');
  console.log('- Pre-warmed proxy connections');
  console.log('- Optimized timeout settings');
  console.log('\nThese optimizations can provide 3-5x speed improvements!');
}

compareSpeed().catch(console.error);