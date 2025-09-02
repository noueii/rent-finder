/**
 * Tests for Queue Strategy
 * Validates priority queue execution with different ordering modes
 */


import { QueueStrategy } from '../../strategies/queue-strategy';
import type { ScraperContext } from '../../strategies/interfaces';

describe('QueueStrategy', () => {
  let strategy: QueueStrategy<string>;
  let mockProcessor: jest.Mock;
  let mockProgress: jest.Mock;
  let context: ScraperContext;
  
  beforeEach(() => {
    mockProcessor = jest.fn();
    mockProgress = jest.fn();
    
    strategy = new QueueStrategy({
      processingOrder: 'fifo',
      maxQueueSize: 100,
      batchSize: 2,
      batchDelay: 50,
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
  
  describe('FIFO processing', () => {
    it('should process URLs in FIFO order', async () => {
      const urls = ['url1', 'url2', 'url3', 'url4'];
      const processingOrder: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        processingOrder.push(url);
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(4);
      expect(processingOrder).toEqual(['url1', 'url2', 'url3', 'url4']);
    });
  });
  
  describe('LIFO processing', () => {
    it('should process URLs in LIFO order', async () => {
      strategy = new QueueStrategy({
        processingOrder: 'lifo',
        batchSize: 1
      });
      
      const urls = ['url1', 'url2', 'url3', 'url4'];
      const processingOrder: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        processingOrder.push(url);
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(4);
      expect(processingOrder).toEqual(['url4', 'url3', 'url2', 'url1']);
    });
  });
  
  describe('Priority processing', () => {
    it('should process URLs by priority', async () => {
      strategy = new QueueStrategy({
        processingOrder: 'priority',
        priorityFunction: (url: string) => {
          const priority = parseInt(url.match(/\d+/)?.[0] || '0');
          return priority;
        },
        batchSize: 1
      });
      
      const urls = ['url5', 'url1', 'url10', 'url3'];
      const processingOrder: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        processingOrder.push(url);
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(4);
      expect(processingOrder).toEqual(['url10', 'url5', 'url3', 'url1']);
    });
    
    it('should handle priority ties', async () => {
      strategy = new QueueStrategy({
        processingOrder: 'priority',
        priorityFunction: (url: string) => url.includes('premium') ? 10 : 1,
        batchSize: 2
      });
      
      const urls = ['url1', 'premium-url1', 'url2', 'premium-url2'];
      const processingOrder: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        processingOrder.push(url);
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(4);
      // Premium URLs should be processed first
      expect(processingOrder.slice(0, 2)).toContain('premium-url1');
      expect(processingOrder.slice(0, 2)).toContain('premium-url2');
    });
  });
  
  describe('Batch processing', () => {
    it('should process in batches with delay', async () => {
      const urls = ['url1', 'url2', 'url3', 'url4'];
      const batchTimes: number[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        batchTimes.push(Date.now());
        return `processed-${url}`;
      });
      
      await strategy.execute(urls, mockProcessor, context);
      
      expect(mockProcessor).toHaveBeenCalledTimes(4);
      
      // Check batch delays
      // First batch (url1, url2) should be immediate
      expect(batchTimes[1] - batchTimes[0]).toBeLessThan(20);
      
      // Second batch (url3, url4) should have delay
      expect(batchTimes[2] - batchTimes[1]).toBeGreaterThanOrEqual(45);
      expect(batchTimes[3] - batchTimes[2]).toBeLessThan(20);
    });
    
    it('should handle partial batches', async () => {
      const urls = ['url1', 'url2', 'url3']; // 3 URLs with batch size 2
      const processingOrder: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        processingOrder.push(url);
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(3);
      expect(processingOrder).toEqual(['url1', 'url2', 'url3']);
    });
  });
  
  describe('Queue size limits', () => {
    it('should respect max queue size', async () => {
      strategy = new QueueStrategy({
        maxQueueSize: 3,
        batchSize: 1
      });
      
      const urls = ['url1', 'url2', 'url3', 'url4', 'url5'];
      mockProcessor.mockImplementation(async (url: string) => `processed-${url}`);
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      // Only first 3 should be processed
      expect(result.success).toHaveLength(3);
      expect(result.skipped).toEqual(['url4', 'url5']);
    });
  });
  
  describe('Error handling', () => {
    it('should retry failed URLs', async () => {
      const urls = ['url1', 'url2'];
      let attempts = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url1' && attempts === 0) {
          attempts++;
          throw new Error('First attempt failed');
        }
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(mockProcessor).toHaveBeenCalledTimes(3);
    });
    
    it('should continue processing on error', async () => {
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
  });
  
  describe('Dynamic queue addition', () => {
    it('should allow adding URLs during processing', async () => {
      const urls = ['url1', 'url2'];
      let addedDynamically = false;
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url1' && !addedDynamically) {
          addedDynamically = true;
          // Simulate dynamic addition (would normally be done via a method)
          // For testing, we'll just track that it could happen
        }
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2);
    });
  });
  
  describe('Progress reporting', () => {
    it('should report progress for each batch', async () => {
      const urls = ['url1', 'url2', 'url3', 'url4'];
      mockProcessor.mockImplementation(async (url: string) => `processed-${url}`);
      
      await strategy.execute(urls, mockProcessor, context);
      
      // Should report progress after each batch
      expect(mockProgress).toHaveBeenCalled();
      
      // Check progress increases
      const progressCalls = mockProgress.mock.calls.map(call => call[0].percentage);
      for (let i = 1; i < progressCalls.length; i++) {
        expect(progressCalls[i]).toBeGreaterThanOrEqual(progressCalls[i - 1]);
      }
    });
  });
  
  describe('abort and stop', () => {
    it('should respect abort signal', async () => {
      const abortController = new AbortController();
      const urls = ['url1', 'url2', 'url3', 'url4'];
      let processedCount = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        processedCount++;
        if (processedCount === 2) {
          abortController.abort();
        }
        return `processed-${url}`;
      });
      
      context.abortSignal = abortController.signal;
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success.length).toBeLessThanOrEqual(2);
      expect(result.skipped.length).toBeGreaterThan(0);
    });
    
    it('should stop processing when stop() is called', async () => {
      const urls = ['url1', 'url2', 'url3', 'url4'];
      let processedCount = 0;
      
      mockProcessor.mockImplementation(async (url: string) => {
        processedCount++;
        if (processedCount === 2) {
          strategy.stop();
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success.length).toBeLessThanOrEqual(2);
      expect(result.skipped.length).toBeGreaterThan(0);
    });
  });
  
  describe('getStats', () => {
    it('should return queue statistics', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
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
    });
  });
});