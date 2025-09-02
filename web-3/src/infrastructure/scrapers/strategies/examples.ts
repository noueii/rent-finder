/**
 * Strategy Usage Examples
 * Demonstrates how to use different scraping strategies
 */

import { createStrategy, StreamStrategy } from './index';
import type { StrategyFactoryConfig } from './index';

// Example 1: Sequential Strategy (safest for rate-limited sites)
export async function sequentialExample() {
  const strategy = createStrategy<any>({
    type: 'sequential',
    maxRetries: 3,
    retryDelay: 1000,
    retryBackoff: 'exponential',
    timeout: 30000,
    continueOnError: true
  });
  
  const urls = ['https://example1.com', 'https://example2.com'];
  
  const result = await strategy.execute(
    urls,
    async (url) => {
      // Your scraping logic here
      const response = await fetch(url);
      return await response.text();
    },
    {
      logger: console,
      onProgress: (progress) => {
        console.log(`Progress: ${progress.percentage.toFixed(2)}% (${progress.completed}/${progress.total})`);
      }
    }
  );
  
  console.log(`Success: ${result.success.length}, Failed: ${result.failed.length}`);
}

// Example 2: Concurrent Strategy (faster for sites that allow it)
export async function concurrentExample() {
  const strategy = createStrategy<any>({
    type: 'concurrent',
    concurrency: 5,
    rampUpDelay: 200, // 200ms between starting each concurrent request
    maxRetries: 2,
    timeout: 20000,
    continueOnError: true
  });
  
  const urls = Array.from({ length: 20 }, (_, i) => `https://example.com/page/${i}`);
  
  const result = await strategy.execute(
    urls,
    async (url) => {
      // Simulated processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      return { url, data: 'scraped data' };
    }
  );
  
  const stats = strategy.getStats();
  console.log('Execution stats:', stats);
}

// Example 3: Queue Strategy (advanced scheduling)
export async function queueExample() {
  const strategy = createStrategy<any>({
    type: 'queue',
    concurrency: 3,
    processingOrder: 'priority',
    priorityFunction: (url: string) => {
      // Higher priority for certain URLs
      if (url.includes('important')) return 10;
      if (url.includes('featured')) return 5;
      return 1;
    },
    batchSize: 5,
    batchDelay: 1000, // 1 second between batches
    maxQueueSize: 1000
  });
  
  const urls = [
    'https://example.com/important/1',
    'https://example.com/normal/1',
    'https://example.com/featured/1',
    'https://example.com/normal/2',
    'https://example.com/important/2',
  ];
  
  const result = await strategy.execute(urls, async (url) => {
    console.log(`Processing: ${url}`);
    return { url, processedAt: Date.now() };
  });
  
  // Important URLs should be processed first
  console.log('Processing order:', result.success.map(r => r.url));
}

// Example 4: Stream Strategy (process results as they arrive)
export async function streamExample() {
  const strategy = new StreamStrategy<any>({
    concurrency: 3,
    highWaterMark: 50,
    lowWaterMark: 20
  });
  
  const urls = Array.from({ length: 100 }, (_, i) => `https://example.com/item/${i}`);
  
  // Set up event handlers
  let processedCount = 0;
  strategy.on('data', (result) => {
    processedCount++;
    if (result.error) {
      console.error(`Failed: ${result.url}`, result.error.message);
    } else {
      console.log(`Processed ${processedCount}: ${result.url}`);
    }
  });
  
  strategy.on('end', () => {
    console.log('Stream processing complete');
  });
  
  strategy.on('error', (error) => {
    console.error('Stream error:', error);
  });
  
  // Process as async iterable
  const processor = async (url: string) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    if (Math.random() > 0.9) throw new Error('Random failure');
    return { url, data: `Data from ${url}` };
  };
  
  for await (const result of strategy.stream(urls, processor)) {
    // Process each result as it arrives
    if (result.data) {
      // Handle successful result
      console.log(`Stream result ${result.index}: ${result.data.url}`);
    } else if (result.error) {
      // Handle error
      console.error(`Stream error ${result.index}: ${result.error.message}`);
    }
  }
}

// Example 5: Strategy selection based on site config
export function selectStrategyForSite(siteName: string): StrategyFactoryConfig {
  const siteConfigs: Record<string, StrategyFactoryConfig> = {
    // Strict rate-limited site
    'homes.co.jp': {
      type: 'sequential',
      maxRetries: 3,
      retryDelay: 2000,
      retryBackoff: 'exponential',
      timeout: 30000,
      errorThreshold: 5
    },
    
    // Site that allows some concurrency
    'suumo.jp': {
      type: 'concurrent',
      concurrency: 5,
      rampUpDelay: 500,
      maxRetries: 2,
      timeout: 20000
    },
    
    // Site that needs priority handling
    'r-store.jp': {
      type: 'queue',
      concurrency: 2,
      processingOrder: 'priority',
      priorityFunction: (url) => {
        // Priority based on URL patterns
        if (url.includes('/premium/')) return 10;
        if (url.includes('/featured/')) return 5;
        return 1;
      },
      batchSize: 10,
      batchDelay: 2000
    },
    
    // Large volume site that needs streaming
    'at-home.co.jp': {
      type: 'stream',
      concurrency: 10,
      highWaterMark: 100,
      lowWaterMark: 50,
      maxRetries: 1,
      timeout: 15000
    }
  };
  
  return siteConfigs[siteName] || {
    type: 'sequential',
    maxRetries: 3,
    timeout: 30000
  };
}