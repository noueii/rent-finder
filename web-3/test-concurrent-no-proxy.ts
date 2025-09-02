import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';

async function testConcurrentNoProxy() {
  console.log('🚀 Testing concurrent scraping WITHOUT proxies\n');
  
  // Set environment to disable proxies
  process.env.PROXY_ENABLED = 'false';
  
  const scraper = new WagayaJapanScraper();
  
  // Just 3 URLs for quick test
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600104',
  ];

  console.log(`📋 Testing with ${testUrls.length} URLs\n`);
  
  // Sequential test
  console.log('🐌 Sequential fetching:');
  const seqStart = Date.now();
  let seqSuccess = 0;
  
  for (let i = 0; i < testUrls.length; i++) {
    try {
      const result = await scraper.fetchApartmentByUrl(testUrls[i]);
      if (result.success && result.data) {
        seqSuccess++;
        console.log(`✅ [${i + 1}/${testUrls.length}] ${result.data.title} - ¥${result.data.price.toLocaleString()}`);
      } else {
        console.log(`❌ [${i + 1}/${testUrls.length}] Failed`);
      }
    } catch (error) {
      console.log(`❌ [${i + 1}/${testUrls.length}] Error`);
    }
  }
  
  const seqTime = (Date.now() - seqStart) / 1000;
  console.log(`\n⏱️  Sequential: ${seqTime.toFixed(2)}s (${seqSuccess} successful)\n`);

  // Concurrent test
  console.log('🚀 Concurrent fetching:');
  const concStart = Date.now();
  
  const result = await scraper.fetchApartmentsByUrlsConcurrent(
    testUrls,
    3, // 3 concurrent workers
    (progress) => {
      console.log(`📊 Progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed`);
    }
  );
  
  const concTime = (Date.now() - concStart) / 1000;
  console.log(`\n✅ Concurrent: ${concTime.toFixed(2)}s`);
  console.log(`📊 Results: ${result.data?.length || 0} successful`);
  
  if (result.data && result.data.length > 0) {
    console.log('\n🏠 Fetched apartments:');
    result.data.forEach((apt, i) => {
      console.log(`${i + 1}. ${apt.title} - ¥${apt.price.toLocaleString()} - ${apt.size}m² ${apt.layout || ''}`);
    });
  }
  
  // Summary
  console.log('\n📈 Performance Summary:');
  console.log(`⚡ ${(seqTime / concTime).toFixed(1)}x faster with concurrent processing`);
  console.log(`⏰ Time saved: ${(seqTime - concTime).toFixed(1)}s`);
}

testConcurrentNoProxy().catch(console.error);