/**
 * Tests for Sequential Strategy
 * Validates sequential execution with proper error handling and progress tracking
 */


import { SequentialStrategy } from '../../strategies/sequential-strategy';
import type { ScraperContext } from '../../strategies/interfaces';

describe('SequentialStrategy', () => {
  let strategy: SequentialStrategy<string>;
  let mockProcessor: jest.Mock;
  let mockProgress: jest.Mock;
  let context: ScraperContext;
  
  beforeEach(() => {
    mockProcessor = jest.fn();
    mockProgress = jest.fn();
    
    strategy = new SequentialStrategy({
      maxRetries: 2,
      retryDelay: 50,
      retryBackoff: 'linear',
      timeout: 1000,
      continueOnError: true,
      warmupDelay: 0
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
    it('should process URLs sequentially', async () => {
      const urls = ['url1', 'url2', 'url3'];
      const results: string[] = [];
      
      mockProcessor.mockImplementation(async (url: string) => {
        results.push(url);
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(3);
      expect(result.success).toEqual([
        'processed-url1',
        'processed-url2',
        'processed-url3'
      ]);
      expect(results).toEqual(['url1', 'url2', 'url3']); // Sequential order
      expect(mockProcessor).toHaveBeenCalledTimes(3);
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
      expect(mockProcessor).toHaveBeenCalledTimes(3); // 2 for url1, 1 for url2
    });
    
    it('should record failures after max retries', async () => {
      const urls = ['url1'];
      const error = new Error('Persistent error');
      
      mockProcessor.mockRejectedValue(error);
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]).toEqual({
        url: 'url1',
        error,
        retries: 2
      });
      expect(mockProcessor).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });
    
    it('should report progress', async () => {
      const urls = ['url1', 'url2', 'url3'];
      mockProcessor.mockImplementation(async (url: string) => `processed-${url}`);
      
      await strategy.execute(urls, mockProcessor, context);
      
      // Should report progress for each URL
      expect(mockProgress).toHaveBeenCalledTimes(3);
      expect(mockProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 3,
          completed: 1,
          failed: 0,
          current: 'url1',
          percentage: expect.closeTo(33.33, 0.01)
        })
      );
    });
    
    it('should respect abort signal', async () => {
      const abortController = new AbortController();
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url2') {
          abortController.abort();
        }
        return `processed-${url}`;
      });
      
      context.abortSignal = abortController.signal;
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2); // url1 and url2
      expect(result.skipped).toContain('url3');
      expect(mockProcessor).toHaveBeenCalledTimes(2);
    });
    
    it('should apply warmup delay', async () => {
      strategy = new SequentialStrategy({
        warmupDelay: 100
      });
      
      const urls = ['url1'];
      mockProcessor.mockResolvedValue('success');
      
      const start = Date.now();
      await strategy.execute(urls, mockProcessor, context);
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(100);
    });
    
    it('should handle timeout', async () => {
      strategy = new SequentialStrategy({
        timeout: 50,
        maxRetries: 0
      });
      
      const urls = ['url1'];
      mockProcessor.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('late'), 100))
      );
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error.message).toContain('timeout');
    });
    
    it('should calculate retry delays correctly', async () => {
      // Linear backoff
      strategy = new SequentialStrategy({
        maxRetries: 2,
        retryDelay: 50,
        retryBackoff: 'linear'
      });
      
      const urls = ['url1'];
      const attempts: number[] = [];
      
      mockProcessor.mockImplementation(() => {
        attempts.push(Date.now());
        throw new Error('Retry test');
      });
      
      await strategy.execute(urls, mockProcessor, context);
      
      expect(attempts).toHaveLength(3);
      // Check delays are approximately correct (50ms, 100ms)
      expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(45);
      expect(attempts[2] - attempts[1]).toBeGreaterThanOrEqual(95);
      
      // Exponential backoff
      strategy = new SequentialStrategy({
        maxRetries: 2,
        retryDelay: 50,
        retryBackoff: 'exponential'
      });
      
      attempts.length = 0;
      await strategy.execute(urls, mockProcessor, context);
      
      expect(attempts).toHaveLength(3);
      // Check delays are approximately correct (50ms, 100ms)
      expect(attempts[1] - attempts[0]).toBeGreaterThanOrEqual(45);
      expect(attempts[2] - attempts[1]).toBeGreaterThanOrEqual(95);
    });
  });
  
  describe('stop', () => {
    it('should stop execution', async () => {
      const urls = ['url1', 'url2', 'url3'];
      
      mockProcessor.mockImplementation(async (url: string) => {
        if (url === 'url2') {
          strategy.stop();
        }
        await new Promise(resolve => setTimeout(resolve, 10));
        return `processed-${url}`;
      });
      
      const result = await strategy.execute(urls, mockProcessor, context);
      
      expect(result.success).toHaveLength(2);
      expect(result.skipped).toContain('url3');
    });
  });
  
  describe('getStats', () => {
    it('should return execution statistics', async () => {
      const urls = ['url1', 'url2'];
      mockProcessor.mockResolvedValue('success');
      
      await strategy.execute(urls, mockProcessor, context);
      
      const stats = strategy.getStats();
      
      expect(stats.totalUrls).toBe(2);
      expect(stats.processedUrls).toBe(2);
      expect(stats.successfulUrls).toBe(2);
      expect(stats.failedUrls).toBe(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
      expect(stats.currentThroughput).toBeGreaterThan(0);
      expect(stats.endTime).toBeDefined();
    });
  });
});