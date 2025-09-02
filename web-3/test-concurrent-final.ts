import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';
import type { ScraperConfig } from './src/types/scraper';

async function testConcurrentFinal() {
  console.log('🚀 Testing concurrent scraping (proxies disabled)\n');
  
  // Create scraper with custom config that disables proxies
  class TestWagayaScraper extends WagayaJapanScraper {
    constructor() {
      super();
      // Disable proxy rotation
      this.enableProxyRotation = false;
    }
  }
  
  const scraper = new TestWagayaScraper();
  
  // Just 3 URLs for the test
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103', 
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600104',
  ];

  console.log(`📋 Testing with ${testUrls.length} URLs (no proxies)\n`);
  
  // Test 1: Sequential fetching
  console.log('🐌 Test 1: Sequential fetching');
  console.log('------------------------------');
  const seqStart = Date.now();
  let seqSuccess = 0;
  
  for (let i = 0; i < testUrls.length; i++) {
    console.log(`Processing ${i + 1}/${testUrls.length}...`);
    try {
      const result = await scraper.fetchApartmentByUrl(testUrls[i]);
      if (result.success && result.data) {
        seqSuccess++;
        console.log(`✅ Success: ${result.data.title} - ¥${result.data.price.toLocaleString()}`);
      } else {
        console.log(`❌ Failed: ${result.error?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.log(`❌ Error: ${error.message}`);
    }
  }
  
  const seqTime = (Date.now() - seqStart) / 1000;
  console.log(`\n⏱️  Sequential time: ${seqTime.toFixed(2)}s`);
  console.log(`📊 Success rate: ${seqSuccess}/${testUrls.length}\n`);

  // Test 2: Concurrent fetching
  console.log('🚀 Test 2: Concurrent fetching');  
  console.log('------------------------------');
  const concStart = Date.now();
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent(
      testUrls,
      3, // 3 concurrent workers
      (progress) => {
        const elapsed = ((Date.now() - concStart) / 1000).toFixed(1);
        console.log(`[${elapsed}s] Progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed`);
      }
    );
    
    const concTime = (Date.now() - concStart) / 1000;
    console.log(`\n⏱️  Concurrent time: ${concTime.toFixed(2)}s`);
    console.log(`📊 Success rate: ${result.data?.length || 0}/${testUrls.length}`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n🏠 Successfully fetched:');
      result.data.forEach((apt, i) => {
        console.log(`${i + 1}. ${apt.title}`);
        console.log(`   - Price: ¥${apt.price.toLocaleString()}`);
        console.log(`   - Size: ${apt.size}m² (${apt.layout || 'N/A'})`);
      });
    }
    
    // Performance comparison
    if (seqSuccess > 0 && result.data && result.data.length > 0) {
      console.log('\n📈 Performance Summary:');
      const speedup = (seqTime / concTime).toFixed(1);
      console.log(`⚡ Speed improvement: ${speedup}x faster`);
      console.log(`⏰ Time saved: ${(seqTime - concTime).toFixed(1)}s`);
    }
    
  } catch (error: any) {
    console.error('Concurrent test failed:', error.message);
  }
}

// Run with timeout
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Test timeout after 60 seconds')), 60000);
});

Promise.race([testConcurrentFinal(), timeoutPromise])
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });