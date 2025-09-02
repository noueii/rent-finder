/**
 * Stream Strategy
 * Processes URLs as a stream, yielding results as they complete
 */

import { BaseStrategy } from './base-strategy';
import type { ScraperContext, ExecutionResult, StrategyConfig } from './interfaces';

export interface StreamStrategyConfig extends StrategyConfig {
  concurrency?: number;
  highWaterMark?: number; // Max buffered results before backpressure
  lowWaterMark?: number;  // Resume processing threshold
}

export interface StreamResult<T> {
  data?: T;
  error?: Error;
  url: string;
  index: number;
}

export class StreamStrategy<T> extends BaseStrategy<T> {
  private concurrency: number;
  private highWaterMark: number;
  private lowWaterMark: number;
  private buffer: StreamResult<T>[] = [];
  private isPaused: boolean = false;
  private onData?: (result: StreamResult<T>) => void;
  private onEnd?: () => void;
  private onError?: (error: Error) => void;
  
  constructor(config: StreamStrategyConfig = {}) {
    super(config);
    this.concurrency = config.concurrency ?? 3;
    this.highWaterMark = config.highWaterMark ?? 100;
    this.lowWaterMark = config.lowWaterMark ?? 50;
  }
  
  /**
   * Stream interface for consuming results
   */
  stream(
    urls: string[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): AsyncIterable<StreamResult<T>> {
    const self = this;
    
    return {
      async *[Symbol.asyncIterator]() {
        const resultPromise = self.execute(urls, processor, context);
        let currentIndex = 0;
        
        // Start execution
        const executionPromise = self.executeInternal(urls, processor, context);
        
        // Yield results as they arrive
        while (currentIndex < urls.length || self.buffer.length > 0) {
          // Wait for data if buffer is empty
          if (self.buffer.length === 0 && currentIndex < urls.length) {
            await new Promise(resolve => {
              const checkBuffer = setInterval(() => {
                if (self.buffer.length > 0 || currentIndex >= urls.length) {
                  clearInterval(checkBuffer);
                  resolve(undefined);
                }
              }, 10);
            });
          }
          
          // Yield buffered results
          while (self.buffer.length > 0) {
            const result = self.buffer.shift()!;
            yield result;
            
            // Check if we should resume processing
            if (self.isPaused && self.buffer.length < self.lowWaterMark) {
              self.isPaused = false;
            }
          }
          
          currentIndex++;
        }
        
        // Wait for execution to complete
        await executionPromise;
      }
    };
  }
  
  protected async executeInternal(
    urls: string[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): Promise<ExecutionResult<T>> {
    const result: ExecutionResult<T> = {
      success: [],
      failed: [],
      skipped: []
    };
    
    const queue = urls.map((url, index) => ({ url, index }));
    const inFlight = new Map<string, Promise<void>>();
    
    while (queue.length > 0 || inFlight.size > 0) {
      // Check if stopped
      if (this.stopped) {
        result.skipped.push(...queue.map(item => item.url));
        break;
      }
      
      // Check error threshold
      if (this.stats.failedUrls >= this.config.errorThreshold) {
        context?.logger?.error('Error threshold reached, stopping execution');
        result.skipped.push(...queue.map(item => item.url));
        break;
      }
      
      // Apply backpressure if buffer is full
      if (this.buffer.length >= this.highWaterMark) {
        this.isPaused = true;
        await this.delay(100);
        continue;
      }
      
      // Start new requests up to concurrency limit
      while (
        inFlight.size < this.concurrency && 
        queue.length > 0 && 
        !this.stopped &&
        !this.isPaused
      ) {
        const { url, index } = queue.shift()!;
        
        // Send progress update
        this.sendProgress(context, url);
        
        // Create promise for processing
        const promise = this.processWithRetry(url, processor, context)
          .then(({ success, data, error, retries }) => {
            // Update stats
            this.stats.processedUrls++;
            
            const streamResult: StreamResult<T> = {
              url,
              index,
              data: success ? data : undefined,
              error: success ? undefined : error
            };
            
            // Add to buffer
            this.buffer.push(streamResult);
            
            // Update result tracking
            if (success && data) {
              this.stats.successfulUrls++;
              result.success.push(data);
              
              context?.logger?.info(`Streamed result for ${url}`, {
                retries,
                bufferSize: this.buffer.length,
                index
              });
            } else {
              this.stats.failedUrls++;
              result.failed.push({ url, error: error!, retries });
              
              context?.logger?.error(`Failed to process ${url}`, {
                error: error?.message,
                retries,
                bufferSize: this.buffer.length
              });
              
              if (!this.config.continueOnError) {
                this.stopped = true;
              }
            }
            
            // Call data handler if set
            this.onData?.(streamResult);
            
            // Send updated progress
            this.sendProgress(context);
          })
          .catch(error => {
            // Handle unexpected errors
            this.onError?.(error as Error);
          })
          .finally(() => {
            inFlight.delete(url);
          });
        
        inFlight.set(url, promise);
      }
      
      // Wait for at least one to complete
      if (inFlight.size > 0) {
        await Promise.race(inFlight.values());
      }
    }
    
    // Wait for all remaining to complete
    if (inFlight.size > 0) {
      await Promise.all(inFlight.values());
    }
    
    // Call end handler
    this.onEnd?.();
    
    return result;
  }
  
  /**
   * Set event handlers for stream processing
   */
  on(event: 'data', handler: (result: StreamResult<T>) => void): void;
  on(event: 'end', handler: () => void): void;
  on(event: 'error', handler: (error: Error) => void): void;
  on(event: string, handler: any): void {
    switch (event) {
      case 'data':
        this.onData = handler;
        break;
      case 'end':
        this.onEnd = handler;
        break;
      case 'error':
        this.onError = handler;
        break;
    }
  }
}