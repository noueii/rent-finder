/**
 * Concurrent processing utilities for scrapers
 * Handles parallel requests with rate limiting and proxy rotation
 */

export interface ConcurrentOptions {
  maxConcurrency: number;
  rateLimit: number; // ms between requests per worker
  onProgress?: (completed: number, total: number, failed: number) => void;
}

export class ConcurrentProcessor {
  /**
   * Process multiple items concurrently with rate limiting
   * Each worker maintains its own rate limit
   */
  static async processInBatches<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options: ConcurrentOptions
  ): Promise<{ results: R[]; errors: Array<{ item: T; error: unknown }> }> {
    const results: R[] = [];
    const errors: Array<{ item: T; error: unknown }> = [];
    let completed = 0;
    let failed = 0;
    
    // Create a queue of items to process
    const queue = [...items];
    let currentIndex = 0;
    
    // Worker function that processes items from the queue
    const worker = async (workerId: number) => {
      const workerDelay = options.rateLimit;
      let lastRequestTime = 0;
      
      while (currentIndex < items.length) {
        const index = currentIndex++;
        const item = queue[index];
        
        if (!item) break;
        
        // Apply rate limiting per worker
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (lastRequestTime > 0 && timeSinceLastRequest < workerDelay) {
          const waitTime = workerDelay - timeSinceLastRequest;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        lastRequestTime = Date.now();
        
        try {
          const result = await processor(item, index);
          results[index] = result;
          completed++;
          
          if (options.onProgress) {
            options.onProgress(completed, items.length, failed);
          }
        } catch (error) {
          errors.push({ item, error });
          failed++;
          
          if (options.onProgress) {
            options.onProgress(completed, items.length, failed);
          }
        }
      }
    };
    
    // Start workers
    const workers: Promise<void>[] = [];
    const workerCount = Math.min(options.maxConcurrency, items.length);
    
    console.log(`🚀 Starting ${workerCount} concurrent workers...`);
    
    for (let i = 0; i < workerCount; i++) {
      workers.push(worker(i));
    }
    
    // Wait for all workers to complete
    await Promise.all(workers);
    
    return { results: results.filter(r => r !== undefined), errors };
  }
  
  /**
   * Process items in parallel chunks
   * Useful for APIs that support batch requests
   */
  static async processInChunks<T, R>(
    items: T[],
    chunkSize: number,
    processor: (chunk: T[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const chunkResults = await processor(chunk);
      results.push(...chunkResults);
    }
    
    return results;
  }
  
  /**
   * Calculate optimal concurrency based on available proxies
   * More proxies = higher safe concurrency
   */
  static calculateOptimalConcurrency(
    proxyCount: number,
    requestsPerProxy: number = 2
  ): number {
    if (proxyCount === 0) {
      // No proxies, be conservative
      return 1;
    }
    
    // Allow up to 2 requests per proxy
    const optimal = Math.min(proxyCount * requestsPerProxy, 10);
    
    return Math.max(1, optimal);
  }
}