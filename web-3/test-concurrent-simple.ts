import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';

async function testConcurrent() {
  console.log('🚀 Testing concurrent scraping with Wagaya Japan');
  console.log('===============================================\n');

  // Create scraper instance
  const scraper = new WagayaJapanScraper();
  
  // Small set of test URLs - using the correct Wagaya URL pattern
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600104',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600105',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600106',
  ];

  console.log(`📋 Testing with ${testUrls.length} URLs\n`);

  // Sequential test
  console.log('🐌 Sequential fetching:');
  const seqStart = Date.now();
  
  for (let i = 0; i < testUrls.length; i++) {
    try {
      const result = await scraper.fetchApartmentByUrl(testUrls[i]);
      if (result.success) {
        console.log(`✅ [${i + 1}/${testUrls.length}] Success`);
      } else {
        console.log(`❌ [${i + 1}/${testUrls.length}] Failed`);
      }
    } catch (error) {
      console.log(`❌ [${i + 1}/${testUrls.length}] Error`);
    }
  }
  
  const seqTime = (Date.now() - seqStart) / 1000;
  console.log(`⏱️  Sequential: ${seqTime.toFixed(2)}s\n`);

  // Concurrent test
  console.log('🚀 Concurrent fetching:');
  const concStart = Date.now();
  
  const result = await scraper.fetchApartmentsByUrlsConcurrent(testUrls);
  
  const concTime = (Date.now() - concStart) / 1000;
  console.log(`✅ Fetched: ${result.data?.length || 0} apartments`);
  console.log(`⏱️  Concurrent: ${concTime.toFixed(2)}s\n`);

  // Summary
  console.log('📈 Results:');
  console.log(`⚡ ${(seqTime / concTime).toFixed(1)}x faster`);
  console.log(`⏰ Saved ${(seqTime - concTime).toFixed(1)}s`);
}

testConcurrent().catch(console.error);