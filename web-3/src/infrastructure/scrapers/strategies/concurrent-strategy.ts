/**
 * Concurrent Strategy
 * Processes multiple URLs in parallel with concurrency control
 */

import { BaseStrategy } from './base-strategy';
import type { ScraperContext, ExecutionResult, StrategyConfig } from './interfaces';

export interface ConcurrentStrategyConfig extends StrategyConfig {
  concurrency?: number;
  rampUpDelay?: number; // Delay between starting concurrent requests
}

export class ConcurrentStrategy<T> extends BaseStrategy<T> {
  private concurrency: number;
  private rampUpDelay: number;
  
  constructor(config: ConcurrentStrategyConfig = {}) {
    super(config);
    this.concurrency = config.concurrency ?? 5;
    this.rampUpDelay = config.rampUpDelay ?? 100;
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
    
    const queue = [...urls];
    const inFlight = new Map<string, Promise<void>>();
    let rampUpCount = 0;
    
    while (queue.length > 0 || inFlight.size > 0) {
      // Check if stopped
      if (this.stopped) {
        result.skipped.push(...queue);
        break;
      }
      
      // Check error threshold
      if (this.stats.failedUrls >= this.config.errorThreshold) {
        context?.logger?.error('Error threshold reached, stopping execution');
        result.skipped.push(...queue);
        break;
      }
      
      // Start new requests up to concurrency limit
      while (inFlight.size < this.concurrency && queue.length > 0 && !this.stopped) {
        const url = queue.shift()!;
        
        // Apply ramp-up delay for initial requests
        if (rampUpCount < this.concurrency && this.rampUpDelay > 0) {
          await this.delay(this.rampUpDelay * rampUpCount);
          rampUpCount++;
        }
        
        // Send progress update
        this.sendProgress(context, url);
        
        // Create promise for processing
        const promise = this.processWithRetry(url, processor, context)
          .then(({ success, data, error, retries }) => {
            // Update stats
            this.stats.processedUrls++;
            
            if (success && data) {
              this.stats.successfulUrls++;
              result.success.push(data);
              
              context?.logger?.info(`Successfully processed ${url}`, {
                retries,
                concurrentRequests: inFlight.size,
                queueSize: queue.length
              });
            } else {
              this.stats.failedUrls++;
              result.failed.push({ url, error: error!, retries });
              
              context?.logger?.error(`Failed to process ${url}`, {
                error: error?.message,
                retries,
                concurrentRequests: inFlight.size
              });
              
              if (!this.config.continueOnError) {
                this.stopped = true;
              }
            }
            
            // Send updated progress
            this.sendProgress(context);
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
    
    return result;
  }
}