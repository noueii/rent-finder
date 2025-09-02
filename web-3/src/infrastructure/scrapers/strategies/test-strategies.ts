/**
 * Test file to verify strategy implementations
 * Run with: npx tsx src/infrastructure/scrapers/strategies/test-strategies.ts
 */

import { 
  SequentialStrategy, 
  ConcurrentStrategy, 
  QueueStrategy, 
  StreamStrategy,
  createStrategy 
} from './index';

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSequentialStrategy() {
  console.log('\n=== Testing Sequential Strategy ===');
  
  const strategy = new SequentialStrategy<string>({
    maxRetries: 2,
    retryDelay: 100,
    continueOnError: true
  });
  
  const urls = ['url1', 'url2', 'url3'];
  let processCount = 0;
  
  const result = await strategy.execute(
    urls,
    async (url) => {
      processCount++;
      console.log(`Processing ${url} (count: ${processCount})`);
      await delay(100);
      if (url === 'url2') throw new Error('Simulated error');
      return `Result for ${url}`;
    },
    {
      logger: console,
      onProgress: (progress) => {
        console.log(`Progress: ${progress.percentage.toFixed(0)}%`);
      }
    }
  );
  
  console.log('Results:', {
    success: result.success.length,
    failed: result.failed.length,
    stats: strategy.getStats()
  });
}

async function testConcurrentStrategy() {
  console.log('\n=== Testing Concurrent Strategy ===');
  
  const strategy = new ConcurrentStrategy<string>({
    concurrency: 3,
    rampUpDelay: 50,
    maxRetries: 1,
    continueOnError: true
  });
  
  const urls = Array.from({ length: 10 }, (_, i) => `url${i}`);
  const activeConcurrent = new Set<string>();
  let maxConcurrent = 0;
  
  const result = await strategy.execute(
    urls,
    async (url) => {
      activeConcurrent.add(url);
      maxConcurrent = Math.max(maxConcurrent, activeConcurrent.size);
      console.log(`Processing ${url} (active: ${activeConcurrent.size})`);
      
      await delay(Math.random() * 200);
      activeConcurrent.delete(url);
      
      return `Result for ${url}`;
    }
  );
  
  console.log('Results:', {
    success: result.success.length,
    maxConcurrent,
    stats: strategy.getStats()
  });
}

async function testQueueStrategy() {
  console.log('\n=== Testing Queue Strategy ===');
  
  const strategy = new QueueStrategy<string>({
    concurrency: 2,
    processingOrder: 'priority',
    priorityFunction: (url) => {
      if (url.includes('high')) return 10;
      if (url.includes('medium')) return 5;
      return 1;
    },
    batchSize: 3,
    batchDelay: 100
  });
  
  const urls = [
    'normal1', 'high1', 'normal2', 'medium1', 'high2', 'normal3'
  ];
  
  const processingOrder: string[] = [];
  
  const result = await strategy.execute(
    urls,
    async (url) => {
      processingOrder.push(url);
      console.log(`Processing ${url}`);
      await delay(50);
      return `Result for ${url}`;
    }
  );
  
  console.log('Results:', {
    processingOrder,
    expectedOrder: ['high1', 'high2', 'medium1', 'normal1', 'normal2', 'normal3']
  });
}

async function testStreamStrategy() {
  console.log('\n=== Testing Stream Strategy ===');
  
  const strategy = new StreamStrategy<string>({
    concurrency: 2,
    highWaterMark: 5,
    lowWaterMark: 2
  });
  
  const urls = Array.from({ length: 20 }, (_, i) => `url${i}`);
  let streamedCount = 0;
  
  // Test async iteration
  console.log('Starting stream...');
  for await (const result of strategy.stream(
    urls,
    async (url) => {
      await delay(Math.random() * 100);
      if (Math.random() > 0.8) throw new Error('Random error');
      return `Result for ${url}`;
    }
  )) {
    streamedCount++;
    if (result.data) {
      console.log(`Streamed ${result.index}: ${result.data}`);
    } else {
      console.log(`Failed ${result.index}: ${result.error?.message}`);
    }
  }
  
  console.log(`Total streamed: ${streamedCount}`);
}

async function testFactoryPattern() {
  console.log('\n=== Testing Factory Pattern ===');
  
  const configs = [
    { type: 'sequential' as const, name: 'Sequential' },
    { type: 'concurrent' as const, name: 'Concurrent', concurrency: 3 },
    { type: 'queue' as const, name: 'Queue', concurrency: 2 },
    { type: 'stream' as const, name: 'Stream', concurrency: 2 }
  ];
  
  for (const config of configs) {
    console.log(`\nCreating ${config.name} strategy...`);
    const strategy = createStrategy<string>(config);
    console.log(`Created: ${strategy.constructor.name}`);
  }
}

// Run tests
async function runTests() {
  try {
    await testSequentialStrategy();
    await testConcurrentStrategy();
    await testQueueStrategy();
    await testStreamStrategy();
    await testFactoryPattern();
    
    console.log('\n✅ All tests completed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Only run if executed directly
if (require.main === module) {
  runTests();
}