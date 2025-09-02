/**
 * Tests for Concurrent Strategy
 * Validates concurrent execution with concurrency limits and ramp-up
 */


import { ConcurrentStrategy } from '../../strategies/concurrent-strategy';
import type { ScraperContext } from '../../strategies/interfaces';

describe('ConcurrentStrategy', () => {
  let strategy: ConcurrentStrategy<string>;
  let mockProcessor: jest.Mock;
  let mockProgress: jest.Mock;
  let context: ScraperContext;
  
  beforeEach(() => {
    mockProcessor = jest.fn();
    mockProgress = jest.fn();
    
    strategy = new ConcurrentStrategy({
      concurrency: 3,
      maxRetries: 1,
      retryDelay: 50,
      retryBackoff: 'linear',
      timeout: 1000,
      continueOnError: true,
      warmupDelay: 0,
      rampUpDelay: 0
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
  
  describe('execute', () => {
    it('should process URLs concurrently', async () => {
      const urls = ['url1', 'url2', 'url3', 'url4', 'url5'];
      const processingOrder: string[] = [];
      const activeCount: number[] = [];
      let currentActive = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        currentActive++;
        activeCount.push(currentActive);
        processingOrder.push(url);
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 50));
        
        currentActive--;
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(5);
      expect(mockProcessor).toHaveBeenCalledTimes(5);
      
      // Check concurrency limit was respected
      expect(Math.max(...activeCount)).toBeLessThanOrEqual(3);
      
      // Should not be strictly sequential
      expect(processingOrder).not.toEqual(['url1', 'url2', 'url3', 'url4', 'url5']);
    });
    
    it('should respect concurrency limit', async () => {
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
      
      await strategy.execute(urls, mockProcessor, context);
      
      expect(maxConcurrent).toBeLessThanOrEqual(3);
      expect(maxConcurrent).toBeGreaterThan(1); // Should use concurrency
    });
    
    it('should apply ramp-up delay', async () => {
      strategy = new ConcurrentStrategy({
        concurrency: 3,
        rampUpDelay: 50
      });
      
      const urls = ['url1', 'url2', 'url3', 'url4'];
      const startTimes: number[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        startTimes.push(Date.now());
        return `processed-${url}`;
      });
      
      const start = Date.now();
      await strategy.execute(urls, mockProcessor, context);
      
      // First batch should start immediately (after warmup)
      expect(startTimes[0] - start).toBeLessThan(10);
      expect(startTimes[1] - start).toBeLessThan(10);
      expect(startTimes[2] - start).toBeLessThan(10);
      
      // Second batch should have ramp-up delay
      expect(startTimes[3] - start).toBeGreaterThanOrEqual(45);
    });
    
    it('should handle errors with retry', async () => {
      const urls = ['url1', 'url2'];
      
      mockProcessor
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('success-url1')
        .mockResolvedValueOnce('success-url2');
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockProcessor).toHaveBeenCalledTimes(3);
    });
    
    it('should continue on error when configured', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url2') {
          throw new Error('Processing failed');
        }
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].url).toBe('url2');
    });
    
    it('should stop on error when configured', async () => {
      strategy = new ConcurrentStrategy({
        concurrency: 1,
        continueOnError: false,
        maxRetries: 0
      });
      
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url1') {
          throw new Error('Stop execution');
        }
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.skipped).toContain('url2');
      expect(result.skipped).toContain('url3');
    });
    
    it('should report progress correctly', async () => {
      const urls = ['url1', 'url2', 'url3'];
      mockProcessor.mockImplementation(async (url: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      await strategy.execute(urls, mockProcessor, context);
      
      // Should report progress updates
      expect(mockProgress).toHaveBeenCalled();
      
      // Final progress should be 100%
      const lastCall = mockProgress.mock.calls[mockProgress.mock.calls.length - 1];
      expect(lastCall[0].percentage).toBe(100);
      expect(lastCall[0].completed).toBe(3);
    });
    
    it('should handle timeout', async () => {
      strategy = new ConcurrentStrategy({
        concurrency: 2,
        timeout: 50,
        maxRetries: 0
      });
      
      const urls = ['url1', 'url2'];
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url1') {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(1); // url2 should succeed
      expect(result.failed).toHaveLength(1); // url1 should timeout
      expect(result.failed[0].error.message).toContain('timeout');
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
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      context.abortSignal = abortController.signal;
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success.length).toBeLessThan(10);
      expect(result.skipped.length).toBeGreaterThan(0);
    });
  });
  
  describe('stop', () => {
    it('should stop execution gracefully', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `url${i + 1}`);
      let processedCount = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        processedCount++;
        if (processedCount === 3) {
          strategy.stop();
        }
        await new Promise(resolve => setTimeout(resolve, 20));
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      // Should process some but not all
      expect(result.success.length).toBeGreaterThan(0);
      expect(result.success.length).toBeLessThan(10);
      expect(result.skipped.length).toBeGreaterThan(0);
    });
  });
  
  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        if (url === 'url3') {
          throw new Error('Failed');
        }
        return `processed-${url}`;
      });
      
      await strategy.execute(urls, mockProcessor, context);
      
      const stats = strategy.getStats();
      
      expect(stats.totalUrls).toBe(3);
      expect(stats.processedUrls).toBe(3);
      expect(stats.successfulUrls).toBe(2);
      expect(stats.failedUrls).toBe(1);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.currentThroughput).toBeGreaterThan(0);
    });
  });
});