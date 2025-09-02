import { WagayaJapanScraper } from './src/lib/scrapers/sources/wagaya-japan-scraper';

async function testWithTimeout() {
  console.log('🚀 Testing concurrent scraping with timeout\n');

  const scraper = new WagayaJapanScraper();
  
  // Just 2 URLs for quick test
  const testUrls = [
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600102',
    'https://wagaya-japan.com/en/chintai_detail.php?id=2600103',
  ];

  console.log('Testing concurrent fetch with progress tracking...\n');
  
  const startTime = Date.now();
  let lastProgress = { completed: 0, failed: 0 };
  
  try {
    const result = await scraper.fetchApartmentsByUrlsConcurrent(
      testUrls,
      2, // Force only 2 concurrent workers
      (progress) => {
        lastProgress = { completed: progress.completed, failed: progress.failed };
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[${elapsed}s] Progress: ${progress.completed} completed, ${progress.failed} failed`);
      }
    );
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ Test completed!');
    console.log(`⏱️  Total time: ${totalTime}s`);
    console.log(`📊 Results: ${result.data?.length || 0} successful, ${lastProgress.failed} failed`);
    
    if (result.data && result.data.length > 0) {
      console.log('\n🏠 Sample apartment data:');
      const sample = result.data[0];
      console.log(`- Title: ${sample.title}`);
      console.log(`- Price: ¥${sample.price.toLocaleString()}`);
      console.log(`- Size: ${sample.size}m²`);
      console.log(`- Layout: ${sample.layout}`);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

// Add timeout to prevent hanging
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Test timeout after 30 seconds')), 30000);
});

Promise.race([testWithTimeout(), timeoutPromise])
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Test failed:', error.message);
    process.exit(1);
  });