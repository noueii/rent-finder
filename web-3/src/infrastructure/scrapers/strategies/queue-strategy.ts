/**
 * Queue Strategy
 * Uses a priority queue for URL processing with advanced scheduling
 */

import { BaseStrategy } from './base-strategy';
import type { ScraperContext, ExecutionResult, StrategyConfig } from './interfaces';

export interface QueuedUrl<T> {
  url: string;
  priority: number;
  metadata?: any;
  addedAt: number;
  attempts: number;
}

export interface QueueStrategyConfig extends StrategyConfig {
  concurrency?: number;
  priorityFunction?: (url: string) => number;
  maxQueueSize?: number;
  processingOrder?: 'fifo' | 'lifo' | 'priority';
  batchSize?: number;
  batchDelay?: number;
}

export class QueueStrategy<T> extends BaseStrategy<T> {
  private concurrency: number;
  private priorityFunction: (url: string) => number;
  private maxQueueSize: number;
  private processingOrder: 'fifo' | 'lifo' | 'priority';
  private batchSize: number;
  private batchDelay: number;
  private queue: QueuedUrl<T>[] = [];
  private processing = new Set<string>();
  
  constructor(config: QueueStrategyConfig = {}) {
    super(config);
    this.concurrency = config.concurrency ?? 3;
    this.priorityFunction = config.priorityFunction ?? (() => 0);
    this.maxQueueSize = config.maxQueueSize ?? 10000;
    this.processingOrder = config.processingOrder ?? 'priority';
    this.batchSize = config.batchSize ?? 1;
    this.batchDelay = config.batchDelay ?? 0;
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
    
    // Initialize queue
    this.initializeQueue(urls);
    
    // Process queue
    while (this.queue.length > 0 || this.processing.size > 0) {
      // Check if stopped
      if (this.stopped) {
        result.skipped.push(...this.queue.map(item => item.url));
        break;
      }
      
      // Check error threshold
      if (this.stats.failedUrls >= this.config.errorThreshold) {
        context?.logger?.error('Error threshold reached, stopping execution');
        result.skipped.push(...this.queue.map(item => item.url));
        break;
      }
      
      // Process batch
      const batch = this.dequeueBatch();
      if (batch.length > 0) {
        await this.processBatch(batch, processor, context, result);
        
        // Batch delay
        if (this.batchDelay > 0 && (this.queue.length > 0 || this.processing.size > 0)) {
          await this.delay(this.batchDelay);
        }
      } else if (this.processing.size > 0) {
        // Wait for some processing to complete
        await this.delay(100);
      }
    }
    
    return result;
  }
  
  private initializeQueue(urls: string[]): void {
    this.queue = urls.map((url, index) => ({
      url,
      priority: this.priorityFunction(url),
      addedAt: Date.now() + index,
      attempts: 0
    }));
    
    // Sort by processing order
    this.sortQueue();
    
    // Trim to max size
    if (this.queue.length > this.maxQueueSize) {
      const skipped = this.queue.splice(this.maxQueueSize);
      this.stats.totalUrls = this.maxQueueSize;
    }
  }
  
  private sortQueue(): void {
    switch (this.processingOrder) {
      case 'priority':
        this.queue.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);
        break;
      case 'lifo':
        this.queue.sort((a, b) => b.addedAt - a.addedAt);
        break;
      case 'fifo':
      default:
        this.queue.sort((a, b) => a.addedAt - b.addedAt);
        break;
    }
  }
  
  private dequeueBatch(): QueuedUrl<T>[] {
    const batch: QueuedUrl<T>[] = [];
    const availableSlots = this.concurrency - this.processing.size;
    const batchCount = Math.min(availableSlots, this.batchSize, this.queue.length);
    
    for (let i = 0; i < batchCount; i++) {
      const item = this.queue.shift();
      if (item && !this.processing.has(item.url)) {
        batch.push(item);
        this.processing.add(item.url);
      }
    }
    
    return batch;
  }
  
  private async processBatch(
    batch: QueuedUrl<T>[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext,
    result: ExecutionResult<T>
  ): Promise<void> {
    const promises = batch.map(async (item) => {
      try {
        // Send progress update
        this.sendProgress(context, item.url);
        
        const { success, data, error, retries } = await this.processWithRetry(
          item.url,
          processor,
          context
        );
        
        // Update stats
        this.stats.processedUrls++;
        
        if (success && data) {
          this.stats.successfulUrls++;
          result.success.push(data);
          
          context?.logger?.info(`Successfully processed ${item.url}`, {
            priority: item.priority,
            attempts: item.attempts + retries,
            queueSize: this.queue.length,
            processing: this.processing.size
          });
        } else {
          this.stats.failedUrls++;
          item.attempts += retries;
          
          // Requeue if under retry limit and continue on error
          if (this.config.continueOnError && item.attempts < this.config.maxRetries) {
            item.priority -= 1; // Lower priority for retries
            this.queue.push(item);
            this.sortQueue();
            
            context?.logger?.warn(`Requeuing ${item.url}`, {
              attempts: item.attempts,
              newPriority: item.priority
            });
          } else {
            result.failed.push({ url: item.url, error: error!, retries: item.attempts });
            
            context?.logger?.error(`Failed to process ${item.url}`, {
              error: error?.message,
              attempts: item.attempts,
              maxed: true
            });
          }
        }
      } finally {
        this.processing.delete(item.url);
        this.sendProgress(context);
      }
    });
    
    await Promise.all(promises);
  }
}