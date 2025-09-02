/**
 * Test script to verify benchmarks are working
 * This runs a minimal set of benchmarks to ensure everything is set up correctly
 */

import { benchmark, formatResults } from './utils';

async function testBenchmarks() {
  console.log('🧪 Testing benchmark utilities...\n');
  
  // Test synchronous operation
  const syncResult = await benchmark(
    () => {
      // Simulate some work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
    },
    {
      name: 'Sync Operation',
      runs: 10,
      warmup: 2,
    }
  );
  
  // Test async operation
  const asyncResult = await benchmark(
    async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    },
    {
      name: 'Async Operation (10ms)',
      runs: 10,
      warmup: 2,
    }
  );
  
  // Test error handling
  try {
    await benchmark(
      () => {
        throw new Error('Test error');
      },
      {
        name: 'Error Test',
        runs: 1,
      }
    );
  } catch (error) {
    console.log('✓ Error handling works correctly\n');
  }
  
  // Display results
  console.log('📊 Test Results:\n');
  console.log(formatResults([syncResult, asyncResult]));
  
  console.log('\n✅ Benchmark utilities are working correctly!');
  console.log('\nYou can now run the full benchmarks with:');
  console.log('  npm run benchmark');
}

// Run test
if (require.main === module) {
  testBenchmarks().catch(console.error);
}