/**
 * Tests for Stream Strategy
 * Validates streaming execution with backpressure and buffering
 */


import { StreamStrategy } from '../../strategies/stream-strategy';
import type { ScraperContext } from '../../strategies/interfaces';

describe('StreamStrategy', () => {
  let strategy: StreamStrategy<string>;
  let mockProcessor: jest.Mock;
  let mockProgress: jest.Mock;
  let context: ScraperContext;
  
  beforeEach(() => {
    mockProcessor = jest.fn();
    mockProgress = jest.fn();
    
    strategy = new StreamStrategy({
      highWaterMark: 10,
      lowWaterMark: 5,
      concurrency: 3,
      maxRetries: 1,
      retryDelay: 50,
      timeout: 1000,
      continueOnError: true
    });
    
    context = {
      onProgress: mockProgress,
      logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    };
  });
  
  describe('stream', () => {
    it('should stream results as they complete', async () => {
      const urls = ['url1', 'url2', 'url3', 'url4', 'url5'];
      const results: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        // Simulate varying processing times
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
        return `processed-${url}`;
      });
      
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        if (result.data) {
          results.push(result.data);
        }
      }
      
      expect(results).toHaveLength(5);
      expect(results).toContain('processed-url1');
      expect(results).toContain('processed-url5');
    });
    
    it('should handle errors in stream', async () => {
      const urls = ['url1', 'url2', 'url3'];
      const results: Array<{ data?: string; error?: Error }> = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url2') {
          throw new Error('Processing failed');
        }
        return `processed-${url}`;
      });
      
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        results.push(result);
      }
      
      expect(results).toHaveLength(3);
      expect(results.filter(r => r.data).length).toBe(2);
      expect(results.filter(r => r.error).length).toBe(1);
      expect(results.find(r => r.error)?.error?.message).toBe('Processing failed');
    });
    
    it('should respect concurrency limits', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `url${i + 1}`);
      let maxConcurrent = 0;
      let currentConcurrent = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        
        await new Promise(resolve => setTimeout(resolve, 20));
        
        currentConcurrent--;
        return `processed-${url}`;
      });
      
      const results: string[] = [];
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        if (result.data) {
          results.push(result.data);
        }
      }
      
      expect(results).toHaveLength(10);
      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });
    
    it('should buffer results appropriately', async () => {
      const urls = Array.from({ length: 20 }, (_, i) => `url${i + 1}`);
      const emitTimes: number[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        if (result.data) {
          emitTimes.push(Date.now());
        }
      }
      
      // Results should be emitted as they complete, not all at once
      expect(emitTimes).toHaveLength(20);
      const timeDiffs = emitTimes.slice(1).map((t, i) => t - emitTimes[i]);
      expect(Math.max(...timeDiffs)).toBeGreaterThan(5); // Some results should be delayed
    });
    
    it('should handle backpressure', async () => {
      const urls = Array.from({ length: 15 }, (_, i) => `url${i + 1}`);
      let processedCount = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        processedCount++;
        return `processed-${url}`;
      });
      
      const results: string[] = [];
      let consumptionDelay = 50;
      
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        if (result.data) {
          results.push(result.data);
          // Simulate slow consumption
          await new Promise(resolve => setTimeout(resolve, consumptionDelay));
          // Speed up after consuming some results
          if (results.length > 5) {
            consumptionDelay = 5;
          }
        }
      }
      
      expect(results).toHaveLength(15);
    });
    
    it('should retry failed items', async () => {
      const urls = ['url1', 'url2'];
      let attempts = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url1' && attempts === 0) {
          attempts++;
          throw new Error('First attempt failed');
        }
        return `processed-${url}`;
      });
      
      const results: Array<{ data?: string; error?: Error }> = [];
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        results.push(result);
      }
      
      expect(results.filter(r => r.data).length).toBe(2);
      expect(results.filter(r => r.error).length).toBe(0);
      expect(mockProcessor).toHaveBeenCalledTimes(3);
    });
    
    it('should respect abort signal', async () => {
      const abortController = new AbortController();
      const urls = Array.from({ length: 10 }, (_, i) => `url${i + 1}`);
      let processedCount = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        processedCount++;
        if (processedCount === 3) {
          abortController.abort();
        }
        return `processed-${url}`;
      });
      
      context.abortSignal = abortController.signal;
      
      const results: string[] = [];
      try {
        for await (const result of strategy.stream(urls, mockProcessor, context)) {
          if (result.data) {
            results.push(result.data);
          }
        }
      } catch (error) {
        // Might throw on abort, which is fine
      }
      
      expect(results.length).toBeLessThan(10);
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('execute', () => {
    it('should collect all stream results', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.success).toContain('processed-url1');
      expect(result.success).toContain('processed-url3');
    });
    
    it('should separate successes and failures', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url2') {
          throw new Error('Failed to process');
        }
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].url).toBe('url2');
    });
  });
  
  describe('stop', () => {
    it('should stop streaming when called', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `url${i + 1}`);
      let processedCount = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        processedCount++;
        if (processedCount === 3) {
          strategy.stop();
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      const results: string[] = [];
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        if (result.data) {
          results.push(result.data);
        }
      }
      
      expect(results.length).toBeLessThan(10);
      expect(results.length).toBeGreaterThan(0);
    });
  });
  
  describe('getStats', () => {
    it('should provide real-time statistics', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (url === 'url3') {
          throw new Error('Failed');
        }
        return `processed-${url}`;
      });
      
      // Start streaming
      const streamPromise = (async () => {
        const results = [];
        for await (const result of strategy.stream(urls, mockProcessor, context)) {
          results.push(result);
          
          // Check stats mid-stream
          const stats = strategy.getStats();
          expect(stats.totalUrls).toBe(3);
          expect(stats.processedUrls).toBeLessThanOrEqual(3);
        }
        return results;
      })();
      
      await streamPromise;
      
      const finalStats = strategy.getStats();
      expect(finalStats.totalUrls).toBe(3);
      expect(finalStats.processedUrls).toBe(3);
      expect(finalStats.successfulUrls).toBe(2);
      expect(finalStats.failedUrls).toBe(1);
    });
  });
  
  describe('watermark behavior', () => {
    it('should pause/resume based on watermarks', async () => {
      strategy = new StreamStrategy({
        highWaterMark: 5,
        lowWaterMark: 2,
        concurrency: 3
      });
      
      const urls = Array.from({ length: 10 }, (_, i) => `url${i + 1}`);
      const bufferSizes: number[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        // Track buffer size at processing time
        bufferSizes.push(strategy['buffer']?.length || 0);
        await new Promise(resolve => setTimeout(resolve, 20));
        return `processed-${url}`;
      });
      
      const results = [];
      for await (const result of strategy.stream(urls, mockProcessor, context)) {
        if (result.data) {
          results.push(result.data);
          // Slow consumption to test watermarks
          await new Promise(resolve => setTimeout(resolve, 30));
        }
      }
      
      expect(results).toHaveLength(10);
      // Buffer should not exceed high watermark
      expect(Math.max(...bufferSizes)).toBeLessThanOrEqual(5);
    });
  });
});