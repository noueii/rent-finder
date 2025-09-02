import { ScraperError, ScraperErrorCode } from '~/types/scraper';

export class ScraperErrorHandler {
  private errorCounts: Map<string, number> = new Map();
  private errorTimestamps: Map<string, Date[]> = new Map();
  private readonly maxErrorsPerWindow: number;
  private readonly windowSizeMs: number;

  constructor(maxErrorsPerWindow: number = 10, windowSizeMinutes: number = 5) {
    this.maxErrorsPerWindow = maxErrorsPerWindow;
    this.windowSizeMs = windowSizeMinutes * 60 * 1000;
  }

  /**
   * Record an error and check if we should stop
   */
  recordError(error: ScraperError, context?: string): boolean {
    const key = `${error.code}:${context || 'global'}`;
    
    // Update error count
    const count = (this.errorCounts.get(key) || 0) + 1;
    this.errorCounts.set(key, count);
    
    // Update timestamps
    const timestamps = this.errorTimestamps.get(key) || [];
    timestamps.push(new Date());
    this.errorTimestamps.set(key, timestamps);
    
    // Clean old timestamps
    this.cleanOldTimestamps(key);
    
    // Check if we should stop
    return this.shouldStop(key);
  }

  /**
   * Check if we should stop due to too many errors
   */
  private shouldStop(key: string): boolean {
    const timestamps = this.errorTimestamps.get(key) || [];
    return timestamps.length >= this.maxErrorsPerWindow;
  }

  /**
   * Clean timestamps outside the window
   */
  private cleanOldTimestamps(key: string): void {
    const timestamps = this.errorTimestamps.get(key) || [];
    const cutoff = new Date(Date.now() - this.windowSizeMs);
    
    const filtered = timestamps.filter(ts => ts > cutoff);
    
    if (filtered.length === 0) {
      this.errorTimestamps.delete(key);
      this.errorCounts.delete(key);
    } else {
      this.errorTimestamps.set(key, filtered);
    }
  }

  /**
   * Get error statistics
   */
  getStats(): Map<string, { count: number; recentErrors: number }> {
    const stats = new Map<string, { count: number; recentErrors: number }>();
    
    this.errorCounts.forEach((count, key) => {
      this.cleanOldTimestamps(key);
      const recentErrors = (this.errorTimestamps.get(key) || []).length;
      
      stats.set(key, { count, recentErrors });
    });
    
    return stats;
  }

  /**
   * Reset all error tracking
   */
  reset(): void {
    this.errorCounts.clear();
    this.errorTimestamps.clear();
  }

  /**
   * Determine retry strategy based on error
   */
  static getRetryStrategy(error: ScraperError): {
    shouldRetry: boolean;
    delayMs: number;
    maxRetries: number;
  } {
    switch (error.code) {
      case ScraperErrorCode.RATE_LIMIT:
        return {
          shouldRetry: true,
          delayMs: 60000, // 1 minute
          maxRetries: 5,
        };
        
      case ScraperErrorCode.TIMEOUT:
        return {
          shouldRetry: true,
          delayMs: 5000, // 5 seconds
          maxRetries: 3,
        };
        
      case ScraperErrorCode.NETWORK_ERROR:
        return {
          shouldRetry: true,
          delayMs: 10000, // 10 seconds
          maxRetries: 3,
        };
        
      case ScraperErrorCode.PARSE_ERROR:
        return {
          shouldRetry: false,
          delayMs: 0,
          maxRetries: 0,
        };
        
      case ScraperErrorCode.VALIDATION_ERROR:
        return {
          shouldRetry: false,
          delayMs: 0,
          maxRetries: 0,
        };
        
      case ScraperErrorCode.BLOCKED:
        return {
          shouldRetry: false,
          delayMs: 0,
          maxRetries: 0,
        };
        
      case ScraperErrorCode.NOT_FOUND:
        return {
          shouldRetry: false,
          delayMs: 0,
          maxRetries: 0,
        };
        
      default:
        return {
          shouldRetry: true,
          delayMs: 5000,
          maxRetries: 2,
        };
    }
  }

  /**
   * Format error for logging
   */
  static formatError(error: ScraperError, context?: any): string {
    const parts = [
      `[${error.code}] ${error.message}`,
    ];
    
    if (context) {
      parts.push(`Context: ${JSON.stringify(context)}`);
    }
    
    if (error.details) {
      if (error.details instanceof Error) {
        parts.push(`Details: ${error.details.message}`);
        if (error.details.stack) {
          parts.push(`Stack: ${error.details.stack}`);
        }
      } else {
        parts.push(`Details: ${JSON.stringify(error.details)}`);
      }
    }
    
    return parts.join('\n');
  }

  /**
   * Create a scraper error from an unknown error
   */
  static createError(error: unknown, code?: ScraperErrorCode): ScraperError {
    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('ECONNREFUSED')) {
        return {
          code: ScraperErrorCode.NETWORK_ERROR,
          message: 'Connection refused',
          details: error,
          retryable: true,
        };
      }
      
      if (error.message.includes('ETIMEDOUT')) {
        return {
          code: ScraperErrorCode.TIMEOUT,
          message: 'Request timed out',
          details: error,
          retryable: true,
        };
      }
      
      if (error.message.includes('429') || error.message.toLowerCase().includes('rate limit')) {
        return {
          code: ScraperErrorCode.RATE_LIMIT,
          message: 'Rate limit exceeded',
          details: error,
          retryable: true,
        };
      }
      
      return {
        code: code || ScraperErrorCode.UNKNOWN,
        message: error.message,
        details: error,
        retryable: code !== ScraperErrorCode.PARSE_ERROR && code !== ScraperErrorCode.VALIDATION_ERROR,
      };
    }
    
    return {
      code: code || ScraperErrorCode.UNKNOWN,
      message: String(error),
      details: error,
      retryable: false,
    };
  }
}