#!/usr/bin/env node

import { ScraperFactory } from './src/lib/scrapers/scraper-factory.js';

async function testConcurrentPerformance() {
  console.log('🚀 Testing concurrent scraping performance');
  console.log('==========================================\n');

  // Create a Wagaya scraper instance
  const scraper = ScraperFactory.create('wagaya-japan');
  
  // Test URLs for concurrent fetching
  const testUrls = [
    'https://wagaya-japan.com/en/rent/5822',
    'https://wagaya-japan.com/en/rent/5823',
    'https://wagaya-japan.com/en/rent/5824',
    'https://wagaya-japan.com/en/rent/5825',
    'https://wagaya-japan.com/en/rent/5826',
    'https://wagaya-japan.com/en/rent/5827',
    'https://wagaya-japan.com/en/rent/5828',
    'https://wagaya-japan.com/en/rent/5829',
    'https://wagaya-japan.com/en/rent/5830',
    'https://wagaya-japan.com/en/rent/5831',
  ];

  console.log(`📋 Testing with ${testUrls.length} URLs\n`);

  // Test 1: Sequential fetching (old way)
  console.log('🐌 Test 1: Sequential fetching');
  console.log('------------------------------');
  const sequentialStart = Date.now();
  let sequentialSuccess = 0;
  let sequentialFailed = 0;

  for (let i = 0; i < testUrls.length; i++) {
    try {
      const result = await scraper.fetchApartmentByUrl(testUrls[i]);
      if (result.success && result.data) {
        sequentialSuccess++;
        console.log(`✅ [${i + 1}/${testUrls.length}] Fetched: ${result.data.title}`);
      } else {
        sequentialFailed++;
        console.log(`❌ [${i + 1}/${testUrls.length}] Failed: ${testUrls[i]}`);
      }
    } catch (error) {
      sequentialFailed++;
      console.log(`❌ [${i + 1}/${testUrls.length}] Error: ${error.message}`);
    }
  }

  const sequentialTime = Date.now() - sequentialStart;
  console.log(`\n⏱️  Sequential time: ${(sequentialTime / 1000).toFixed(2)}s`);
  console.log(`✅ Success: ${sequentialSuccess}, ❌ Failed: ${sequentialFailed}\n`);

  // Test 2: Concurrent fetching (new way)
  console.log('🚀 Test 2: Concurrent fetching');
  console.log('------------------------------');
  const concurrentStart = Date.now();
  let concurrentCompleted = 0;
  let concurrentFailed = 0;

  const result = await scraper.fetchApartmentsByUrlsConcurrent(
    testUrls,
    undefined, // Let it calculate optimal concurrency
    (progress) => {
      concurrentCompleted = progress.completed;
      concurrentFailed = progress.failed;
      const total = progress.total || testUrls.length;
      const percentage = Math.round((progress.completed / total) * 100);
      console.log(`📊 Progress: ${progress.completed}/${total} (${percentage}%) - Failed: ${progress.failed}`);
    }
  );

  const concurrentTime = Date.now() - concurrentStart;
  console.log(`\n⏱️  Concurrent time: ${(concurrentTime / 1000).toFixed(2)}s`);
  console.log(`✅ Success: ${result.data?.length || 0}, ❌ Failed: ${concurrentFailed}`);

  // Summary
  console.log('\n📈 Performance Summary');
  console.log('======================');
  const speedup = (sequentialTime / concurrentTime).toFixed(2);
  const timeSaved = ((sequentialTime - concurrentTime) / 1000).toFixed(2);
  console.log(`⚡ Speed improvement: ${speedup}x faster`);
  console.log(`⏰ Time saved: ${timeSaved}s`);
  console.log(`🔧 Configuration:`);
  console.log(`   - Proxies: 300 loaded from proxilist.txt`);
  console.log(`   - User Agents: 288 unique combinations`);
  console.log(`   - Rate Limit: 0.5s per request (Wagaya)`);
  console.log(`   - Concurrent Workers: Dynamically calculated based on proxy count`);
}

// Run the test
testConcurrentPerformance().catch(console.error);