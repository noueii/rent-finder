/**
 * Scraping Strategies
 * Export all strategy implementations
 */

export * from './interfaces';
export * from './base-strategy';
export * from './sequential-strategy';
export * from './concurrent-strategy';
export * from './queue-strategy';
export * from './stream-strategy';

// Strategy factory
import { SequentialStrategy } from './sequential-strategy';
import { ConcurrentStrategy } from './concurrent-strategy';
import { QueueStrategy } from './queue-strategy';
import { StreamStrategy } from './stream-strategy';
import type { IScrapingStrategy, StrategyConfig } from './interfaces';

export type StrategyType = 'sequential' | 'concurrent' | 'queue' | 'stream';

export interface StrategyFactoryConfig extends StrategyConfig {
  type: StrategyType;
  // Type-specific configs
  concurrency?: number;
  priorityFunction?: (url: string) => number;
  maxQueueSize?: number;
  processingOrder?: 'fifo' | 'lifo' | 'priority';
  batchSize?: number;
  batchDelay?: number;
  highWaterMark?: number;
  lowWaterMark?: number;
  rampUpDelay?: number;
}

export function createStrategy<T>(config: StrategyFactoryConfig): IScrapingStrategy<T> {
  switch (config.type) {
    case 'sequential':
      return new SequentialStrategy<T>(config);
      
    case 'concurrent':
      return new ConcurrentStrategy<T>({
        ...config,
        concurrency: config.concurrency,
        rampUpDelay: config.rampUpDelay
      });
      
    case 'queue':
      return new QueueStrategy<T>({
        ...config,
        concurrency: config.concurrency,
        priorityFunction: config.priorityFunction,
        maxQueueSize: config.maxQueueSize,
        processingOrder: config.processingOrder,
        batchSize: config.batchSize,
        batchDelay: config.batchDelay
      });
      
    case 'stream':
      return new StreamStrategy<T>({
        ...config,
        concurrency: config.concurrency,
        highWaterMark: config.highWaterMark,
        lowWaterMark: config.lowWaterMark
      });
      
    default:
      throw new Error(`Unknown strategy type: ${config.type}`);
  }
}