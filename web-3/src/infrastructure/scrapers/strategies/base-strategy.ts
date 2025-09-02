/**
 * Base Strategy Implementation
 * Common functionality for all strategies
 */

import type { 
  IScrapingStrategy, 
  ScraperContext, 
  ExecutionResult, 
  ExecutionStats,
  StrategyConfig,
  ProgressUpdate
} from './interfaces';

export abstract class BaseStrategy<T> implements IScrapingStrategy<T> {
  protected stats: ExecutionStats;
  protected stopped: boolean = false;
  protected config: Required<StrategyConfig>;
  
  constructor(config: StrategyConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryBackoff: config.retryBackoff ?? 'exponential',
      timeout: config.timeout ?? 30000,
      continueOnError: config.continueOnError ?? true,
      errorThreshold: config.errorThreshold ?? Infinity,
      warmupDelay: config.warmupDelay ?? 0
    };
    
    this.stats = {
      startTime: 0,
      endTime: undefined,
      totalUrls: 0,
      processedUrls: 0,
      successfulUrls: 0,
      failedUrls: 0,
      averageProcessingTime: 0,
      currentThroughput: 0
    };
  }
  
  async execute(
    urls: string[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): Promise<ExecutionResult<T>> {
    // Reset state
    this.stopped = false;
    this.stats = {
      startTime: Date.now(),
      endTime: undefined,
      totalUrls: urls.length,
      processedUrls: 0,
      successfulUrls: 0,
      failedUrls: 0,
      averageProcessingTime: 0,
      currentThroughput: 0
    };
    
    // Apply warmup delay
    if (this.config.warmupDelay > 0) {
      await this.delay(this.config.warmupDelay);
    }
    
    context?.logger?.info(`Starting ${this.constructor.name} execution`, {
      totalUrls: urls.length,
      config: this.config
    });
    
    // Execute strategy-specific implementation
    const result = await this.executeInternal(urls, processor, context);
    
    // Update final stats
    this.stats.endTime = Date.now();
    const duration = this.stats.endTime - this.stats.startTime;
    this.stats.currentThroughput = this.stats.processedUrls / (duration / 1000);
    
    context?.logger?.info(`Completed ${this.constructor.name} execution`, {
      ...this.stats,
      duration
    });
    
    return result;
  }
  
  stop(): void {
    this.stopped = true;
  }
  
  getStats(): ExecutionStats {
    const stats = { ...this.stats };
    if (!stats.endTime && stats.startTime) {
      const duration = Date.now() - stats.startTime;
      stats.currentThroughput = stats.processedUrls / (duration / 1000);
    }
    return stats;
  }
  
  /**
   * Strategy-specific implementation
   */
  protected abstract executeInternal(
    urls: string[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): Promise<ExecutionResult<T>>;
  
  /**
   * Process a single URL with retry logic
   */
  protected async processWithRetry(
    url: string,
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): Promise<{ success: boolean; data?: T; error?: Error; retries: number }> {
    let lastError: Error | undefined;
    let retries = 0;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      if (this.stopped) {
        return { 
          success: false, 
          error: new Error('Execution stopped'), 
          retries 
        };
      }
      
      try {
        const startTime = Date.now();
        
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), this.config.timeout);
        });
        
        // Race between processor and timeout
        const data = await Promise.race([
          processor(url),
          timeoutPromise
        ]);
        
        // Update stats
        const processingTime = Date.now() - startTime;
        this.updateProcessingTime(processingTime);
        
        return { success: true, data, retries };
        
      } catch (error) {
        lastError = error as Error;
        retries = attempt;
        
        context?.logger?.warn(`Retry attempt ${attempt} for ${url}`, {
          error: lastError.message,
          attempt
        });
        
        if (attempt < this.config.maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          await this.delay(delay);
        }
      }
    }
    
    return { 
      success: false, 
      error: lastError || new Error('Max retries exceeded'), 
      retries 
    };
  }
  
  /**
   * Calculate retry delay based on backoff strategy
   */
  protected calculateRetryDelay(attempt: number): number {
    if (this.config.retryBackoff === 'exponential') {
      return Math.min(
        this.config.retryDelay * Math.pow(2, attempt - 1),
        30000 // Cap at 30 seconds
      );
    }
    return this.config.retryDelay * attempt;
  }
  
  /**
   * Update average processing time
   */
  protected updateProcessingTime(time: number): void {
    const { processedUrls, averageProcessingTime } = this.stats;
    this.stats.averageProcessingTime = 
      (averageProcessingTime * processedUrls + time) / (processedUrls + 1);
  }
  
  /**
   * Send progress update
   */
  protected sendProgress(context?: ScraperContext, current?: string): void {
    if (!context?.onProgress) return;
    
    const progress: ProgressUpdate = {
      total: this.stats.totalUrls,
      completed: this.stats.successfulUrls,
      failed: this.stats.failedUrls,
      current,
      percentage: (this.stats.processedUrls / this.stats.totalUrls) * 100,
      estimatedTimeRemaining: this.estimateTimeRemaining()
    };
    
    context.onProgress(progress);
  }
  
  /**
   * Estimate remaining time based on current throughput
   */
  protected estimateTimeRemaining(): number | undefined {
    if (this.stats.processedUrls === 0) return undefined;
    
    const elapsed = Date.now() - this.stats.startTime;
    const rate = this.stats.processedUrls / (elapsed / 1000);
    const remaining = this.stats.totalUrls - this.stats.processedUrls;
    
    return rate > 0 ? (remaining / rate) * 1000 : undefined;
  }
  
  /**
   * Utility: delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}