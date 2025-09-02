/**
 * Scraping Strategy Interfaces
 * Define contracts for different execution models
 */

export interface ScraperContext {
  abortSignal?: AbortSignal;
  onProgress?: (progress: ProgressUpdate) => void;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, meta?: any) => void;
  };
}

export interface ProgressUpdate {
  total: number;
  completed: number;
  failed: number;
  current?: string;
  percentage: number;
  estimatedTimeRemaining?: number;
}

export interface ExecutionResult<T> {
  success: T[];
  failed: Array<{
    url: string;
    error: Error;
    retries: number;
  }>;
  skipped: string[];
}

/**
 * Base interface for all scraping strategies
 */
export interface IScrapingStrategy<T> {
  /**
   * Execute the scraping strategy
   * @param urls - URLs to process
   * @param processor - Function to process each URL
   * @param context - Execution context
   */
  execute(
    urls: string[],
    processor: (url: string) => Promise<T>,
    context?: ScraperContext
  ): Promise<ExecutionResult<T>>;
  
  /**
   * Stop the current execution
   */
  stop(): void;
  
  /**
   * Get current execution stats
   */
  getStats(): ExecutionStats;
}

export interface ExecutionStats {
  startTime: number;
  endTime?: number;
  totalUrls: number;
  processedUrls: number;
  successfulUrls: number;
  failedUrls: number;
  averageProcessingTime: number;
  currentThroughput: number; // URLs per second
}

/**
 * Configuration for strategy execution
 */
export interface StrategyConfig {
  // Retry configuration
  maxRetries?: number;
  retryDelay?: number;
  retryBackoff?: 'linear' | 'exponential';
  
  // Timeout configuration
  timeout?: number;
  
  // Error handling
  continueOnError?: boolean;
  errorThreshold?: number; // Stop after N errors
  
  // Performance
  warmupDelay?: number; // Initial delay before starting
}